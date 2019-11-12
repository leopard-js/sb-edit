import Project from "../../Project";
import Script from "../../Script";
import Block from "../../Block";
import * as BlockInput from "../../BlockInput";
import { OpCode } from "../../OpCode";

import * as prettier from "prettier";

const config = {
  sjsImport: "https://pulljosh.github.io/scratch-js/scratch-js/index.mjs"
};

function formatJS(str: string, prettierConfig: prettier.Options = {}) {
  // tslint:disable-next-line:object-literal-sort-keys
  const formatted = prettier.format(str, { ...prettierConfig, parser: "babel" });
  return formatted;
}

function triggerInitCode(script: Script) {
  const hat = script.hat;

  if (hat === null) {
    return null;
  }

  const triggerInitStr = (name: string, options?: object) =>
    `new Trigger(Trigger.${name}${options ? `, ${JSON.stringify(options)}` : ""}, this.${script.name}.bind(this))`;

  switch (hat.opcode) {
    case OpCode.event_whenflagclicked:
      return triggerInitStr("GREEN_FLAG");
    case OpCode.event_whenkeypressed:
      return triggerInitStr("KEY_PRESSED", { key: hat.inputs.KEY_OPTION.value });
    case OpCode.event_whenbroadcastreceived:
      return triggerInitStr("BROADCAST", { name: hat.inputs.BROADCAST_OPTION.value });
    default:
      return null;
  }
}

function uniqueNameGenerator(usedNames: string[] = []) {
  function uniqueName(name) {
    if (!usedNames.includes(name)) {
      usedNames.push(name);
      return name;
    }

    const numResult = /\d+$/.exec(name);
    if (numResult === null) {
      return uniqueName(name + "2");
    }
    return uniqueName(name.slice(0, numResult.index) + (parseInt(numResult[0], 10) + 1));
  }

  // Creates hybrid function/object
  uniqueName.usedNames = usedNames;
  uniqueName.branch = function() {
    return uniqueNameGenerator(this.usedNames);
  };
  return uniqueName;
}

function camelCase(name: string, upper: boolean = false) {
  const validChars = /[^a-zA-Z0-9]/;
  let parts = name.split(validChars);
  parts = parts.map(part => part.trim());
  parts = parts.map(part => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase());
  if (!upper) {
    parts[0] = parts[0].toLowerCase();
  }

  return parts.join("");
}

function inputToJS(input: BlockInput.Any): string {
  switch (input.type) {
    case "block":
      return blockToJS(input.value as Block);
    case "blocks":
      return input.value.map(block => blockToJS(block as Block)).join(";\n");
    case "color":
      const { r, g, b } = input.value;
      const toHexDigits = (n: number) => {
        if (n < 16) {
          return "0" + n.toString(16);
        }
        return n.toString(16);
      };
      return JSON.stringify(`#${toHexDigits(r)}${toHexDigits(g)}${toHexDigits(b)}`);
    default:
      return JSON.stringify(input.value);
  }
}

