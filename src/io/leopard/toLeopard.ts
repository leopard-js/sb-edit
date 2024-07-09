import Project from "../../Project";
import Script from "../../Script";
import Block from "../../Block";
import * as BlockInput from "../../BlockInput";
import { OpCode } from "../../OpCode";

// TODO: Upgrade to Prettier v3, which formats asynchronously
// Or https://github.com/prettier/prettier-synchronized if it's OK to be Node-only
import * as prettier from "prettier2";
import Target from "../../Target";
import { List, Variable } from "../../Data";

/**
 * Words which are invalid for any JavaScript identifier to be, when it isn't
 * on a namespace (like `this` or `this.vars`).
 *
 * This list may be more comprehensive than it needs to be in every case,
 * erring to avoid potential issues.
 *
 * Mostly pulled from MDN:
 * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Lexical_grammar#reserved_words
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
 * Global identifiers which Leopard sprites (subclasses of `Sprite`) must not
 * be named as, since that would overwrite or be a reference binding error.
 *
 * Only capitalized identifiers need to be listed here: generated sprite names
 * will never conflict with identifiers whose first letter is lowercase.
 * (This is also why JS reserved words aren't listed here - they're all
 * lowercase, so don't conflict with generated sprite names.)
 *
 * However, it *must* include even (capitalized) identifiers which *aren't*
 * provided by Leopard, if any part of generated Leopard code could directly
 * refer to those identifiers (expecting some browser-provided value, rather
 * than a generated `Sprite` subclass!).
 */
const LEOPARD_RESERVED_SPRITE_NAMES = [
  // Flat-out syntax errors
  "Infinity",
  "NaN",

  // Browser-provided identifiers
  "Date",
  "Math",

  // Leopard-provided identifiers
  "Color",
  "Costume",
  "Sound",
  "Sprite",
  "StageBase",
  "Trigger",
  "Watcher"
];

/**
 * Property names which have special meaning in JavaScript. Custom properties
 * must not overwrite these names, no matter the context.
 */
const JS_RESERVED_PROPERTIES = ["__proto__", "constructor", "prototype"];

/**
 * Property names which are used by any Leopard target - these correspond to
 * Leopard's `SpriteBase` abstract class. Properties here are present on
 * sprites as well as the stage.
 *
 * Overwriting these properties would change behavior that Leopard itself
 * provides and expects to be behave in certain ways. While this a coding wizard
 * might like to take advantage of this in their own Leopard project, generated
 * projects must never accidentally overwrite these!
 *
 * This list is a superset of `JS_RESERVED_PROPERTIES` (and so are all supersets
 * of this list).
 *
 * Note that this is *not* a superset of ordinary JavaScript reserved
 * words. Properties are always accessed with `this.${name}` syntax, not used
 * as standalone identifiers (`let ${name} = foo`).
 */
const LEOPARD_RESERVED_SPRITE_BASE_PROPERTIES = [
  ...JS_RESERVED_PROPERTIES,

  // Internals
  "_costumeNumber",
  "_layerOrder",
  "_project",
  "_vars",

  // Basic execution
  "triggers",
  "vars",
  "warp",

  // Other objects
  "stage",
  "sprites",
  "watchers",

  // Control & events
  "broadcast",
  "broadcastAndWait",
  "wait",

  // Operators - casting
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
  "scratchTan",
  "scratchToDeg",
  "scratchToRad",
  "normalizeDeg",
  "wrapClamp",

  // Lists (arrays)
  "arrayIncludes",
  "indexInArray",
  "itemOf",

  // Sensing
  "answer",
  "askAndWait",
  "keyPressed",
  "loudness",
  "mouse",
  "restartTimer",
  "timer",

  // Looks
  "costume",
  "costumeNumber",
  "costumes",
  "effects",

  // Sounds
  "audioEffects",
  "effectChain",
  "getSound",
  "getSoundsPlayedByMe",
  "playSoundUntilDone",
  "sounds",
  "startSound",
  "stopAllOfMySounds",
  "stopAllSounds",

  // Pen
  "clearPen"
];

/**
 * Property names which are used by Leopard stages (instances of `Stage`,
 * whether any subclass or directly constructed from `Stage`). This list is
 * a superset of `LEOPARD_RESERVED_SPRITE_BASE_PROPERTIES`.
 */
const LEOPARD_RESERVED_STAGE_PROPERTIES = [
  ...LEOPARD_RESERVED_SPRITE_BASE_PROPERTIES,

  // Essential properties
  "__counter",
  "fence",
  "height",
  "width",

  // Events & control
  "fireBackdropChanged"
];

/**
 * Property names which are used by Leopard sprites (instances of `Sprite`,
 * whether any subclass or directly constructed from `Sprite`). This list is
 * a superset of `LEOPARD_RESERVED_SPRITE_BASE_PROPERTIES`.
 */
const LEOPARD_RESERVED_SPRITE_PROPERTIES = [
  ...LEOPARD_RESERVED_SPRITE_BASE_PROPERTIES,

  // Internals
  "_direction",
  "_penColor",
  "_penDown",
  "_speechBubble",
  "_x",
  "_y",

  // Other objects
  "andClones",
  "clones",
  "parent",

  // Control & events
  "createClone",
  "deleteThisClone",

  // Sensing
  "colorTouching",
  "touching",
  "nearestEdge",

  // Looks
  "moveAhead",
  "moveBehind",
  "say",
  "sayAndWait",
  "size",
  "think",
  "thinkAndWait",
  "visible",

  // Motion
  "direction",
  "glide",
  "goto",
  "ifOnEdgeBounce",
  "move",
  "positionInFence",
  "rotationStyle",
  "x",
  "y",

  // Pen
  "penColor",
  "penDown",
  "penSize",
  "stamp"
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
  Any = "Any",

  /**
   * Number input shape. If the input block isn't guaranteed to be a number,
   * it is automatically wrapped with this.toNumber(), which has particular
   * behavior to match Scratch.
   */
  Number = "Number",

  /**
   * Special "index" shape, representing an arbitrary number which has been
   * decremented (decreased by 1). Scratch lists are 1-based while JavaScript
   * arrays and strings are indexed starting from 0, so all indexes converted
   * from Scratch must be decreased to match. The "index" shape allows number
   * primitives to be statically decremented, and blocks which include a plus
   * or minus operator to automtaically "absorb" the following decrement.
   */
  Index = "Index",

  /**
   * String input shape. If the input block isn't guaranteed to be a string,
   * it is automatically wrapped with this.toString(), which is just a wrapper
   * around the built-in String() op but is written so for consistency.
   *
   * The string input shape also guarantees that primitive values which could
   * be statically converted to a number, e.g. the string "1.234", will NOT be
   * converted.
   */
  String = "String",

  /**
   * Boolean input shape. If the input block isn't guaranteed to be a boolean,
   * it is automatically wrapped with this.toBoolean(), which has particular
   * behavior to match Scratch. Note that Scratch doesn't have a concept of
   * boolean primitives (no "true" or "false" blocks, nor a "switch" type
   * control for directly inputting true/false as in Snap!).
   */
  Boolean = "Boolean",

  /**
   * "Stack" block, referring to blocks which can be put one after another and
   * together represent a sequence of steps. Stack inputs may be empty and
   * otherwise are one or more blocks. In JavaScript, there's no fundamental
   * difference between a "function" for reporting values and a "command" for
   * applying effects, so no additional syntax is required to cast any given
   * input value to a stack.
   */
  Stack = "Stack"
}

