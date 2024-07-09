import Project from "../../Project";
import Script from "../../Script";
import Block from "../../Block";
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
 * Desirable traits are the basic attributes controlling what syntax
 * is returned for any given block (or primitive value). Provide a
 * valid combination of traits to `inputToJS` to constrain the types
 * of values that will be proivded to that input.
 *
 * An empty list of desirable traits indicates any value at all
 * (including `undefined`) is acceptable in the current context.
 */
enum DesirableTraits {
  /**
   * Indicates an exact boolean (true/false) value is desired.
   */
  IsBoolean,

  /**
   * Indicates a number value is desired (typeof x === 'number').
   * By default, this indicates it's OK to leave NaN as it is.
   * Other non-number values will be cast to zero, but if the
   * value is NaN to begin with, that will be left as-is.
   *
   * Behavior can be customized by specifying, alongside IsNumber,
   * IsCastToNaN or IsCastToZero.
   */
  IsNumber,

  /**
   * Indicates an index value is desired - this is a normal number,
   * but decremented by one compared to its value in Scratch.
   *
   * The traits for customizing IsNumber don't apply to IsIndex.
   */
  IsIndex,

  /**
   * Indicates a string value is desired (typeof x === 'string').
   *
   * This must be specified if a number value is *not* desired;
   * if left unspecified (declaring any value is acceptable),
   * inputs with values such as "1.234", regardless if they are
   * string or number inputs in Scratch, will be converted to
   * number primitives (such as the number 1.234).
   */
  IsString,

  /**
   * Indicates a series of stack blocks is desired. It may be
   * empty, contain a single block, or contain multiple blocks.
   *
   * In JavaScript, there's generally no difference between a
   * "function" for reporting values and a "command" for doing
   * side-effects, so blocks are returned without any special
   * syntax if a stack is desired.
   */
  IsStack,

  /**
   * Indicates that if a value can't be converted to a number
   * (according to `toNumber(expr, true)` rules), NaN should be
   * returned. NaN itself is also returned as NaN.
   *
   * May only be specified alongside IsNumber.
   */
  IsCastToNaN,

  /**
   * Indicates that if a value can't be converted to a number,
   * or if the value is NaN itself, zero shuold be returned.
   *
   * May only be specifeid alongside IsNumber.
   */
  IsCastToZero
}

/**
 * Satisfying traits are the basic attributes that tell what kind
 * of value would be returned by a given block. They're mainly used
 * to aid the value casting which occurs at the end of `blocktoJS`.
 *
 * An empty list of satisfying traits indicates no particular type
 * of value is guaranteed, i.e. this block could have any value,
 * or the type of its value is totally indeterminate.
 */
enum SatisfyingTraits {
  /**
   * Indicates an exact boolean (true/false) value is satisfied.
   */
  IsBoolean,

  /**
   * Indicates a number value is satisfied (typeof x === 'number').
   * By default, this implies the number value may be NaN, but this
   * can be ruled out by specifying, alongside IsNumber, IsNotNaN.
   */
  IsNumber,

  /**
   * Indicates an index is satisfied. Within the definition for a
   * particular reporter, this means the reporter already took care
   * of decrementing its numeric return value by one.
   */
  IsIndex,

  /**
   * Indicates a string value is satisfied (typeof x === 'string').
   */
  IsString,

  /**
   * Indicates a stack block is satisfied. This isn't generally
   * apropos to any special meaning in Leopard or in current
   * conversion code.
   */
  IsStack,

  /**
   * Indicates that the satisfied number value isn't NaN - i.e,
   * it's a non-NaN number.
   *
   * May only be specified alongside IsNumber.
   */
  IsNotNaN
}

type DesirableTraitCombo =
  | []
  | [DesirableTraits.IsBoolean]
  | [DesirableTraits.IsNumber]
  | [DesirableTraits.IsNumber, DesirableTraits.IsCastToNaN]
  | [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]
  | [DesirableTraits.IsIndex]
  | [DesirableTraits.IsStack]
  | [DesirableTraits.IsString];

