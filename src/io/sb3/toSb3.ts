import Block, { BlockBase, KnownBlock, ProcedureBlock } from "../../Block";
import Costume from "../../Costume";
import Project, { TextToSpeechLanguage } from "../../Project";
import Script from "../../Script";
import Sound from "../../Sound";
import Target, { Sprite, Stage } from "../../Target";
import * as BlockInput from "../../BlockInput";
import * as sb3 from "./interfaces";
import { OpCode } from "../../OpCode";
import { generateId } from "../../util/id";
import { prop } from "../../util/ts-util";

const BIS = sb3.BlockInputStatus;

interface ToSb3Options {
  warn: (message: string) => void
}

interface ToSb3Output {
  json: string
}

export default function toSb3(
  options: Partial<ToSb3Options> = {}
): ToSb3Output {
  // Serialize a project. Returns an object containing the text to be stored
  // in the caller's project.json output file.

  const project: Project = this;

  let warn = (message: string) => undefined;
  if (options.warn) {
    warn = options.warn;
  }

  type BlockData = sb3.Target["blocks"];

  function applyBlockData(a: BlockData, b?: BlockData) {
    if (b) {
      Object.assign(a, b);
    }
  }

  function newBlockData(): BlockData {
    return {};
  }

  function getVariableId(variableName: string, target: Target, stage: Stage): string | null {
    // Get the ID associated with the provided variable name on either the
    // provided target or the stage, or null if no matching variable is found.

    let variable = target.getVariable(variableName);
    variable = variable || stage.getVariable(variableName);
    return variable ? variable.id : null;
  }

  function getListId(listName: string, target: Target, stage: Stage): string | null {
    // Get the ID associated with the provided list name on either the provided
    // target or the stage, or null if no matching list is found.

    let list = target.getList(listName);
    list = list || stage.getList(listName);
    return list ? list.id : null;
  }

  interface SerializeInputsToFields {
    stage: Stage;
    target: Target;

    fieldEntries;
  }

  function serializeInputsToFields(inputs: {[key: string]: BlockInput.Any}, options: SerializeInputsToFields): {
    fields: {[key: string]: any}
  } {
    // Serialize provided inputs into a "fields" mapping that can be stored
    // on a serialized block.
    //
    // Where the Scratch 3.0 term "input" refers to a slot that accepts blocks,
    // the term "field" is any user-interactive slot that cannot be obscured as
    // such. Fields are also the interactive element within any shadow block,
    // making their presence key to nearly all inputs.
    //
    // While inputs are fairly complex to serialize, fields are comparatively
    // simple. A field always contains only its selected or entered value, so
    // it's not concerned with a variety of structures like an input is.
    // The format for a field mapping looks something like this:
    //
    //   {
    //     VARIABLE: ["my variable", "theVariablesId"]
    //   }
    //
    // Some fields take an ID; some don't. Here's another example:
    //
    //   {
    //     DISTANCETOMENU: ["_mouse_"]
    //   }
    //
    // The important thing to remember with fields during serialization is that
    // they refer to slots that don't accept blocks: non-droppable menus,
    // primarily, but the value in a (non-compressed) shadow input too.

    const {fieldEntries, stage, target} = options;

    const result = {
      fields: {}
    };

    if (!fieldEntries) {
      return result;
    }

    for (const key of Object.keys(fieldEntries)) {
      const input = inputs[key];
      // Fields are stored as a plain [value, id?] pair.
      let id: string;
      switch (input.type) {
        case "variable":
          id = getVariableId(input.value, target, stage);
        case "list":
          id = getListId(input.value, target, stage);
        default:
          id = null;
      }
      result.fields[key] = [input.value, id];
      continue;
    }

    return result;
  }

  interface SerializeInputShadowOptions {
    getBroadcastId: GetBroadcastId;

    parentId: string;
    primitiveOrOpCode: number | OpCode;
  }

  function serializeInputShadow(value: any, options: SerializeInputShadowOptions): {
    shadowValue: sb3.BlockInputValue,
    blockData: BlockData
  } {
    // Serialize the shadow block representing a provided value and type.
    //
    // To gather an understanding of what shadow blocks are used for, have
    // a look at serializeInputsToInputs; the gist is that they represent the
    // actual place in which you type a value or select an option from a
    // dropdown menu, and they can be obscured by having a block placed in
    // their place.
    //
    // A shadow block's only concerns are with revealing an interactive field
    // to the user. They exist so that inputs can let a non-shadow block stand
    // in place of that field.
    //
    // There are two forms in which a shadow block can be serialized. The rarer
    // structure, though the more basic one, is simply that of a typical block,
    // only with the "shadow: true" flag set. A shadow block contains a single
    // field; this field is stored the same as in any non-shadow block. Such a
    // serialized shadow block might look like this:
    //
    //   {
    //     opcode: "math_number",
    //     shadow: true,
    //     parent: "someBlockId",
    //     fields: {
    //       NUM: [50]
    //     }
    //   }
    //
    // The second form contains essentially the same data, but in a more
    // "compressed" form. In this form, the shadow block is stored as a simple
    // [type, value] pair, where the type is a constant representing the opcode
    // and field name in which the value should be placed when deserializing.
    // Because it's so much more concise than the non-compressed form, most
    // inputs are serialized in this way. The same input above in compressed
    // form would look like this:
    //
    //   [4, 50]
    //
    // As described in serializeInputsToInputs, compressed shadow blocks are
    // stored inline with the input they correspond to, not as separate blocks
    // with IDs.
    //
    // Within this code, we use the primimtiveOrOpCode option to determine how
    // the shadow should be serialized. If it is a number, it's referring to a
    // "primitive", the term uses for shadows when they are in the compressed
    // form. If it's a string, it is a (shadow) block opcode, and should be
    // serialized in the expanded form.

    const {getBroadcastId, parentId, primitiveOrOpCode} = options;

    const blockData = newBlockData();
    let shadowValue = null;

    if (primitiveOrOpCode === BIS.BROADCAST_PRIMITIVE) {
      // Broadcast primitives, unlike all other primitives, expect two values:
      // the broadcast name and its ID.
      shadowValue = [BIS.BROADCAST_PRIMITIVE, value, getBroadcastId(value)];
    } else if (typeof primitiveOrOpCode === "number") {
      // Primitive shadow, can be stored in compressed form.
      shadowValue = [primitiveOrOpCode, value];
    } else {
      // Note: Only 1-field shadow blocks are supported.
      const shadowOpCode = primitiveOrOpCode;
      const fieldEntries = sb3.fieldTypeMap[shadowOpCode];
      if (fieldEntries) {
        const fieldKey = Object.keys(fieldEntries)[0];
        const fields = {[fieldKey]: [value]};

        const id = generateId();

        blockData[id] = {
          opcode: shadowOpCode,

          next: null,
          parent: parentId,

          fields,
          inputs: {},

          shadow: true,
          topLevel: false
        };

        shadowValue = id;
      }
    }

    return {shadowValue, blockData};
  }

  interface SerializeInputsToInputsOptions<PassedInputs extends {[key: string]: BlockInput.Any}> {
    stage: Stage;
    target: Target;

    getBroadcastId: GetBroadcastId;
    getCustomBlockData: GetCustomBlockData;

    block: Block;
    inputEntries;

    initialValues: {
      [key in keyof PassedInputs]: any
    };
  }

  function serializeInputsToInputs<PassedInputs extends {[key: string]: BlockInput.Any}>(inputs: PassedInputs, options: SerializeInputsToInputsOptions<PassedInputs>): {
    inputs: sb3.Block["inputs"],
    blockData: BlockData
  } {
    // Serialize provided inputs into an "inputs" mapping that can be stored
    // on a serialized block.
    //
    // In any Scratch block, the majority of behavior configuration is provided
    // by setting values for fields and inputs. In Scratch 3.0, the term
    // "input" refers to any slot in a block where a block may be placed.
    // (Fields are slots which don't accept blocks - non-droppable dropdown
    // menus, most of the time.)
    //
    // During serialization, there are three fundamental ways to describe an
    // input, each associated with a particular constant numeral. They're all
    // based on the concept of a "shadow block", which is a representation of
    // the non-block contents of an input. They're described in the following
    // list, and are detailed further in serializeInputShadow.
    //
    // (1) INPUT_SAME_BLOCK_SHADOW:
    //   The input contains only a shadow block - no non-shadow. Take the
    //   number input (612), for example. The element you type in to change
    //   that value is the shadow block. Because there is nothing obscuring
    //   the shadow block, the input is serialized as INPUT_SAME_BLOCK_SHADOW.
    // (2) INPUT_BLOCK_NO_SHADOW:
    //   The input contains a non-shadow block - but no shadow. These are
    //   relatively rare, since most inputs contain a shadow block (even when
    //   obscured - see (3) below). Examples of inputs that don't are boolean
    //   and substack slots, both prominent in blocks in the Control category.
    // (3) INPUT_DIFF_BLOCK_SHADOW:
    //   The input contains a non-shadow block - and a shadow block, too.
    //   This is the case when you've placed an ordinary Scratch block into the
    //   input, obscuring the shadow block in its place. It's worth noting that
    //   Scratch 3.0 remembers the type and value of an obscured shadow: if you
    //   place a block ((4) * (13)) into that number input (612), and later
    //   remove it, Scratch will reveal the (612) shadow again.
    //
    // There is one other way an input may be serialized, which is simply not
    // storing it at all. This occurs when an input contains neither a shadow
    // nor a non-shadow, as in INPUT_BLOCK_NO_SHADOW (2) but with the block
    // removed. (It's technically also valid to output null as the ID of the
    // block inside an INPUT_BLOCK_NO_SHADOW to represent such inputs. In this
    // code we choose not to store them at all.)
    //
    // When all is said and done, a block's inputs are stored as a mapping of
    // each input's ID to an array whose first item is one of the constants
    // described above, and whose following items depend on which constant.
    // For the block "go to x: (50) y: ((x position) of (dog))", that mapping
    // might look something like this:
    //
    //   inputs: {
    //     X: [INPUT_SAME_BLOCK_SHADOW, [4, 50]],
    //     Y: [INPUT_DIFF_BLOCK_SHADOW, "some block id", [4, -50]]
    //   }
    //
    // The arrays [4, 50] and [4, -50] represent the two shadow blocks these
    // inputs hold (the latter obscured by the "of" block). The value 4 is a
    // constant referring to a "math_number" - essentially, it is the type of
    // the shadow contained within that input.
    //
    // It's worth noting that some shadows are serialized as
    // actual blocks on the target's "blocks" dictionary, and referred to by
    // ID; the inputs in "switch to costume (item (random) of (costumes))"
    // follow this structure:
    //
    //   inputs: {
    //     COSTUME: [INPUT_DIFF_BLOCK_SHADOW, "id 1", "id 2"]
    //   }
    //
    // ...where id 2 is the ID of the obscured shadow block. Specific details
    // on how shadow blocks are serialized and whether they're stored as
    // arrays or referenced by block ID is described in serializeInputShadow.
    // As far as the input mapping is concerned, all that matters is that the
    // two formats may be interchanged with one another.
    //
    // Also note that there are a couple blocks (specifically the variable and
    // list-contents getters) which are serialized altogether in the compressed
    // much the same as a compressed shadow, irregardless of the type of the
    // input they've been placed inside. This is because they're so common in
    // a project, and do not have any inputs of their own - only a field to
    // identify which variable or list the block corresponds to. The input
    // mapping for the block "set x to (spawn x)" would look something like
    // this:
    //
    //   inputs: {
    //     X: [INPUT_DIFF_BLOCK_SHADOW, [12, "spawn x", "someId"], [4, 0]]
    //   }
    //
    // ...where someId is the ID of the variable, and [4, 0] is the obscured
    // shadow block, as usual.

    const {block, getBroadcastId, getCustomBlockData, initialValues, inputEntries, stage, target} = options;

    const blockData = newBlockData();

    const result: {
      inputs: sb3.Block["inputs"],
      blockData: BlockData
    } = {
      inputs: {},
      blockData
    };

    // Just for debugging!
    const entryKeys = Object.keys(inputEntries);
    const fieldEntryKeys = Object.keys(sb3.fieldTypeMap[block.opcode] || {});
    const missingEntries = Object.keys(inputs).filter(
      inp => !(entryKeys.includes(inp) || fieldEntryKeys.includes(inp)));
    for (const key of missingEntries) {
      warn(`Missing entry for input ${key} on ${block.opcode} (${block.id} in ${target.name})`);
    }

    for (const [key, entry] of Object.entries(inputEntries)) {
      const input = inputs[key];
      if (entry === sb3.BooleanOrSubstackInputStatus) {
        let firstBlock: Block;
        let siblingBlocks: Block[];

        if (input && input.type === "blocks") {
          firstBlock = input.value[0];
          siblingBlocks = input.value;
        } else if (input && input.type === "block") {
          firstBlock = input.value;
        }

        if (firstBlock) {
          const {blockData: inputBlockData, blockId} = serializeBlock(firstBlock, {getBroadcastId, getCustomBlockData, parent: block, siblingBlocks, stage, target});
          applyBlockData(blockData, inputBlockData);

          if (blockId) {
            result.inputs[key] = [BIS.INPUT_BLOCK_NO_SHADOW, blockId];
          }
        }
      } else {
        let valueForShadow;
        if (input.type === "block") {
          valueForShadow = initialValues[key];
          // Special-case some input opcodes for more realistic initial values.
          if (entry === OpCode.looks_costume) {
            if (target.costumes[0]) {
              valueForShadow = target.costumes[0].name;
            }
          } else if (entry === OpCode.sound_sounds_menu) {
            if (target.sounds[0]) {
              valueForShadow = target.sounds[0].name;
            }
          } else if (entry === OpCode.event_broadcast_menu) {
            valueForShadow = getBroadcastId.initialBroadcastName;
          }
        } else {
          valueForShadow = input.value;
        }

        const {shadowValue, blockData: shadowBlockData} = serializeInputShadow(valueForShadow, {
          getBroadcastId,
          parentId: block.id,
          primitiveOrOpCode: entry as number | OpCode
        });
        applyBlockData(blockData, shadowBlockData);

        let obscuringBlockValue;

        if (input.type === "block") {
          if (input.value.opcode === OpCode.data_variable) {
            const variableName = input.value.inputs.VARIABLE.value;
            const variableId = getVariableId(variableName, target, stage);
            obscuringBlockValue = [BIS.VAR_PRIMITIVE, variableName, variableId];
          } else if (input.value.opcode === OpCode.data_listcontents) {
            const listName = input.value.inputs.LIST.value;
            const listId = getListId(listName, target, stage);
            obscuringBlockValue = [BIS.LIST_PRIMITIVE, listName, listId];
          } else {
            const {blockData: inputBlockData, blockId} = serializeBlock(input.value, {getBroadcastId, getCustomBlockData, parent: block, stage, target});
            applyBlockData(blockData, inputBlockData);
            obscuringBlockValue = blockId;
          }
        }

        if (obscuringBlockValue) {
          result.inputs[key] = [BIS.INPUT_DIFF_BLOCK_SHADOW, obscuringBlockValue, shadowValue];
        } else {
          result.inputs[key] = [BIS.INPUT_SAME_BLOCK_SHADOW, shadowValue];
        }
      }
    }

    return result;
  }

  interface SerializeInputsOptions {
    stage: Stage;
    target: Target;

    getBroadcastId: GetBroadcastId;
    getCustomBlockData: GetCustomBlockData;
  }

  function serializeInputs(block: Block, options: SerializeInputsOptions): {
    inputs: sb3.Block["inputs"],
    fields: sb3.Block["fields"],
    mutation?: sb3.Block["mutation"],
    blockData: BlockData
  } {
    // Serialize a block's inputs, returning the data which should be stored on
    // the serialized block, as well as any associated blockData.
    //
    // This function looks more intimidating than it ought to; most of the meat
    // here is related to serializing specific blocks whose resultant data must
    // be generated differently than other blocks. (Custom blocks are related
    // the main ones to blame.)
    //
    // serializeInputs is in charge of converting the inputs on the provided
    // block into the structures that Scratch 3.0 expects. There are (usually)
    // two mappings into which inputs are stored: fields and inputs. Specific
    // details on how these are serialized is discussed in their corresponding
    // functions (which serializeInputs defers to for most blocks), but the
    // gist is:
    //
    // * Fields store actual data, while inputs refer to shadow blocks.
    //   (Each shadow block contains a field for storing the value of that
    //    input, though often they are serialized as a "compressed" form that
    //    doesn't explicitly label that field. See serializeInputsToInputs.)
    // * Reporter blocks can be placed only into inputs - not fields.
    //   (In actuality, the input is not replaced by a block; rather, the way
    //    it is stored is changed to refer to the ID of the placed block, and
    //    the shadow block contianing the field value is maintained, "obscured"
    //    but able to be recovered if the obscuring block is moved elsewhere.)
    //
    // Blocks may also have a "mutation" field. This is an XML attribute
    // mapping containing data specific to a particular instance of a block
    // that wouldn't fit on the block's input and field mappings. Specific
    // details may vary greatly based on the opcode.

    const {stage, target, getBroadcastId, getCustomBlockData} = options;

    const {fields} = serializeInputsToFields(block.inputs, {
      fieldEntries: sb3.fieldTypeMap[block.opcode],
      stage, target
    });

    const blockData = newBlockData();
    let inputs: sb3.Block["inputs"] = {};
    let mutation: sb3.Block["mutation"];

    if (block.isKnownBlock()) {
      switch (block.opcode) {
        case OpCode.procedures_definition: {
          const prototypeId = generateId();

          const {args, warp} = getCustomBlockData(block.inputs.PROCCODE.value);

          const prototypeInputs: sb3.Block["inputs"] = {};
          for (const arg of args) {
            const shadowId = generateId();
            blockData[shadowId] = {
              opcode: prop({
                boolean: OpCode.argument_reporter_boolean,
                numberOrString: OpCode.argument_reporter_string_number
              }, arg.type),

              next: null,
              parent: prototypeId,

              inputs: {},
              fields: {
                VALUE: [arg.name]
              },

              shadow: true,
              topLevel: false
            };

            prototypeInputs[arg.id] = [BIS.INPUT_SAME_BLOCK_SHADOW, shadowId];
          }

          blockData[prototypeId] = {
            opcode: OpCode.procedures_prototype,

            next: null,
            parent: block.id,

            inputs: prototypeInputs,
            fields: {},

            shadow: true,
            topLevel: false,

            mutation: {
              tagName: "mutation",
              children: [],
              proccode: block.inputs.PROCCODE.value,
              argumentids: JSON.stringify(args.map(arg => arg.id)),
              argumentnames: JSON.stringify(args.map(arg => arg.name)),
              argumentdefaults: JSON.stringify(args.map(arg => arg.default)),
              warp: JSON.stringify(warp) as "true" | "false"
            }
          };

          inputs.custom_block = [BIS.INPUT_SAME_BLOCK_SHADOW, prototypeId];

          break;
        }

        case OpCode.procedures_call: {
          const proccode = block.inputs.PROCCODE.value;
          const customBlockData = getCustomBlockData(proccode);
          if (!customBlockData) {
            warn(`Missing custom block prototype for proccode ${proccode} (${block.id} in ${target.name}); skipping this block`);
            return null;
          }

          const {args, warp} = customBlockData;

          mutation = {
            tagName: "mutation",
            children: [],
            proccode: block.inputs.PROCCODE.value,
            argumentids: JSON.stringify(args.map(arg => arg.id)),
            warp: JSON.stringify(warp) as "true" | "false"
          }

          const inputEntries = {};
          const constructedInputs = {};
          const initialValues = {};
          let i = 0;
          for (const arg of args) {
            inputEntries[arg.id] = prop({
              "boolean": sb3.BooleanOrSubstackInputStatus,
              "numberOrString": BIS.TEXT_PRIMITIVE
            }, arg.type)
            initialValues[arg.id] = prop({
              "boolean": false,
              "numberOrString": ""
            }, arg.type);
            constructedInputs[arg.id] = block.inputs.INPUTS.value[i++];
          }

          const result = serializeInputsToInputs(constructedInputs, {
            stage,
            target,

            getBroadcastId,
            getCustomBlockData,

            block,
            initialValues,
            inputEntries
          });

          inputs = result.inputs;
          applyBlockData(blockData, result.blockData);

          break;
        }

        default: {
          const inputEntries = prop(sb3.inputPrimitiveOrShadowMap, block.opcode);

          const initialValues = {};
          for (const key of Object.keys(inputEntries)) {
            initialValues[key] = (BlockBase.getDefaultInput(block.opcode, key) || {}).initial;
          }

          const result = serializeInputsToInputs(block.inputs, {
            stage,
            target,

            getBroadcastId,
            getCustomBlockData,

            block,
            initialValues,
            inputEntries
          });

          inputs = result.inputs;
          applyBlockData(blockData, result.blockData);
        }
      }
    }

    return {inputs, fields, mutation, blockData};
  }

  interface SerializeBlockOptions {
    stage: Stage;
    target: Target;

    getBroadcastId: GetBroadcastId;
    getCustomBlockData: GetCustomBlockData;

    parent?: Block;
    siblingBlocks?: Block[];
    x?: number;
    y?: number;
  }

  function serializeBlock(block: Block, options: SerializeBlockOptions): {
    blockData: BlockData,
    blockId: string | null
  } {
    // Serialize a block, returning the resultant block data as well as the
    // ID which should be used when referring to this block, or null if no
    // such block could be serialized.
    //
    // As discussed in serializeTarget, blocks are serialized into a single
    // flat dictionary (per target), rather than an abstract syntax tree.
    // Within a serialized block, it's common to find reference to another
    // block by its ID. This is seen in linking to the next and parent blocks,
    // and to inputs.
    //
    // In Scratch 3.0 (contrasting with 2.0 as well as the intermediate format
    // created for sb-edit), "inputs" are stored in not one but two containers
    // per block: inputs, and fields. The difference is discussed in their
    // corresponding functions. Blocks may also carry a mutation, a mapping of
    // XML property names and values, for use in some blocks (notably those
    // associated with custom blocks). All this data is serialized and detailed
    // in serializeInputs.
    //
    // serializeBlock is in charge of serializing an individual block, as well
    // as its following block, and building the links between it and its parent
    // and siblings. As with other block-related functions, data is collected
    // into a BlockData object, a wrapper around the mapping of IDs to their
    // associated serialized block.
    //
    // It's possible for a block to be skipped altogether during serialization,
    // because it referred to some value which could not be converted into
    // valid SB3 data. For reporters, this means leaving an empty input; for
    // stack blocks, it means skipping to the next block in the sibling array
    // (or leaving an empty connection if there is none). It's up to the caller
    // to handle serializeBlock returning a null blockId usefully.

    const blockData = newBlockData();

    const {getBroadcastId, getCustomBlockData, parent, siblingBlocks, stage, target} = options;

    let nextBlock: Block;
    let nextBlockId: sb3.Block["next"];
    if (siblingBlocks) {
      const thisIndex = siblingBlocks.indexOf(block) + 1;
      nextBlock = siblingBlocks.find((x, index) => index === thisIndex);
    }

    if (nextBlock) {
      const {blockData: nextBlockData, blockId} = serializeBlock(nextBlock, {
        stage, target,
        getBroadcastId,
        getCustomBlockData,
        parent: block,
        siblingBlocks
      });

      applyBlockData(blockData, nextBlockData);
      nextBlockId = blockId;
    }

    const serializeInputsResult = serializeInputs(block, {
      stage,
      target,

      getBroadcastId,
      getCustomBlockData
    });

    if (!serializeInputsResult) {
      return {blockData, blockId: nextBlockId};
    }

    const { inputs, fields, mutation, blockData: inputBlockData } = serializeInputsResult;

    applyBlockData(blockData, inputBlockData);

    const obj: sb3.Block = {
      opcode: block.opcode,

      parent: parent ? parent.id : null,
      next: nextBlockId,
      topLevel: !parent,

      inputs,
      fields,
      mutation,

      shadow: false
    };

    if (obj.topLevel) {
      obj.x = options.x;
      obj.y = options.y;
    }

    const blockId = block.id;

    blockData[blockId] = obj;

    return {blockData, blockId};
  }

  interface CustomBlockData {
    args: Array<{
      default: string,
      id: string,
      name: string,
      type: "boolean" | "numberOrString"
    }>,
    warp: boolean
  }

  type GetCustomBlockData = (proccode: string) => CustomBlockData;

  type BaseGetBroadcastId = (name: string) => string;
  interface GetBroadcastId extends BaseGetBroadcastId {
    initialBroadcastName: string;
  }

  function collectCustomBlockData(target: Target): GetCustomBlockData {
    // Parse the scripts in a target, collecting metadata about each custom
    // block's arguments and other info, and return a function for accessing
    // the data associated with a particular custom block's proccode.
    //
    // It's necesary to collect this data prior to serializing any associated
    // procedure_call blocks, because they require access to data only found
    // on the associated procedure_definition. (Specifically, the types of
    // each input on the custom block, since those will influence the initial
    // value & shadow type in the serialized caller block's inputs.)

    const data: {[proccode: string]: CustomBlockData} = {};

    for (const script of target.scripts) {
      const block = script.blocks[0];
      if (block.opcode !== OpCode.procedures_definition) {
        continue;
      }

      const proccode = block.inputs.PROCCODE.value;
      const warp = block.inputs.WARP.value;

      const args: Array<{
        default: string,
        id: string
        name: string,
        type: "boolean" | "numberOrString"
      }> = [];

      for (const {name, type} of block.inputs.ARGUMENTS.value) {
        if (type === "label") {
          continue;
        }

        const id = generateId();

        args.push({
          id,
          name,
          type,
          default: prop({
            boolean: "false",
            numberOrString: ""
          }, type)
        });
      }

      data[proccode] = {args, warp};
    }

    return (proccode: string): CustomBlockData => {
      return data[proccode];
    };
  }

  interface SerializeTargetOptions {
    stage: Stage;

    getBroadcastId: GetBroadcastId;

    broadcasts: sb3.Sprite["broadcasts"];
  }

  function serializeTarget(target: Target, options: SerializeTargetOptions): sb3.Target {
    // Serialize a target. This function typically isn't used on its own, in
    // favor of the specialized functions for sprites and stage. It contains
    // the base code shared across all targets - sounds and costumes, variables
    // and lists, and, of course, blocks, for example.
    //
    // In Scratch 3.0, the representation for the code in a sprite is a flat,
    // one-dimensional mapping of block ID to block data. To identify which
    // blocks are the first block in a "script", a topLevel flag is used.
    // This differs considerably from 2.0, where the scripts property of any
    // target contained an AST (abstract syntax tree) representation.
    //
    // Since all blocks are stored in a flat mapping (and none share an ID),
    // sb-edit makes use of a "BlockData" system, which is really just a
    // syntactical wrapper around Object.assign-ing data onto an object.
    // When a block is serialized, a BlockData store is returned, and this is
    // combined into the BlockData of whatever is consuming the serialized
    // data. Eventually, all blocks (and their subblocks, inputs, etc) have
    // been serialized, and the collected data is stored on the target.
    //
    // serializeTarget also handles converting costumes, sounds, variables,
    // etc into the structures Scratch 3.0 expects.

    const mapToIdObject = (
      values: Array<{id: string, [propName: string]: any}>,
      fn: (x: any) => any
    ): {[key: string]: any} => {
      const ret = {};
      for (const object of values) {
        ret[object.id] = fn(object);
      }
      return ret;
    }

    const {broadcasts, getBroadcastId, stage} = options;

    const blockData = newBlockData();

    const getCustomBlockData = collectCustomBlockData(target);

    for (const script of target.scripts) {
      applyBlockData(blockData, serializeBlock(script.blocks[0], {
        stage, target,
        getBroadcastId,
        getCustomBlockData,
        siblingBlocks: script.blocks,
        x: script.x,
        y: script.y
      }).blockData);
    }

    const blocks = blockData;

    return {
      name: target.name,
      isStage: target.isStage,

      currentCostume: target.costumeNumber,
      layerOrder: target.layerOrder,
      volume: target.volume,

      blocks,
      broadcasts,

      // sb-edit doesn't support comments (as of feb 12, 2020)
      comments: {},

      sounds: target.sounds.map(sound => ({
        name: sound.name,
        dataFormat: sound.dataFormat,
        assetId: sound.md5,
        md5ext: sound.md5 + "." + sound.ext,
        sampleCount: sound.sampleCount,
        rate: sound.sampleRate
      })),

      costumes: target.costumes.map(costume => ({
        name: costume.name,
        assetId: costume.md5,
        bitmapResolution: costume.bitmapResolution,
        dataFormat: costume.dataFormat,
        rotationCenterX: costume.centerX,
        rotationCenterY: costume.centerY
      })),

      variables: mapToIdObject(target.variables, ({ name, value, cloud }) => {
        if (cloud) {
          return [name, value, cloud]
        } else {
          return [name, value];
        }
      }),

      lists: mapToIdObject(target.lists, ({ name, value }) => [name, value])
    };
  }

  const rotationStyleMap: {[key: string]: "all around" | "left-right" | "don't rotate"} = {
    "normal": "all around",
    "leftRight": "left-right",
    "none": "don't rotate"
  };

  interface SerializeSpriteOptions {
    stage: Stage;

    getBroadcastId: GetBroadcastId;
  }

  function serializeSprite(sprite: Sprite, options: SerializeSpriteOptions): sb3.Sprite {
    // Serialize a sprite. Extending from a serialized target, sprites carry
    // a variety of properties for their on-screen position and appearance.

    const {getBroadcastId, stage} = options;
    return {
      ...serializeTarget(sprite, {
        stage,

        getBroadcastId,

        // Broadcasts are stored on the stage, not on any sprite.
        broadcasts: {}
      }),
      isStage: false,
      x: sprite.x,
      y: sprite.y,
      size: sprite.size,
      direction: sprite.direction,
      rotationStyle: rotationStyleMap[sprite.rotationStyle],
      draggable: sprite.isDraggable,
      visible: sprite.visible
    };
  }

  interface SerializeStageOptions {
    getBroadcastId: GetBroadcastId;

    broadcasts: sb3.Target["broadcasts"];
    tempo: number;
    textToSpeechLanguage: TextToSpeechLanguage;
    videoState: "on" | "off";
    videoTransparency: number;
  }

  function serializeStage(stage: Stage, options: SerializeStageOptions): sb3.Stage {
    // Serialize a stage. Extending from a serialized target, the stage carries
    // additional properties for values shared across the project - notably,
    // the broadcast dictionary, as well as values for some extensions.

    const {broadcasts, getBroadcastId} = options;
    return {
      ...serializeTarget(stage, {broadcasts, getBroadcastId, stage}),
      isStage: true,
      tempo: options.tempo,
      textToSpeechLanguage: options.textToSpeechLanguage,
      videoState: options.videoState,
      videoTransparency: options.videoTransparency
    };
  }

  function serializeProject(project: Project): sb3.ProjectJSON {
    // Serialize a project. This is the master function used when project.toSb3
    // is called. The main purpose of serializeProject is to serialize each
    // target (sprite or stage) and collect them together in the final output
    // format. It also provides utility functions shared across every target's
    // serialization, e.g. broadcast utilities.

    // Maintain broadcast dictionaries in both name <-> id directions. sb-edit
    // operates on broadcast names, but Scratch 3.0 largely requires access to
    // their IDs as well, so we generate IDs for names as they are required.
    // Name -> ID is for converting sb-edit names and is the backbone behind
    // getBroadcastId; ID -> name is the format which is directly serialized
    // on the stage object. (Only the stage need carries a filled-out broadcast
    // dictionary in Scratch 3.0.)
    let broadcastNameToId: {[name: string]: string} = {};
    let broadcastIdToName: {[id: string]: string} = {};

    const getBroadcastId = (name: string): string => {
      if (!(name in broadcastNameToId)) {
        const id = generateId();
        broadcastNameToId[name] = id;
        broadcastIdToName[id] = name;
      }
      return broadcastNameToId[name];
    };

    // Preemptively parse through all the broadcast inputs in the project and
    // generate a broadcast ID for each of them.
    for (const target of [project.stage, ...project.sprites]) {
      for (const block of target.blocks) {
        if (block.opcode === OpCode.event_whenbroadcastreceived) {
          if (block.inputs.BROADCAST_OPTION.type === "broadcast") {
            getBroadcastId(block.inputs.BROADCAST_OPTION.value);
          }
        } else if (block.opcode === OpCode.event_broadcast || block.opcode === OpCode.event_broadcastandwait) {
          if (block.inputs.BROADCAST_INPUT.type === "broadcast") {
            getBroadcastId(block.inputs.BROADCAST_INPUT.value);
          }
        }
      }
    }

    // Sort broadcasts by name.
    broadcastNameToId = Object.assign({}, ...Object.entries(broadcastNameToId)
      .sort(([name1], [name2]) => name1 < name2 ? -1 : 1)
      .map(([name, id]) => ({[name]: id})));
    broadcastIdToName = Object.assign({}, ...Object.entries(broadcastIdToName)
      .sort(([, name1], [, name2]) => name1 < name2 ? -1 : 1)
      .map(([id, name]) => ({[id]: name})));

    // Set the broadcast name used in obscured broadcast inputs to the first
    // sorted-alphabetically broadcast's name.
    getBroadcastId.initialBroadcastName = Object.keys(broadcastNameToId)[0] || 'message1';

    return {
      targets: [
        serializeStage(project.stage, {
          getBroadcastId,

          broadcasts: broadcastIdToName,
          tempo: project.tempo,
          textToSpeechLanguage: project.textToSpeechLanguage,
          videoState: project.videoOn ? "on" : "off",
          videoTransparency: project.videoAlpha,
        }),
        ...project.sprites.map(sprite => serializeSprite(sprite, {
          stage: project.stage,

          getBroadcastId
        }))
      ],
      meta: {
        semver: "3.0.0"
      }
    };
  }

  return {
    json: JSON.stringify(serializeProject(project))
  };
}
