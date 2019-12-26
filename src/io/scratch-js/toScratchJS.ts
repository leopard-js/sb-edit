import Project from "../../Project";
import Script from "../../Script";
import Block from "../../Block";
import * as BlockInput from "../../BlockInput";
import { OpCode } from "../../OpCode";

import * as prettier from "prettier";
import Target from "../../Target";

function triggerInitCode(script: Script) {
  const hat = script.hat;

  if (hat === null) {
    return null;
  }

  const triggerInitStr = (name: string, options?: object) =>
    `new Trigger(Trigger.${name}${options ? `, ${JSON.stringify(options)}` : ""}, this.${script.name})`;

  switch (hat.opcode) {
    case OpCode.event_whenflagclicked:
      return triggerInitStr("GREEN_FLAG");
    case OpCode.event_whenkeypressed:
      return triggerInitStr("KEY_PRESSED", { key: hat.inputs.KEY_OPTION.value });
    case OpCode.event_whenthisspriteclicked:
      return triggerInitStr("CLICKED");
    case OpCode.event_whenbroadcastreceived:
      return triggerInitStr("BROADCAST", { name: hat.inputs.BROADCAST_OPTION.value });
    case OpCode.control_start_as_clone:
      return triggerInitStr("CLONE_START");
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

  let result = parts.join("");

  // A blank string is no good
  if (result.length === 0) {
    result = "_";
  }

  // Variable names cannot start with a number
  if (!isNaN(parseInt(result[0], 10))) {
    result = "_" + result;
  }

  return result;
}

interface ToScratchJSOptions {
  scratchJSURL: string;
  getTargetURL: (info: { name: string; from: "index" | "target" }) => string;
  getAssetURL: (info: { type: "costume" | "sound"; target: string; name: string; md5: string; ext: string }) => string;
  indexURL: string;
  autoplay: boolean;
}
export default function toScratchJS(
  options: Partial<ToScratchJSOptions> = {},
  prettierConfig: prettier.Options = {}
): { [fileName: string]: string } {
  const project: Project = this;

  const defaultOptions: ToScratchJSOptions = {
    scratchJSURL: "https://pulljosh.github.io/scratch-js/scratch-js/index.mjs",
    getTargetURL: ({ name, from }) => {
      switch (from) {
        case "index":
          return `./${name}/${name}.mjs`;
        case "target":
          return `../${name}/${name}.mjs`;
      }
    },
    getAssetURL: ({ type, target, name, md5, ext }) => {
      switch (type) {
        case "costume":
          return `./${target}/costumes/${name}.${ext}`;
        case "sound":
          return `./${target}/sounds/${name}.${ext}`;
      }
    },
    indexURL: "./index.mjs",
    autoplay: true
  };
  options = { ...defaultOptions, ...options };

  // Update all identifying names in the project to be unique
  // Names changed first are less likely to be ugly
  const uniqueName = uniqueNameGenerator();

  let targetNameMap = {};
  let customBlockArgNameMap: Map<Script, { [key: string]: string }> = new Map();
  let variableNameMap: Map<Target, { [key: string]: string }> = new Map();
  let costumeNameMap: Map<Target, { [key: string]: string }> = new Map();

  for (const target of [project.stage, ...project.sprites]) {
    const newTargetName = uniqueName(camelCase(target.name, true));
    targetNameMap[target.name] = newTargetName;
    target.setName(newTargetName);

    const uniqueCostumeName = uniqueNameGenerator();

    const cNameMap = {};
    costumeNameMap.set(target, cNameMap);

    for (const costume of target.costumes) {
      const newName = uniqueCostumeName(camelCase(costume.name));
      cNameMap[costume.name] = newName;
      costume.setName(newName);
    }

    const uniqueSoundName = uniqueNameGenerator();
    for (const sound of target.sounds) {
      sound.setName(uniqueSoundName(camelCase(sound.name)));
    }

    let uniqueVariableName = uniqueName.branch();

    const varNameMap = {};
    variableNameMap.set(target, varNameMap);

    for (const list of target.lists) {
      const newName = uniqueVariableName(camelCase(list.name));
      varNameMap[list.name] = newName;
      list.setName(newName);
    }

    for (const variable of target.variables) {
      const newName = uniqueVariableName(camelCase(variable.name));
      varNameMap[variable.name] = newName;
      variable.setName(newName);
    }

    const uniqueScriptName = uniqueNameGenerator([
      "stage",
      "direction",
      "x",
      "y",
      "penDown",
      "penColor",
      "vars",
      "costumeNumber",
      "costume",
      "mouse",
      "timer",
      "triggers",
      "costumes",
      "size",
      "visible",
      "penSize"
    ]);
    for (const script of target.scripts) {
      script.setName(uniqueScriptName(camelCase(script.name)));

      const argNameMap = {};
      customBlockArgNameMap.set(script, argNameMap);

      const uniqueParamName = uniqueName.branch();
      for (const block of script.blocks) {
        if (block.opcode === OpCode.procedures_definition) {
          for (const argument of block.inputs.ARGUMENTS.value) {
            if (argument.type !== "label") {
              const newName = uniqueParamName(camelCase(argument.name));
              argNameMap[argument.name] = newName;
              argument.name = newName;
            }
          }
        }
      }
    }
  }

  function scriptToJS(script: Script, target: Target): string {
    const body = script.body.map(blockToJS).join(";\n");
    if (script.hat && script.hat.opcode === OpCode.procedures_definition) {
      return `
        * ${script.name}(${script.hat.inputs.ARGUMENTS.value
        .filter(arg => arg.type !== "label")
        .map(arg => arg.name)
        .join(", ")}) {
          ${body}
        }
      `;
    }
    return `
      * ${script.name}() {
        ${body}
      }
    `;

    function inputToJS(input: BlockInput.Any): string {
      // TODO: Right now, inputs can be completely undefined if imported from
      // the .sb3 format (because sb3 is weird). This little check will replace
      // undefined inputs with the value `null`. In theory, this should
      // eventually be removed when the sb3 import script is improved.
      if (input === undefined) {
        return "null";
      }

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
          const asNum = parseFloat(input.value as string);
          if (!isNaN(asNum)) {
            return JSON.stringify(asNum);
          }
          return JSON.stringify(input.value);
      }
    }

    function blockToJS(block: Block): string {
      const warp = script.hat && script.hat.opcode === OpCode.procedures_definition && script.hat.inputs.WARP.value;

      // If the block contains a variable or list dropdown,
      // get the code to grab that variable now for convenience
      let varName: string = null;
      let selectedVarSource: string = null;
      if ("VARIABLE" in block.inputs) {
        varName = block.inputs.VARIABLE.value.toString();
      }
      if ("LIST" in block.inputs) {
        varName = block.inputs.LIST.value.toString();
      }
      if (varName !== null) {
        const spriteVars = variableNameMap.get(target);
        if (varName in spriteVars) {
          selectedVarSource = `this.vars.${spriteVars[varName]}`;
        } else {
          const stageVars = variableNameMap.get(project.stage);
          selectedVarSource = `this.stage.vars.${stageVars[varName]}`;
        }
      }

      const stage = "this" + (target.isStage ? "" : ".stage");

      switch (block.opcode) {
        case OpCode.motion_movesteps:
          return `this.move(${inputToJS(block.inputs.STEPS)})`;
        case OpCode.motion_turnright:
          return `this.direction += (${inputToJS(block.inputs.DEGREES)})`;
        case OpCode.motion_turnleft:
          return `this.direction -= (${inputToJS(block.inputs.DEGREES)})`;
        case OpCode.motion_goto:
          switch (block.inputs.TO.value) {
            case "_random_":
              return `this.goto(this.random(-240, 240), this.random(-180, 180))`;
            case "_mouse_":
              return `this.goto(this.mouse.x, this.mouse.y)`;
            default: {
              const sprite = `(this.sprites[${JSON.stringify(targetNameMap[block.inputs.TO.value])}])`;
              return `this.goto(${sprite}.x, ${sprite}.y)`;
            }
          }
        case OpCode.motion_gotoxy:
          return `this.goto((${inputToJS(block.inputs.X)}), (${inputToJS(block.inputs.Y)}))`;
        case OpCode.motion_glideto:
          switch (block.inputs.TO.value) {
            case "_random_":
              return `yield* this.glide((${inputToJS(
                block.inputs.SECS
              )}), this.random(-240, 240), this.random(-180, 180))`;
            case "_mouse_":
              return `yield* this.glide((${inputToJS(block.inputs.SECS)}), this.mouse.x, this.mouse.y)`;
            default: {
              const sprite = `(this.sprites[${JSON.stringify(targetNameMap[block.inputs.TO.value])}])`;
              return `yield* this.glide((${inputToJS(block.inputs.SECS)}), ${sprite}.x, ${sprite}.y)`;
            }
          }
        case OpCode.motion_glidesecstoxy:
          return `yield* this.glide((${inputToJS(block.inputs.SECS)}), (${inputToJS(block.inputs.X)}), (${inputToJS(
            block.inputs.Y
          )}))`;
        case OpCode.motion_pointindirection:
          return `this.direction = (${inputToJS(block.inputs.DIRECTION)})`;
        case OpCode.motion_pointtowards:
          switch (block.inputs.TOWARDS.value) {
            case "_mouse_":
              return `this.direction = this.radToScratch(Math.atan2(this.mouse.y - this.y, this.mouse.x - this.x))`;
            default: {
              const sprite = `(this.sprites[${JSON.stringify(targetNameMap[block.inputs.TOWARDS.value])}])`;
              return `this.direction = this.radToScratch(Math.atan2(${sprite}.y - this.y, ${sprite}.x - this.x))`;
            }
          }
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
        case OpCode.looks_sayforsecs:
          return `yield* this.sayAndWait((${inputToJS(block.inputs.MESSAGE)}), (${inputToJS(block.inputs.SECS)}))`;
        case OpCode.looks_say:
          return `this.say(${inputToJS(block.inputs.MESSAGE)})`;
        case OpCode.looks_thinkforsecs:
          return `yield* this.thinkAndWait((${inputToJS(block.inputs.MESSAGE)}), (${inputToJS(block.inputs.SECS)}))`;
        case OpCode.looks_think:
          return `this.think(${inputToJS(block.inputs.MESSAGE)})`;
        case OpCode.looks_switchcostumeto:
          return `this.costume = (${JSON.stringify(costumeNameMap.get(target)[block.inputs.COSTUME.value])})`;
        case OpCode.looks_nextcostume:
          return `this.costumeNumber += 1`;
        case OpCode.looks_switchbackdropto:
          // TODO: Next backdrop, previous backdrop, etc...
          return `${stage}.costume = (${JSON.stringify(
            costumeNameMap.get(project.stage)[block.inputs.BACKDROP.value]
          )})`;
        case OpCode.looks_nextbackdrop:
          return `${stage}.costume += 1`;
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
        case OpCode.looks_backdropnumbername:
          switch (block.inputs.NUMBER_NAME.value) {
            case "name":
              return `${stage}.costume.name`;
            case "number":
            default:
              return `${stage}.costumeNumber`;
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
            ${warp ? "" : "yield;"}
          }`;
        case OpCode.control_forever:
          return `while (true) {
            ${inputToJS(block.inputs.SUBSTACK)};
            ${warp ? "" : "yield;"}
          }`;
        case OpCode.control_if:
          return `if (${inputToJS(block.inputs.CONDITION)}) {
            ${inputToJS(block.inputs.SUBSTACK)}
          }`;
        case OpCode.control_if_else:
          return `if (${inputToJS(block.inputs.CONDITION)}) {
            ${inputToJS(block.inputs.SUBSTACK)}
          } else {
            ${inputToJS(block.inputs.SUBSTACK2)}
          }`;
        case OpCode.control_wait_until:
          return `while (!(${inputToJS(block.inputs.CONDITION)})) { yield; }`;
        case OpCode.control_repeat_until:
          return `while(!(${inputToJS(block.inputs.CONDITION)})) {
            ${inputToJS(block.inputs.SUBSTACK)};
            ${warp ? "" : "yield;"}
          }`;
        case OpCode.control_create_clone_of:
          switch (block.inputs.CLONE_OPTION.value) {
            case "_myself_":
              return `this.createClone()`;
            default:
              return `this.sprites[${JSON.stringify(targetNameMap[block.inputs.CLONE_OPTION.value])}].createClone()`;
          }
        case OpCode.control_delete_this_clone:
          return `this.deleteThisClone()`;
        case OpCode.sensing_touchingobject:
          switch (block.inputs.TOUCHINGOBJECTMENU.value) {
            case "_mouse_":
              return `this.touching("mouse")`;
            default:
              return `this.touching(this.sprites[${JSON.stringify(
                targetNameMap[block.inputs.TOUCHINGOBJECTMENU.value]
              )}])`;
          }
        case OpCode.sensing_distanceto:
          switch (block.inputs.DISTANCETOMENU.value) {
            case "_mouse_":
              return `(Math.hypot(this.mouse.x - this.x, this.mouse.y - this.y))`;
            default: {
              const sprite = `this.sprites[${JSON.stringify(targetNameMap[block.inputs.DISTANCETOMENU.value])}]`;
              return `(Math.hypot(${sprite}.x - this.x, ${sprite}.y - this.y))`;
            }
          }
        case OpCode.sensing_keypressed:
          const getKeyName = key => {
            return key.split(" ")[0];
          };
          return `this.keyPressed(${JSON.stringify(getKeyName(block.inputs.KEY_OPTION.value))})`;
        case OpCode.sensing_mousedown:
          return `this.mouse.down`;
        case OpCode.sensing_mousex:
          return `this.mouse.x`;
        case OpCode.sensing_mousey:
          return `this.mouse.y`;
        case OpCode.sensing_timer:
          return `this.timer`;
        case OpCode.sensing_resettimer:
          return `this.restartTimer()`;
        case OpCode.sensing_of: {
          let propName: string;
          switch (block.inputs.PROPERTY.value) {
            case "x position":
              propName = "x";
              break;
            case "y position":
              propName = "y";
              break;
            case "direction":
              propName = "direction";
              break;
            case "costume #":
            case "backdrop #":
              propName = "costumeNumber";
              break;
            case "costume name":
            case "backdrop name":
              propName = "costume.name";
              break;
            case "size":
              propName = "size";
              break;
            case "volume":
              propName = null;
              break;
            default:
              let varOwner: Target = project.stage;
              if (block.inputs.OBJECT.value !== "_stage_") {
                varOwner = project.sprites.find(sprite => sprite.name === targetNameMap[block.inputs.OBJECT.value]);
              }
              propName = `vars[${JSON.stringify(variableNameMap.get(varOwner)[block.inputs.PROPERTY.value])}]`;
              break;
          }

          if (propName === null) {
            return `/* Cannot access property ${block.inputs.PROPERTY.value} of target */ null`;
          }

          let targetObj: string;
          if (block.inputs.OBJECT.value === "_stage_") {
            targetObj = `this.stage`;
          } else {
            targetObj = `this.sprites[${JSON.stringify(targetNameMap[block.inputs.OBJECT.value])}]`;
          }

          return `${targetObj}.${propName}`;
        }
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
          return `((${inputToJS(block.inputs.STRING)})[(${inputToJS(block.inputs.LETTER)}) - 1])`;
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
          return selectedVarSource;
        case OpCode.data_setvariableto:
          return `${selectedVarSource} = (${inputToJS(block.inputs.VALUE)})`;
        case OpCode.data_changevariableby:
          return `${selectedVarSource} += (${inputToJS(block.inputs.VALUE)})`;
        case OpCode.data_listcontents:
          return `${selectedVarSource}.join(" ")`;
        case OpCode.data_addtolist:
          return `${selectedVarSource}.push(${inputToJS(block.inputs.ITEM)})`;
        case OpCode.data_deleteoflist:
          // Supposed to be a numerical index, but can be
          // string "all" when sb2 converted to sb3 by Scratch
          if (block.inputs.INDEX.value === "all") {
            return `${selectedVarSource} = []`;
          }
          if (block.inputs.INDEX.value === "last") {
            return `${selectedVarSource}.splice(${selectedVarSource}.length - 1, 1)`;
          }
          return `${selectedVarSource}.splice(((${inputToJS(block.inputs.INDEX)}) - 1), 1)`;
        case OpCode.data_deletealloflist:
          return `${selectedVarSource} = []`;
        case OpCode.data_insertatlist:
          return `${selectedVarSource}.splice(((${inputToJS(block.inputs.INDEX)}) - 1), 0, (${inputToJS(
            block.inputs.ITEM
          )}))`;
        case OpCode.data_replaceitemoflist:
          return `${selectedVarSource}.splice(((${inputToJS(block.inputs.INDEX)}) - 1), 1, (${inputToJS(
            block.inputs.ITEM
          )}))`;
        case OpCode.data_itemoflist:
          if (block.inputs.INDEX.value === "last") {
            return `${selectedVarSource}[${selectedVarSource}.length - 1]`;
          }
          return `${selectedVarSource}[(${inputToJS(block.inputs.INDEX)}) - 1]`;
        case OpCode.data_itemnumoflist:
          return `(${selectedVarSource}.indexOf(${inputToJS(block.inputs.ITEM)}) + 1)`;
        case OpCode.data_lengthoflist:
          return `${selectedVarSource}.length`;
        case OpCode.data_listcontainsitem:
          return `${selectedVarSource}.includes(${inputToJS(block.inputs.ITEM)})`;
        case OpCode.procedures_call:
          return `yield* this.${
            // Get name of custom block script with given PROCCODE:
            target.scripts.find(
              script =>
                script.hat !== null &&
                script.hat.opcode === OpCode.procedures_definition &&
                script.hat.inputs.PROCCODE.value === block.inputs.PROCCODE.value
            ).name
          }(${block.inputs.INPUTS.value.map(inputToJS).join(", ")})`;
        case OpCode.argument_reporter_string_number:
        case OpCode.argument_reporter_boolean:
          return customBlockArgNameMap.get(script)[block.inputs.VALUE.value];
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
          return `/* TODO: Implement ${block.opcode} */ null`;
      }
    }
  }

  let files: { [fileName: string]: string } = {
    "index.html": `
      <!DOCTYPE html>
      <html>
        <body>
          <button id="greenFlag">Green Flag</button>
          <div id="project"></div>

          <script type="module">
            import project from ${JSON.stringify(options.indexURL)};
      
            project.attach("#project");
      
            document
              .querySelector("#greenFlag")
              .addEventListener("click", () => {
                project.greenFlag();
              });

            ${options.autoplay ? "// Autoplay\nproject.greenFlag();" : ""}
          </script>
        </body>
      </html>
    `,
    "index.mjs": `
      import { Project } from ${JSON.stringify(options.scratchJSURL)};

      ${[project.stage, ...project.sprites]
        .map(
          target =>
            `import ${target.name} from ${JSON.stringify(options.getTargetURL({ name: target.name, from: "index" }))};`
        )
        .join("\n")}

      const stage = new Stage(${JSON.stringify({ costumeNumber: project.stage.costumeNumber + 1 })});

      const sprites = {
        ${project.sprites
          .map(
            sprite =>
              `${sprite.name}: new ${sprite.name}(${JSON.stringify({
                x: sprite.x,
                y: sprite.y,
                direction: sprite.direction,
                costumeNumber: sprite.costumeNumber + 1,
                size: sprite.size,
                visible: sprite.visible
              })})`
          )
          .join(",\n")}
      };

      const project = new Project(stage, sprites);
      export default project;
    `
  };

  const optionalToNumber = value => {
    if (Array.isArray(value)) {
      return value.map(optionalToNumber);
    }
    if (typeof value !== "string") {
      return value;
    }
    const asNum = parseFloat(value);
    if (!isNaN(asNum)) {
      return asNum;
    }
    return value;
  };

  for (const target of [project.stage, ...project.sprites]) {
    files[`${target.name}/${target.name}.mjs`] = `
      import { ${target.isStage ? "Stage as StageBase" : "Sprite"}, Trigger, Costume } from '${options.scratchJSURL}';

      export default class ${target.name} extends ${target.isStage ? "StageBase" : "Sprite"} {
        constructor(...args) {
          super(...args);

          this.costumes = [
            ${target.costumes
              .map(
                costume =>
                  `new Costume(${JSON.stringify(costume.name)}, ${JSON.stringify(
                    options.getAssetURL({
                      type: "costume",
                      target: target.name,
                      name: costume.name,
                      md5: costume.md5,
                      ext: costume.ext
                    })
                  )}, ${JSON.stringify({
                    x: costume.centerX / costume.bitmapResolution,
                    y: costume.centerY / costume.bitmapResolution
                  })})`
              )
              .join(",\n")}
          ];

          this.triggers = [
            ${target.scripts
              .map(triggerInitCode)
              .filter(trigger => trigger !== null)
              .join(",\n")}
          ];

          ${[...target.variables, ...target.lists]
            .map(variable => `this.vars.${variable.name} = ${JSON.stringify(optionalToNumber(variable.value))};`)
            .join("\n")}
        }

        ${target.scripts
          .filter(script => script.hat !== null)
          .map(script => scriptToJS(script, target))
          .join("\n\n")}
      }
    `;
  }

  Object.keys(files).forEach(filepath => {
    files[filepath] = prettier.format(files[filepath], { ...prettierConfig, filepath });
  });

  return files;
}