type SatisfyingTraitCombo =
  | []
  | [SatisfyingTraits.IsBoolean]
  | [SatisfyingTraits.IsNumber]
  | [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN]
  | [SatisfyingTraits.IsIndex]
  | [SatisfyingTraits.IsString]
  | [SatisfyingTraits.IsStack];

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
    desiredTraits: DesirableTraitCombo = []
  ): string {
    // Short-circuit for string inputs. These must never return number syntax.
    if (desiredTraits.length && desiredTraits[0] === DesirableTraits.IsString) {
      return JSON.stringify(value);
    }

    // Other input shapes which static inputs may fulfill: number, index, any.
    // These are all OK to return JavaScript number literals for.
    const asNum = Number(value as string);
    if (!isNaN(asNum) && value !== "") {
      if (desiredTraits.length && desiredTraits[0] === DesirableTraits.IsIndex) {
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
            : staticBlockInputToLiteral(valueInput.value, [DesirableTraits.IsNumber]);
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
        return `${leftSide} += ${inputToJS(input, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero])}`;
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
        return `${leftSide} -= ${inputToJS(input, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero])}`;
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
        const num = inputToJS(input, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);
        return `Color.num(${num})`;
      }
    }

    function inputToJS(input: BlockInput.Any, desiredTraits: DesirableTraitCombo = []): string {
      // TODO: Right now, inputs can be completely undefined if imported from
      // the .sb3 format (because sb3 is weird). This little check will replace
      // undefined inputs with the value `null`. In theory, this should
      // eventually be removed when the sb3 import script is improved.
      if (input === undefined) {
        return "null";
      }

      switch (input.type) {
        case "block": {
          const inputSource = blockToJS(input.value, desiredTraits);
          if (desiredTraits.length && desiredTraits[0] === DesirableTraits.IsStack) {
            return inputSource;
          } else {
            return `(${inputSource})`;
          }
        }

        case "blocks": {
          return input.value?.map(block => blockToJS(block)).join(";\n") ?? "";
        }

        default: {
          return staticBlockInputToLiteral(input.value, desiredTraits);
        }
      }
    }

    function blockToJS(block: Block, desiredTraits: DesirableTraitCombo = []): string {
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

      let satisfiesTraits: SatisfyingTraitCombo = [];
      let blockSource: string;

      makeBlockSource: switch (block.opcode) {
        case OpCode.motion_movesteps: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const steps = inputToJS(block.inputs.STEPS, [DesirableTraits.IsNumber]);
          blockSource = `this.move(${steps})`;

          break;
        }

        case OpCode.motion_turnright: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = increase(`this.direction`, block.inputs.DEGREES, false);

          break;
        }

        case OpCode.motion_turnleft: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = decrease(`this.direction`, block.inputs.DEGREES, false);

          break;
        }

        case OpCode.motion_goto: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

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
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const x = inputToJS(block.inputs.X, [DesirableTraits.IsNumber]);
          const y = inputToJS(block.inputs.Y, [DesirableTraits.IsNumber]);
          blockSource = `this.goto(${x}, ${y})`;

          break;
        }

        case OpCode.motion_glideto: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const secs = inputToJS(block.inputs.SECS, [DesirableTraits.IsNumber]);

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
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const secs = inputToJS(block.inputs.SECS, [DesirableTraits.IsNumber]);
          const x = inputToJS(block.inputs.X, [DesirableTraits.IsNumber]);
          const y = inputToJS(block.inputs.Y, [DesirableTraits.IsNumber]);
          blockSource = `yield* this.glide(${secs}, ${x}, ${y})`;

          break;
        }

        case OpCode.motion_pointindirection: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const direction = inputToJS(block.inputs.DIRECTION, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);
          blockSource = `this.direction = ${direction}`;

          break;
        }

        case OpCode.motion_pointtowards: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

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
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = increase(`this.x`, block.inputs.DX, false);

          break;
        }

        case OpCode.motion_setx: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const x = inputToJS(block.inputs.X, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);
          blockSource = `this.x = ${x}`;

          break;
        }

        case OpCode.motion_changeyby: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = increase(`this.y`, block.inputs.DY, false);

          break;
        }

        case OpCode.motion_sety: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const y = inputToJS(block.inputs.Y, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);
          blockSource = `this.y = ${y}`;

          break;
        }

        case OpCode.motion_ifonedgebounce: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `this.ifOnEdgeBounce()`;

          break;
        }

        case OpCode.motion_setrotationstyle: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

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
          satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];

          blockSource = `this.x`;

          break;
        }

        case OpCode.motion_yposition: {
          satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];

          blockSource = `this.y`;

          break;
        }

        case OpCode.motion_direction: {
          satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];

          blockSource = `this.direction`;

          break;
        }

        // Obsolete no-op blocks:
        case OpCode.motion_scroll_right:
        case OpCode.motion_scroll_up:
        case OpCode.motion_align_scene: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = ``;

          break;
        }

        case OpCode.motion_xscroll:
        case OpCode.motion_yscroll: {
          satisfiesTraits = [];

          blockSource = `undefined`; // Compatibility with Scratch 3.0 \:)/

          break;
        }

        case OpCode.looks_sayforsecs: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const message = inputToJS(block.inputs.MESSAGE);
          const secs = inputToJS(block.inputs.SECS, [DesirableTraits.IsNumber]);
          blockSource = `yield* this.sayAndWait(${message}, ${secs})`;

          break;
        }

        case OpCode.looks_say: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const message = inputToJS(block.inputs.MESSAGE);
          blockSource = `this.say(${message})`;

          break;
        }

        case OpCode.looks_thinkforsecs: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const message = inputToJS(block.inputs.MESSAGE);
          const secs = inputToJS(block.inputs.SECS, [DesirableTraits.IsNumber]);
          blockSource = `yield* this.thinkAndWait(${message}, ${secs})`;

          break;
        }

        case OpCode.looks_think: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const message = inputToJS(block.inputs.MESSAGE);
          blockSource = `this.think(${message})`;

          break;
        }

        case OpCode.looks_switchcostumeto: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const costume = inputToJS(block.inputs.COSTUME);
          blockSource = `this.costume = ${costume}`;

          break;
        }

        case OpCode.looks_nextcostume: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `this.costumeNumber++`;

          break;
        }

        case OpCode.looks_switchbackdropto: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const backdrop = inputToJS(block.inputs.BACKDROP);
          blockSource = `${stage}.costume = ${backdrop}`;

          break;
        }

        case OpCode.looks_nextbackdrop: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `${stage}.costumeNumber++`;

          break;
        }

        case OpCode.looks_changesizeby: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = increase(`this.size`, block.inputs.CHANGE, false);

          break;
        }

        case OpCode.looks_setsizeto: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const size = inputToJS(block.inputs.SIZE, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);
          blockSource = `this.size = ${size}`;

          break;
        }

        case OpCode.looks_changeeffectby: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const effect = block.inputs.EFFECT.value.toLowerCase();
          blockSource = increase(`this.effects.${effect}`, block.inputs.CHANGE, false);

          break;
        }

        case OpCode.looks_seteffectto: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const effect = block.inputs.EFFECT.value.toLowerCase();
          const value = inputToJS(block.inputs.VALUE, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);
          blockSource = `this.effects.${effect} = ${value}`;

          break;
        }

        case OpCode.looks_cleargraphiceffects: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `this.effects.clear()`;

          break;
        }

        case OpCode.looks_show: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `this.visible = true`;

          break;
        }

        case OpCode.looks_hide: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `this.visible = false`;

          break;
        }

        case OpCode.looks_gotofrontback: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

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
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const num = inputToJS(block.inputs.NUM, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);

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
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = ``;

          break;
        }

        case OpCode.looks_costumenumbername: {
          switch (block.inputs.NUMBER_NAME.value) {
            case "name": {
              satisfiesTraits = [SatisfyingTraits.IsString];
              blockSource = `this.costume.name`;
              break;
            }

            case "number":
            default: {
              satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
              blockSource = `this.costumeNumber`;
              break;
            }
          }

          break;
        }

        case OpCode.looks_backdropnumbername: {
          switch (block.inputs.NUMBER_NAME.value) {
            case "name": {
              satisfiesTraits = [SatisfyingTraits.IsString];
              blockSource = `${stage}.costume.name`;
              break;
            }

            case "number":
            default: {
              satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
              blockSource = `${stage}.costumeNumber`;
              break;
            }
          }

          break;
        }

        case OpCode.looks_size: {
          satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];

          blockSource = `this.size`;

          break;
        }

        case OpCode.sound_playuntildone: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const sound = inputToJS(block.inputs.SOUND_MENU);
          blockSource = `yield* this.playSoundUntilDone(${sound})`;

          break;
        }

        case OpCode.sound_play: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const sound = inputToJS(block.inputs.SOUND_MENU);
          blockSource = `yield* this.startSound(${sound})`;

          break;
        }

        case OpCode.sound_setvolumeto: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const volume = inputToJS(block.inputs.VOLUME, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);
          blockSource = `this.audioEffects.volume = ${volume}`;

          break;
        }

        case OpCode.sound_changevolumeby: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = increase(`this.audioEffects.volume`, block.inputs.VOLUME, false);

          break;
        }

        case OpCode.sound_volume: {
          satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];

          blockSource = `this.audioEffects.volume`;

          break;
        }

        case OpCode.sound_seteffectto: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const value = inputToJS(block.inputs.VALUE, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);

          if (block.inputs.EFFECT.type === "soundEffect") {
            const effect = block.inputs.EFFECT.value.toLowerCase();
            blockSource = `this.audioEffects.${effect} = ${value}`;
          } else {
            const effect = inputToJS(block.inputs.EFFECT);
            blockSource = `this.audioEffects[${effect}] = ${value}`;
          }

          break;
        }

        case OpCode.sound_changeeffectby: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const value = block.inputs.VALUE;

          if (block.inputs.EFFECT.type === "soundEffect") {
            const effect = block.inputs.EFFECT.value.toLowerCase();
            blockSource = increase(`this.audioEffects.${effect}`, value, false);
          } else {
            const effect = inputToJS(block.inputs.EFFECT);
            blockSource = increase(`this.audioEffects[${effect}]`, value, false);
          }

          break;
        }

        case OpCode.sound_cleareffects: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `this.audioEffects.clear()`;

          break;
        }

        case OpCode.sound_stopallsounds: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `this.stopAllSounds()`;

          break;
        }

        case OpCode.event_broadcast: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const message = inputToJS(block.inputs.BROADCAST_INPUT, [DesirableTraits.IsString]);
          blockSource = `this.broadcast(${message})`;

          break;
        }

        case OpCode.event_broadcastandwait: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const message = inputToJS(block.inputs.BROADCAST_INPUT, [DesirableTraits.IsString]);
          blockSource = `yield* this.broadcastAndWait(${message})`;

          break;
        }

        case OpCode.control_wait: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const duration = inputToJS(block.inputs.DURATION, [DesirableTraits.IsNumber]);
          blockSource = `yield* this.wait(${duration})`;

          break;
        }

        case OpCode.control_repeat: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const times = inputToJS(block.inputs.TIMES, [DesirableTraits.IsNumber]);
          const substack = inputToJS(block.inputs.SUBSTACK, [DesirableTraits.IsStack]);

          blockSource = `for (let i = 0; i < ${times}; i++) {
            ${substack};
            ${warp ? "" : "yield;"}
          }`;

          break;
        }

        case OpCode.control_forever: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const substack = inputToJS(block.inputs.SUBSTACK, [DesirableTraits.IsStack]);

          blockSource = `while (true) {
            ${substack};
            ${warp ? "" : "yield;"}
          }`;

          break;
        }

        case OpCode.control_if: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const condition = inputToJS(block.inputs.CONDITION, [DesirableTraits.IsBoolean]);
          const substack = inputToJS(block.inputs.SUBSTACK, [DesirableTraits.IsStack]);

          blockSource = `if (${condition}) {
            ${substack}
          }`;

          break;
        }

        case OpCode.control_if_else: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const condition = inputToJS(block.inputs.CONDITION, [DesirableTraits.IsBoolean]);
          const substack1 = inputToJS(block.inputs.SUBSTACK, [DesirableTraits.IsStack]);
          const substack2 = inputToJS(block.inputs.SUBSTACK2, [DesirableTraits.IsStack]);

          blockSource = `if (${condition}) {
            ${substack1}
          } else {
            ${substack2}
          }`;

          break;
        }

        case OpCode.control_wait_until: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const condition = inputToJS(block.inputs.CONDITION, [DesirableTraits.IsBoolean]);
          blockSource = `while (!${condition}) { yield; }`;

          break;
        }

        case OpCode.control_repeat_until: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const condition = inputToJS(block.inputs.CONDITION, [DesirableTraits.IsBoolean]);
          const substack = inputToJS(block.inputs.SUBSTACK, [DesirableTraits.IsStack]);

          blockSource = `while (!${condition}) {
            ${substack}
            ${warp ? "" : "yield;"}
          }`;

          break;
        }

        case OpCode.control_while: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const condition = inputToJS(block.inputs.CONDITION, [DesirableTraits.IsBoolean]);
          const substack = inputToJS(block.inputs.SUBSTACK, [DesirableTraits.IsStack]);

          blockSource = `while (${condition}) {
            ${substack}
            ${warp ? "" : "yield;"}
          }`;

          break;
        }

        case OpCode.control_for_each: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const value = inputToJS(block.inputs.VALUE, [DesirableTraits.IsNumber]);
          const substack = inputToJS(block.inputs.SUBSTACK, [DesirableTraits.IsStack]);

          // TODO: Verify compatibility if variable changes during evaluation
          blockSource = `for (${selectedVarSource} = 1; ${selectedVarSource} <= ${value}; ${selectedVarSource}++) {
            ${substack}
            ${warp ? "" : "yield;"}
          }`;

          break;
        }

        case OpCode.control_all_at_once: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = inputToJS(block.inputs.SUBSTACK, [DesirableTraits.IsStack]);

          break;
        }

        case OpCode.control_stop: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

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
          satisfiesTraits = [SatisfyingTraits.IsStack];

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
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `this.deleteThisClone()`;

          break;
        }

        case OpCode.control_get_counter: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `${stage}.__counter`;

          break;
        }

        case OpCode.control_incr_counter: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `${stage}.__counter++`;

          break;
        }

        case OpCode.control_clear_counter: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `${stage}.__counter = 0`;

          break;
        }

        case OpCode.sensing_touchingobject: {
          satisfiesTraits = [SatisfyingTraits.IsBoolean];

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
          satisfiesTraits = [SatisfyingTraits.IsBoolean];

          const color = colorInputToJS(block.inputs.COLOR);
          blockSource = `this.touching(${color})`;

          break;
        }

        case OpCode.sensing_coloristouchingcolor: {
          satisfiesTraits = [SatisfyingTraits.IsBoolean];

          const color1 = colorInputToJS(block.inputs.COLOR);
          const color2 = colorInputToJS(block.inputs.COLOR2);
          blockSource = `this.colorTouching(${color1}, ${color2})`;

          break;
        }

        case OpCode.sensing_distanceto: {
          satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];

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
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const question = inputToJS(block.inputs.QUESTION);
          blockSource = `yield* this.askAndWait(${question})`;

          break;
        }

        case OpCode.sensing_answer: {
          satisfiesTraits = [SatisfyingTraits.IsString];

          blockSource = `this.answer`;

          break;
        }

        case OpCode.sensing_keypressed: {
          satisfiesTraits = [SatisfyingTraits.IsBoolean];

          const key = inputToJS(block.inputs.KEY_OPTION, [DesirableTraits.IsString]);
          blockSource = `this.keyPressed(${key})`;

          break;
        }

        case OpCode.sensing_mousedown: {
          satisfiesTraits = [SatisfyingTraits.IsBoolean];

          blockSource = `this.mouse.down`;

          break;
        }

        case OpCode.sensing_mousex: {
          satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];

          blockSource = `this.mouse.x`;

          break;
        }

        case OpCode.sensing_mousey: {
          satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];

          blockSource = `this.mouse.y`;

          break;
        }

        case OpCode.sensing_loudness: {
          satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];

          blockSource = `this.loudness`;

          break;
        }

        case OpCode.sensing_timer: {
          satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];

          blockSource = `this.timer`;

          break;
        }

        case OpCode.sensing_resettimer: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `this.restartTimer()`;

          break;
        }

        case OpCode.sensing_of: {
          let propName: string | null;
          switch (block.inputs.PROPERTY.value) {
            case "x position": {
              satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
              propName = "x";
              break;
            }

            case "y position": {
              satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
              propName = "y";
              break;
            }

            case "direction": {
              satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
              propName = "direction";
              break;
            }

            case "costume #":
            case "backdrop #": {
              satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
              propName = "costumeNumber";
              break;
            }

            case "costume name":
            case "backdrop name": {
              satisfiesTraits = [SatisfyingTraits.IsString];
              propName = "costume.name";
              break;
            }

            case "size": {
              satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
              propName = "size";
              break;
            }

            case "volume": {
              satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
              propName = "audioEffects.volume";
              break;
            }

            default: {
              satisfiesTraits = [];

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
                satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
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
          satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];

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
              satisfiesTraits = [SatisfyingTraits.IsString];
              blockSource = `""`;
              break;
            }
          }

          break;
        }

        case OpCode.sensing_dayssince2000: {
          satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];

          blockSource = `((new Date().getTime() - new Date(2000, 0, 1)) / 1000 / 60 + new Date().getTimezoneOffset()) / 60 / 24`;

          break;
        }

        case OpCode.sensing_username: {
          satisfiesTraits = [SatisfyingTraits.IsString];

          blockSource = `(/* no username */ "")`;

          break;
        }

        case OpCode.sensing_userid: {
          satisfiesTraits = [];

          blockSource = `undefined`; // Obsolete no-op block.

          break;
        }

        case OpCode.operator_add: {
          const num1 = inputToJS(block.inputs.NUM1, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);
          const num2 = inputToJS(block.inputs.NUM2, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);

          if (desiredTraits.length && desiredTraits[0] === DesirableTraits.IsIndex) {
            // Attempt to fulfill a desired index input by subtracting 1 from either side
            // of the block. If neither side can be parsed as a number (i.e. both inputs
            // are filled with blocks), this clause just falls back to the normal number
            // shape.
            let val1 = parseNumber(block.inputs.NUM1);
            let val2 = parseNumber(block.inputs.NUM2);
            if (typeof val2 === "number") {
              satisfiesTraits = [SatisfyingTraits.IsIndex];
              blockSource = --val2 ? `${num1} + ${val2}` : num1;
              break;
            } else if (typeof val1 === "number") {
              satisfiesTraits = [SatisfyingTraits.IsIndex];
              blockSource = --val1 ? `${val1} + ${num2}` : num2;
              break;
            }
          }

          satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
          blockSource = `${num1} + ${num2}`;

          break;
        }

        case OpCode.operator_subtract: {
          const num1 = inputToJS(block.inputs.NUM1, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);
          const num2 = inputToJS(block.inputs.NUM2, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);

          if (desiredTraits.length && desiredTraits[0] === DesirableTraits.IsIndex) {
            // Do basically the same thing as the addition operator does, but with
            // specifics for subtraction: increment the right-hand or decrement the
            // left-hand.
            let val1 = parseNumber(block.inputs.NUM1);
            let val2 = parseNumber(block.inputs.NUM2);
            if (typeof val2 === "number") {
              satisfiesTraits = [SatisfyingTraits.IsIndex];
              blockSource = ++val2 ? `${num1} - ${val2}` : num1;
              break;
            } else if (typeof val1 === "number") {
              satisfiesTraits = [SatisfyingTraits.IsIndex];
              blockSource = --val1 ? `${val1} - ${num2}` : `-${num2}`;
              break;
            }
          }

          satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
          blockSource = `${num1} - ${num2}`;

          break;
        }

        case OpCode.operator_multiply: {
          satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];

          const num1 = inputToJS(block.inputs.NUM1, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);
          const num2 = inputToJS(block.inputs.NUM2, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);

          blockSource = `${num1} * ${num2}`;

          break;
        }

        case OpCode.operator_divide: {
          // Division returns NaN if zero is divided by zero. We can rule that
          // out if there a non-zero primitive on either side of the operation.

          const val1 = parseNumber(block.inputs.NUM1);
          const val2 = parseNumber(block.inputs.NUM2);

          if ((typeof val1 === "number" && val1 !== 0) || (typeof val2 === "number" && val2 !== 0)) {
            satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
          } else {
            satisfiesTraits = [SatisfyingTraits.IsNumber];
          }

          const num1 = inputToJS(block.inputs.NUM1, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);
          const num2 = inputToJS(block.inputs.NUM2, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);

          blockSource = `${num1} / ${num2}`;

          break;
        }

        case OpCode.operator_random: {
          satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];

          const from = inputToJS(block.inputs.FROM, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);
          const to = inputToJS(block.inputs.TO, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);
          blockSource = `this.random(${from}, ${to})`;

          break;
        }

        case OpCode.operator_gt: {
          satisfiesTraits = [SatisfyingTraits.IsBoolean];

          const operand1 = inputToJS(block.inputs.OPERAND1);
          const operand2 = inputToJS(block.inputs.OPERAND2);
          blockSource = `this.compare(${operand1}, ${operand2}) > 0`;

          break;
        }

        case OpCode.operator_lt: {
          satisfiesTraits = [SatisfyingTraits.IsBoolean];

          const operand1 = inputToJS(block.inputs.OPERAND1);
          const operand2 = inputToJS(block.inputs.OPERAND2);
          blockSource = `this.compare(${operand1}, ${operand2}) < 0`;

          break;
        }

        case OpCode.operator_equals: {
          satisfiesTraits = [SatisfyingTraits.IsBoolean];

          // If both sides are blocks, we can't make any assumptions about what kind of
          // values are being compared.(*) Use the custom .compare() function to ensure
          // compatibility with Scratch's equals block.
          //
          // (*) This is theoretically false, but we currently don't have a way to inspect
          // the returned satisfied traits of a block input to see if both sides match up.

          if (
            (block.inputs.OPERAND1 as BlockInput.Any).type === "block" &&
            (block.inputs.OPERAND2 as BlockInput.Any).type === "block"
          ) {
            const operand1 = inputToJS(block.inputs.OPERAND1);
            const operand2 = inputToJS(block.inputs.OPERAND2);
            blockSource = `this.compare(${operand1}, ${operand2}) === 0`;
            break;
          }

          // From this point on, either the left- or right-hand side is definitely a
          // primitive (or both).

          const val1 = parseNumber(block.inputs.OPERAND1);
          if (typeof val1 === "number") {
            const operand2 = inputToJS(block.inputs.OPERAND2, [DesirableTraits.IsNumber, DesirableTraits.IsCastToNaN]);
            blockSource = `${val1} === ${operand2}`;
            break;
          }

          const val2 = parseNumber(block.inputs.OPERAND2);
          if (typeof val2 === "number") {
            const operand1 = inputToJS(block.inputs.OPERAND1, [DesirableTraits.IsNumber, DesirableTraits.IsCastToNaN]);
            blockSource = `${operand1} === ${val2}`;
            break;
          }

          // If neither side was parsed as a number, one side is definitely a string.
          // Compare both sides as strings.

          // TODO: Shouldn't this be case-insensitive?
          const operand1 = inputToJS(block.inputs.OPERAND1, [DesirableTraits.IsString]);
          const operand2 = inputToJS(block.inputs.OPERAND2, [DesirableTraits.IsString]);
          blockSource = `${operand1} === ${operand2}`;

          break;
        }

        case OpCode.operator_and: {
          satisfiesTraits = [SatisfyingTraits.IsBoolean];

          const operand1 = inputToJS(block.inputs.OPERAND1, [DesirableTraits.IsBoolean]);
          const operand2 = inputToJS(block.inputs.OPERAND2, [DesirableTraits.IsBoolean]);
          blockSource = `${operand1} && ${operand2}`;

          break;
        }

        case OpCode.operator_or: {
          satisfiesTraits = [SatisfyingTraits.IsBoolean];

          const operand1 = inputToJS(block.inputs.OPERAND1, [DesirableTraits.IsBoolean]);
          const operand2 = inputToJS(block.inputs.OPERAND2, [DesirableTraits.IsBoolean]);
          blockSource = `${operand1} || ${operand2}`;

          break;
        }

        case OpCode.operator_not: {
          satisfiesTraits = [SatisfyingTraits.IsBoolean];

          const operand = inputToJS(block.inputs.OPERAND, [DesirableTraits.IsBoolean]);
          blockSource = `!${operand}`;

          break;
        }

        case OpCode.operator_join: {
          satisfiesTraits = [SatisfyingTraits.IsString];

          const string1 = inputToJS(block.inputs.STRING1, [DesirableTraits.IsString]);
          const string2 = inputToJS(block.inputs.STRING2, [DesirableTraits.IsString]);
          blockSource = `${string1} + ${string2}`;

          break;
        }

        case OpCode.operator_letter_of: {
          satisfiesTraits = [SatisfyingTraits.IsString];

          const string = inputToJS(block.inputs.STRING);
          const letter = inputToJS(block.inputs.LETTER, [DesirableTraits.IsIndex]);
          blockSource = `this.letterOf(${string}, ${letter})`;

          break;
        }

        case OpCode.operator_length: {
          satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];

          const string = inputToJS(block.inputs.STRING);
          blockSource = `${string}.length`;

          break;
        }

        case OpCode.operator_contains: {
          satisfiesTraits = [SatisfyingTraits.IsBoolean];

          const string1 = inputToJS(block.inputs.STRING1, [DesirableTraits.IsString]);
          const string2 = inputToJS(block.inputs.STRING2, [DesirableTraits.IsString]);
          blockSource = `this.stringIncludes(${string1}, ${string2})`;

          break;
        }

        case OpCode.operator_mod: {
          // Modulo returns NaN if the divisor is zero or the dividend is Infinity.

          const val1 = parseNumber(block.inputs.NUM1);
          const val2 = parseNumber(block.inputs.NUM2);

          // The divisor isn't zero if it's a non-zero primitive.
          const divisorIsNotZero = typeof val2 === "number" && val2 !== 0;

          // The dividend isn't infinity if it's a primitive.
          const dividendIsNotInfinity = typeof val1 === "number";

          if (divisorIsNotZero && dividendIsNotInfinity) {
            satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
          } else {
            satisfiesTraits = [SatisfyingTraits.IsNumber];
          }

          const num1 = inputToJS(block.inputs.NUM1, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);
          const num2 = inputToJS(block.inputs.NUM2, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);

          blockSource = `${num1} % ${num2}`;

          break;
        }

        case OpCode.operator_round: {
          satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];

          const num = inputToJS(block.inputs.NUM, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);
          blockSource = `Math.round(${num})`;

          break;
        }

        case OpCode.operator_mathop: {
          const num = inputToJS(block.inputs.NUM, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);
          const val = parseNumber(block.inputs.NUM);

          const isNotInfinity = typeof val === "number";
          const infinityIsNaN = (
            isNotInfinity ? [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN] : [SatisfyingTraits.IsNumber]
          ) satisfies SatisfyingTraitCombo;

          const isNotNegative = typeof val === "number" && val >= 0;
          const negativeIsNaN = (
            isNotNegative ? [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN] : [SatisfyingTraits.IsNumber]
          ) satisfies SatisfyingTraitCombo;

          const magnitudeIsOneOrLower = typeof val === "number" && Math.abs(val) <= 1;
          const magnitudeAboveOneIsNaN = (
            magnitudeIsOneOrLower ? [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN] : [SatisfyingTraits.IsNumber]
          ) satisfies SatisfyingTraitCombo;

          switch (block.inputs.OPERATOR.value) {
            case "abs": {
              satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
              blockSource = `Math.abs(${num})`;
              break;
            }

            case "floor": {
              satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
              blockSource = `Math.floor(${num})`;
              break;
            }

            case "ceiling": {
              satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
              blockSource = `Math.ceil(${num})`;
              break;
            }

            case "sqrt": {
              satisfiesTraits = negativeIsNaN;
              blockSource = `Math.sqrt(${num})`;
              break;
            }

            case "sin": {
              satisfiesTraits = infinityIsNaN;
              blockSource = `Math.sin(this.degToRad(${num}))`;
              break;
            }

            case "cos": {
              satisfiesTraits = infinityIsNaN;
              blockSource = `Math.cos(this.degToRad(${num}))`;
              break;
            }

            case "tan": {
              satisfiesTraits = infinityIsNaN;
              blockSource = `this.scratchTan(${num})`;
              break;
            }

            case "asin": {
              satisfiesTraits = magnitudeAboveOneIsNaN;
              blockSource = `this.radToDeg(Math.asin(${num}))`;
              break;
            }

            case "acos": {
              satisfiesTraits = magnitudeAboveOneIsNaN;
              blockSource = `this.radToDeg(Math.acos(${num}))`;
              break;
            }

            case "atan": {
              satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
              blockSource = `this.radToDeg(Math.atan(${num}))`;
              break;
            }

            case "ln": {
              satisfiesTraits = infinityIsNaN;
              blockSource = `Math.log(${num})`;
              break;
            }

            case "log": {
              satisfiesTraits = infinityIsNaN;
              blockSource = `Math.log10(${num})`;
              break;
            }

            case "e ^": {
              satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
              blockSource = `Math.E ** ${num}`;
              break;
            }

            case "10 ^": {
              satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
              blockSource = `10 ** ${num}`;
              break;
            }
          }

          break;
        }

        case OpCode.data_variable: {
          // TODO: Is this wrong?
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = selectedVarSource;

          break;
        }

        case OpCode.data_setvariableto: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const value = inputToJS(block.inputs.VALUE);
          blockSource = `${selectedVarSource} = ${value}`;

          break;
        }

        case OpCode.data_changevariableby: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = increase(selectedVarSource, block.inputs.VALUE, true);

          break;
        }

        case OpCode.data_showvariable: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `${selectedWatcherSource}.visible = true`;

          break;
        }

        case OpCode.data_hidevariable: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `${selectedWatcherSource}.visible = false`;

          break;
        }

        case OpCode.data_listcontents: {
          satisfiesTraits = [SatisfyingTraits.IsString];

          // TODO: This isn't nuanced how Scratch works.
          blockSource = `${selectedVarSource}.join(" ")`;

          break;
        }

        case OpCode.data_addtolist: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const item = inputToJS(block.inputs.ITEM);
          blockSource = `${selectedVarSource}.push(${item})`;

          break;
        }

        case OpCode.data_deleteoflist: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

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
              const index = inputToJS(block.inputs.INDEX, [DesirableTraits.IsIndex]);
              blockSource = `${selectedVarSource}.splice(${index}, 1)`;
              break;
            }
          }

          break;
        }

        case OpCode.data_deletealloflist: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `${selectedVarSource} = []`;

          break;
        }

        case OpCode.data_insertatlist: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const index = inputToJS(block.inputs.INDEX, [DesirableTraits.IsIndex]);
          const item = inputToJS(block.inputs.ITEM);
          blockSource = `${selectedVarSource}.splice(${index}, 0, ${item})`;

          break;
        }

        case OpCode.data_replaceitemoflist: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const index = inputToJS(block.inputs.INDEX, [DesirableTraits.IsIndex]);
          const item = inputToJS(block.inputs.ITEM);
          blockSource = `${selectedVarSource}.splice(${index}, 1, ${item})`;

          break;
        }

        case OpCode.data_itemoflist: {
          satisfiesTraits = [];

          switch (block.inputs.INDEX.value) {
            case "last": {
              blockSource = `this.itemOf(${selectedVarSource}, ${selectedVarSource}.length - 1)`;
              break;
            }

            default: {
              const index = inputToJS(block.inputs.INDEX, [DesirableTraits.IsIndex]);
              blockSource = `this.itemOf(${selectedVarSource}, ${index})`;
              break;
            }
          }

          break;
        }

        case OpCode.data_itemnumoflist: {
          const item = inputToJS(block.inputs.ITEM);

          if (desiredTraits.length && desiredTraits[0] === DesirableTraits.IsIndex) {
            satisfiesTraits = [SatisfyingTraits.IsIndex];
            blockSource = `this.indexInArray(${selectedVarSource}, ${item})`;
          } else {
            satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
            blockSource = `this.indexInArray(${selectedVarSource}, ${item}) + 1`;
          }

          break;
        }

        case OpCode.data_lengthoflist: {
          satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];

          blockSource = `${selectedVarSource}.length`;

          break;
        }

        case OpCode.data_listcontainsitem: {
          satisfiesTraits = [SatisfyingTraits.IsBoolean];

          const item = inputToJS(block.inputs.ITEM);
          blockSource = `this.arrayIncludes(${selectedVarSource}, ${item})`;

          break;
        }

        case OpCode.data_showlist: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `${selectedWatcherSource}.visible = true`;

          break;
        }

        case OpCode.data_hidelist: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `${selectedWatcherSource}.visible = false`;

          break;
        }

        case OpCode.procedures_call: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          // Get name of custom block script with given PROCCODE:
          // TODO: what if it doesn't exist?
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const procName = target.scripts.find(
            script =>
              script.hat !== null &&
              script.hat.opcode === OpCode.procedures_definition &&
              script.hat.inputs.PROCCODE.value === block.inputs.PROCCODE.value
          )!.name;

          // TODO: We don't differentiate between input kinds here - all are treated as "any".
          // This is ostensibly "fine" because Scratch only lets you drop boolean blocks into
          // boolean inputs, so casting should never be necessary, but *if it were,* we'd be
          // letting non-boolean values slip through here. We should compare with the input
          // types of the procedure and provide [DesirableTraits.IsBoolean] when applicable.
          const procArgs = block.inputs.INPUTS.value.map(input => inputToJS(input)).join(", ");

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
            satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
            blockSource = `0`;
            break;
          }

          const argNames = customBlockArgNameMap.get(script);
          // The procedure definition that this argument reporter was dragged out of doesn't exist (it's in another
          // sprite, or deleted). Scratch returns 0 here.
          if (!argNames) {
            satisfiesTraits = [SatisfyingTraits.IsNumber, SatisfyingTraits.IsNotNaN];
            blockSource = `0`;
            break;
          }

          if (block.opcode === OpCode.argument_reporter_boolean) {
            satisfiesTraits = [SatisfyingTraits.IsBoolean];
          } else {
            satisfiesTraits = [];
          }

          blockSource = argNames[block.inputs.VALUE.value];

          break;
        }

        case OpCode.pen_clear: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `this.clearPen()`;

          break;
        }

        case OpCode.pen_stamp: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `this.stamp()`;

          break;
        }

        case OpCode.pen_penDown: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `this.penDown = true`;

          break;
        }

        case OpCode.pen_penUp: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = `this.penDown = false`;

          break;
        }

        case OpCode.pen_setPenColorToColor: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const color = colorInputToJS(block.inputs.COLOR);
          blockSource = `this.penColor = ${color}`;

          break;
        }

        case OpCode.pen_changePenColorParamBy: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

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
              const value = inputToJS(block.inputs.VALUE, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);
              blockSource = `this.penColor.a -= ${value} / 100`;
              break;
            }
          }

          break;
        }

        case OpCode.pen_setPenColorParamTo: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const value = inputToJS(block.inputs.VALUE, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);

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
          satisfiesTraits = [SatisfyingTraits.IsStack];

          const size = inputToJS(block.inputs.SIZE, [DesirableTraits.IsNumber, DesirableTraits.IsCastToZero]);
          blockSource = `this.penSize = ${size}`;

          break;
        }

        case OpCode.pen_changePenSizeBy: {
          satisfiesTraits = [SatisfyingTraits.IsStack];

          blockSource = increase(`this.penSize`, block.inputs.SIZE, false);

          break;
        }

        default: {
          satisfiesTraits = [];

          blockSource = `/* TODO: Implement ${block.opcode} */ null`;

          break;
        }
      }

      if (!desiredTraits.length) {
        return blockSource;
      }

      if (desiredTraits[0] === DesirableTraits.IsStack) {
        return blockSource;
      }

      if (desiredTraits[0] === DesirableTraits.IsNumber) {
        if (desiredTraits[1] === DesirableTraits.IsCastToNaN) {
          if (satisfiesTraits.length && satisfiesTraits[0] === SatisfyingTraits.IsNumber) {
            return blockSource;
          }

          return `this.toNumber(${blockSource}, true)`;
        }

        if (desiredTraits[1] === DesirableTraits.IsCastToZero) {
          if (
            satisfiesTraits.length &&
            satisfiesTraits[0] === SatisfyingTraits.IsNumber &&
            satisfiesTraits[1] === SatisfyingTraits.IsNotNaN
          ) {
            return blockSource;
          }

          return `this.toNumber(${blockSource})`;
        }

        if (satisfiesTraits.length && satisfiesTraits[0] === SatisfyingTraits.IsNumber) {
          return blockSource;
        }

        return `this.toNumber(${blockSource})`;
      }

      if (desiredTraits[0] === DesirableTraits.IsIndex) {
        if (satisfiesTraits.length) {
          if (satisfiesTraits[0] === SatisfyingTraits.IsIndex) {
            return blockSource;
          }

          if (satisfiesTraits[0] === SatisfyingTraits.IsNumber && satisfiesTraits[1] === SatisfyingTraits.IsNotNaN) {
            return `(${blockSource}) - 1`;
          }
        }

        return `this.toNumber(${blockSource}) - 1`;
      }

      if (desiredTraits[0] === DesirableTraits.IsString) {
        if (satisfiesTraits.length && satisfiesTraits[0] === SatisfyingTraits.IsString) {
          return blockSource;
        }

        return `this.toString(${blockSource})`;
      }

      if (desiredTraits[0] === DesirableTraits.IsBoolean) {
        if (satisfiesTraits.length && satisfiesTraits[0] === SatisfyingTraits.IsBoolean) {
          return blockSource;
        }

        return `this.toBoolean(${blockSource})`;
      }

      return blockSource;
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
