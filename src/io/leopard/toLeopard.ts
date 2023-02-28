import Project from "../../Project";
import Script from "../../Script";
import Block, { BlockBase } from "../../Block";
import * as BlockInput from "../../BlockInput";
import { OpCode } from "../../OpCode";

import * as prettier from "prettier";
import Target from "../../Target";
import { List, Variable } from "../../Data";

/**
 * Words which are invalid for any JavaScript identifier to be, when it isn't
 * on a namespace (like `this` or `this.vars`).
 *
 * This list may be more comprehensive than it needs to be in every case,
 * erring to avoid potential issues.
 */
const JS_RESERVED_WORDS = [
  "arguments",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "yield",
  "var",
  "void",
  "while",
  "with"
];

/**
 * Input shapes are the basic attribute controlling which of a set of syntaxes
 * is returned for any given block (or primitive value). Provide an input shape
 * to inputToJS to specify what kind of value should be provided as the value
 * in that input. If the content of input does not match the desired shape, for
 * example because it is a block which returns a different type than desired,
 * it will be automatically cast to the correct type for use in the block.
 */
enum InputShape {
  /**
   * Generic shape indicating that any kind of input is acceptable. The input
   * will never be cast, and may be null, undefined, or any JavaScript value.
   */
  Any = "any",

  /**
   * Number input shape. If the input block isn't guaranteed to be a number,
   * it is automatically wrapped with this.toNumber(), which has particular
   * behavior to match Scratch.
   */
  Number = "number",

  /**
   * String input shape. If the input block isn't guaranteed to be a string,
   * it is automatically wrapped with this.toString(), which is just a wrapper
   * around the built-in String() op but is written so for consistency.
   *
   * The string input shape also guarantees that primitive values which could
   * be statically converted to a number, e.g. the string "1.234", will NOT be
   * converted.
   */
  String = "string",

  /**
   * Boolean input shape. If the input block isn't guaranteed to be a boolean,
   * it is automatically wrapped with this.toBoolean(), which has particular
   * behavior to match Scratch. Note that Scratch doesn't have a concept of
   * boolean primitives (no "true" or "false" blocks, nor a "switch" type
   * control for directly inputting true/false as in Snap!).
   */
  Boolean = "boolean",

  /**
   * Special "index" shape, representing an arbitrary number which has been
   * decremented (decreased by 1). Scratch lists are 1-based while JavaScript
   * arrays and strings are indexed starting from 0, so all indexes converted
   * from Scratch must be decreased to match. The "index" shape allows number
   * primitives to be statically decremented, and blocks which include a plus
   * or minus operator to automtaically "absorb" the following decrement.
   */
  Index = "index",

  /**
   * "Stack" block, referring to blocks which can be put one after another and
   * together represent a sequence of steps. Stack inputs may be empty and
   * otherwise are one or more blocks. In JavaScript, there's no fundamental
   * difference between a "function" for reporting values and a "command" for
   * applying effects, so no additional syntax is required to cast any given
   * input value to a stack.
   */
  Stack = "stack"
}