function blockToJS(block: Block): string {
  switch (block.opcode) {
    case OpCode.motion_movesteps:
      return `this.move(${inputToJS(block.inputs.STEPS)})`;
    case OpCode.motion_turnright:
      return `this.direction += (${inputToJS(block.inputs.DEGREES)})`;
    case OpCode.motion_turnleft:
      return `this.direction -= (${inputToJS(block.inputs.DEGREES)})`;
    case OpCode.motion_gotoxy:
      return `this.goto((${inputToJS(block.inputs.X)}), (${inputToJS(block.inputs.Y)}))`;
    case OpCode.motion_glidesecstoxy:
      return `yield* this.glide((${inputToJS(block.inputs.SECS)}), (${inputToJS(block.inputs.X)}), (${inputToJS(
        block.inputs.Y
      )}))`;
    case OpCode.motion_pointindirection:
      return `this.direction = (${inputToJS(block.inputs.DIRECTION)})`;
    case OpCode.motion_changexby:
      return `this.x += (${inputToJS(block.inputs.DX)})`;
    case OpCode.motion_setx:
      return `this.x = (${inputToJS(block.inputs.X)})`;
    case OpCode.motion_changeyby:
      return `this.y += (${inputToJS(block.inputs.DY)})`;
    case OpCode.motion_sety:
      return `this.y = (${inputToJS(block.inputs.Y)})`;
    case OpCode.motion_xposition:
      return `this.x`;
    case OpCode.motion_yposition:
      return `this.y`;
    case OpCode.motion_direction:
      return `this.direction`;
    case OpCode.looks_switchcostumeto:
      return `this.costume = (${inputToJS(block.inputs.COSTUME)})`;
    case OpCode.looks_nextcostume:
      return `this.costume += 1;`;
    case OpCode.looks_changesizeby:
      return `this.size += (${inputToJS(block.inputs.CHANGE)})`;
    case OpCode.looks_setsizeto:
      return `this.size = (${inputToJS(block.inputs.SIZE)})`;
    case OpCode.looks_show:
      return `this.visible = true`;
    case OpCode.looks_hide:
      return `this.visible = false`;
    case OpCode.looks_costumenumbername:
      switch (block.inputs.NUMBER_NAME.value) {
        case "name":
          return `this.costume.name`;
        case "number":
        default:
          return `this.costumeNumber`;
      }
    case OpCode.looks_size:
      return `this.size`;
    case OpCode.sound_playuntildone:
      return `yield* this.playSound(/* TODO: Get url for sound ${block.inputs.SOUND_MENU} */)`;
    case OpCode.sound_play:
      return `this.playSound(/* TODO: Get url for sound ${block.inputs.SOUND_MENU} */)`;
    case OpCode.sound_stopallsounds:
      return `this.stopAllSounds()`;
    case OpCode.event_broadcast:
      return `this.broadcast(${inputToJS(block.inputs.BROADCAST_INPUT)})`;
    case OpCode.event_broadcastandwait:
      return `yield* this.broadcastAndWait(${inputToJS(block.inputs.BROADCAST_INPUT)})`;
    case OpCode.control_wait:
      return `yield* this.wait(${inputToJS(block.inputs.DURATION)})`;
    case OpCode.control_repeat:
      return `for (let i = 0; i < (${inputToJS(block.inputs.TIMES)}); i++) {
        ${inputToJS(block.inputs.SUBSTACK)};
        yield;
      }`;
    case OpCode.control_forever:
      return `while (true) {
        ${inputToJS(block.inputs.SUBSTACK)};
        yield;
      }`;
    case OpCode.control_if:
      return `if (${inputToJS(block.inputs.CONDITION)}) {
        ${inputToJS(block.inputs.SUBSTACK)}
      }`;
    case OpCode.control_wait_until:
      return `while (!(${inputToJS(block.inputs.CONDITION)})) { yield; }`;
    case OpCode.control_repeat_until:
      return `while(!(${inputToJS(block.inputs.CONDITION)})) {
        ${inputToJS(block.inputs.SUBSTACK)}
      }`;
    case OpCode.sensing_touchingobject:
      switch (block.inputs.TOUCHINGOBJECTMENU.value) {
        case "_mouse_":
          return `/* TODO: Create touching "mouse" option */`;
        default:
          return `this.touching(${inputToJS(block.inputs.TOUCHINGOBJECTMENU)})`;
      }
    case OpCode.sensing_keypressed:
      return `this.keyPressed(${inputToJS(block.inputs.KEY_OPTION)})`;
    case OpCode.sensing_mousex:
      return `this.mouse.x`;
    case OpCode.sensing_mousey:
      return `this.mouse.y`;
    case OpCode.sensing_timer:
      return `this.timer`;
    case OpCode.sensing_resettimer:
      return `this.restartTimer()`;
    case OpCode.sensing_current:
      switch (block.inputs.CURRENTMENU.value) {
        case "YEAR":
          return `(new Date().getFullYear())`;
        case "MONTH":
          return `(new Date().getMonth() + 1)`;
        case "DATE":
          return `(new Date().getDate())`;
        case "DAYOFWEEK":
          return `(new Date().getDay() + 1)`;
        case "HOUR":
          return `(new Date().getHours())`;
        case "MINUTE":
          return `(new Date().getMinutes())`;
        case "SECOND":
          return `(new Date().getSeconds())`;
      }
    case OpCode.sensing_dayssince2000:
      return `(((new Date().getTime() - new Date(2000, 0, 1)) / 1000 / 60 + new Date().getTimezoneOffset()) / 60 / 24)`;
    case OpCode.sensing_username:
      return `(/* no username */ "")`;
    case OpCode.operator_add:
      return `((${inputToJS(block.inputs.NUM1)}) + (${inputToJS(block.inputs.NUM2)}))`;
    case OpCode.operator_subtract:
      return `((${inputToJS(block.inputs.NUM1)}) - (${inputToJS(block.inputs.NUM2)}))`;
    case OpCode.operator_multiply:
      return `((${inputToJS(block.inputs.NUM1)}) * (${inputToJS(block.inputs.NUM2)}))`;
    case OpCode.operator_divide:
      return `((${inputToJS(block.inputs.NUM1)}) / (${inputToJS(block.inputs.NUM2)}))`;
    case OpCode.operator_random:
      return `this.random(${inputToJS(block.inputs.FROM)}, ${inputToJS(block.inputs.TO)})`;
    case OpCode.operator_gt:
      return `((${inputToJS(block.inputs.OPERAND1)}) > (${inputToJS(block.inputs.OPERAND2)}))`;
    case OpCode.operator_lt:
      return `((${inputToJS(block.inputs.OPERAND1)}) < (${inputToJS(block.inputs.OPERAND2)}))`;
    case OpCode.operator_equals:
      return `((${inputToJS(block.inputs.OPERAND1)}) == (${inputToJS(block.inputs.OPERAND2)}))`;
    case OpCode.operator_and:
      return `((${inputToJS(block.inputs.OPERAND1)}) && (${inputToJS(block.inputs.OPERAND2)}))`;
    case OpCode.operator_or:
      return `((${inputToJS(block.inputs.OPERAND1)}) || (${inputToJS(block.inputs.OPERAND2)}))`;
    case OpCode.operator_not:
      return `(!(${inputToJS(block.inputs.OPERAND)}))`;
    case OpCode.operator_join:
      return `("" + (${inputToJS(block.inputs.STRING1)}) + (${inputToJS(block.inputs.STRING2)}))`;
    case OpCode.operator_letter_of:
      return `((${inputToJS(block.inputs.STRING)})[${inputToJS(block.inputs.LETTER)}])`;
    case OpCode.operator_length:
      return `(${inputToJS(block.inputs.STRING)}).length`;
    case OpCode.operator_contains:
      return `(${inputToJS(block.inputs.STRING1)}).includes(${inputToJS(block.inputs.STRING2)})`;
    case OpCode.operator_mod:
      return `((${inputToJS(block.inputs.NUM1)}) % (${inputToJS(block.inputs.NUM2)}))`;
    case OpCode.operator_round:
      return `Math.round(${inputToJS(block.inputs.NUM)})`;
    case OpCode.operator_mathop:
      switch (block.inputs.OPERATOR.value) {
        case "abs":
          return `Math.abs(${inputToJS(block.inputs.NUM)})`;
        case "floor":
          return `Math.floor(${inputToJS(block.inputs.NUM)})`;
        case "ceiling":
          return `Math.ceil(${inputToJS(block.inputs.NUM)})`;
        case "sqrt":
          return `Math.sqrt(${inputToJS(block.inputs.NUM)})`;
        case "sin":
          return `Math.sin(this.scratchToRad(${inputToJS(block.inputs.NUM)}))`;
        case "cos":
          return `Math.cos(this.scratchToRad(${inputToJS(block.inputs.NUM)}))`;
        case "tan":
          return `Math.tan(this.scratchToRad(${inputToJS(block.inputs.NUM)}))`;
        case "asin":
          return `this.radToScratch(Math.asin(${inputToJS(block.inputs.NUM)}))`;
        case "acos":
          return `this.radToScratch(Math.acos(${inputToJS(block.inputs.NUM)}))`;
        case "atan":
          return `this.radToScratch(Math.atan(${inputToJS(block.inputs.NUM)}))`;
        case "ln":
          return `Math.log(${inputToJS(block.inputs.NUM)})`;
        case "log":
          return `Math.log10(${inputToJS(block.inputs.NUM)})`;
        case "e ^":
          return `(Math.E ** (${inputToJS(block.inputs.NUM)}))`;
        case "10 ^":
          return `(10 ** (${inputToJS(block.inputs.NUM)}))`;
      }
      break;
    case OpCode.data_variable:
      // TODO: Detect variable scope (for all variable types)
      // It might make sense for this to happen at the library level rather than during compilation
      // (Consider possibility of dynamic variable names with hacked blocks)
      return `g.get(${inputToJS(block.inputs.VARIABLE)})`;
    case OpCode.data_setvariableto:
      return `g.set((${inputToJS(block.inputs.VARIABLE)}), (${inputToJS(block.inputs.VALUE)}))`;
    case OpCode.data_changevariableby:
      return `g.change((${inputToJS(block.inputs.VARIABLE)}), (${inputToJS(block.inputs.VALUE)}))`;
    case OpCode.data_showvariable:
      return `g.show(${inputToJS(block.inputs.VARIABLE)})`;
    case OpCode.data_hidevariable:
      return `g.hide(${inputToJS(block.inputs.VARIABLE)})`;
    case OpCode.data_listcontents:
      return `g.get(${inputToJS(block.inputs.LIST)})`;
    case OpCode.pen_clear:
      return `this.clearPen()`;
    case OpCode.pen_stamp:
      return `this.stamp()`;
    case OpCode.pen_penDown:
      return `this.penDown = true`;
    case OpCode.pen_penUp:
      return `this.penDown = false`;
    case OpCode.pen_setPenColorToColor:
      return `this.penColor = (${inputToJS(block.inputs.COLOR)})`;
    case OpCode.pen_setPenSizeTo:
      return `this.penSize = (${inputToJS(block.inputs.SIZE)})`;
    case OpCode.pen_changePenSizeBy:
      return `this.penSize += (${inputToJS(block.inputs.SIZE)})`;
    default:
      return `/* TODO: Implement ${block.opcode} */`;
  }
}

