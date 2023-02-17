import Project from "../../Project";
import Script from "../../Script";
import Block, { BlockBase } from "../../Block";
import * as BlockInput from "../../BlockInput";
import { OpCode } from "../../OpCode";

import * as prettier from "prettier";
import Target from "../../Target";
import { List, Variable } from "../../Data";

type InputShape = "number" | "string" | "boolean" | "stack";

function uniqueNameGenerator(usedNames: string[] = []) {
  function uniqueName(name): string {
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

function camelCase(name: string, upper = false): string {
  const validChars = /[^a-zA-Z0-9]/;
  const ignoredChars = /[']/g;
  let parts = name.replace(ignoredChars, "").split(validChars);
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

interface ToLeopardOptions {
  leopardJSURL: string;
  leopardCSSURL: string;
  getTargetURL: (info: { name: string; from: "index" | "target" }) => string;
  getAssetURL: (info: { type: "costume" | "sound"; target: string; name: string; md5: string; ext: string }) => string;
  indexURL: string;
  autoplay: boolean;
}
export default function toLeopard(
  options: Partial<ToLeopardOptions> = {},
  prettierConfig: prettier.Options = {}
): { [fileName: string]: string } {
  const project: Project = this;

  const defaultOptions: ToLeopardOptions = {
    leopardJSURL: "https://unpkg.com/leopard@^1/dist/index.esm.js",
    leopardCSSURL: "https://unpkg.com/leopard@^1/dist/index.min.css",
    getTargetURL: ({ name, from }) => {
      switch (from) {
        case "index":
          return `./${name}/${name}.js`;
        case "target":
          return `../${name}/${name}.js`;
      }
    },
    getAssetURL: ({ type, target, name, ext }) => {
      switch (type) {
        case "costume":
          return `./${target}/costumes/${name}.${ext}`;
        case "sound":
          return `./${target}/sounds/${name}.${ext}`;
      }
    },
    indexURL: "./index.js",
    autoplay: true
  };
  options = { ...defaultOptions, ...options };

  // Update all identifying names in the project to be unique
  // Names changed first are less likely to be ugly
  const uniqueName = uniqueNameGenerator();

  let targetNameMap = {};
  let customBlockArgNameMap: Map<Script, { [key: string]: string }> = new Map();
  let variableNameMap: { [id: string]: string } = {}; // ID to unique (Leopard) name

  for (const target of [project.stage, ...project.sprites]) {
    const newTargetName = uniqueName(camelCase(target.name, true));
    targetNameMap[target.name] = newTargetName;
    target.setName(newTargetName);

    let uniqueVariableName = uniqueName.branch();

    for (const { id, name } of [...target.lists, ...target.variables]) {
      const newName = uniqueVariableName(camelCase(name));
      variableNameMap[id] = newName;
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
      "penSize",
      "askAndWait",
      "answer",
      "parent",
      "clones",
      "andClones",
      "effects",
      "rotationStyle",
      "moveAhead",
      "moveBehind",
      "toBoolean"
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

  // Cache a set of variables which are for the stage since whether or not a variable
  // is local has to be known every time any variable block is converted. We check the
  // stage because all non-stage variables are "for this sprite only" and because it's
  // marginally quicker to iterate over a shorter set than a longer one [an assumption
  // made about projects with primarily "for this sprite only" variables].
  const stageVariables: Set<string> = new Set();
  for (const variable of project.stage.variables) {
    stageVariables.add(variable.id);
  }
  for (const list of project.stage.lists) {
    stageVariables.add(list.id);
  }

  function staticBlockInputToLiteral(value: string | number | boolean | object): string {
    const asNum = Number(value as string);
    if (!isNaN(asNum) && value !== "") {
      return JSON.stringify(asNum);
    }
    return JSON.stringify(value);
  }

  function triggerInitCode(script: Script, target: Target): string | null {
    const hat = script.hat;

    if (hat === null) {
      return null;
    }

    const triggerInitStr = (name: string, options?: Partial<Record<string, string>>): string => {
      let optionsStr = "";
      if (options) {
        const optionValues = [];
        for (const [optionName, optionValue] of Object.entries(options)) {
          optionValues.push(`${optionName}: ${optionValue}`);
        }
        optionsStr = `, {${optionValues.join(", ")}}`;
      }
      return `new Trigger(Trigger.${name}${optionsStr}, this.${script.name})`;
    };

    switch (hat.opcode) {
      case OpCode.event_whenflagclicked:
        return triggerInitStr("GREEN_FLAG");
      case OpCode.event_whenkeypressed:
        return triggerInitStr("KEY_PRESSED", { key: JSON.stringify(hat.inputs.KEY_OPTION.value) });
      case OpCode.event_whenthisspriteclicked:
      case OpCode.event_whenstageclicked:
        return triggerInitStr("CLICKED");
      case OpCode.event_whenbroadcastreceived:
        return triggerInitStr("BROADCAST", { name: JSON.stringify(hat.inputs.BROADCAST_OPTION.value) });
      case OpCode.event_whengreaterthan: {
        const valueInput = hat.inputs.VALUE as BlockInput.Any;
        // If the "greater than" value is a literal, we can include it directly.
        // Otherwise, it's a block that may depend on sprite state and needs to
        // be a function.
        const value =
          valueInput.type === "block"
            ? `() => ${blockToJSWithContext(valueInput.value, target)}`
            : staticBlockInputToLiteral(valueInput.value);
        return triggerInitStr(`${hat.inputs.WHENGREATERTHANMENU.value}_GREATER_THAN`, {
          VALUE: value
        });
      }
      case OpCode.control_start_as_clone:
        return triggerInitStr("CLONE_START");
      default:
        return null;
    }
  }

  function scriptToJS(script: Script, target: Target): string {
    const body = script.body.map(block => blockToJSWithContext(block, target, script)).join(";\n");
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
  }

  function blockToJSWithContext(block: Block, target: Target, script?: Script): string {
    return blockToJS(block);

    function inputToJS(input: BlockInput.Any, desiredInputShape?: InputShape): string {
      // TODO: Right now, inputs can be completely undefined if imported from
      // the .sb3 format (because sb3 is weird). This little check will replace
      // undefined inputs with the value `null`. In theory, this should
      // eventually be removed when the sb3 import script is improved.
      if (input === undefined) {
        return "null";
      }

      switch (input.type) {
        case "block":
          return blockToJS(input.value as Block, desiredInputShape);
        case "blocks":
          return input.value.map(block => blockToJS(block as Block)).join(";\n");
        default: {
          return staticBlockInputToLiteral(input.value);
        }
      }
    }

    function blockToJS(block: Block, desiredInputShape?: InputShape): string {
      const warp =
        script && script.hat && script.hat.opcode === OpCode.procedures_definition && script.hat.inputs.WARP.value;

      // If the block contains a variable or list dropdown,
      // get the code to grab that variable now for convenience
      let selectedVarSource: string = null;
      let selectedWatcherSource: string = null;
      let varInputId: string = null;
      if ("VARIABLE" in block.inputs) {
        varInputId = (block.inputs.VARIABLE.value as { id: string }).id;
      } else if ("LIST" in block.inputs) {
        varInputId = (block.inputs.LIST.value as { id: string }).id;
      }
      if (varInputId) {
        const newName = variableNameMap[varInputId];
        if (target === project.stage || !stageVariables.has(newName)) {
          selectedVarSource = `this.vars.${newName}`;
          selectedWatcherSource = `this.watchers.${newName}`;
        } else {
          selectedVarSource = `this.stage.vars.${newName}`;
          selectedWatcherSource = `this.stage.watchers.${newName}`;
        }
      }

      const stage = "this" + (target.isStage ? "" : ".stage");

      let satisfiesInputShape: InputShape = null;
      let blockSource: string = null;

      switch (block.opcode) {
        case OpCode.motion_movesteps:
          satisfiesInputShape = "stack";
          blockSource = `this.move(${inputToJS(block.inputs.STEPS)})`;
          break;

        case OpCode.motion_turnright:
          satisfiesInputShape = "stack";
          blockSource = `this.direction += (${inputToJS(block.inputs.DEGREES)})`;
          break;

        case OpCode.motion_turnleft:
          satisfiesInputShape = "stack";
          blockSource = `this.direction -= (${inputToJS(block.inputs.DEGREES)})`;
          break;

        case OpCode.motion_goto:
          satisfiesInputShape = "stack";
          switch (block.inputs.TO.value) {
            case "_random_":
              blockSource = `this.goto(this.random(-240, 240), this.random(-180, 180))`;
              break;
            case "_mouse_":
              blockSource = `this.goto(this.mouse.x, this.mouse.y)`;
              break;
            default: {
              const sprite = `(this.sprites[${JSON.stringify(targetNameMap[block.inputs.TO.value])}])`;
              blockSource = `this.goto(${sprite}.x, ${sprite}.y)`;
              break;
            }
          }
          break;

        case OpCode.motion_gotoxy:
          satisfiesInputShape = "stack";
          blockSource = `this.goto((${inputToJS(block.inputs.X)}), (${inputToJS(block.inputs.Y)}))`;
          break;

        case OpCode.motion_glideto:
          satisfiesInputShape = "stack";
          switch (block.inputs.TO.value) {
            case "_random_":
              blockSource = `yield* this.glide((${inputToJS(
                block.inputs.SECS
              )}), this.random(-240, 240), this.random(-180, 180))`;
              break;
            case "_mouse_":
              blockSource = `yield* this.glide((${inputToJS(block.inputs.SECS)}), this.mouse.x, this.mouse.y)`;
              break;
            default: {
              const sprite = `(this.sprites[${JSON.stringify(targetNameMap[block.inputs.TO.value])}])`;
              blockSource = `yield* this.glide((${inputToJS(block.inputs.SECS)}), ${sprite}.x, ${sprite}.y)`;
              break;
            }
          }
          break;

        case OpCode.motion_glidesecstoxy:
          satisfiesInputShape = "stack";
          blockSource = `yield* this.glide((${inputToJS(block.inputs.SECS)}), (${inputToJS(block.inputs.X)}), (${inputToJS(
            block.inputs.Y
          )}))`;
          break;

        case OpCode.motion_pointindirection:
          satisfiesInputShape = "stack";
          blockSource = `this.direction = (${inputToJS(block.inputs.DIRECTION)})`;
          break;

        case OpCode.motion_pointtowards:
          satisfiesInputShape = "stack";
          switch (block.inputs.TOWARDS.value) {
            case "_mouse_":
              blockSource = `this.direction = this.radToScratch(Math.atan2(this.mouse.y - this.y, this.mouse.x - this.x))`;
              break;
            default: {
              const sprite = `(this.sprites[${JSON.stringify(targetNameMap[block.inputs.TOWARDS.value])}])`;
              blockSource = `this.direction = this.radToScratch(Math.atan2(${sprite}.y - this.y, ${sprite}.x - this.x))`;
              break;
            }
          }
          break;

        case OpCode.motion_changexby:
          satisfiesInputShape = "stack";
          blockSource = `this.x += (${inputToJS(block.inputs.DX)})`;
          break;

        case OpCode.motion_setx:
          satisfiesInputShape = "stack";
          blockSource = `this.x = (${inputToJS(block.inputs.X)})`;
          break;

        case OpCode.motion_changeyby:
          satisfiesInputShape = "stack";
          blockSource = `this.y += (${inputToJS(block.inputs.DY)})`;
          break;

        case OpCode.motion_sety:
          satisfiesInputShape = "stack";
          blockSource = `this.y = (${inputToJS(block.inputs.Y)})`;
          break;

        case OpCode.motion_setrotationstyle:
          satisfiesInputShape = "stack";
          switch (block.inputs.STYLE.value) {
            case "left-right":
              blockSource = `this.rotationStyle = Sprite.RotationStyle.LEFT_RIGHT`;
              break;
            case "don't rotate":
              blockSource = `this.rotationStyle = Sprite.RotationStyle.DONT_ROTATE`;
              break;
            case "all around":
              blockSource = `this.rotationStyle = Sprite.RotationStyle.ALL_AROUND`;
              break;
          }
          break;

        case OpCode.motion_xposition:
          satisfiesInputShape = "number";
          blockSource = `this.x`;
          break;

        case OpCode.motion_yposition:
          satisfiesInputShape = "number";
          blockSource = `this.y`;
          break;

        case OpCode.motion_direction:
          satisfiesInputShape = "number";
          blockSource = `this.direction`;
          break;

        // Obsolete no-op blocks:
        case OpCode.motion_scroll_right:
        case OpCode.motion_scroll_up:
        case OpCode.motion_align_scene:
          satisfiesInputShape = "stack";
          blockSource = ``;
          break;

        case OpCode.motion_xscroll:
        case OpCode.motion_yscroll:
          satisfiesInputShape = "string";
          blockSource = `undefined`; // Compatibility with Scratch 3.0 \:)/
          break;

        case OpCode.looks_sayforsecs:
          satisfiesInputShape = "stack";
          blockSource = `yield* this.sayAndWait((${inputToJS(block.inputs.MESSAGE)}), (${inputToJS(block.inputs.SECS)}))`;
          break;

        case OpCode.looks_say:
          satisfiesInputShape = "stack";
          blockSource = `this.say(${inputToJS(block.inputs.MESSAGE)})`;
          break;

        case OpCode.looks_thinkforsecs:
          satisfiesInputShape = "stack";
          blockSource = `yield* this.thinkAndWait((${inputToJS(block.inputs.MESSAGE)}), (${inputToJS(block.inputs.SECS)}))`;
          break;

        case OpCode.looks_think:
          satisfiesInputShape = "stack";
          blockSource = `this.think(${inputToJS(block.inputs.MESSAGE)})`;
          break;

        case OpCode.looks_switchcostumeto:
          satisfiesInputShape = "stack";
          blockSource = `this.costume = (${inputToJS(block.inputs.COSTUME)})`;
          break;

        case OpCode.looks_nextcostume:
          satisfiesInputShape = "stack";
          blockSource = `this.costumeNumber += 1`;
          break;

        case OpCode.looks_switchbackdropto:
          satisfiesInputShape = "stack";
          blockSource = `${stage}.costume = (${inputToJS(block.inputs.BACKDROP)})`;
          break;

        case OpCode.looks_nextbackdrop:
          satisfiesInputShape = "stack";
          blockSource = `${stage}.costumeNumber += 1`;
          break;

        case OpCode.looks_changesizeby:
          satisfiesInputShape = "stack";
          blockSource = `this.size += (${inputToJS(block.inputs.CHANGE)})`;
          break;

        case OpCode.looks_setsizeto:
          satisfiesInputShape = "stack";
          blockSource = `this.size = (${inputToJS(block.inputs.SIZE)})`;
          break;

        case OpCode.looks_changeeffectby: {
          const effectName = block.inputs.EFFECT.value.toLowerCase();
          satisfiesInputShape = "stack";
          blockSource = `this.effects.${effectName} += ${inputToJS(block.inputs.CHANGE)}`;
          break;
        }

        case OpCode.looks_seteffectto: {
          const effectName = block.inputs.EFFECT.value.toLowerCase();
          satisfiesInputShape = "stack";
          blockSource = `this.effects.${effectName} = ${inputToJS(block.inputs.VALUE)}`;
          break;
        }

        case OpCode.looks_cleargraphiceffects:
          satisfiesInputShape = "stack";
          blockSource = `this.effects.clear()`;
          break;

        case OpCode.looks_show:
          satisfiesInputShape = "stack";
          blockSource = `this.visible = true`;
          break;

        case OpCode.looks_hide:
          satisfiesInputShape = "stack";
          blockSource = `this.visible = false`;
          break;

        case OpCode.looks_gotofrontback:
          satisfiesInputShape = "stack";
          if (block.inputs.FRONT_BACK.value === "front") {
            blockSource = `this.moveAhead()`;
          } else {
            blockSource = `this.moveBehind()`;
          }
          break;

        case OpCode.looks_goforwardbackwardlayers:
          satisfiesInputShape = "stack";
          if (block.inputs.FORWARD_BACKWARD.value === "forward") {
            blockSource = `this.moveAhead(${inputToJS(block.inputs.NUM)})`;
          } else {
            blockSource = `this.moveBehind(${inputToJS(block.inputs.NUM)})`;
          }
          break;

        // Obsolete no-op blocks:
        case OpCode.looks_hideallsprites:
        case OpCode.looks_changestretchby:
        case OpCode.looks_setstretchto:
          satisfiesInputShape = "stack";
          blockSource = ``;
          break;

        case OpCode.looks_costumenumbername:
          switch (block.inputs.NUMBER_NAME.value) {
            case "name":
              satisfiesInputShape = "string";
              blockSource = `this.costume.name`;
              break;
            case "number":
            default:
              satisfiesInputShape = "number";
              blockSource = `this.costumeNumber`;
              break;
          }
          break;

        case OpCode.looks_backdropnumbername:
          switch (block.inputs.NUMBER_NAME.value) {
            case "name":
              satisfiesInputShape = "string";
              blockSource = `${stage}.costume.name`;
              break;
            case "number":
            default:
              satisfiesInputShape = "number";
              blockSource = `${stage}.costumeNumber`;
              break;
          }
          break;

        case OpCode.looks_size:
          satisfiesInputShape = "number";
          blockSource = `this.size`;
          break;

        case OpCode.sound_playuntildone:
          satisfiesInputShape = "stack";
          blockSource = `yield* this.playSoundUntilDone(${inputToJS(block.inputs.SOUND_MENU)})`;
          break;

        case OpCode.sound_play:
          satisfiesInputShape = "stack";
          blockSource = `yield* this.startSound(${inputToJS(block.inputs.SOUND_MENU)})`;
          break;

        case OpCode.sound_setvolumeto:
          satisfiesInputShape = "stack";
          blockSource = `this.audioEffects.volume = ${inputToJS(block.inputs.VOLUME)}`;
          break;

        case OpCode.sound_changevolumeby:
          satisfiesInputShape = "stack";
          blockSource = `this.audioEffects.volume += ${inputToJS(block.inputs.VOLUME)}`;
          break;

        case OpCode.sound_volume:
          satisfiesInputShape = "number";
          blockSource = `this.audioEffects.volume`;
          break;

        case OpCode.sound_seteffectto: {
          satisfiesInputShape = "stack";
          const value = inputToJS(block.inputs.VALUE);
          if (block.inputs.EFFECT.type === "soundEffect") {
            blockSource = `this.audioEffects.${block.inputs.EFFECT.value.toLowerCase()} = ${value}`;
          } else {
            blockSource = `this.audioEffects[${inputToJS(block.inputs.EFFECT)}] = ${value}`;
          }
          break;
        }

        case OpCode.sound_changeeffectby: {
          satisfiesInputShape = "stack";
          const value = inputToJS(block.inputs.VALUE);
          if (block.inputs.EFFECT.type === "soundEffect") {
            blockSource = `this.audioEffects.${block.inputs.EFFECT.value.toLowerCase()} += ${value}`;
          } else {
            blockSource = `this.audioEffects[${inputToJS(block.inputs.EFFECT)}] += ${value}`;
          }
          break;
        }

        case OpCode.sound_cleareffects:
          satisfiesInputShape = "stack";
          blockSource = `this.audioEffects.clear()`;
          break;

        case OpCode.sound_stopallsounds:
          satisfiesInputShape = "stack";
          blockSource = `this.stopAllSounds()`;
          break;

        case OpCode.event_broadcast:
          satisfiesInputShape = "stack";
          blockSource = `this.broadcast(${inputToJS(block.inputs.BROADCAST_INPUT)})`;
          break;

        case OpCode.event_broadcastandwait:
          satisfiesInputShape = "stack";
          blockSource = `yield* this.broadcastAndWait(${inputToJS(block.inputs.BROADCAST_INPUT)})`;
          break;

        case OpCode.control_wait:
          satisfiesInputShape = "stack";
          blockSource = `yield* this.wait(${inputToJS(block.inputs.DURATION)})`;
          break;

        case OpCode.control_repeat:
          satisfiesInputShape = "stack";
          blockSource = `for (let i = 0; i < (${inputToJS(block.inputs.TIMES)}); i++) {
            ${inputToJS(block.inputs.SUBSTACK)};
            ${warp ? "" : "yield;"}
          }`;
          break;

        case OpCode.control_forever:
          satisfiesInputShape = "stack";
          blockSource = `while (true) {
            ${inputToJS(block.inputs.SUBSTACK)};
            ${warp ? "" : "yield;"}
          }`;
          break;

        case OpCode.control_if:
          satisfiesInputShape = "stack";
          blockSource = `if (${inputToJS(block.inputs.CONDITION, "boolean")}) {
            ${inputToJS(block.inputs.SUBSTACK)}
          }`;
          break;

        case OpCode.control_if_else:
          satisfiesInputShape = "stack";
          blockSource = `if (${inputToJS(block.inputs.CONDITION, "boolean")}) {
            ${inputToJS(block.inputs.SUBSTACK)}
          } else {
            ${inputToJS(block.inputs.SUBSTACK2)}
          }`;
          break;

        case OpCode.control_wait_until:
          satisfiesInputShape = "stack";
          blockSource = `while (!(${inputToJS(block.inputs.CONDITION, "boolean")})) { yield; }`;
          break;

        case OpCode.control_repeat_until:
          satisfiesInputShape = "stack";
          blockSource = `while (!(${inputToJS(block.inputs.CONDITION, "boolean")})) {
            ${inputToJS(block.inputs.SUBSTACK)}
            ${warp ? "" : "yield;"}
          }`;
          break;

        case OpCode.control_while:
          satisfiesInputShape = "stack";
          blockSource = `while (${inputToJS(block.inputs.CONDITION, "boolean")}) {
            ${inputToJS(block.inputs.SUBSTACK)}
            ${warp ? "" : "yield;"}
          }`;
          break;

        case OpCode.control_for_each:
          satisfiesInputShape = "stack";
          blockSource = `for (${selectedVarSource} = 1; ${selectedVarSource} <= (${inputToJS(
            block.inputs.VALUE
          )}); ${selectedVarSource}++) {
            ${inputToJS(block.inputs.SUBSTACK)}
            ${warp ? "" : "yield;"}
          }`;
          break;

        case OpCode.control_all_at_once:
          satisfiesInputShape = "stack";
          blockSource = inputToJS(block.inputs.SUBSTACK);
          break;

        case OpCode.control_stop:
          satisfiesInputShape = "stack";
          switch (block.inputs.STOP_OPTION.value) {
            case "this script":
              blockSource = `return;`;
              break;
            default:
              blockSource = `/* TODO: Implement stop ${block.inputs.STOP_OPTION.value} */ null`;
              break;
          }
          break;

        case OpCode.control_create_clone_of:
          satisfiesInputShape = "stack";
          switch (block.inputs.CLONE_OPTION.value) {
            case "_myself_":
              blockSource = `this.createClone()`;
              break;
            default:
              blockSource = `this.sprites[${JSON.stringify(targetNameMap[block.inputs.CLONE_OPTION.value])}].createClone()`;
              break;
          }
          break;

        case OpCode.control_delete_this_clone:
          satisfiesInputShape = "stack";
          blockSource = `this.deleteThisClone()`;
          break;

        case OpCode.control_get_counter:
          satisfiesInputShape = "number";
          blockSource = `${stage}.__counter`;
          break;

        case OpCode.control_incr_counter:
          satisfiesInputShape = "stack";
          blockSource = `${stage}.__counter++`;
          break;

        case OpCode.control_clear_counter:
          satisfiesInputShape = "stack";
          blockSource = `${stage}.__counter = 0`;
          break;

        case OpCode.sensing_touchingobject:
          satisfiesInputShape = "boolean";
          switch (block.inputs.TOUCHINGOBJECTMENU.value) {
            case "_mouse_":
              blockSource = `this.touching("mouse")`;
              break;
            case "_edge_":
              blockSource = `this.touching("edge")`;
              break;
            default:
              blockSource = `this.touching(this.sprites[${JSON.stringify(
                targetNameMap[block.inputs.TOUCHINGOBJECTMENU.value]
              )}].andClones())`;
              break;
          }
          break;

        case OpCode.sensing_touchingcolor:
          satisfiesInputShape = "boolean";
          if (block.inputs.COLOR.type === "color") {
            const { r, g, b } = block.inputs.COLOR.value;
            blockSource = `this.touching(Color.rgb(${r}, ${g}, ${b}))`;
          } else {
            blockSource = `this.touching(Color.num(${inputToJS(block.inputs.COLOR)}))`;
          }
          break;

        case OpCode.sensing_coloristouchingcolor: {
          let color1: string;
          let color2: string;

          if (block.inputs.COLOR.type === "color") {
            const { r, g, b } = block.inputs.COLOR.value;
            color1 = `Color.rgb(${r}, ${g}, ${b})`;
          } else {
            color1 = `Color.num(${inputToJS(block.inputs.COLOR)})`;
          }

          if (block.inputs.COLOR2.type === "color") {
            const { r, g, b } = block.inputs.COLOR2.value;
            color2 = `Color.rgb(${r}, ${g}, ${b})`;
          } else {
            color2 = `Color.num(${inputToJS(block.inputs.COLOR2)})`;
          }

          satisfiesInputShape = "boolean";
          blockSource = `this.colorTouching((${color1}), (${color2}))`;
          break;
        }

        case OpCode.sensing_distanceto:
          satisfiesInputShape = "number";
          switch (block.inputs.DISTANCETOMENU.value) {
            case "_mouse_":
              blockSource = `(Math.hypot(this.mouse.x - this.x, this.mouse.y - this.y))`;
              break;
            default: {
              const sprite = `this.sprites[${JSON.stringify(targetNameMap[block.inputs.DISTANCETOMENU.value])}]`;
              blockSource = `(Math.hypot(${sprite}.x - this.x, ${sprite}.y - this.y))`;
              break;
            }
          }
          break;

        case OpCode.sensing_askandwait:
          satisfiesInputShape = "stack";
          blockSource = `yield* this.askAndWait(${inputToJS(block.inputs.QUESTION)})`;
          break;

        case OpCode.sensing_answer:
          satisfiesInputShape = "string";
          blockSource = `this.answer`;
          break;

        case OpCode.sensing_keypressed:
          satisfiesInputShape = "boolean";
          blockSource = `this.keyPressed(${inputToJS(block.inputs.KEY_OPTION)})`;
          break;

        case OpCode.sensing_mousedown:
          satisfiesInputShape = "boolean";
          blockSource = `this.mouse.down`;
          break;
        case OpCode.sensing_mousex:
          satisfiesInputShape = "number";
          blockSource = `this.mouse.x`;
          break;

        case OpCode.sensing_mousey:
          satisfiesInputShape = "number";
          blockSource = `this.mouse.y`;
          break;

        case OpCode.sensing_loudness:
          satisfiesInputShape = "number";
          blockSource = `this.loudness`;
          break;

        case OpCode.sensing_timer:
          satisfiesInputShape = "number";
          blockSource = `this.timer`;
          break;

        case OpCode.sensing_resettimer:
          satisfiesInputShape = "stack";
          blockSource = `this.restartTimer()`;
          break;

        case OpCode.sensing_of: {
          let propName: string;
          switch (block.inputs.PROPERTY.value) {
            case "x position":
              propName = "x";
              satisfiesInputShape = "number";
              break;
            case "y position":
              propName = "y";
              satisfiesInputShape = "number";
              break;
            case "direction":
              propName = "direction";
              satisfiesInputShape = "number";
              break;
            case "costume #":
            case "backdrop #":
              propName = "costumeNumber";
              satisfiesInputShape = "number";
              break;
            case "costume name":
            case "backdrop name":
              propName = "costume.name";
              satisfiesInputShape = "string";
              break;
            case "size":
              propName = "size";
              satisfiesInputShape = "number";
              break;
            case "volume":
              propName = null;
              break;
            default: {
              let varOwner: Target = project.stage;
              if (block.inputs.OBJECT.value !== "_stage_") {
                varOwner = project.sprites.find(sprite => sprite.name === targetNameMap[block.inputs.OBJECT.value]);
              }
              // "of" block gets variables by name, not ID, using lookupVariableByNameAndType in scratch-vm.
              const variable = varOwner.variables.find(variable => variable.name === block.inputs.PROPERTY.value);
              const newName = variableNameMap[variable.id];
              propName = `vars.${newName}`;
              satisfiesInputShape = "string";
              break;
            }
          }

          if (propName === null) {
            blockSource = `/* Cannot access property ${block.inputs.PROPERTY.value} of target */ null`;
            break;
          }

          let targetObj: string;
          if (block.inputs.OBJECT.value === "_stage_") {
            targetObj = `this.stage`;
          } else {
            targetObj = `this.sprites[${JSON.stringify(targetNameMap[block.inputs.OBJECT.value])}]`;
          }

          blockSource = `${targetObj}.${propName}`;
          break;
        }

        case OpCode.sensing_current:
          satisfiesInputShape = "number";
          switch (block.inputs.CURRENTMENU.value) {
            case "YEAR":
              blockSource = `(new Date().getFullYear())`;
              break;
            case "MONTH":
              blockSource = `(new Date().getMonth() + 1)`;
              break;
            case "DATE":
              blockSource = `(new Date().getDate())`;
              break;
            case "DAYOFWEEK":
              blockSource = `(new Date().getDay() + 1)`;
              break;
            case "HOUR":
              blockSource = `(new Date().getHours())`;
              break;
            case "MINUTE":
              blockSource = `(new Date().getMinutes())`;
              break;
            case "SECOND":
              blockSource = `(new Date().getSeconds())`;
              break;
            default:
              blockSource = `('')`;
              break;
          }
          break;

        case OpCode.sensing_dayssince2000:
          satisfiesInputShape = "number";
          blockSource = `(((new Date().getTime() - new Date(2000, 0, 1)) / 1000 / 60 + new Date().getTimezoneOffset()) / 60 / 24)`;
          break;

        case OpCode.sensing_username:
          satisfiesInputShape = "string";
          blockSource = `(/* no username */ "")`;
          break;

        case OpCode.sensing_userid:
          satisfiesInputShape = "string";
          blockSource = `undefined`; // Obsolete no-op block.
          break;

        case OpCode.operator_add:
          satisfiesInputShape = "number";
          blockSource = `((${inputToJS(block.inputs.NUM1)}) + (${inputToJS(block.inputs.NUM2)}))`;
          break;

        case OpCode.operator_subtract:
          satisfiesInputShape = "number";
          blockSource = `((${inputToJS(block.inputs.NUM1)}) - (${inputToJS(block.inputs.NUM2)}))`;
          break;

        case OpCode.operator_multiply:
          satisfiesInputShape = "number";
          blockSource = `((${inputToJS(block.inputs.NUM1)}) * (${inputToJS(block.inputs.NUM2)}))`;
          break;

        case OpCode.operator_divide:
          satisfiesInputShape = "number";
          blockSource = `((${inputToJS(block.inputs.NUM1)}) / (${inputToJS(block.inputs.NUM2)}))`;
          break;

        case OpCode.operator_random:
          satisfiesInputShape = "number";
          blockSource = `this.random(${inputToJS(block.inputs.FROM)}, ${inputToJS(block.inputs.TO)})`;
          break;

        case OpCode.operator_gt:
          satisfiesInputShape = "boolean";
          blockSource = `((${inputToJS(block.inputs.OPERAND1)}) > (${inputToJS(block.inputs.OPERAND2)}))`;
          break;

        case OpCode.operator_lt:
          satisfiesInputShape = "boolean";
          blockSource = `((${inputToJS(block.inputs.OPERAND1)}) < (${inputToJS(block.inputs.OPERAND2)}))`;
          break;

        case OpCode.operator_equals:
          satisfiesInputShape = "boolean";
          blockSource = `((${inputToJS(block.inputs.OPERAND1)}) == (${inputToJS(block.inputs.OPERAND2)}))`;
          break;

        case OpCode.operator_and:
          satisfiesInputShape = "boolean";
          blockSource = `((${inputToJS(block.inputs.OPERAND1, "boolean")}) && (${inputToJS(block.inputs.OPERAND2, "boolean")}))`;
          break;

        case OpCode.operator_or:
          satisfiesInputShape = "boolean";
          blockSource = `((${inputToJS(block.inputs.OPERAND1, "boolean")}) || (${inputToJS(block.inputs.OPERAND2, "boolean")}))`;
          break;

        case OpCode.operator_not:
          satisfiesInputShape = "boolean";
          blockSource = `(!(${inputToJS(block.inputs.OPERAND, "boolean")}))`;
          break;

        case OpCode.operator_join:
          satisfiesInputShape = "string";
          blockSource = `("" + (${inputToJS(block.inputs.STRING1)}) + (${inputToJS(block.inputs.STRING2)}))`;
          break;

        case OpCode.operator_letter_of:
          satisfiesInputShape = "string";
          blockSource = `(String(${inputToJS(block.inputs.STRING)})[(${inputToJS(block.inputs.LETTER)}) - 1])`;
          break;

        case OpCode.operator_length:
          satisfiesInputShape = "number";
          blockSource = `(${inputToJS(block.inputs.STRING)}).length`;
          break;

        case OpCode.operator_contains:
          satisfiesInputShape = "boolean";
          blockSource = `(${inputToJS(block.inputs.STRING1)}).includes(${inputToJS(block.inputs.STRING2)})`;
          break;

        case OpCode.operator_mod:
          satisfiesInputShape = "number";
          blockSource = `((${inputToJS(block.inputs.NUM1)}) % (${inputToJS(block.inputs.NUM2)}))`;
          break;

        case OpCode.operator_round:
          satisfiesInputShape = "number";
          blockSource = `Math.round(${inputToJS(block.inputs.NUM)})`;
          break;

        case OpCode.operator_mathop:
          satisfiesInputShape = "number";
          switch (block.inputs.OPERATOR.value) {
            case "abs":
              blockSource = `Math.abs(${inputToJS(block.inputs.NUM)})`;
              break;
            case "floor":
              blockSource = `Math.floor(${inputToJS(block.inputs.NUM)})`;
              break;
            case "ceiling":
              blockSource = `Math.ceil(${inputToJS(block.inputs.NUM)})`;
              break;
            case "sqrt":
              blockSource = `Math.sqrt(${inputToJS(block.inputs.NUM)})`;
              break;
            case "sin":
              blockSource = `Math.sin(this.degToRad(${inputToJS(block.inputs.NUM)}))`;
              break;
            case "cos":
              blockSource = `Math.cos(this.degToRad(${inputToJS(block.inputs.NUM)}))`;
              break;
            case "tan":
              blockSource = `Math.tan(this.degToRad(${inputToJS(block.inputs.NUM)}))`;
              break;
            case "asin":
              blockSource = `this.radToDeg(Math.asin(${inputToJS(block.inputs.NUM)}))`;
              break;
            case "acos":
              blockSource = `this.radToDeg(Math.acos(${inputToJS(block.inputs.NUM)}))`;
              break;
            case "atan":
              blockSource = `this.radToDeg(Math.atan(${inputToJS(block.inputs.NUM)}))`;
              break;
            case "ln":
              blockSource = `Math.log(${inputToJS(block.inputs.NUM)})`;
              break;
            case "log":
              blockSource = `Math.log10(${inputToJS(block.inputs.NUM)})`;
              break;
            case "e ^":
              blockSource = `(Math.E ** (${inputToJS(block.inputs.NUM)}))`;
              break;
            case "10 ^":
              blockSource = `(10 ** (${inputToJS(block.inputs.NUM)}))`;
              break;
          }
          break;

        case OpCode.data_variable:
          satisfiesInputShape = "string";
          blockSource = selectedVarSource;
          break;

        case OpCode.data_setvariableto:
          satisfiesInputShape = "stack";
          blockSource = `${selectedVarSource} = (${inputToJS(block.inputs.VALUE)})`;
          break;

        case OpCode.data_changevariableby:
          satisfiesInputShape = "stack";
          blockSource = `${selectedVarSource} += (${inputToJS(block.inputs.VALUE)})`;
          break;

        case OpCode.data_showvariable:
          satisfiesInputShape = "stack";
          blockSource = `${selectedWatcherSource}.visible = true`;
          break;

        case OpCode.data_hidevariable:
          satisfiesInputShape = "stack";
          blockSource = `${selectedWatcherSource}.visible = false`;
          break;

        case OpCode.data_listcontents:
          satisfiesInputShape = "string";
          blockSource = `${selectedVarSource}.join(" ")`;
          break;

        case OpCode.data_addtolist:
          satisfiesInputShape = "stack";
          blockSource = `${selectedVarSource}.push(${inputToJS(block.inputs.ITEM)})`;
          break;

        case OpCode.data_deleteoflist:
          satisfiesInputShape = "stack";
          // Supposed to be a numerical index, but can be
          // string "all" when sb2 converted to sb3 by Scratch
          if (block.inputs.INDEX.value === "all") {
            blockSource = `${selectedVarSource} = []`;
          } else if (block.inputs.INDEX.value === "last") {
            blockSource = `${selectedVarSource}.splice(${selectedVarSource}.length - 1, 1)`;
          } else {
            blockSource = `${selectedVarSource}.splice(((${inputToJS(block.inputs.INDEX)}) - 1), 1)`;
          }
          break;

        case OpCode.data_deletealloflist:
          satisfiesInputShape = "stack";
          blockSource = `${selectedVarSource} = []`;
          break;

        case OpCode.data_insertatlist:
          satisfiesInputShape = "stack";
          blockSource = `${selectedVarSource}.splice(((${inputToJS(block.inputs.INDEX)}) - 1), 0, (${inputToJS(
            block.inputs.ITEM
          )}))`;
          break;

        case OpCode.data_replaceitemoflist:
          satisfiesInputShape = "stack";
          blockSource = `${selectedVarSource}.splice(((${inputToJS(block.inputs.INDEX)}) - 1), 1, (${inputToJS(
            block.inputs.ITEM
          )}))`;
          break;

        case OpCode.data_itemoflist:
          satisfiesInputShape = "string";
          if (block.inputs.INDEX.value === "last") {
            blockSource = `${selectedVarSource}[${selectedVarSource}.length - 1]`;
          } else {
            blockSource = `${selectedVarSource}[(${inputToJS(block.inputs.INDEX)}) - 1]`;
          }
          break;

        case OpCode.data_itemnumoflist:
          satisfiesInputShape = "number";
          blockSource = `(${selectedVarSource}.indexOf(${inputToJS(block.inputs.ITEM)}) + 1)`;
          break;

        case OpCode.data_lengthoflist:
          satisfiesInputShape = "number";
          blockSource = `${selectedVarSource}.length`;
          break;

        case OpCode.data_listcontainsitem:
          satisfiesInputShape = "boolean";
          blockSource = `${selectedVarSource}.includes(${inputToJS(block.inputs.ITEM)})`;
          break;

        case OpCode.data_showlist:
          satisfiesInputShape = "stack";
          blockSource = `${selectedWatcherSource}.visible = true`;
          break;

        case OpCode.data_hidelist:
          satisfiesInputShape = "stack";
          blockSource = `${selectedWatcherSource}.visible = false`;
          break;

        case OpCode.procedures_call: {
          satisfiesInputShape = "stack";

          // Get name of custom block script with given PROCCODE:
          const procName = target.scripts.find(
            script =>
              script.hat !== null &&
              script.hat.opcode === OpCode.procedures_definition &&
              script.hat.inputs.PROCCODE.value === block.inputs.PROCCODE.value
          ).name;

          const procArgs = `${block.inputs.INPUTS.value.map(input => inputToJS(input)).join(", ")}`;

          // Warp-mode procedures execute all child procedures in warp mode as well
          if (warp) {
            blockSource = `this.warp(this.${procName})(${procArgs})`;
          } else {
            blockSource = `yield* this.${procName}(${procArgs})`;
          }
          break;
        }

        case OpCode.argument_reporter_string_number:
        case OpCode.argument_reporter_boolean:
          // Argument reporters dragged outside their script return 0
          if (!script) {
            satisfiesInputShape = "number";
            blockSource = "0";
            break;
          }

          if (block.opcode === OpCode.argument_reporter_boolean) {
            satisfiesInputShape = "boolean";
          } else {
            satisfiesInputShape = "string";
          }
          blockSource = customBlockArgNameMap.get(script)[block.inputs.VALUE.value];
          break;

        case OpCode.pen_clear:
          satisfiesInputShape = "stack";
          blockSource = `this.clearPen()`;
          break;

        case OpCode.pen_stamp:
          satisfiesInputShape = "stack";
          blockSource = `this.stamp()`;
          break;

        case OpCode.pen_penDown:
          satisfiesInputShape = "stack";
          blockSource = `this.penDown = true`;
          break;

        case OpCode.pen_penUp:
          satisfiesInputShape = "stack";
          blockSource = `this.penDown = false`;
          break;

        case OpCode.pen_setPenColorToColor:
          satisfiesInputShape = "stack";
          if (block.inputs.COLOR.type === "color") {
            const { r, g, b } = block.inputs.COLOR.value;
            blockSource = `this.penColor = Color.rgb(${r}, ${g}, ${b})`;
          } else {
            blockSource = `this.penColor = Color.num(${inputToJS(block.inputs.COLOR)})`;
          }
          break;

        case OpCode.pen_changePenColorParamBy:
          satisfiesInputShape = "stack";
          switch (block.inputs.colorParam.value) {
            case "color":
              blockSource = `this.penColor.h += (${inputToJS(block.inputs.VALUE)})`;
              break;
            case "saturation":
              blockSource = `this.penColor.s += (${inputToJS(block.inputs.VALUE)})`;
              break;
            case "brightness":
              blockSource = `this.penColor.v += (${inputToJS(block.inputs.VALUE)})`;
              break;
            case "transparency":
              blockSource = `this.penColor.a -= ((${inputToJS(block.inputs.VALUE)}) / 100)`;
              break;
          }
          break;

        case OpCode.pen_setPenColorParamTo:
          satisfiesInputShape = "stack";
          switch (block.inputs.colorParam.value) {
            case "color":
              blockSource = `this.penColor.h = (${inputToJS(block.inputs.VALUE)})`;
              break;
            case "saturation":
              blockSource = `this.penColor.s = (${inputToJS(block.inputs.VALUE)})`;
              break;
            case "brightness":
              blockSource = `this.penColor.v = (${inputToJS(block.inputs.VALUE)})`;
              break;
            case "transparency":
              blockSource = `this.penColor.a = (1 - ((${inputToJS(block.inputs.VALUE)}) / 100))`;
              break;
          }
          break;

        case OpCode.pen_setPenSizeTo:
          satisfiesInputShape = "stack";
          blockSource = `this.penSize = (${inputToJS(block.inputs.SIZE)})`;
          break;

        case OpCode.pen_changePenSizeBy:
          satisfiesInputShape = "stack";
          blockSource = `this.penSize += (${inputToJS(block.inputs.SIZE)})`;
          break;

        default:
          satisfiesInputShape = "string";
          blockSource = `/* TODO: Implement ${block.opcode} */ null`;
          break;
      }

      if (satisfiesInputShape === desiredInputShape) {
        return blockSource;
      }

      if (desiredInputShape === "boolean") {
        return `(this.toBoolean(${blockSource}))`;
      }

      return blockSource;
    }
  }

  let files: { [fileName: string]: string } = {
    "index.html": `
      <!DOCTYPE html>
      <html>
        <head>
          <link rel="stylesheet" href="${options.leopardCSSURL}" />
        </head>
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
    "index.js": `
      import { Project } from ${JSON.stringify(options.leopardJSURL)};

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
                visible: sprite.visible,
                layerOrder: sprite.layerOrder
              })})`
          )
          .join(",\n")}
      };

      const project = new Project(stage, sprites, {
        frameRate: 30 // Set to 60 to make your project run faster
      });
      export default project;
    `
  };

  // Scratch doesn't care much about "types" (like numbers vs strings), but
  // sometimes Javascript does. This function attempts to parse a Scratch
  // value and turn it into the most appropriate Javascript representation
  function toOptimalJavascriptRepresentation(value): string {
    if (Array.isArray(value)) {
      return `[${value.map(toOptimalJavascriptRepresentation).join(", ")}]`;
    }

    if (typeof value === "string") {
      // Does this string look like a number?
      const numValue = Number(value);

      if (isNaN(numValue)) {
        // Not a number! Treat it like a string!
        return JSON.stringify(value);
      }

      if (Number.isInteger(numValue) && !Number.isSafeInteger(numValue)) {
        // If this number is an integer that is so large it cannot be reliably
        // stored, leave it as a string instead. (Usually in these cases the
        // Scratch user is treating the number like a string anyway.)
        return JSON.stringify(value);
      }

      // This looks like a nice, safe number
      return JSON.stringify(numValue);
    }

    // Here's the catch-all for something else that might pass through
    return JSON.stringify(value);
  }

  for (const target of [project.stage, ...project.sprites]) {
    // We don't want to include JavaScript for unused variable watchers.
    // Some watchers start invisible but appear later, so this code builds a list of
    // watchers that appear in "show variable" and "show list" blocks. The list is
    // actually *used* later, by some other code.
    let shownWatchers: Set<string> = new Set();
    let targetsToCheckForShowBlocks: Target[];
    if (target.isStage) {
      targetsToCheckForShowBlocks = [project.stage, ...project.sprites];
    } else {
      targetsToCheckForShowBlocks = [target];
    }
    for (const checkTarget of targetsToCheckForShowBlocks) {
      for (const block of checkTarget.blocks) {
        if (block.opcode === OpCode.data_showvariable || block.opcode === OpCode.data_hidevariable) {
          shownWatchers.add(block.inputs.VARIABLE.value.id);
        }
        if (block.opcode === OpCode.data_showlist || block.opcode === OpCode.data_hidelist) {
          shownWatchers.add(block.inputs.LIST.value.id);
        }
      }
    }

    files[`${target.name}/${target.name}.js`] = `
      import { ${target.isStage ? "Stage as StageBase" : "Sprite"}, Trigger, Watcher, Costume, Color, Sound } from '${
      options.leopardJSURL
    }';

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
                    x: costume.centerX,
                    y: costume.centerY
                  })})`
              )
              .join(",\n")}
          ];

          this.sounds = [
            ${target.sounds
              .map(
                sound =>
                  `new Sound(${JSON.stringify(sound.name)}, ${JSON.stringify(
                    options.getAssetURL({
                      type: "sound",
                      target: target.name,
                      name: sound.name,
                      md5: sound.md5,
                      ext: sound.ext
                    })
                  )})`
              )
              .join(",\n")}
          ];

          this.triggers = [
            ${target.scripts
              .map(script => triggerInitCode(script, target))
              .filter(trigger => trigger !== null)
              .join(",\n")}
          ];

          ${target.volume !== 100 ? `this.audioEffects.volume = ${target.volume};` : ""}

          ${[...target.variables, ...target.lists]
            .map(
              variable =>
                `this.vars.${variableNameMap[variable.id]} = ${toOptimalJavascriptRepresentation(variable.value)};`
            )
            .join("\n")}

          ${[...target.variables, ...target.lists]
            .filter(variable => variable.visible || shownWatchers.has(variable.id))
            .map(variable => {
              const newName = variableNameMap[variable.id];
              return `this.watchers.${newName} = new Watcher({
              label: ${JSON.stringify((target.isStage ? "" : `${target.name}: `) + variable.name)},
              style: ${JSON.stringify(
                variable instanceof List
                  ? "normal"
                  : { default: "normal", large: "large", slider: "slider" }[variable.mode]
              )},
              visible: ${JSON.stringify(variable.visible)},
              value: () => this.vars.${newName},
              ${
                variable instanceof Variable && variable.mode === "slider"
                  ? `setValue: (value) => { this.vars.${newName} = value; },\n`
                  : ""
              }x: ${JSON.stringify(variable.x + 240)},
              y: ${JSON.stringify(180 - variable.y)},
              ${"width" in variable ? `width: ${JSON.stringify(variable.width)},` : ""}
              ${"height" in variable ? `height: ${JSON.stringify(variable.height)},` : ""}
            });`;
            })
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