function uniqueNameGenerator(reservedNames: string[] | Set<string> = []) {
  const usedNames: Set<string> = new Set(reservedNames);
  return uniqueName;

  function uniqueName(name): string {
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }

    const numResult = /\d+$/.exec(name);
    if (numResult === null) {
      return uniqueName(name + "2");
    }
    return uniqueName(name.slice(0, numResult.index) + (parseInt(numResult[0], 10) + 1));
  }
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

  // Sprite identifier must not conflict with module-level/global identifiers,
  // imports and any others that are referenced in generated code.
  //
  // Only classes and similar capitalized namespaces need to be listed here:
  // generated sprite names will never conflict with identifiers whose first
  // letter is lowercase. (This is also why JavaScript reserved words aren't
  // listed here - they're all lowercase, so sprite names won't conflict.)
  const uniqueSpriteName = uniqueNameGenerator(["Color", "Costume", "Sound", "Sprite", "Trigger", "Watcher"]);

  let targetNameMap = {};
  let customBlockArgNameMap: Map<Script, { [key: string]: string }> = new Map();
  let variableNameMap: { [id: string]: string } = {}; // ID to unique (Leopard) name

  for (const target of [project.stage, ...project.sprites]) {
    const newTargetName = uniqueSpriteName(camelCase(target.name, true));
    targetNameMap[target.name] = newTargetName;
    target.setName(newTargetName);

    // Variables are uniquely named per-target. These are on an empty namespace
    // so don't have any conflicts.
    //
    // Note: since variables are serialized as properties on an object (this.vars),
    // these never conflict with reserved JavaScript words like "class" or "new".
    let uniqueVariableName = uniqueNameGenerator();

    for (const { id, name } of [...target.lists, ...target.variables]) {
      const newName = uniqueVariableName(camelCase(name));
      variableNameMap[id] = newName;
    }

    // Scripts are uniquely named per-target. These are on the sprite's main
    // namespace, so must not conflict with properties and methods defined on
    // all sprites/targets by Leopard.
    //
    // The list of reserved names is technically different between BaseSprite,
    // Sprite, and Stage, but all three are considered together here, whatever
    // kind of target will actually be getting script names here.
    //
    // Note: since scripts are serialized as class methods, these never conflict
    // with reserved JavaScript words like "class" or "new" (they're accessed
    // with the same typeof syntax, e.g. this.whenGreenFlagClicked).
    const uniqueScriptName = uniqueNameGenerator([
      // Essential data
      "costumes",
      "effectChain",
      "effects",
      "height",
      "name",
      "sounds",
      "triggers",
      "vars",
      "watchers",
      "width",

      // Other objects
      "andClones",
      "clones",
      "stage",
      "sprites",
      "parent",

      // Motion
      "direction",
      "glide",
      "goto",
      "move",
      "rotationStyle",
      "x",
      "y",

      // Looks
      "costumeNumber",
      "costume",
      "moveAhead",
      "moveBehind",
      "say",
      "sayAndWait",
      "size",
      "think",
      "thinkAndWait",
      "visible",

      // Sounds
      "audioEffects",
      "getSound",
      "getSoundsPlayedByMe",
      "playSoundUntilDone",
      "startSound",
      "stapAllOfMySounds",
      "stopAllSounds",

      // Control & events
      "broadcast",
      "broadcastAndWait",
      "createClone",
      "deleteThisClone",
      "fireBackdropChanged",
      "wait",
      "warp",

      // Opeartors - casting
      "toNumber",
      "toBoolean",
      "toString",
      "compare",

      // Operators - strings
      "stringIncludes",
      "letterOf",

      // Operators - numbers
      "degToRad",
      "degToScratch",
      "radToDeg",
      "radToScratch",
      "random",
      "scratchToDeg",
      "scratchToRad",
      "normalizeDeg",

      // Sensing
      "answer",
      "askAndWait",
      "colorTouching",
      "keyPressed",
      "loudness",
      "mouse",
      "restartTimer",
      "timer",
      "touching",

      // Lists (arrays)
      "arrayIncludes",
      "indexInArray",
      "itemOf",

      // Pen
      "clearPen",
      "penColor",
      "penDown",
      "penSize",
      "stamp"
    ]);

    for (const script of target.scripts) {
      script.setName(uniqueScriptName(camelCase(script.name)));

      const argNameMap = {};
      customBlockArgNameMap.set(script, argNameMap);

      // Parameter names aren't defined on a namespace at all, so must not conflict
      // with JavaScript reserved words.
      const uniqueParamName = uniqueNameGenerator(JS_RESERVED_WORDS);

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

  function staticBlockInputToLiteral(
    value: string | number | boolean | object,
    desiredInputShape?: InputShape
  ): string {
    // Short-circuit for string inputs. These must never return number syntax.
    if (desiredInputShape === "string") {
      return JSON.stringify(value);
    }

    // Other input shapes which static inputs may fulfill: number, index, any.
    // These are all OK to return JavaScript number literals for.
    const asNum = Number(value as string);
    if (!isNaN(asNum) && value !== "") {
      if (desiredInputShape === "index") {
        return JSON.stringify(asNum - 1);
      } else {
        return JSON.stringify(asNum);
      }
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
            : staticBlockInputToLiteral(valueInput.value, InputShape.Number);
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

    function increase(leftSide: string, input: BlockInput.Any, allowIncrementDecrement: Boolean) {
      let n;
      if (input.type === "block" || ((n = Number(input.value)), isNaN(n))) {
        return `${leftSide} += (${inputToJS(input, InputShape.Number)});`;
      }

      if (allowIncrementDecrement && n === 1) {
        return `${leftSide}++;`;
      } else if (allowIncrementDecrement && n === -1) {
        return `${leftSide}--;`;
      } else if (n >= 0) {
        return `${leftSide} += ${JSON.stringify(n)};`;
      } else if (n < 0) {
        return `${leftSide} -= ${JSON.stringify(-n)};`;
      }
    }

    function decrease(leftSide: string, input: BlockInput.Any, allowIncrementDecrement: Boolean = true) {
      let n;
      if (input.type === "block" || ((n = Number(input.value)), isNaN(n))) {
        return `${leftSide} -= (${inputToJS(input, InputShape.Number)})`;
      }

      if (allowIncrementDecrement && n === 1) {
        return `${leftSide}--`;
      } else if (allowIncrementDecrement && n === -1) {
        return `${leftSide}++`;
      } else if (n > 0) {
        return `${leftSide} -= ${JSON.stringify(n)}`;
      } else if (n <= 0) {
        return `${leftSide} += ${JSON.stringify(-n)}`;
      }
    }

    function inputToJS(input: BlockInput.Any, desiredInputShape: InputShape): string {
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
          return staticBlockInputToLiteral(input.value, desiredInputShape);
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
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.move(${inputToJS(block.inputs.STEPS, InputShape.Number)})`;
          break;

        case OpCode.motion_turnright:
          satisfiesInputShape = InputShape.Stack;
          blockSource = increase(`this.direction`, block.inputs.DEGREES, false);
          break;

        case OpCode.motion_turnleft:
          satisfiesInputShape = InputShape.Stack;
          blockSource = decrease(`this.direction`, block.inputs.DEGREES, false);
          break;

        case OpCode.motion_goto:
          satisfiesInputShape = InputShape.Stack;
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
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.goto((${inputToJS(block.inputs.X, InputShape.Number)}), (${inputToJS(block.inputs.Y, InputShape.Number)}))`;
          break;

        case OpCode.motion_glideto: {
          const secs = inputToJS(block.inputs.SECS, InputShape.Number);
          satisfiesInputShape = InputShape.Stack;

          switch (block.inputs.TO.value) {
            case "_random_":
              blockSource = `yield* this.glide(${secs}, this.random(-240, 240), this.random(-180, 180))`;
              break;
            case "_mouse_":
              blockSource = `yield* this.glide(${secs}, this.mouse.x, this.mouse.y)`;
              break;
            default: {
              const sprite = `(this.sprites[${JSON.stringify(targetNameMap[block.inputs.TO.value])}])`;
              blockSource = `yield* this.glide(${secs}, ${sprite}.x, ${sprite}.y)`;
              break;
            }
          }
          break;
        }

        case OpCode.motion_glidesecstoxy:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `yield* this.glide((${inputToJS(block.inputs.SECS, InputShape.Number)}), (${inputToJS(
            block.inputs.X,
            InputShape.Number
          )}), (${inputToJS(block.inputs.Y, InputShape.Number)}))`;
          break;

        case OpCode.motion_pointindirection:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.direction = (${inputToJS(block.inputs.DIRECTION, InputShape.Number)})`;
          break;

        case OpCode.motion_pointtowards: {
          let coords: string;

          switch (block.inputs.TOWARDS.value) {
            case "_mouse_":
              coords = `this.mouse`;
              break;
            default: {
              coords = `this.sprites[${JSON.stringify(targetNameMap[block.inputs.TOWARDS.value])}]`;
              break;
            }
          }

          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.direction = this.radToScratch(Math.atan2(${coords}.y - this.y, ${coords}.x - this.x))`;
          break;
        }

        case OpCode.motion_changexby:
          satisfiesInputShape = InputShape.Stack;
          blockSource = increase(`this.x`, block.inputs.DX, false);
          break;

        case OpCode.motion_setx:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.x = (${inputToJS(block.inputs.X, InputShape.Number)})`;
          break;

        case OpCode.motion_changeyby:
          satisfiesInputShape = InputShape.Stack;
          blockSource = increase(`this.y`, block.inputs.DY, false);
          break;

        case OpCode.motion_sety:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.y = (${inputToJS(block.inputs.Y, InputShape.Number)})`;
          break;

        case OpCode.motion_setrotationstyle:
          satisfiesInputShape = InputShape.Stack;
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
          satisfiesInputShape = InputShape.Number;
          blockSource = `this.x`;
          break;

        case OpCode.motion_yposition:
          satisfiesInputShape = InputShape.Number;
          blockSource = `this.y`;
          break;

        case OpCode.motion_direction:
          satisfiesInputShape = InputShape.Number;
          blockSource = `this.direction`;
          break;

        // Obsolete no-op blocks:
        case OpCode.motion_scroll_right:
        case OpCode.motion_scroll_up:
        case OpCode.motion_align_scene:
          satisfiesInputShape = InputShape.Stack;
          blockSource = ``;
          break;

        case OpCode.motion_xscroll:
        case OpCode.motion_yscroll:
          satisfiesInputShape = InputShape.Any;
          blockSource = `undefined`; // Compatibility with Scratch 3.0 \:)/
          break;

        case OpCode.looks_sayforsecs:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `yield* this.sayAndWait((${inputToJS(block.inputs.MESSAGE, InputShape.Any)}), (${inputToJS(
            block.inputs.SECS,
            InputShape.Number
          )}))`;
          break;

        case OpCode.looks_say:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.say(${inputToJS(block.inputs.MESSAGE, InputShape.Any)})`;
          break;

        case OpCode.looks_thinkforsecs:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `yield* this.thinkAndWait((${inputToJS(block.inputs.MESSAGE, InputShape.Any)}), (${inputToJS(
            block.inputs.SECS,
            InputShape.Number
          )}))`;
          break;

        case OpCode.looks_think:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.think(${inputToJS(block.inputs.MESSAGE, InputShape.Any)})`;
          break;

        case OpCode.looks_switchcostumeto:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.costume = (${inputToJS(block.inputs.COSTUME, InputShape.Any)})`;
          break;

        case OpCode.looks_nextcostume:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.costumeNumber++`;
          break;

        case OpCode.looks_switchbackdropto:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `${stage}.costume = (${inputToJS(block.inputs.BACKDROP, InputShape.Any)})`;
          break;

        case OpCode.looks_nextbackdrop:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `${stage}.costumeNumber++`;
          break;

        case OpCode.looks_changesizeby:
          satisfiesInputShape = InputShape.Stack;
          blockSource = increase(`this.size`, block.inputs.CHANGE, false);
          break;

        case OpCode.looks_setsizeto:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.size = (${inputToJS(block.inputs.SIZE, InputShape.Number)})`;
          break;

        case OpCode.looks_changeeffectby: {
          const effectName = block.inputs.EFFECT.value.toLowerCase();
          satisfiesInputShape = InputShape.Stack;
          blockSource = increase(`this.effects.${effectName}`, block.inputs.CHANGE, false);
          break;
        }

        case OpCode.looks_seteffectto: {
          const effectName = block.inputs.EFFECT.value.toLowerCase();
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.effects.${effectName} = ${inputToJS(block.inputs.VALUE, InputShape.Number)}`;
          break;
        }

        case OpCode.looks_cleargraphiceffects:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.effects.clear()`;
          break;

        case OpCode.looks_show:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.visible = true`;
          break;

        case OpCode.looks_hide:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.visible = false`;
          break;

        case OpCode.looks_gotofrontback:
          satisfiesInputShape = InputShape.Stack;
          if (block.inputs.FRONT_BACK.value === "front") {
            blockSource = `this.moveAhead()`;
          } else {
            blockSource = `this.moveBehind()`;
          }
          break;

        case OpCode.looks_goforwardbackwardlayers:
          satisfiesInputShape = InputShape.Stack;
          if (block.inputs.FORWARD_BACKWARD.value === "forward") {
            blockSource = `this.moveAhead(${inputToJS(block.inputs.NUM, InputShape.Number)})`;
          } else {
            blockSource = `this.moveBehind(${inputToJS(block.inputs.NUM, InputShape.Number)})`;
          }
          break;

        // Obsolete no-op blocks:
        case OpCode.looks_hideallsprites:
        case OpCode.looks_changestretchby:
        case OpCode.looks_setstretchto:
          satisfiesInputShape = InputShape.Stack;
          blockSource = ``;
          break;

        case OpCode.looks_costumenumbername:
          switch (block.inputs.NUMBER_NAME.value) {
            case "name":
              satisfiesInputShape = InputShape.String;
              blockSource = `this.costume.name`;
              break;
            case "number":
            default:
              satisfiesInputShape = InputShape.Number;
              blockSource = `this.costumeNumber`;
              break;
          }
          break;

        case OpCode.looks_backdropnumbername:
          switch (block.inputs.NUMBER_NAME.value) {
            case "name":
              satisfiesInputShape = InputShape.String;
              blockSource = `${stage}.costume.name`;
              break;
            case "number":
            default:
              satisfiesInputShape = InputShape.Number;
              blockSource = `${stage}.costumeNumber`;
              break;
          }
          break;

        case OpCode.looks_size:
          satisfiesInputShape = InputShape.Number;
          blockSource = `this.size`;
          break;

        case OpCode.sound_playuntildone:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `yield* this.playSoundUntilDone(${inputToJS(block.inputs.SOUND_MENU, InputShape.Any)})`;
          break;

        case OpCode.sound_play:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `yield* this.startSound(${inputToJS(block.inputs.SOUND_MENU, InputShape.Any)})`;
          break;

        case OpCode.sound_setvolumeto:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.audioEffects.volume = ${inputToJS(block.inputs.VOLUME, InputShape.Number)}`;
          break;

        case OpCode.sound_changevolumeby:
          satisfiesInputShape = InputShape.Stack;
          blockSource = increase(`this.audioEffects.volume`, block.inputs.VOLUME, false);
          break;

        case OpCode.sound_volume:
          satisfiesInputShape = InputShape.Number;
          blockSource = `this.audioEffects.volume`;
          break;

        case OpCode.sound_seteffectto: {
          satisfiesInputShape = InputShape.Stack;
          const value = inputToJS(block.inputs.VALUE, InputShape.Number);
          if (block.inputs.EFFECT.type === "soundEffect") {
            blockSource = `this.audioEffects.${block.inputs.EFFECT.value.toLowerCase()} = ${value}`;
          } else {
            blockSource = `this.audioEffects[${inputToJS(block.inputs.EFFECT, InputShape.Any)}] = ${value}`;
          }
          break;
        }

        case OpCode.sound_changeeffectby: {
          satisfiesInputShape = InputShape.Stack;
          const value = block.inputs.VALUE;
          if (block.inputs.EFFECT.type === "soundEffect") {
            blockSource = increase(`this.audioEffects.${block.inputs.EFFECT.value.toLowerCase()}`, value, false);
          } else {
            blockSource = increase(`this.audioEffects[${inputToJS(block.inputs.EFFECT, InputShape.Any)}]`, value, false);
          }
          break;
        }

        case OpCode.sound_cleareffects:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.audioEffects.clear()`;
          break;

        case OpCode.sound_stopallsounds:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.stopAllSounds()`;
          break;

        case OpCode.event_broadcast:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.broadcast(${inputToJS(block.inputs.BROADCAST_INPUT, InputShape.String)})`;
          break;

        case OpCode.event_broadcastandwait:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `yield* this.broadcastAndWait(${inputToJS(block.inputs.BROADCAST_INPUT, InputShape.String)})`;
          break;

        case OpCode.control_wait:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `yield* this.wait(${inputToJS(block.inputs.DURATION, InputShape.Number)})`;
          break;

        case OpCode.control_repeat:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `for (let i = 0; i < (${inputToJS(block.inputs.TIMES, InputShape.Number)}); i++) {
            ${inputToJS(block.inputs.SUBSTACK, InputShape.Stack)};
            ${warp ? "" : "yield;"}
          }`;
          break;

        case OpCode.control_forever:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `while (true) {
            ${inputToJS(block.inputs.SUBSTACK, InputShape.Stack)};
            ${warp ? "" : "yield;"}
          }`;
          break;

        case OpCode.control_if:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `if (${inputToJS(block.inputs.CONDITION, InputShape.Boolean)}) {
            ${inputToJS(block.inputs.SUBSTACK, InputShape.Stack)}
          }`;
          break;

        case OpCode.control_if_else:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `if (${inputToJS(block.inputs.CONDITION, InputShape.Boolean)}) {
            ${inputToJS(block.inputs.SUBSTACK, InputShape.Stack)}
          } else {
            ${inputToJS(block.inputs.SUBSTACK2, InputShape.Stack)}
          }`;
          break;

        case OpCode.control_wait_until:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `while (!(${inputToJS(block.inputs.CONDITION, InputShape.Boolean)})) { yield; }`;
          break;

        case OpCode.control_repeat_until:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `while (!(${inputToJS(block.inputs.CONDITION, InputShape.Boolean)})) {
            ${inputToJS(block.inputs.SUBSTACK, InputShape.Stack)}
            ${warp ? "" : "yield;"}
          }`;
          break;

        case OpCode.control_while:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `while (${inputToJS(block.inputs.CONDITION, InputShape.Boolean)}) {
            ${inputToJS(block.inputs.SUBSTACK, InputShape.Stack)}
            ${warp ? "" : "yield;"}
          }`;
          break;

        case OpCode.control_for_each:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `for (${selectedVarSource} = 1; ${selectedVarSource} <= (${inputToJS(
            block.inputs.VALUE,
            InputShape.Number
          )}); ${selectedVarSource}++) {
            ${inputToJS(block.inputs.SUBSTACK, InputShape.Stack)}
            ${warp ? "" : "yield;"}
          }`;
          break;

        case OpCode.control_all_at_once:
          satisfiesInputShape = InputShape.Stack;
          blockSource = inputToJS(block.inputs.SUBSTACK, InputShape.Stack);
          break;

        case OpCode.control_stop:
          satisfiesInputShape = InputShape.Stack;
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
          satisfiesInputShape = InputShape.Stack;
          switch (block.inputs.CLONE_OPTION.value) {
            case "_myself_":
              blockSource = `this.createClone()`;
              break;
            default:
              blockSource = `this.sprites[${JSON.stringify(
                targetNameMap[block.inputs.CLONE_OPTION.value]
              )}].createClone()`;
              break;
          }
          break;

        case OpCode.control_delete_this_clone:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.deleteThisClone()`;
          break;

        case OpCode.control_get_counter:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `${stage}.__counter`;
          break;

        case OpCode.control_incr_counter:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `${stage}.__counter++`;
          break;

        case OpCode.control_clear_counter:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `${stage}.__counter = 0`;
          break;

        case OpCode.sensing_touchingobject:
          satisfiesInputShape = InputShape.Boolean;
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
          satisfiesInputShape = InputShape.Boolean;
          if (block.inputs.COLOR.type === "color") {
            const { r, g, b } = block.inputs.COLOR.value;
            blockSource = `this.touching(Color.rgb(${r}, ${g}, ${b}))`;
          } else {
            blockSource = `this.touching(Color.num(${inputToJS(block.inputs.COLOR, InputShape.Number)}))`;
          }
          break;

        case OpCode.sensing_coloristouchingcolor: {
          let color1: string;
          let color2: string;

          if (block.inputs.COLOR.type === "color") {
            const { r, g, b } = block.inputs.COLOR.value;
            color1 = `Color.rgb(${r}, ${g}, ${b})`;
          } else {
            color1 = `Color.num(${inputToJS(block.inputs.COLOR, InputShape.Number)})`;
          }

          if (block.inputs.COLOR2.type === "color") {
            const { r, g, b } = block.inputs.COLOR2.value;
            color2 = `Color.rgb(${r}, ${g}, ${b})`;
          } else {
            color2 = `Color.num(${inputToJS(block.inputs.COLOR2, InputShape.Number)})`;
          }

          satisfiesInputShape = InputShape.Boolean;
          blockSource = `this.colorTouching((${color1}), (${color2}))`;
          break;
        }

        case OpCode.sensing_distanceto: {
          let coords: string;

          switch (block.inputs.DISTANCETOMENU.value) {
            case "_mouse_":
              coords = `this.mouse`;
              break;
            default:
              coords = `this.sprites[${JSON.stringify(targetNameMap[block.inputs.DISTANCETOMENU.value])}]`;
              break;
          }

          satisfiesInputShape = InputShape.Number;
          blockSource = `(Math.hypot(${coords}.x - this.x, ${coords}.y - this.y))`;
          break;
        }

        case OpCode.sensing_askandwait:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `yield* this.askAndWait(${inputToJS(block.inputs.QUESTION, InputShape.Any)})`;
          break;

        case OpCode.sensing_answer:
          satisfiesInputShape = InputShape.String;
          blockSource = `this.answer`;
          break;

        case OpCode.sensing_keypressed:
          satisfiesInputShape = InputShape.Boolean;
          blockSource = `this.keyPressed(${inputToJS(block.inputs.KEY_OPTION, InputShape.String)})`;
          break;

        case OpCode.sensing_mousedown:
          satisfiesInputShape = InputShape.Boolean;
          blockSource = `this.mouse.down`;
          break;
        case OpCode.sensing_mousex:
          satisfiesInputShape = InputShape.Number;
          blockSource = `this.mouse.x`;
          break;

        case OpCode.sensing_mousey:
          satisfiesInputShape = InputShape.Number;
          blockSource = `this.mouse.y`;
          break;

        case OpCode.sensing_loudness:
          satisfiesInputShape = InputShape.Number;
          blockSource = `this.loudness`;
          break;

        case OpCode.sensing_timer:
          satisfiesInputShape = InputShape.Number;
          blockSource = `this.timer`;
          break;

        case OpCode.sensing_resettimer:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.restartTimer()`;
          break;

        case OpCode.sensing_of: {
          let propName: string;
          switch (block.inputs.PROPERTY.value) {
            case "x position":
              propName = "x";
              satisfiesInputShape = InputShape.Number;
              break;
            case "y position":
              propName = "y";
              satisfiesInputShape = InputShape.Number;
              break;
            case "direction":
              propName = "direction";
              satisfiesInputShape = InputShape.Number;
              break;
            case "costume #":
            case "backdrop #":
              propName = "costumeNumber";
              satisfiesInputShape = InputShape.Number;
              break;
            case "costume name":
            case "backdrop name":
              propName = "costume.name";
              satisfiesInputShape = InputShape.String;
              break;
            case "size":
              propName = "size";
              satisfiesInputShape = InputShape.Number;
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
              satisfiesInputShape = InputShape.Any;
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
          satisfiesInputShape = InputShape.Number;
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
          satisfiesInputShape = InputShape.Number;
          blockSource = `(((new Date().getTime() - new Date(2000, 0, 1)) / 1000 / 60 + new Date().getTimezoneOffset()) / 60 / 24)`;
          break;

        case OpCode.sensing_username:
          satisfiesInputShape = InputShape.String;
          blockSource = `(/* no username */ "")`;
          break;

        case OpCode.sensing_userid:
          satisfiesInputShape = InputShape.Any;
          blockSource = `undefined`; // Obsolete no-op block.
          break;

        case OpCode.operator_add:
          if (desiredInputShape === "index") {
            satisfiesInputShape = InputShape.Index;
            if ((block.inputs.NUM2 as BlockInput.Any).type !== "block" && !isNaN(Number(block.inputs.NUM2.value))) {
              if (Number(block.inputs.NUM2.value) === 1) {
                blockSource = `(${inputToJS(block.inputs.NUM1, InputShape.Number)})`;
              } else {
                blockSource = `((${inputToJS(block.inputs.NUM1, InputShape.Number)}) + ${(block.inputs.NUM2.value as number) -
                  1})`;
              }
            } else if (
              (block.inputs.NUM1 as BlockInput.Any).type !== "block" &&
              !isNaN(Number(block.inputs.NUM1.value))
            ) {
              satisfiesInputShape = InputShape.Index;
              if (Number(block.inputs.NUM1.value) === 1) {
                blockSource = `(${inputToJS(block.inputs.NUM2, InputShape.Number)})`;
              } else {
                blockSource = `(${(block.inputs.NUM2.value as number) - 1} + ${inputToJS(
                  block.inputs.NUM2,
                  InputShape.Number
                )})`;
              }
            }
            break;
          }
          satisfiesInputShape = InputShape.Number;
          blockSource = `((${inputToJS(block.inputs.NUM1, InputShape.Number)}) + (${inputToJS(block.inputs.NUM2, InputShape.Number)}))`;
          break;

        case OpCode.operator_subtract:
          satisfiesInputShape = InputShape.Number;
          blockSource = `((${inputToJS(block.inputs.NUM1, InputShape.Number)}) - (${inputToJS(block.inputs.NUM2, InputShape.Number)}))`;
          break;

        case OpCode.operator_multiply:
          satisfiesInputShape = InputShape.Number;
          blockSource = `((${inputToJS(block.inputs.NUM1, InputShape.Number)}) * (${inputToJS(block.inputs.NUM2, InputShape.Number)}))`;
          break;

        case OpCode.operator_divide:
          satisfiesInputShape = InputShape.Number;
          blockSource = `((${inputToJS(block.inputs.NUM1, InputShape.Number)}) / (${inputToJS(block.inputs.NUM2, InputShape.Number)}))`;
          break;

        case OpCode.operator_random:
          satisfiesInputShape = InputShape.Number;
          blockSource = `this.random(${inputToJS(block.inputs.FROM, InputShape.Number)}, ${inputToJS(block.inputs.TO, InputShape.Number)})`;
          break;

        case OpCode.operator_gt:
          satisfiesInputShape = InputShape.Boolean;
          blockSource = `(this.compare((${inputToJS(block.inputs.OPERAND1, InputShape.Any)}), (${inputToJS(
            block.inputs.OPERAND2,
            InputShape.Any
          )})) > 0)`;
          break;

        case OpCode.operator_lt:
          satisfiesInputShape = InputShape.Boolean;
          blockSource = `(this.compare((${inputToJS(block.inputs.OPERAND1, InputShape.Any)}), (${inputToJS(
            block.inputs.OPERAND2,
            InputShape.Any
          )})) < 0)`;
          break;

        case OpCode.operator_equals:
          satisfiesInputShape = InputShape.Boolean;
          if (
            (block.inputs.OPERAND1 as BlockInput.Any).type !== "block" &&
            !isNaN(Number(block.inputs.OPERAND1.value))
          ) {
            blockSource = `(${Number(block.inputs.OPERAND1.value)} === (${inputToJS(
              block.inputs.OPERAND2,
              InputShape.Number
            )}))`;
          } else if (
            (block.inputs.OPERAND2 as BlockInput.Any).type !== "block" &&
            !isNaN(Number(block.inputs.OPERAND2.value))
          ) {
            blockSource = `((${inputToJS(block.inputs.OPERAND1, InputShape.Number)}) === ${Number(
              block.inputs.OPERAND2.value
            )})`;
          } else if ((block.inputs.OPERAND1 as BlockInput.Any).type !== "block") {
            blockSource = `(${JSON.stringify(block.inputs.OPERAND1.value)} === (${inputToJS(
              block.inputs.OPERAND2,
              InputShape.Any
            )}))`;
          } else if ((block.inputs.OPERAND2 as BlockInput.Any).type !== "block") {
            blockSource = `((${inputToJS(block.inputs.OPERAND1, InputShape.Any)}) === ${JSON.stringify(
              block.inputs.OPERAND2.value
            )})`;
          } else {
            blockSource = `(this.compare((${inputToJS(block.inputs.OPERAND1, InputShape.Any)}), (${inputToJS(
              block.inputs.OPERAND2,
              InputShape.Any
            )})) === 0)`;
          }
          break;

        case OpCode.operator_and:
          satisfiesInputShape = InputShape.Boolean;
          blockSource = `((${inputToJS(block.inputs.OPERAND1, InputShape.Boolean)}) && (${inputToJS(
            block.inputs.OPERAND2,
            InputShape.Boolean
          )}))`;
          break;

        case OpCode.operator_or:
          satisfiesInputShape = InputShape.Boolean;
          blockSource = `((${inputToJS(block.inputs.OPERAND1, InputShape.Boolean)}) || (${inputToJS(
            block.inputs.OPERAND2,
            InputShape.Boolean
          )}))`;
          break;

        case OpCode.operator_not:
          satisfiesInputShape = InputShape.Boolean;
          blockSource = `(!(${inputToJS(block.inputs.OPERAND, InputShape.Boolean)}))`;
          break;

        case OpCode.operator_join:
          satisfiesInputShape = InputShape.String;
          blockSource = `((${inputToJS(block.inputs.STRING1, InputShape.String)}) + (${inputToJS(
            block.inputs.STRING2,
            InputShape.String
          )}))`;
          break;

        case OpCode.operator_letter_of:
          satisfiesInputShape = InputShape.String;
          blockSource = `this.letterOf(${inputToJS(block.inputs.STRING, InputShape.Any)}, ${inputToJS(
            block.inputs.LETTER,
            InputShape.Index
          )})`;
          break;

        case OpCode.operator_length:
          satisfiesInputShape = InputShape.Number;
          blockSource = `(${inputToJS(block.inputs.STRING, InputShape.String)}).length`;
          break;

        case OpCode.operator_contains:
          satisfiesInputShape = InputShape.Boolean;
          blockSource = `this.stringIncludes(${inputToJS(block.inputs.STRING1, InputShape.String)}, ${inputToJS(
            block.inputs.STRING2,
            InputShape.String
          )})`;
          break;

        case OpCode.operator_mod:
          satisfiesInputShape = InputShape.Number;
          blockSource = `((${inputToJS(block.inputs.NUM1, InputShape.Number)}) % (${inputToJS(block.inputs.NUM2, InputShape.Number)}))`;
          break;

        case OpCode.operator_round:
          satisfiesInputShape = InputShape.Number;
          blockSource = `Math.round(${inputToJS(block.inputs.NUM, InputShape.Number)})`;
          break;

        case OpCode.operator_mathop: {
          const inputSource = inputToJS(block.inputs.NUM, InputShape.Number);
          satisfiesInputShape = InputShape.Number;
          switch (block.inputs.OPERATOR.value) {
            case "abs":
              blockSource = `Math.abs(${inputSource})`;
              break;
            case "floor":
              blockSource = `Math.floor(${inputSource})`;
              break;
            case "ceiling":
              blockSource = `Math.ceil(${inputSource})`;
              break;
            case "sqrt":
              blockSource = `Math.sqrt(${inputSource})`;
              break;
            case "sin":
              blockSource = `Math.sin(this.degToRad(${inputSource}))`;
              break;
            case "cos":
              blockSource = `Math.cos(this.degToRad(${inputSource}))`;
              break;
            case "tan":
              blockSource = `this.scratchTan(${inputSource})`;
              break;
            case "asin":
              blockSource = `this.radToDeg(Math.asin(${inputSource}))`;
              break;
            case "acos":
              blockSource = `this.radToDeg(Math.acos(${inputSource}))`;
              break;
            case "atan":
              blockSource = `this.radToDeg(Math.atan(${inputSource}))`;
              break;
            case "ln":
              blockSource = `Math.log(${inputSource})`;
              break;
            case "log":
              blockSource = `Math.log10(${inputSource})`;
              break;
            case "e ^":
              blockSource = `(Math.E ** (${inputSource}))`;
              break;
            case "10 ^":
              blockSource = `(10 ** (${inputSource}))`;
              break;
          }
          break;
        }

        case OpCode.data_variable:
          satisfiesInputShape = InputShape.Stack;
          blockSource = selectedVarSource;
          break;

        case OpCode.data_setvariableto:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `${selectedVarSource} = (${inputToJS(block.inputs.VALUE, InputShape.Any)})`;
          break;

        case OpCode.data_changevariableby:
          satisfiesInputShape = InputShape.Stack;
          blockSource = increase(selectedVarSource, block.inputs.VALUE, true);
          break;

        case OpCode.data_showvariable:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `${selectedWatcherSource}.visible = true`;
          break;

        case OpCode.data_hidevariable:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `${selectedWatcherSource}.visible = false`;
          break;

        case OpCode.data_listcontents:
          satisfiesInputShape = InputShape.String;
          blockSource = `${selectedVarSource}.join(" ")`;
          break;

        case OpCode.data_addtolist:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `${selectedVarSource}.push(${inputToJS(block.inputs.ITEM, InputShape.Any)})`;
          break;

        case OpCode.data_deleteoflist:
          satisfiesInputShape = InputShape.Stack;
          // Supposed to be a numerical index, but can be
          // string "all" when sb2 converted to sb3 by Scratch
          if (block.inputs.INDEX.value === "all") {
            blockSource = `${selectedVarSource} = []`;
          } else if (block.inputs.INDEX.value === "last") {
            blockSource = `${selectedVarSource}.splice(${selectedVarSource}.length - 1, 1)`;
          } else {
            blockSource = `${selectedVarSource}.splice((${inputToJS(block.inputs.INDEX, InputShape.Index)}), 1)`;
          }
          break;

        case OpCode.data_deletealloflist:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `${selectedVarSource} = []`;
          break;

        case OpCode.data_insertatlist: {
          const index = inputToJS(block.inputs.INDEX, InputShape.Index);
          const item = inputToJS(block.inputs.ITEM, InputShape.Any);
          satisfiesInputShape = InputShape.Stack;
          blockSource = `${selectedVarSource}.splice(${index}, 0, ${item})`;
          break;
        }

        case OpCode.data_replaceitemoflist: {
          const index = inputToJS(block.inputs.INDEX, InputShape.Index);
          const item = inputToJS(block.inputs.ITEM, InputShape.Any);
          satisfiesInputShape = InputShape.Stack;
          blockSource = `${selectedVarSource}.splice(${index}, 1, ${item})`;
          break;
        }

        case OpCode.data_itemoflist:
          satisfiesInputShape = InputShape.Any;
          if (block.inputs.INDEX.value === "last") {
            blockSource = `this.itemOf(${selectedVarSource}, ${selectedVarSource}.length - 1)`;
          } else {
            blockSource = `this.itemOf(${selectedVarSource}, ${inputToJS(block.inputs.INDEX, InputShape.Index)})`;
          }
          break;

        case OpCode.data_itemnumoflist:
          if (desiredInputShape === InputShape.Index) {
            satisfiesInputShape = InputShape.Index;
            blockSource = `this.indexInArray(${selectedVarSource}, ${inputToJS(block.inputs.ITEM, InputShape.Any)})`;
          } else {
            satisfiesInputShape = InputShape.Number;
            blockSource = `(this.indexInArray(${selectedVarSource}, ${inputToJS(block.inputs.ITEM, InputShape.Any)}) + 1)`;
          }
          break;

        case OpCode.data_lengthoflist:
          satisfiesInputShape = InputShape.Number;
          blockSource = `${selectedVarSource}.length`;
          break;

        case OpCode.data_listcontainsitem:
          satisfiesInputShape = InputShape.Boolean;
          blockSource = `this.arrayIncludes(${selectedVarSource}, ${inputToJS(block.inputs.ITEM, InputShape.Any)})`;
          break;

        case OpCode.data_showlist:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `${selectedWatcherSource}.visible = true`;
          break;

        case OpCode.data_hidelist:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `${selectedWatcherSource}.visible = false`;
          break;

        case OpCode.procedures_call: {
          satisfiesInputShape = InputShape.Stack;

          // Get name of custom block script with given PROCCODE:
          const procName = target.scripts.find(
            script =>
              script.hat !== null &&
              script.hat.opcode === OpCode.procedures_definition &&
              script.hat.inputs.PROCCODE.value === block.inputs.PROCCODE.value
          ).name;

          // TODO: Boolean inputs should provide appropriate desiredInputShape instead of "any"
          const procArgs = `${block.inputs.INPUTS.value.map(input => inputToJS(input, InputShape.Any)).join(", ")}`;

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
            satisfiesInputShape = InputShape.Number;
            blockSource = `0`;
            break;
          }

          if (block.opcode === OpCode.argument_reporter_boolean) {
            satisfiesInputShape = InputShape.Boolean;
          } else {
            satisfiesInputShape = InputShape.Any;
          }
          blockSource = customBlockArgNameMap.get(script)[block.inputs.VALUE.value];
          break;

        case OpCode.pen_clear:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.clearPen()`;
          break;

        case OpCode.pen_stamp:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.stamp()`;
          break;

        case OpCode.pen_penDown:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.penDown = true`;
          break;

        case OpCode.pen_penUp:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.penDown = false`;
          break;

        case OpCode.pen_setPenColorToColor:
          satisfiesInputShape = InputShape.Stack;
          if (block.inputs.COLOR.type === "color") {
            const { r, g, b } = block.inputs.COLOR.value;
            blockSource = `this.penColor = Color.rgb(${r}, ${g}, ${b})`;
          } else {
            blockSource = `this.penColor = Color.num(${inputToJS(block.inputs.COLOR, InputShape.Number)})`;
          }
          break;

        case OpCode.pen_changePenColorParamBy:
          satisfiesInputShape = InputShape.Stack;
          switch (block.inputs.colorParam.value) {
            case "color":
              blockSource = increase(`this.penColor.h`, block.inputs.VALUE, false);
              break;
            case "saturation":
              blockSource = increase(`this.penColor.s`, block.inputs.VALUE, false);
              break;
            case "brightness":
              blockSource = increase(`this.penColor.v`, block.inputs.VALUE, false);
              break;
            case "transparency":
              blockSource = `this.penColor.a -= ((${inputToJS(block.inputs.VALUE, InputShape.Number)}) / 100)`;
              break;
          }
          break;

        case OpCode.pen_setPenColorParamTo:
          satisfiesInputShape = InputShape.Stack;
          switch (block.inputs.colorParam.value) {
            case "color":
              blockSource = `this.penColor.h = (${inputToJS(block.inputs.VALUE, InputShape.Number)})`;
              break;
            case "saturation":
              blockSource = `this.penColor.s = (${inputToJS(block.inputs.VALUE, InputShape.Number)})`;
              break;
            case "brightness":
              blockSource = `this.penColor.v = (${inputToJS(block.inputs.VALUE, InputShape.Number)})`;
              break;
            case "transparency":
              blockSource = `this.penColor.a = (1 - ((${inputToJS(block.inputs.VALUE, InputShape.Any)}) / 100))`;
              break;
          }
          break;

        case OpCode.pen_setPenSizeTo:
          satisfiesInputShape = InputShape.Stack;
          blockSource = `this.penSize = (${inputToJS(block.inputs.SIZE, InputShape.Number)})`;
          break;

        case OpCode.pen_changePenSizeBy:
          satisfiesInputShape = InputShape.Stack;
          blockSource = increase(`this.penSize`, block.inputs.SIZE, false);
          break;

        default:
          satisfiesInputShape = InputShape.Any;
          blockSource = `/* TODO: Implement ${block.opcode} */ null`;
          break;
      }

      if (satisfiesInputShape === desiredInputShape) {
        return blockSource;
      }

      if (desiredInputShape === "boolean") {
        return `(this.toBoolean(${blockSource}))`;
      }

      if (desiredInputShape === "string") {
        return `(this.toString(${blockSource}))`;
      }

      if (desiredInputShape === "number") {
        return `(this.toNumber(${blockSource}))`;
      }

      if (desiredInputShape === "index") {
        return `((${blockSource}) - 1)`;
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
                  ? `setValue: (value) => { this.vars.${newName} = value; },
                  step: ${JSON.stringify(variable.isDiscrete ? 1 : 0.01)},
                  min: ${JSON.stringify(variable.sliderMin)},
                  max: ${JSON.stringify(variable.sliderMax)},`
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