export default function toScratchJS(
  project: Project,
  prettierConfig?: prettier.Options
): { [fileName: string]: string } {
  // Update all identifying names in the project to be unique
  // Names changed first are less likely to be ugly
  const uniqueName = uniqueNameGenerator(["g", "s"]);

  for (const target of [project.stage, ...project.sprites]) {
    target.setName(uniqueName(camelCase(target.name, true)));

    const uniqueCostumeName = uniqueNameGenerator();
    for (const costume of target.costumes) {
      costume.setName(uniqueCostumeName(camelCase(costume.name)));
    }

    const uniqueSoundName = uniqueNameGenerator();
    for (const sound of target.sounds) {
      sound.setName(uniqueSoundName(camelCase(sound.name)));
    }

    let uniqueVariableName: typeof uniqueName;
    if (target.isStage) {
      uniqueVariableName = uniqueName;
    } else {
      // Don't use existing names, but don't save to global "used" list either:
      uniqueVariableName = uniqueName.branch();
    }
    for (const list of target.lists) {
      list.setName(uniqueVariableName(camelCase(list.name)));
    }

    for (const variable of target.variables) {
      variable.setName(uniqueVariableName(camelCase(variable.name)));
    }

    const uniqueScriptName = uniqueNameGenerator();
    for (const script of target.scripts) {
      script.setName(uniqueScriptName(camelCase(script.name)));
    }
  }

  let files: { [fileName: string]: string } = {
    "index.mjs": `
      import { Project } from '${config.sjsImport}';

      import Stage from './Stage/Stage.mjs';
      ${project.sprites.map(
        sprite => `
        import ${sprite.name} from './${sprite.name}/${sprite.name}.mjs';
      `
      )}

      const stage = new Stage();

      const sprites = [
        ${project.sprites
          .map(
            sprite => `
          new ${sprite.name}({
            x: ${sprite.x},
            y: ${sprite.y},
            direction: ${sprite.direction},
            costumeNumber: ${sprite.costumeNumber},
            size: ${sprite.size},
            visible: ${sprite.visible}
          })
        `
          )
          .join(",\n")}
      ];

      const project = new Project(stage, sprites);

      project.run();
    `
  };

  for (const sprite of project.sprites) {
    files[`${sprite.name}/${sprite.name}.mjs`] = `
      import { Sprite, Trigger, Costume } from '${config.sjsImport}';

      export default class ${sprite.name} extends Sprite {
        constructor(...args) {
          super(...args);

          this.costumes = [
            ${sprite.costumes
              .map(
                costume =>
                  `new Costume("${costume.name}", "./${sprite.name}/costumes/${costume.name}.${
                    costume.ext
                  }", ${JSON.stringify({ x: costume.centerX, y: costume.centerY })})`
              )
              .join(",\n")}
          ];

          this.triggers = [
            ${sprite.scripts
              .map(triggerInitCode)
              .filter(trigger => trigger !== null)
              .join(",\n")}
          ];
        }

        ${sprite.scripts
          .map(script => {
            return `
            * ${script.name}(g, s) {
              ${script.body.map(blockToJS).join(";\n")}
            }
        `;
          })
          .join("\n\n")}
      }
    `;
  }

  Object.keys(files).forEach(fileName => {
    files[fileName] = formatJS(files[fileName], prettierConfig);
  });

  return files;
}