function uniqueNameFactory(reservedNames: string[] | Set<string> = []) {
  const usedNames: Set<string> = new Set(reservedNames);
  return uniqueName;

  function uniqueName(name: string): string {
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }

    const numResult = /\d+$/.exec(name);
    if (numResult === null) {
      return uniqueName(name + "2");
    }
    return uniqueName(name.slice(0, numResult.index) + String(parseInt(numResult[0], 10) + 1));
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

export interface ToLeopardOptions {
  leopardJSURL: string;
  leopardCSSURL: string;
  getTargetURL: (info: { name: string; from: "index" | "target" }) => string;
  getAssetURL: (info: { type: "costume" | "sound"; target: string; name: string; md5: string; ext: string }) => string;
  indexURL: string;
  autoplay: boolean;
}
export default function toLeopard(
  project: Project,
  inOptions: Partial<ToLeopardOptions> = {},
  prettierConfig: prettier.Options = {}
): { [fileName: string]: string } {
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
  const options = { ...defaultOptions, ...inOptions };

  // Maps targets' Scratch names to corresponding Leopard names
  // (JS class names, which are identifiers).
  let targetNameMap: Partial<Record<string, string>> = {};

  // Maps input names on actual custom block Script objects to corresponding
  // Leopard names (JS function arguments, which are identifiers).
  let customBlockArgNameMap: Map<Script, { [key: string]: string }> = new Map();

  // Maps variables and lists' Scratch IDs to corresponding Leopard names
  // (JS properties on `this.vars`). This is shared across all sprites, so
  // that global (stage) variables' IDs map to the same name regardless what
  // sprite they're accessed in. There's no issue about local (sprite)
  // variables conflicting with each other, since the variables in each
  // sprite all have unique IDs, even if they share the same (Scratch) name.
  let variableNameMap: { [id: string]: string } = {};

  const uniqueSpriteName = uniqueNameFactory(LEOPARD_RESERVED_SPRITE_NAMES);

  for (const target of [project.stage, ...project.sprites]) {
    const newTargetName = uniqueSpriteName(camelCase(target.name, true));
    targetNameMap[target.name] = newTargetName;
    target.setName(newTargetName);

    // Variables are uniquely named per-target. These are on an empty namespace
    // so don't have any conflicts.
    const uniqueVariableName = uniqueNameFactory(JS_RESERVED_PROPERTIES);

    for (const { id, name } of [...target.lists, ...target.variables]) {
      const newName = uniqueVariableName(camelCase(name));
      variableNameMap[id] = newName;
    }

    const uniqueScriptName = uniqueNameFactory(
      target === project.stage ? LEOPARD_RESERVED_STAGE_PROPERTIES : LEOPARD_RESERVED_SPRITE_PROPERTIES
    );

    for (const script of target.scripts) {
      script.setName(uniqueScriptName(camelCase(script.name)));

      const argNameMap: Record<string, string> = {};
      customBlockArgNameMap.set(script, argNameMap);

      // Parameter names aren't defined on a namespace at all, so must not conflict
      // with JavaScript reserved words.
      const uniqueParamName = uniqueNameFactory(JS_RESERVED_WORDS);

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
    value: string | number | boolean | object | null,
    desiredInputShape?: InputShape
  ): string {
    // Short-circuit for string inputs. These must never return number syntax.
    if (desiredInputShape === InputShape.String) {
      return JSON.stringify(value);
    }

    // Other input shapes which static inputs may fulfill: number, index, any.
    // These are all OK to return JavaScript number literals for.
    const asNum = Number(value as string);
    if (!isNaN(asNum) && value !== "") {
      if (desiredInputShape === InputShape.Index) {
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

    const triggerInitStr = (name: string, options?: Record<string, string>): string => {
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

    function increase(leftSide: string, input: BlockInput.Any, allowIncrementDecrement: boolean): string {
      const n = parseNumber(input);
      if (typeof n !== "number") {
        return `${leftSide} += ${inputToJS(input, InputShape.Number)}`;
      }

      if (allowIncrementDecrement && n === 1) {
        return `${leftSide}++`;
      } else if (allowIncrementDecrement && n === -1) {
        return `${leftSide}--`;
      } else if (n >= 0) {
        return `${leftSide} += ${JSON.stringify(n)}`;
      } else {
        return `${leftSide} -= ${JSON.stringify(-n)}`;
      }
    }

    function decrease(leftSide: string, input: BlockInput.Any, allowIncrementDecrement: boolean) {
      const n = parseNumber(input);
      if (typeof n !== "number") {
        return `${leftSide} -= ${inputToJS(input, InputShape.Number)}`;
      }

      if (allowIncrementDecrement && n === 1) {
        return `${leftSide}--`;
      } else if (allowIncrementDecrement && n === -1) {
        return `${leftSide}++`;
      } else if (n > 0) {
        return `${leftSide} -= ${JSON.stringify(n)}`;
      } else {
        return `${leftSide} += ${JSON.stringify(-n)}`;
      }
    }

    function parseNumber(input: BlockInput.Any): number | null {
      // Returns a number if the input was a primitive (static) value and was
      // able to be parsed as a number; otherwise, returns null.

      if (input.type === "block") {
        return null;
      }

      const n = Number(input.value);

      if (isNaN(n)) {
        return null;
      }

      return n;
    }

    function spriteInputToJS(input: { value: string }): string {
      return `this.sprites[${JSON.stringify(targetNameMap[input.value])}]`;
    }

    function colorInputToJS(input: BlockInput.Color | BlockInput.Block): string {
      if (input.type === "color") {
        const { r, g, b } = input.value;
        return `Color.rgb(${r}, ${g}, ${b})`;
      } else {
        const num = inputToJS(input, InputShape.Number);
        return `Color.num(${num})`;
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
        case "block": {
          const inputSource = blockToJS(input.value, desiredInputShape);
          if (desiredInputShape === InputShape.Stack) {
            return inputSource;
          } else {
            return `(${inputSource})`;
          }
        }

        case "blocks": {
          return input.value?.map(block => blockToJS(block)).join(";\n") ?? "";
        }

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
      // TODO: set these to null and restructure control flow to avoid null checks
      let selectedVarSource = "";
      let selectedWatcherSource = "";
      let varInputId: string | null = null;
      if ("VARIABLE" in block.inputs) {
        varInputId = (block.inputs.VARIABLE.value as { id: string }).id;
      } else if ("LIST" in block.inputs) {
        varInputId = (block.inputs.LIST.value as { id: string }).id;
      }
      if (varInputId) {
        const newName = variableNameMap[varInputId];
        if (target === project.stage || !stageVariables.has(varInputId)) {
          selectedVarSource = `this.vars.${newName}`;
          selectedWatcherSource = `this.watchers.${newName}`;
        } else {
          selectedVarSource = `this.stage.vars.${newName}`;
          selectedWatcherSource = `this.stage.watchers.${newName}`;
        }
      }

      const stage = "this" + (target.isStage ? "" : ".stage");

      let satisfiesInputShape: InputShape;
      let blockSource: string;

      makeBlockSource: switch (block.opcode) {
        case OpCode.motion_movesteps: {
          satisfiesInputShape = InputShape.Stack;

          const steps = inputToJS(block.inputs.STEPS, InputShape.Number);
          blockSource = `this.move(${steps})`;

          break;
        }

        case OpCode.motion_turnright: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = increase(`this.direction`, block.inputs.DEGREES, false);

          break;
        }

        case OpCode.motion_turnleft: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = decrease(`this.direction`, block.inputs.DEGREES, false);

          break;
        }

        case OpCode.motion_goto: {
          satisfiesInputShape = InputShape.Stack;

          let x: string;
          let y: string;
          switch (block.inputs.TO.value) {
            case "_random_": {
              x = `this.random(-240, 240)`;
              y = `this.random(-180, 180)`;
              break;
            }

            case "_mouse_": {
              x = `this.mouse.x`;
              y = `this.mouse.y`;
              break;
            }

            default: {
              const sprite = spriteInputToJS(block.inputs.TO);
              x = `${sprite}.x`;
              y = `${sprite}.y`;
              break;
            }
          }

          blockSource = `this.goto(${x}, ${y})`;

          break;
        }

        case OpCode.motion_gotoxy: {
          satisfiesInputShape = InputShape.Stack;

          const x = inputToJS(block.inputs.X, InputShape.Number);
          const y = inputToJS(block.inputs.Y, InputShape.Number);
          blockSource = `this.goto(${x}, ${y})`;

          break;
        }

        case OpCode.motion_glideto: {
          satisfiesInputShape = InputShape.Stack;

          const secs = inputToJS(block.inputs.SECS, InputShape.Number);

          let x: string;
          let y: string;
          switch (block.inputs.TO.value) {
            case "_random_": {
              x = `this.random(-240, 240)`;
              y = `this.random(-180, 180)`;
              break;
            }

            case "_mouse_": {
              x = `this.mouse.x`;
              y = `this.mouse.y`;
              break;
            }

            default: {
              const sprite = spriteInputToJS(block.inputs.TO);
              x = `${sprite}.x`;
              y = `${sprite}.y`;
              break;
            }
          }

          blockSource = `yield* this.glide(${secs}, ${x}, ${y})`;

          break;
        }

        case OpCode.motion_glidesecstoxy: {
          satisfiesInputShape = InputShape.Stack;

          const secs = inputToJS(block.inputs.SECS, InputShape.Number);
          const x = inputToJS(block.inputs.X, InputShape.Number);
          const y = inputToJS(block.inputs.Y, InputShape.Number);
          blockSource = `yield* this.glide(${secs}, ${x}, ${y})`;

          break;
        }

        case OpCode.motion_pointindirection: {
          satisfiesInputShape = InputShape.Stack;

          const direction = inputToJS(block.inputs.DIRECTION, InputShape.Number);
          blockSource = `this.direction = ${direction}`;

          break;
        }

        case OpCode.motion_pointtowards: {
          satisfiesInputShape = InputShape.Stack;

          let x: string;
          let y: string;
          switch (block.inputs.TOWARDS.value) {
            case "_mouse_": {
              x = `this.mouse.x`;
              y = `this.mouse.y`;
              break;
            }

            default: {
              const sprite = spriteInputToJS(block.inputs.TOWARDS);
              x = `${sprite}.x`;
              y = `${sprite}.y`;
              break;
            }
          }

          blockSource = `this.direction = this.radToScratch(Math.atan2(${y} - this.y, ${x} - this.x))`;

          break;
        }

        case OpCode.motion_changexby: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = increase(`this.x`, block.inputs.DX, false);

          break;
        }

        case OpCode.motion_setx: {
          satisfiesInputShape = InputShape.Stack;

          const x = inputToJS(block.inputs.X, InputShape.Number);
          blockSource = `this.x = ${x}`;

          break;
        }

        case OpCode.motion_changeyby: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = increase(`this.y`, block.inputs.DY, false);

          break;
        }

        case OpCode.motion_sety: {
          satisfiesInputShape = InputShape.Stack;

          const y = inputToJS(block.inputs.Y, InputShape.Number);
          blockSource = `this.y = ${y}`;

          break;
        }

        case OpCode.motion_ifonedgebounce: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `this.ifOnEdgeBounce()`;

          break;
        }

        case OpCode.motion_setrotationstyle: {
          satisfiesInputShape = InputShape.Stack;

          let style: string;
          switch (block.inputs.STYLE.value) {
            case "left-right": {
              style = `LEFT_RIGHT`;
              break;
            }

            case "don't rotate": {
              style = `DONT_ROTATE`;
              break;
            }

            case "all around": {
              style = `ALL_AROUND`;
              break;
            }
          }

          blockSource = `this.rotationStyle = Sprite.RotationStyle.${style}`;

          break;
        }

        case OpCode.motion_xposition: {
          satisfiesInputShape = InputShape.Number;

          blockSource = `this.x`;

          break;
        }

        case OpCode.motion_yposition: {
          satisfiesInputShape = InputShape.Number;

          blockSource = `this.y`;

          break;
        }

        case OpCode.motion_direction: {
          satisfiesInputShape = InputShape.Number;

          blockSource = `this.direction`;

          break;
        }

        // Obsolete no-op blocks:
        case OpCode.motion_scroll_right:
        case OpCode.motion_scroll_up:
        case OpCode.motion_align_scene: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = ``;

          break;
        }

        case OpCode.motion_xscroll:
        case OpCode.motion_yscroll: {
          satisfiesInputShape = InputShape.Any;

          blockSource = `undefined`; // Compatibility with Scratch 3.0 \:)/

          break;
        }

        case OpCode.looks_sayforsecs: {
          satisfiesInputShape = InputShape.Stack;

          const message = inputToJS(block.inputs.MESSAGE, InputShape.Any);
          const secs = inputToJS(block.inputs.SECS, InputShape.Number);
          blockSource = `yield* this.sayAndWait(${message}, ${secs})`;

          break;
        }

        case OpCode.looks_say: {
          satisfiesInputShape = InputShape.Stack;

          const message = inputToJS(block.inputs.MESSAGE, InputShape.Any);
          blockSource = `this.say(${message})`;

          break;
        }

        case OpCode.looks_thinkforsecs: {
          satisfiesInputShape = InputShape.Stack;

          const message = inputToJS(block.inputs.MESSAGE, InputShape.Any);
          const secs = inputToJS(block.inputs.SECS, InputShape.Number);
          blockSource = `yield* this.thinkAndWait(${message}, ${secs})`;

          break;
        }

        case OpCode.looks_think: {
          satisfiesInputShape = InputShape.Stack;

          const message = inputToJS(block.inputs.MESSAGE, InputShape.Any);
          blockSource = `this.think(${message})`;

          break;
        }

        case OpCode.looks_switchcostumeto: {
          satisfiesInputShape = InputShape.Stack;

          const costume = inputToJS(block.inputs.COSTUME, InputShape.Any);
          blockSource = `this.costume = ${costume}`;

          break;
        }

        case OpCode.looks_nextcostume: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `this.costumeNumber++`;

          break;
        }

        case OpCode.looks_switchbackdropto: {
          satisfiesInputShape = InputShape.Stack;

          const backdrop = inputToJS(block.inputs.BACKDROP, InputShape.Any);
          blockSource = `${stage}.costume = ${backdrop}`;

          break;
        }

        case OpCode.looks_nextbackdrop: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `${stage}.costumeNumber++`;

          break;
        }

        case OpCode.looks_changesizeby: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = increase(`this.size`, block.inputs.CHANGE, false);

          break;
        }

        case OpCode.looks_setsizeto: {
          satisfiesInputShape = InputShape.Stack;

          const size = inputToJS(block.inputs.SIZE, InputShape.Number);
          blockSource = `this.size = ${size}`;

          break;
        }

        case OpCode.looks_changeeffectby: {
          satisfiesInputShape = InputShape.Stack;

          const effect = block.inputs.EFFECT.value.toLowerCase();
          blockSource = increase(`this.effects.${effect}`, block.inputs.CHANGE, false);

          break;
        }

        case OpCode.looks_seteffectto: {
          satisfiesInputShape = InputShape.Stack;

          const effect = block.inputs.EFFECT.value.toLowerCase();
          const value = inputToJS(block.inputs.VALUE, InputShape.Number);
          blockSource = `this.effects.${effect} = ${value}`;

          break;
        }

        case OpCode.looks_cleargraphiceffects: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `this.effects.clear()`;

          break;
        }

        case OpCode.looks_show: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `this.visible = true`;

          break;
        }

        case OpCode.looks_hide: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `this.visible = false`;

          break;
        }

        case OpCode.looks_gotofrontback: {
          satisfiesInputShape = InputShape.Stack;

          switch (block.inputs.FRONT_BACK.value) {
            case "front": {
              blockSource = `this.moveAhead()`;
              break;
            }

            case "back":
            default: {
              blockSource = `this.moveBehind()`;
              break;
            }
          }

          break;
        }

        case OpCode.looks_goforwardbackwardlayers: {
          satisfiesInputShape = InputShape.Stack;

          const num = inputToJS(block.inputs.NUM, InputShape.Number);

          switch (block.inputs.FORWARD_BACKWARD.value) {
            case "forward": {
              blockSource = `this.moveAhead(${num})`;
              break;
            }

            case "backward":
            default: {
              blockSource = `this.moveBehind(${num})`;
              break;
            }
          }

          break;
        }

        // Obsolete no-op blocks:
        case OpCode.looks_hideallsprites:
        case OpCode.looks_changestretchby:
        case OpCode.looks_setstretchto: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = ``;

          break;
        }

        case OpCode.looks_costumenumbername: {
          switch (block.inputs.NUMBER_NAME.value) {
            case "name": {
              satisfiesInputShape = InputShape.String;
              blockSource = `this.costume.name`;
              break;
            }

            case "number":
            default: {
              satisfiesInputShape = InputShape.Number;
              blockSource = `this.costumeNumber`;
              break;
            }
          }

          break;
        }

        case OpCode.looks_backdropnumbername: {
          switch (block.inputs.NUMBER_NAME.value) {
            case "name": {
              satisfiesInputShape = InputShape.String;
              blockSource = `${stage}.costume.name`;
              break;
            }

            case "number":
            default: {
              satisfiesInputShape = InputShape.Number;
              blockSource = `${stage}.costumeNumber`;
              break;
            }
          }

          break;
        }

        case OpCode.looks_size: {
          satisfiesInputShape = InputShape.Number;

          blockSource = `this.size`;

          break;
        }

        case OpCode.sound_playuntildone: {
          satisfiesInputShape = InputShape.Stack;

          const sound = inputToJS(block.inputs.SOUND_MENU, InputShape.Any);
          blockSource = `yield* this.playSoundUntilDone(${sound})`;

          break;
        }

        case OpCode.sound_play: {
          satisfiesInputShape = InputShape.Stack;

          const sound = inputToJS(block.inputs.SOUND_MENU, InputShape.Any);
          blockSource = `yield* this.startSound(${sound})`;

          break;
        }

        case OpCode.sound_setvolumeto: {
          satisfiesInputShape = InputShape.Stack;

          const volume = inputToJS(block.inputs.VOLUME, InputShape.Number);
          blockSource = `this.audioEffects.volume = ${volume}`;

          break;
        }

        case OpCode.sound_changevolumeby: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = increase(`this.audioEffects.volume`, block.inputs.VOLUME, false);

          break;
        }

        case OpCode.sound_volume: {
          satisfiesInputShape = InputShape.Number;

          blockSource = `this.audioEffects.volume`;

          break;
        }

        case OpCode.sound_seteffectto: {
          satisfiesInputShape = InputShape.Stack;

          const value = inputToJS(block.inputs.VALUE, InputShape.Number);

          if (block.inputs.EFFECT.type === "soundEffect") {
            const effect = block.inputs.EFFECT.value.toLowerCase();
            blockSource = `this.audioEffects.${effect} = ${value}`;
          } else {
            const effect = inputToJS(block.inputs.EFFECT, InputShape.Any);
            blockSource = `this.audioEffects[${effect}] = ${value}`;
          }

          break;
        }

        case OpCode.sound_changeeffectby: {
          satisfiesInputShape = InputShape.Stack;

          const value = block.inputs.VALUE;

          if (block.inputs.EFFECT.type === "soundEffect") {
            const effect = block.inputs.EFFECT.value.toLowerCase();
            blockSource = increase(`this.audioEffects.${effect}`, value, false);
          } else {
            const effect = inputToJS(block.inputs.EFFECT, InputShape.Any);
            blockSource = increase(`this.audioEffects[${effect}]`, value, false);
          }

          break;
        }

        case OpCode.sound_cleareffects: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `this.audioEffects.clear()`;

          break;
        }

        case OpCode.sound_stopallsounds: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `this.stopAllSounds()`;

          break;
        }

        case OpCode.event_broadcast: {
          satisfiesInputShape = InputShape.Stack;

          const message = inputToJS(block.inputs.BROADCAST_INPUT, InputShape.String);
          blockSource = `this.broadcast(${message})`;

          break;
        }

        case OpCode.event_broadcastandwait: {
          satisfiesInputShape = InputShape.Stack;

          const message = inputToJS(block.inputs.BROADCAST_INPUT, InputShape.String);
          blockSource = `yield* this.broadcastAndWait(${message})`;

          break;
        }

        case OpCode.control_wait: {
          satisfiesInputShape = InputShape.Stack;

          const duration = inputToJS(block.inputs.DURATION, InputShape.Number);
          blockSource = `yield* this.wait(${duration})`;

          break;
        }

        case OpCode.control_repeat: {
          satisfiesInputShape = InputShape.Stack;

          const times = inputToJS(block.inputs.TIMES, InputShape.Number);
          const substack = inputToJS(block.inputs.SUBSTACK, InputShape.Stack);

          blockSource = `for (let i = 0; i < ${times}; i++) {
            ${substack};
            ${warp ? "" : "yield;"}
          }`;

          break;
        }

        case OpCode.control_forever: {
          satisfiesInputShape = InputShape.Stack;

          const substack = inputToJS(block.inputs.SUBSTACK, InputShape.Stack);

          blockSource = `while (true) {
            ${substack};
            ${warp ? "" : "yield;"}
          }`;

          break;
        }

        case OpCode.control_if: {
          satisfiesInputShape = InputShape.Stack;

          const condition = inputToJS(block.inputs.CONDITION, InputShape.Boolean);
          const substack = inputToJS(block.inputs.SUBSTACK, InputShape.Stack);

          blockSource = `if (${condition}) {
            ${substack}
          }`;

          break;
        }

        case OpCode.control_if_else: {
          satisfiesInputShape = InputShape.Stack;

          const condition = inputToJS(block.inputs.CONDITION, InputShape.Boolean);
          const substack1 = inputToJS(block.inputs.SUBSTACK, InputShape.Stack);
          const substack2 = inputToJS(block.inputs.SUBSTACK2, InputShape.Stack);

          blockSource = `if (${condition}) {
            ${substack1}
          } else {
            ${substack2}
          }`;

          break;
        }

        case OpCode.control_wait_until: {
          satisfiesInputShape = InputShape.Stack;

          const condition = inputToJS(block.inputs.CONDITION, InputShape.Boolean);
          blockSource = `while (!${condition}) { yield; }`;

          break;
        }

        case OpCode.control_repeat_until: {
          satisfiesInputShape = InputShape.Stack;

          const condition = inputToJS(block.inputs.CONDITION, InputShape.Boolean);
          const substack = inputToJS(block.inputs.SUBSTACK, InputShape.Stack);

          blockSource = `while (!${condition}) {
            ${substack}
            ${warp ? "" : "yield;"}
          }`;

          break;
        }

        case OpCode.control_while: {
          satisfiesInputShape = InputShape.Stack;

          const condition = inputToJS(block.inputs.CONDITION, InputShape.Boolean);
          const substack = inputToJS(block.inputs.SUBSTACK, InputShape.Stack);

          blockSource = `while (${condition}) {
            ${substack}
            ${warp ? "" : "yield;"}
          }`;

          break;
        }

        case OpCode.control_for_each: {
          satisfiesInputShape = InputShape.Stack;

          const value = inputToJS(block.inputs.VALUE, InputShape.Number);
          const substack = inputToJS(block.inputs.SUBSTACK, InputShape.Stack);

          // TODO: Verify compatibility if variable changes during evaluation
          blockSource = `for (${selectedVarSource} = 1; ${selectedVarSource} <= ${value}; ${selectedVarSource}++) {
            ${substack}
            ${warp ? "" : "yield;"}
          }`;

          break;
        }

        case OpCode.control_all_at_once: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = inputToJS(block.inputs.SUBSTACK, InputShape.Stack);

          break;
        }

        case OpCode.control_stop: {
          satisfiesInputShape = InputShape.Stack;

          switch (block.inputs.STOP_OPTION.value) {
            case "this script": {
              blockSource = `return;`;
              break;
            }

            default: {
              blockSource = `/* TODO: Implement stop ${block.inputs.STOP_OPTION.value} */ null`;
              break;
            }
          }

          break;
        }

        case OpCode.control_create_clone_of: {
          satisfiesInputShape = InputShape.Stack;

          let target: string;
          switch (block.inputs.CLONE_OPTION.value) {
            case "_myself_": {
              target = `this`;
              break;
            }

            default: {
              target = spriteInputToJS(block.inputs.CLONE_OPTION);
              break;
            }
          }

          blockSource = `${target}.createClone()`;

          break;
        }

        case OpCode.control_delete_this_clone: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `this.deleteThisClone()`;

          break;
        }

        case OpCode.control_get_counter: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `${stage}.__counter`;

          break;
        }

        case OpCode.control_incr_counter: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `${stage}.__counter++`;

          break;
        }

        case OpCode.control_clear_counter: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `${stage}.__counter = 0`;

          break;
        }

        case OpCode.sensing_touchingobject: {
          satisfiesInputShape = InputShape.Boolean;

          let target: string;
          switch (block.inputs.TOUCHINGOBJECTMENU.value) {
            case "_mouse_": {
              target = JSON.stringify("mouse");
              break;
            }

            case "_edge_": {
              target = JSON.stringify("edge");
              break;
            }

            default: {
              const sprite = spriteInputToJS(block.inputs.TOUCHINGOBJECTMENU);
              target = `${sprite}.andClones()`;
              break;
            }
          }

          blockSource = `this.touching(${target})`;

          break;
        }

        case OpCode.sensing_touchingcolor: {
          satisfiesInputShape = InputShape.Boolean;

          const color = colorInputToJS(block.inputs.COLOR);
          blockSource = `this.touching(${color})`;

          break;
        }

        case OpCode.sensing_coloristouchingcolor: {
          satisfiesInputShape = InputShape.Boolean;

          const color1 = colorInputToJS(block.inputs.COLOR);
          const color2 = colorInputToJS(block.inputs.COLOR2);
          blockSource = `this.colorTouching(${color1}, ${color2})`;

          break;
        }

        case OpCode.sensing_distanceto: {
          satisfiesInputShape = InputShape.Number;

          let x: string;
          let y: string;
          switch (block.inputs.DISTANCETOMENU.value) {
            case "_mouse_": {
              x = `this.mouse.x`;
              y = `this.mouse.y`;
              break;
            }

            default: {
              const sprite = spriteInputToJS(block.inputs.DISTANCETOMENU);
              x = `${sprite}.x`;
              y = `${sprite}.y`;
              break;
            }
          }

          blockSource = `Math.hypot(${x} - this.x, ${y} - this.y)`;

          break;
        }

        case OpCode.sensing_askandwait: {
          satisfiesInputShape = InputShape.Stack;

          const question = inputToJS(block.inputs.QUESTION, InputShape.Any);
          blockSource = `yield* this.askAndWait(${question})`;

          break;
        }

        case OpCode.sensing_answer: {
          satisfiesInputShape = InputShape.String;

          blockSource = `this.answer`;

          break;
        }

        case OpCode.sensing_keypressed: {
          satisfiesInputShape = InputShape.Boolean;

          const key = inputToJS(block.inputs.KEY_OPTION, InputShape.String);
          blockSource = `this.keyPressed(${key})`;

          break;
        }

        case OpCode.sensing_mousedown: {
          satisfiesInputShape = InputShape.Boolean;

          blockSource = `this.mouse.down`;

          break;
        }

        case OpCode.sensing_mousex: {
          satisfiesInputShape = InputShape.Number;

          blockSource = `this.mouse.x`;

          break;
        }

        case OpCode.sensing_mousey: {
          satisfiesInputShape = InputShape.Number;

          blockSource = `this.mouse.y`;

          break;
        }

        case OpCode.sensing_loudness: {
          satisfiesInputShape = InputShape.Number;

          blockSource = `this.loudness`;

          break;
        }

        case OpCode.sensing_timer: {
          satisfiesInputShape = InputShape.Number;

          blockSource = `this.timer`;

          break;
        }

        case OpCode.sensing_resettimer: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `this.restartTimer()`;

          break;
        }

        case OpCode.sensing_of: {
          let propName: string | null;
          switch (block.inputs.PROPERTY.value) {
            case "x position": {
              satisfiesInputShape = InputShape.Number;
              propName = "x";
              break;
            }

            case "y position": {
              satisfiesInputShape = InputShape.Number;
              propName = "y";
              break;
            }

            case "direction": {
              satisfiesInputShape = InputShape.Number;
              propName = "direction";
              break;
            }

            case "costume #":
            case "backdrop #": {
              satisfiesInputShape = InputShape.Number;
              propName = "costumeNumber";
              break;
            }

            case "costume name":
            case "backdrop name": {
              satisfiesInputShape = InputShape.String;
              propName = "costume.name";
              break;
            }

            case "size": {
              satisfiesInputShape = InputShape.Number;
              propName = "size";
              break;
            }

            case "volume": {
              satisfiesInputShape = InputShape.Number;
              propName = "audioEffects.volume";
              break;
            }

            default: {
              satisfiesInputShape = InputShape.Any;

              let varOwner: Target = project.stage;
              if (block.inputs.OBJECT.value !== "_stage_") {
                const sprite = project.sprites.find(sprite => sprite.name === targetNameMap[block.inputs.OBJECT.value]);
                if (sprite) {
                  varOwner = sprite;
                }
              }

              // "of" block gets variables by name, not ID, using lookupVariableByNameAndType in scratch-vm.
              const variable = varOwner.variables.find(variable => variable.name === block.inputs.PROPERTY.value);
              if (!variable) {
                satisfiesInputShape = InputShape.Number;
                blockSource = `(0 /* ${varOwner.name} doesn't have a "${block.inputs.PROPERTY.value}" variable */)`;
                break makeBlockSource;
              }

              propName = `vars.${variableNameMap[variable.id]}`;
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
            targetObj = spriteInputToJS(block.inputs.OBJECT);
          }

          blockSource = `${targetObj}.${propName}`;
          break;
        }

        case OpCode.sensing_current: {
          satisfiesInputShape = InputShape.Number;

          switch (block.inputs.CURRENTMENU.value) {
            case "YEAR": {
              blockSource = `new Date().getFullYear()`;
              break;
            }

            case "MONTH": {
              blockSource = `new Date().getMonth() + 1`;
              break;
            }

            case "DATE": {
              blockSource = `new Date().getDate()`;
              break;
            }

            case "DAYOFWEEK": {
              blockSource = `new Date().getDay() + 1`;
              break;
            }

            case "HOUR": {
              blockSource = `new Date().getHours()`;
              break;
            }

            case "MINUTE": {
              blockSource = `new Date().getMinutes()`;
              break;
            }

            case "SECOND": {
              blockSource = `new Date().getSeconds()`;
              break;
            }

            default: {
              satisfiesInputShape = InputShape.String;
              blockSource = `""`;
              break;
            }
          }

          break;
        }

        case OpCode.sensing_dayssince2000: {
          satisfiesInputShape = InputShape.Number;

          blockSource = `((new Date().getTime() - new Date(2000, 0, 1)) / 1000 / 60 + new Date().getTimezoneOffset()) / 60 / 24`;

          break;
        }

        case OpCode.sensing_username: {
          satisfiesInputShape = InputShape.String;

          blockSource = `(/* no username */ "")`;

          break;
        }

        case OpCode.sensing_userid: {
          satisfiesInputShape = InputShape.Any;

          blockSource = `undefined`; // Obsolete no-op block.

          break;
        }

        case OpCode.operator_add: {
          satisfiesInputShape = InputShape.Number;

          const num1 = inputToJS(block.inputs.NUM1, InputShape.Number);
          const num2 = inputToJS(block.inputs.NUM2, InputShape.Number);

          if (desiredInputShape === InputShape.Index) {
            // Attempt to fulfill a desired index input by subtracting 1 from either side
            // of the block. If neither side can be parsed as a number (i.e. both inputs
            // are filled with blocks), this clause just falls back to the normal number
            // shape.
            let val1 = parseNumber(block.inputs.NUM1);
            let val2 = parseNumber(block.inputs.NUM2);
            if (typeof val2 === "number") {
              satisfiesInputShape = InputShape.Index;
              blockSource = --val2 ? `${num1} + ${val2}` : num1;
              break;
            } else if (typeof val1 === "number") {
              satisfiesInputShape = InputShape.Index;
              blockSource = --val1 ? `${val1} + ${num2}` : num2;
              break;
            }
          }

          blockSource = `${num1} + ${num2}`;

          break;
        }

        case OpCode.operator_subtract: {
          satisfiesInputShape = InputShape.Number;

          const num1 = inputToJS(block.inputs.NUM1, InputShape.Number);
          const num2 = inputToJS(block.inputs.NUM2, InputShape.Number);

          if (desiredInputShape === InputShape.Index) {
            // Do basically the same thing as the addition operator does, but with
            // specifics for subtraction: increment the right-hand or decrement the
            // left-hand.
            let val1 = parseNumber(block.inputs.NUM1);
            let val2 = parseNumber(block.inputs.NUM2);
            if (typeof val2 === "number") {
              satisfiesInputShape = InputShape.Index;
              blockSource = ++val2 ? `${num1} - ${val2}` : num1;
              break;
            } else if (typeof val1 === "number") {
              satisfiesInputShape = InputShape.Index;
              blockSource = --val1 ? `${val1} - ${num2}` : `-${num2}`;
              break;
            }
          }

          blockSource = `${num1} - ${num2}`;

          break;
        }

        case OpCode.operator_multiply: {
          satisfiesInputShape = InputShape.Number;

          const num1 = inputToJS(block.inputs.NUM1, InputShape.Number);
          const num2 = inputToJS(block.inputs.NUM2, InputShape.Number);
          blockSource = `${num1} * ${num2}`;

          break;
        }

        case OpCode.operator_divide: {
          satisfiesInputShape = InputShape.Number;

          const num1 = inputToJS(block.inputs.NUM1, InputShape.Number);
          const num2 = inputToJS(block.inputs.NUM2, InputShape.Number);
          blockSource = `${num1} / ${num2}`;

          break;
        }

        case OpCode.operator_random: {
          satisfiesInputShape = InputShape.Number;

          const from = inputToJS(block.inputs.FROM, InputShape.Number);
          const to = inputToJS(block.inputs.TO, InputShape.Number);
          blockSource = `this.random(${from}, ${to})`;

          break;
        }

        case OpCode.operator_gt: {
          satisfiesInputShape = InputShape.Boolean;

          const operand1 = inputToJS(block.inputs.OPERAND1, InputShape.Any);
          const operand2 = inputToJS(block.inputs.OPERAND2, InputShape.Any);
          blockSource = `this.compare(${operand1}, ${operand2}) > 0`;

          break;
        }

        case OpCode.operator_lt: {
          satisfiesInputShape = InputShape.Boolean;

          const operand1 = inputToJS(block.inputs.OPERAND1, InputShape.Any);
          const operand2 = inputToJS(block.inputs.OPERAND2, InputShape.Any);
          blockSource = `this.compare(${operand1}, ${operand2}) < 0`;

          break;
        }

        case OpCode.operator_equals: {
          satisfiesInputShape = InputShape.Boolean;

          // If both sides are blocks, we can't make any assumptions about what kind of
          // values are being compared.(*) Use the custom .compare() function to ensure
          // compatibility with Scratch's equals block.
          //
          // (*) This is theoretically false, but we currently don't have a way to inspect
          // the returned InputShape of a block input to see if both sides match up.

          if (
            (block.inputs.OPERAND1 as BlockInput.Any).type === "block" &&
            (block.inputs.OPERAND2 as BlockInput.Any).type === "block"
          ) {
            const operand1 = inputToJS(block.inputs.OPERAND1, InputShape.Any);
            const operand2 = inputToJS(block.inputs.OPERAND2, InputShape.Any);
            blockSource = `this.compare(${operand1}, ${operand2}) === 0`;
            break;
          }

          // From this point on, either the left- or right-hand side is definitely a
          // primitive (or both).

          const val1 = parseNumber(block.inputs.OPERAND1);
          if (typeof val1 === "number") {
            const operand2 = inputToJS(block.inputs.OPERAND2, InputShape.Number);
            blockSource = `${val1} === ${operand2}`;
            break;
          }

          const val2 = parseNumber(block.inputs.OPERAND2);
          if (typeof val2 === "number") {
            const operand1 = inputToJS(block.inputs.OPERAND1, InputShape.Number);
            blockSource = `${operand1} === ${val2}`;
            break;
          }

          // If neither side was parsed as a number, one side is definitely a string.
          // Compare both sides as strings.

          // TODO: Shouldn't this be case-insensitive?
          const operand1 = inputToJS(block.inputs.OPERAND1, InputShape.String);
          const operand2 = inputToJS(block.inputs.OPERAND2, InputShape.String);
          blockSource = `${operand1} === ${operand2}`;

          break;
        }

        case OpCode.operator_and: {
          satisfiesInputShape = InputShape.Boolean;

          const operand1 = inputToJS(block.inputs.OPERAND1, InputShape.Boolean);
          const operand2 = inputToJS(block.inputs.OPERAND2, InputShape.Boolean);
          blockSource = `${operand1} && ${operand2}`;

          break;
        }

        case OpCode.operator_or: {
          satisfiesInputShape = InputShape.Boolean;

          const operand1 = inputToJS(block.inputs.OPERAND1, InputShape.Boolean);
          const operand2 = inputToJS(block.inputs.OPERAND2, InputShape.Boolean);
          blockSource = `${operand1} || ${operand2}`;

          break;
        }

        case OpCode.operator_not: {
          satisfiesInputShape = InputShape.Boolean;

          const operand = inputToJS(block.inputs.OPERAND, InputShape.Boolean);
          blockSource = `!${operand}`;

          break;
        }

        case OpCode.operator_join: {
          satisfiesInputShape = InputShape.String;

          const string1 = inputToJS(block.inputs.STRING1, InputShape.String);
          const string2 = inputToJS(block.inputs.STRING2, InputShape.String);
          blockSource = `${string1} + ${string2}`;

          break;
        }

        case OpCode.operator_letter_of: {
          satisfiesInputShape = InputShape.String;

          const string = inputToJS(block.inputs.STRING, InputShape.Any);
          const letter = inputToJS(block.inputs.LETTER, InputShape.Index);
          blockSource = `this.letterOf(${string}, ${letter})`;

          break;
        }

        case OpCode.operator_length: {
          satisfiesInputShape = InputShape.Number;

          const string = inputToJS(block.inputs.STRING, InputShape.Any);
          blockSource = `${string}.length`;

          break;
        }

        case OpCode.operator_contains: {
          satisfiesInputShape = InputShape.Boolean;

          const string1 = inputToJS(block.inputs.STRING1, InputShape.String);
          const string2 = inputToJS(block.inputs.STRING2, InputShape.String);
          blockSource = `this.stringIncludes(${string1}, ${string2})`;

          break;
        }

        case OpCode.operator_mod: {
          satisfiesInputShape = InputShape.Number;

          const num1 = inputToJS(block.inputs.NUM1, InputShape.Number);
          const num2 = inputToJS(block.inputs.NUM2, InputShape.Number);
          blockSource = `${num1} % ${num2}`;

          break;
        }

        case OpCode.operator_round: {
          satisfiesInputShape = InputShape.Number;

          const num = inputToJS(block.inputs.NUM, InputShape.Number);
          blockSource = `Math.round(${num})`;

          break;
        }

        case OpCode.operator_mathop: {
          // TODO: Verify this is true for all ops.
          satisfiesInputShape = InputShape.Number;

          const num = inputToJS(block.inputs.NUM, InputShape.Number);
          switch (block.inputs.OPERATOR.value) {
            case "abs": {
              blockSource = `Math.abs(${num})`;
              break;
            }

            case "floor": {
              blockSource = `Math.floor(${num})`;
              break;
            }

            case "ceiling": {
              blockSource = `Math.ceil(${num})`;
              break;
            }

            case "sqrt": {
              blockSource = `Math.sqrt(${num})`;
              break;
            }

            case "sin": {
              blockSource = `Math.sin(this.degToRad(${num}))`;
              break;
            }

            case "cos": {
              blockSource = `Math.cos(this.degToRad(${num}))`;
              break;
            }

            case "tan": {
              blockSource = `this.scratchTan(${num})`;
              break;
            }

            case "asin": {
              blockSource = `this.radToDeg(Math.asin(${num}))`;
              break;
            }

            case "acos": {
              blockSource = `this.radToDeg(Math.acos(${num}))`;
              break;
            }

            case "atan": {
              blockSource = `this.radToDeg(Math.atan(${num}))`;
              break;
            }

            case "ln": {
              blockSource = `Math.log(${num})`;
              break;
            }

            case "log": {
              blockSource = `Math.log10(${num})`;
              break;
            }

            case "e ^": {
              blockSource = `Math.E ** ${num}`;
              break;
            }

            case "10 ^": {
              blockSource = `10 ** ${num}`;
              break;
            }
          }

          break;
        }

        case OpCode.data_variable: {
          // TODO: Is this wrong?
          satisfiesInputShape = InputShape.Stack;

          blockSource = selectedVarSource;

          break;
        }

        case OpCode.data_setvariableto: {
          satisfiesInputShape = InputShape.Stack;

          const value = inputToJS(block.inputs.VALUE, InputShape.Any);
          blockSource = `${selectedVarSource} = ${value}`;

          break;
        }

        case OpCode.data_changevariableby: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = increase(selectedVarSource, block.inputs.VALUE, true);

          break;
        }

        case OpCode.data_showvariable: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `${selectedWatcherSource}.visible = true`;

          break;
        }

        case OpCode.data_hidevariable: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `${selectedWatcherSource}.visible = false`;

          break;
        }

        case OpCode.data_listcontents: {
          satisfiesInputShape = InputShape.String;

          // TODO: This isn't nuanced how Scratch works.
          blockSource = `${selectedVarSource}.join(" ")`;

          break;
        }

        case OpCode.data_addtolist: {
          satisfiesInputShape = InputShape.Stack;

          const item = inputToJS(block.inputs.ITEM, InputShape.Any);
          blockSource = `${selectedVarSource}.push(${item})`;

          break;
        }

        case OpCode.data_deleteoflist: {
          satisfiesInputShape = InputShape.Stack;

          switch (block.inputs.INDEX.value) {
            case "all": {
              blockSource = `${selectedVarSource} = []`;
              break;
            }

            case "last": {
              blockSource = `${selectedVarSource}.splice(${selectedVarSource}.length - 1, 1)`;
              break;
            }

            default: {
              const index = inputToJS(block.inputs.INDEX, InputShape.Index);
              blockSource = `${selectedVarSource}.splice(${index}, 1)`;
              break;
            }
          }

          break;
        }

        case OpCode.data_deletealloflist: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `${selectedVarSource} = []`;

          break;
        }

        case OpCode.data_insertatlist: {
          satisfiesInputShape = InputShape.Stack;

          const index = inputToJS(block.inputs.INDEX, InputShape.Index);
          const item = inputToJS(block.inputs.ITEM, InputShape.Any);
          blockSource = `${selectedVarSource}.splice(${index}, 0, ${item})`;

          break;
        }

        case OpCode.data_replaceitemoflist: {
          satisfiesInputShape = InputShape.Stack;

          const index = inputToJS(block.inputs.INDEX, InputShape.Index);
          const item = inputToJS(block.inputs.ITEM, InputShape.Any);
          blockSource = `${selectedVarSource}.splice(${index}, 1, ${item})`;

          break;
        }

        case OpCode.data_itemoflist: {
          satisfiesInputShape = InputShape.Any;

          switch (block.inputs.INDEX.value) {
            case "last": {
              blockSource = `this.itemOf(${selectedVarSource}, ${selectedVarSource}.length - 1)`;
              break;
            }

            default: {
              const index = inputToJS(block.inputs.INDEX, InputShape.Index);
              blockSource = `this.itemOf(${selectedVarSource}, ${index})`;
              break;
            }
          }

          break;
        }

        case OpCode.data_itemnumoflist: {
          const item = inputToJS(block.inputs.ITEM, InputShape.Any);

          if (desiredInputShape === InputShape.Index) {
            satisfiesInputShape = InputShape.Index;
            blockSource = `this.indexInArray(${selectedVarSource}, ${item})`;
          } else {
            satisfiesInputShape = InputShape.Number;
            blockSource = `this.indexInArray(${selectedVarSource}, ${item}) + 1`;
          }

          break;
        }

        case OpCode.data_lengthoflist: {
          satisfiesInputShape = InputShape.Number;

          blockSource = `${selectedVarSource}.length`;

          break;
        }

        case OpCode.data_listcontainsitem: {
          satisfiesInputShape = InputShape.Boolean;

          const item = inputToJS(block.inputs.ITEM, InputShape.Any);
          blockSource = `this.arrayIncludes(${selectedVarSource}, ${item})`;

          break;
        }

        case OpCode.data_showlist: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `${selectedWatcherSource}.visible = true`;

          break;
        }

        case OpCode.data_hidelist: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `${selectedWatcherSource}.visible = false`;

          break;
        }

        case OpCode.procedures_call: {
          satisfiesInputShape = InputShape.Stack;

          // Get name of custom block script with given PROCCODE:
          // TODO: what if it doesn't exist?
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const procName = target.scripts.find(
            script =>
              script.hat !== null &&
              script.hat.opcode === OpCode.procedures_definition &&
              script.hat.inputs.PROCCODE.value === block.inputs.PROCCODE.value
          )!.name;

          // TODO: Boolean inputs should provide appropriate desiredInputShape instead of "any"
          const procArgs = block.inputs.INPUTS.value.map(input => inputToJS(input, InputShape.Any)).join(", ");

          // Warp-mode procedures execute all child procedures in warp mode as well
          if (warp) {
            blockSource = `this.warp(this.${procName})(${procArgs})`;
          } else {
            blockSource = `yield* this.${procName}(${procArgs})`;
          }

          break;
        }

        case OpCode.argument_reporter_string_number:
        case OpCode.argument_reporter_boolean: {
          // Argument reporters dragged outside their script return 0
          if (!script) {
            satisfiesInputShape = InputShape.Number;
            blockSource = `0`;
            break;
          }

          const argNames = customBlockArgNameMap.get(script);
          // The procedure definition that this argument reporter was dragged out of doesn't exist (it's in another
          // sprite, or deleted). Scratch returns 0 here.
          if (!argNames) {
            satisfiesInputShape = InputShape.Number;
            blockSource = `0`;
            break;
          }

          if (block.opcode === OpCode.argument_reporter_boolean) {
            satisfiesInputShape = InputShape.Boolean;
          } else {
            satisfiesInputShape = InputShape.Any;
          }

          blockSource = argNames[block.inputs.VALUE.value];

          break;
        }

        case OpCode.pen_clear: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `this.clearPen()`;

          break;
        }

        case OpCode.pen_stamp: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `this.stamp()`;

          break;
        }

        case OpCode.pen_penDown: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `this.penDown = true`;

          break;
        }

        case OpCode.pen_penUp: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = `this.penDown = false`;

          break;
        }

        case OpCode.pen_setPenColorToColor: {
          satisfiesInputShape = InputShape.Stack;

          const color = colorInputToJS(block.inputs.COLOR);
          blockSource = `this.penColor = ${color}`;

          break;
        }

        case OpCode.pen_changePenColorParamBy: {
          satisfiesInputShape = InputShape.Stack;

          switch (block.inputs.COLOR_PARAM.value) {
            case "color": {
              blockSource = increase(`this.penColor.h`, block.inputs.VALUE, false);
              break;
            }

            case "saturation": {
              blockSource = increase(`this.penColor.s`, block.inputs.VALUE, false);
              break;
            }

            case "brightness": {
              blockSource = increase(`this.penColor.v`, block.inputs.VALUE, false);
              break;
            }

            case "transparency": {
              const value = inputToJS(block.inputs.VALUE, InputShape.Number);
              blockSource = `this.penColor.a -= ${value} / 100`;
              break;
            }
          }

          break;
        }

        case OpCode.pen_setPenColorParamTo: {
          satisfiesInputShape = InputShape.Stack;

          const value = inputToJS(block.inputs.VALUE, InputShape.Number);

          switch (block.inputs.COLOR_PARAM.value) {
            case "color": {
              blockSource = `this.penColor.h = ${value}`;
              break;
            }

            case "saturation": {
              blockSource = `this.penColor.s = ${value}`;
              break;
            }

            case "brightness": {
              blockSource = `this.penColor.v = ${value}`;
              break;
            }

            case "transparency": {
              blockSource = `this.penColor.a = 1 - (${value} / 100)`;
              break;
            }
          }

          break;
        }

        case OpCode.pen_setPenSizeTo: {
          satisfiesInputShape = InputShape.Stack;

          const size = inputToJS(block.inputs.SIZE, InputShape.Number);
          blockSource = `this.penSize = ${size}`;

          break;
        }

        case OpCode.pen_changePenSizeBy: {
          satisfiesInputShape = InputShape.Stack;

          blockSource = increase(`this.penSize`, block.inputs.SIZE, false);

          break;
        }

        default: {
          satisfiesInputShape = InputShape.Any;

          blockSource = `/* TODO: Implement ${block.opcode} */ null`;

          break;
        }
      }

      switch (desiredInputShape) {
        case satisfiesInputShape: {
          return blockSource;
        }

        case InputShape.Number: {
          return `this.toNumber(${blockSource})`;
        }

        case InputShape.Index: {
          return `(${blockSource}) - 1`;
        }

        case InputShape.Boolean: {
          return `this.toBoolean(${blockSource})`;
        }

        case InputShape.String: {
          return `this.toString(${blockSource})`;
        }

        default: {
          return blockSource;
        }
      }
    }
  }

  const getPathsToRelativeOrAbsolute = (destination: string) => {
    const fakeOrigin = `http://${Math.random()}.com`;
    const isExternal = new URL(destination, fakeOrigin).origin !== fakeOrigin;
    const isAbsolute = isExternal || destination.startsWith("/");

    if (isAbsolute) {
      return () => destination;
    } else {
      return ({ from }: { from: "index" | "target" }) => {
        switch (from) {
          case "index":
            return "./" + destination;
          case "target":
            return "../" + destination;
        }
      };
    }
  };

  const toLeopardJS = getPathsToRelativeOrAbsolute(options.leopardJSURL);
  const toLeopardCSS = getPathsToRelativeOrAbsolute(options.leopardCSSURL);

  let files: { [fileName: string]: string } = {
    "index.html": `
      <!DOCTYPE html>
      <html>
        <head>
          <link rel="stylesheet" href="${toLeopardCSS({ from: "index" })}" />
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
      import { Project, Sprite } from ${JSON.stringify(toLeopardJS({ from: "index" }))};

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
              `${sprite.name}: new ${sprite.name}({${Object.entries({
                x: sprite.x,
                y: sprite.y,
                direction: sprite.direction,
                rotationStyle: `Sprite.RotationStyle.${
                  {
                    normal: "ALL_AROUND",
                    leftRight: "LEFT_RIGHT",
                    none: "DONT_ROTATE"
                  }[sprite.rotationStyle]
                }`,
                costumeNumber: sprite.costumeNumber + 1,
                size: sprite.size,
                visible: sprite.visible,
                layerOrder: sprite.layerOrder
              })
                .map(([key, value]) => `${key}:${value.toString()}`)
                .join(",")}})`
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
  function toOptimalJavascriptRepresentation(value: string | number | boolean | (string | number | boolean)[]): string {
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
      import { ${
        target.isStage ? "Stage as StageBase" : "Sprite"
      }, Trigger, Watcher, Costume, Color, Sound } from '${toLeopardJS({ from: "target" })}';

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
