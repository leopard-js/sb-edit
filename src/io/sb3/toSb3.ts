import Block, { BlockBase } from "../../Block";
import Project, { TextToSpeechLanguage } from "../../Project";
import Target, { Sprite, Stage } from "../../Target";
import * as BlockInput from "../../BlockInput";
import * as sb3 from "./interfaces";
import { OpCode } from "../../OpCode";
import { prop } from "../../util/ts-util";

const BIS = sb3.BlockInputStatus;

interface ToSb3Options {
  warn: (message: string) => void;
}

interface ToSb3Output {
  json: string;
}

export default function toSb3(options: Partial<ToSb3Options> = {}): ToSb3Output {
  // Serialize a project. Returns an object containing the text to be stored
  // in the caller's project.json output file. toSb3 should be bound or applied
  // so that 'this' refers to the Project object to be serialized.

  let warn: ToSb3Options["warn"] = (): void => undefined;
  if (options.warn) {
    warn = options.warn;
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

  interface SerializeInputsToFieldsOptions {
    stage: Stage;
    target: Target;

    fieldEntries;
  }

  function serializeInputsToFields(
    inputs: { [key: string]: BlockInput.Any },
    options: SerializeInputsToFieldsOptions
  ): { [key: string]: string[] } {
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

    const { fieldEntries, stage, target } = options;

    const fields = {};

    if (!fieldEntries) {
      return fields;
    }

    for (const key of Object.keys(fieldEntries)) {
      const input = inputs[key];
      // Fields are stored as a plain [value, id?] pair.
      let id: string;
      switch (input.type) {
        case "variable":
          id = getVariableId(input.value, target, stage);
          break;
        case "list":
          id = getListId(input.value, target, stage);
          break;
        default:
          id = null;
          break;
      }
      fields[key] = [input.value, id];
    }

    return fields;
  }

  interface SerializeInputShadowOptions {
    blockData: sb3.Target["blocks"];

    parentId: string;
    primitiveOrOpCode: number | OpCode;
    shadowId: string;
  }

  function serializeInputShadow(value: string | number, options: SerializeInputShadowOptions): sb3.BlockInputValue {
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

    const { blockData, parentId, primitiveOrOpCode, shadowId } = options;

    let shadowValue = null;

    if (primitiveOrOpCode === BIS.BROADCAST_PRIMITIVE) {
      // Broadcast primitives, unlike all other primitives, expect two values:
      // the broadcast name and its ID. We just reuse the name for its ID;
      // after all, the name is the unique identifier sb-edit uses to refer to
      // the broadcast.
      shadowValue = [BIS.BROADCAST_PRIMITIVE, value, value];
    } else if (primitiveOrOpCode === BIS.COLOR_PICKER_PRIMITIVE) {
      // Color primitive. Convert the {r, g, b} object into hex form.
      const hex = (k: string): string => (value || { r: 0, g: 0, b: 0 })[k].toString(16).padStart(2, "0");
      shadowValue = [BIS.COLOR_PICKER_PRIMITIVE, "#" + hex("r") + hex("g") + hex("b")];
    } else if (typeof primitiveOrOpCode === "number") {
      // Primitive shadow, can be stored in compressed form.
      shadowValue = [primitiveOrOpCode, value];
    } else {
      // Note: Only 1-field shadow blocks are supported.
      const shadowOpCode = primitiveOrOpCode;
      const fieldEntries = sb3.fieldTypeMap[shadowOpCode];
      if (fieldEntries) {
        const fieldKey = Object.keys(fieldEntries)[0];
        const fields = { [fieldKey]: [value as string] };

        blockData[shadowId] = {
          opcode: shadowOpCode,

          next: null,
          parent: parentId,

          fields,
          inputs: {},

          shadow: true,
          topLevel: false
        };

        shadowValue = shadowId;
      }
    }

    return shadowValue;
  }

  interface SerializeInputsToInputsOptions<PassedInputs extends { [key: string]: BlockInput.Any }> {
    stage: Stage;
    target: Target;

    blockData: sb3.Target["blocks"];

    initialBroadcastName: string;
    customBlockDataMap: CustomBlockDataMap;

    block: Block;
    inputEntries;

    initialValues: {
      [key in keyof PassedInputs]: any;
    };
  }

  function serializeInputsToInputs<PassedInputs extends { [key: string]: BlockInput.Any }>(
    inputs: PassedInputs,
    options: SerializeInputsToInputsOptions<PassedInputs>
  ): sb3.Block["inputs"] {
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

    const {
      block,
      blockData,
      initialBroadcastName,
      customBlockDataMap,
      initialValues,
      inputEntries,
      stage,
      target
    } = options;

    const resultInputs: sb3.Block["inputs"] = {};

    for (const [key, entry] of Object.entries(inputEntries)) {
      const input = inputs[key];
      if (entry === sb3.BooleanOrSubstackInputStatus) {
        let blockId: string;

        if (input) {
          const options = {
            stage,
            target,
            blockData,
            initialBroadcastName,
            customBlockDataMap,
            parent: block
          };

          switch (input.type) {
            case "blocks":
              blockId = serializeBlockStack(input.value, options);
              break;
            case "block":
              blockId = serializeBlock(input.value, options);
              break;
          }
        }

        if (blockId) {
          resultInputs[key] = [BIS.INPUT_BLOCK_NO_SHADOW, blockId];
        }
      } else {
        let valueForShadow;
        if (input.type === "block") {
          valueForShadow = initialValues[key];
          // Special-case some input opcodes for more realistic initial values.
          switch (entry) {
            case OpCode.looks_costume:
              if (target.costumes[0]) {
                valueForShadow = target.costumes[0].name;
              }
              break;
            case OpCode.sound_sounds_menu:
              if (target.sounds[0]) {
                valueForShadow = target.sounds[0].name;
              }
              break;
            case OpCode.event_broadcast_menu:
              valueForShadow = initialBroadcastName;
              break;
          }
        } else {
          valueForShadow = input.value;
        }

        const shadowValue = serializeInputShadow(valueForShadow, {
          blockData,
          parentId: block.id,
          shadowId: block.id + "-" + key,
          primitiveOrOpCode: entry as number | OpCode
        });

        if (input.type === "block") {
          let obscuringBlockValue;

          switch (input.value.opcode) {
            case OpCode.data_variable: {
              const variableName = input.value.inputs.VARIABLE.value;
              const variableId = getVariableId(variableName, target, stage);
              obscuringBlockValue = [BIS.VAR_PRIMITIVE, variableName, variableId];
              break;
            }
            case OpCode.data_listcontents: {
              const listName = input.value.inputs.LIST.value;
              const listId = getListId(listName, target, stage);
              obscuringBlockValue = [BIS.LIST_PRIMITIVE, listName, listId];
              break;
            }
            default: {
              obscuringBlockValue = serializeBlock(input.value, {
                blockData,
                initialBroadcastName,
                customBlockDataMap,
                parent: block,
                stage,
                target
              });
              break;
            }
          }

          resultInputs[key] = [BIS.INPUT_DIFF_BLOCK_SHADOW, obscuringBlockValue, shadowValue];
        } else {
          resultInputs[key] = [BIS.INPUT_SAME_BLOCK_SHADOW, shadowValue];
        }
      }
    }

    return resultInputs;
  }

  interface SerializeInputsOptions {
    stage: Stage;
    target: Target;

    blockData: sb3.Target["blocks"];

    initialBroadcastName: string;
    customBlockDataMap: CustomBlockDataMap;
  }

  function serializeInputs(
    block: Block,
    options: SerializeInputsOptions
  ): {
    inputs: sb3.Block["inputs"];
    fields: sb3.Block["fields"];
    mutation?: sb3.Block["mutation"];
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

    const { blockData, stage, target, initialBroadcastName, customBlockDataMap } = options;

    const fields = serializeInputsToFields(block.inputs, {
      fieldEntries: sb3.fieldTypeMap[block.opcode],
      stage,
      target
    });

    let inputs: sb3.Block["inputs"] = {};
    let mutation: sb3.Block["mutation"];

    if (block.isKnownBlock()) {
      switch (block.opcode) {
        case OpCode.procedures_definition: {
          const prototypeId = block.id + "-prototype";

          const { args, warp } = customBlockDataMap[block.inputs.PROCCODE.value];

          const prototypeInputs: sb3.Block["inputs"] = {};
          for (const arg of args) {
            const shadowId = arg.id + "-prototype-shadow";
            blockData[shadowId] = {
              opcode: prop(
                {
                  boolean: OpCode.argument_reporter_boolean,
                  numberOrString: OpCode.argument_reporter_string_number
                },
                arg.type
              ),

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
          const customBlockData = customBlockDataMap[proccode];
          if (!customBlockData) {
            warn(
              `Missing custom block prototype for proccode ${proccode} (${block.id} in ${target.name}); skipping this block`
            );
            return null;
          }

          const { args, warp } = customBlockData;

          mutation = {
            tagName: "mutation",
            children: [],
            proccode,
            argumentids: JSON.stringify(args.map(arg => arg.id)),
            warp: JSON.stringify(warp) as "true" | "false"
          };

          const inputEntries = {};
          const constructedInputs = {};
          const initialValues = {};
          for (let i = 0; i < args.length; i++) {
            const { type, id } = args[i];
            switch (type) {
              case "boolean":
                inputEntries[id] = sb3.BooleanOrSubstackInputStatus;
                // A boolean input's initialValues entry will never be
                // referenced (because empty boolean inputs don't contain
                // shadow blocks), so there's no need to set it.
                break;
              case "numberOrString":
                inputEntries[id] = BIS.TEXT_PRIMITIVE;
                initialValues[id] = "";
                break;
            }
            constructedInputs[id] = block.inputs.INPUTS.value[i];
          }

          inputs = serializeInputsToInputs(constructedInputs, {
            stage,
            target,

            blockData,

            initialBroadcastName,
            customBlockDataMap,

            block,
            initialValues,
            inputEntries
          });

          break;
        }

        default: {
          const inputEntries = prop(sb3.inputPrimitiveOrShadowMap, block.opcode);

          const initialValues = {};
          for (const key of Object.keys(inputEntries)) {
            const defaultInput = BlockBase.getDefaultInput(block.opcode, key);
            if (defaultInput) {
              initialValues[key] = defaultInput.initial;
            }
          }

          inputs = serializeInputsToInputs(block.inputs, {
            stage,
            target,

            blockData,

            initialBroadcastName,
            customBlockDataMap,

            block,
            initialValues,
            inputEntries
          });

          break;
        }
      }
    }

    return { inputs, fields, mutation };
  }

  interface SerializeBlockOptions {
    stage: Stage;
    target: Target;

    blockData: sb3.Target["blocks"];

    initialBroadcastName: string;
    customBlockDataMap: CustomBlockDataMap;

    parent?: Block;
    x?: number;
    y?: number;
  }

  function serializeBlock(block: Block, options: SerializeBlockOptions): string | null {
    // Serialize a block, mutating the passed block data and returning the
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
    // into a flat mapping of IDs to their associated serialized block.
    //
    // It's possible for a block to be skipped altogether during serialization,
    // because it referred to some value which could not be converted into
    // valid SB3 data. For reporters, this means leaving an empty input; for
    // stack blocks, it means skipping to the next block in the sibling array
    // (or leaving an empty connection if there is none). It's up to the caller
    // to handle serializeBlock returning a null blockId usefully.
    //
    // Note that while serializeBlock will recursively serialize input blocks,
    // it will not serialize the following sibling block. As such, the
    // serialized block will always contain {next: null}. The caller is
    // responsible for updating this and setting it to the following block ID.
    // (The function serializeBlockStack is generally where this happens.)

    const { blockData, initialBroadcastName, customBlockDataMap, parent, stage, target } = options;

    const serializeInputsResult = serializeInputs(block, {
      stage,
      target,

      blockData,

      initialBroadcastName,
      customBlockDataMap
    });

    if (!serializeInputsResult) {
      return null;
    }

    const { inputs, fields, mutation } = serializeInputsResult;

    const obj: sb3.Block = {
      opcode: block.opcode,

      parent: parent ? parent.id : null,
      next: null, // The caller is responsible for setting this.
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

    return blockId;
  }

  // Since serializeBlockStack passes the actual serialization behavior to
  // serializeBlock, the two functions share the same options type.
  type SerializeBlockStackOptions = SerializeBlockOptions;

  function serializeBlockStack(blocks: Block[], options: SerializeBlockStackOptions): string | null {
    // Serialize a stack of blocks, returning the ID of the first successfully
    // serialized block, or null if there is none.
    //
    // When serializing a block returns null, there is an expectation that the
    // block should be "skipped" by the caller. When dealing with stack blocks,
    // that means making a connection between the previous block and the first
    // successfully successfully serialized following block. This function
    // handles that case, as well as building the connections between stack
    // blocks in general.
    //
    // Note that the passed options object will be mutated, to change the
    // parent block to the previous block in the stack.

    const { blockData } = options;

    let previousBlockId: string;
    let firstBlockId: string | null = null;

    for (const block of blocks) {
      const blockId = serializeBlock(block, options);

      if (!blockId) {
        continue;
      }

      if (!firstBlockId) {
        firstBlockId = blockId;
      }

      if (previousBlockId) {
        blockData[previousBlockId].next = blockId;
      }

      previousBlockId = blockId;
      options.parent = block;
    }

    return firstBlockId;
  }

  interface CustomBlockArg {
    default: string;
    id: string;
    name: string;
    type: "boolean" | "numberOrString";
  }

  interface CustomBlockData {
    args: CustomBlockArg[];
    warp: boolean;
  }

  interface CustomBlockDataMap {
    [proccode: string]: CustomBlockData;
  }

  function collectCustomBlockData(target: Target): CustomBlockDataMap {
    // Parse the scripts in a target, collecting metadata about each custom
    // block's arguments and other info, and return a mapping of proccode to
    // the associated data.
    //
    // It's necesary to collect this data prior to serializing any associated
    // procedures_call blocks, because they require access to data only found
    // on the associated procedures_definition. (Specifically, the types of
    // each input on the custom block, since those will influence the initial
    // value & shadow type in the serialized caller block's inputs.)

    const data: CustomBlockDataMap = {};

    for (const script of target.scripts) {
      const block = script.blocks[0];
      if (block.opcode !== OpCode.procedures_definition) {
        continue;
      }

      const proccode = block.inputs.PROCCODE.value;
      const warp = block.inputs.WARP.value;

      const args: CustomBlockArg[] = [];

      const argData = block.inputs.ARGUMENTS.value;
      for (let i = 0; i < argData.length; i++) {
        const { name, type } = argData[i];

        if (type === "label") {
          continue;
        }

        const id = block.id + "-argument-" + i;

        args.push({
          id,
          name,
          type,
          default: prop(
            {
              boolean: "false",
              numberOrString: ""
            },
            type
          )
        });
      }

      data[proccode] = { args, warp };
    }

    return data;
  }

  interface SerializeTargetOptions {
    stage: Stage;

    initialBroadcastName: string;

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
    // When a block is serialized, a flat block mapping is returned, and this
    // is combined into the mapping of whatever is consuming the serialized
    // data. Eventually, all blocks (and their subblocks, inputs, etc) have
    // been serialized, and the collected data is stored on the target.
    //
    // serializeTarget also handles converting costumes, sounds, variables,
    // etc into the structures Scratch 3.0 expects.

    function mapToIdObject<Entry extends { id: string }, ReturnType>(
      values: Array<Entry>,
      fn: (x: Entry) => ReturnType
    ): { [key: string]: ReturnType } {
      // Map an Array of objects with an "id` property
      // (e.g [{id: 1, prop: "val"}, ...])
      // into an object whose keys are the `id` property,
      // and whose values are the passed objects transformed by `fn`.
      const ret = {};
      for (const object of values) {
        ret[object.id] = fn(object);
      }
      return ret;
    }

    const { broadcasts, initialBroadcastName, stage } = options;

    const blockData: sb3.Target["blocks"] = {};

    const customBlockDataMap = collectCustomBlockData(target);

    for (const script of target.scripts) {
      serializeBlockStack(script.blocks, {
        stage,
        target,
        blockData,
        initialBroadcastName,
        customBlockDataMap,
        x: script.x,
        y: script.y
      });
    }

    return {
      name: target.name,
      isStage: target.isStage,

      currentCostume: target.costumeNumber,
      layerOrder: target.layerOrder,
      volume: target.volume,

      blocks: blockData,
      broadcasts,

      // @todo sb-edit doesn't support comments (as of feb 12, 2020)
      comments: {},

      sounds: target.sounds.map(sound => ({
        name: sound.name,
        dataFormat: sound.ext,
        assetId: sound.md5,
        md5ext: sound.md5 + "." + sound.ext,
        sampleCount: sound.sampleCount,
        rate: sound.sampleRate
      })),

      costumes: target.costumes.map(costume => ({
        name: costume.name,
        assetId: costume.md5,
        md5ext: costume.md5 + "." + costume.ext,
        bitmapResolution: costume.bitmapResolution,
        dataFormat: costume.ext,
        rotationCenterX: costume.centerX,
        rotationCenterY: costume.centerY
      })),

      variables: mapToIdObject(target.variables, ({ name, value, cloud }) => {
        if (cloud) {
          return [name, value, cloud];
        } else {
          return [name, value];
        }
      }),

      lists: mapToIdObject(target.lists, ({ name, value }) => [name, value])
    };
  }

  const rotationStyleMap: { [key: string]: "all around" | "left-right" | "don't rotate" } = {
    normal: "all around",
    leftRight: "left-right",
    none: "don't rotate"
  };

  interface SerializeSpriteOptions {
    stage: Stage;

    initialBroadcastName: string;
  }

  function serializeSprite(sprite: Sprite, options: SerializeSpriteOptions): sb3.Sprite {
    // Serialize a sprite. Extending from a serialized target, sprites carry
    // a variety of properties for their on-screen position and appearance.

    const { initialBroadcastName, stage } = options;
    return {
      ...serializeTarget(sprite, {
        stage,

        initialBroadcastName,

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
    initialBroadcastName: string;

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

    const { broadcasts, initialBroadcastName } = options;
    return {
      ...serializeTarget(stage, { broadcasts, initialBroadcastName, stage }),
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

    // Set the broadcast name used in obscured broadcast inputs to the first
    // sorted-alphabetically broadcast's name. While we're parsing through
    // all the broadcast names in the project, also store them on a simple
    // mapping of (name -> name), to be stored on the stage. (toSb3 uses a
    // broadcast's name as its ID.)
    let lowestName;
    const broadcasts = {};
    for (const target of [project.stage, ...project.sprites]) {
      for (const block of target.blocks) {
        if (
          block.opcode === OpCode.event_whenbroadcastreceived ||
          block.opcode === OpCode.event_broadcast ||
          block.opcode === OpCode.event_broadcastandwait
        ) {
          const broadcastInput =
            block.opcode === OpCode.event_whenbroadcastreceived
              ? block.inputs.BROADCAST_OPTION
              : block.inputs.BROADCAST_INPUT;

          if (broadcastInput.type === "broadcast") {
            const currentName = broadcastInput.value;
            if (currentName < lowestName || !lowestName) {
              lowestName = currentName;
            }
            broadcasts[currentName] = currentName;
          }
        }
      }
    }

    const initialBroadcastName = lowestName || "message1";

    return {
      targets: [
        serializeStage(project.stage, {
          initialBroadcastName,

          broadcasts,
          tempo: project.tempo,
          textToSpeechLanguage: project.textToSpeechLanguage,
          videoState: project.videoOn ? "on" : "off",
          videoTransparency: project.videoAlpha
        }),
        ...project.sprites.map(sprite =>
          serializeSprite(sprite, {
            stage: project.stage,

            initialBroadcastName
          })
        )
      ],
      meta: {
        semver: "3.0.0"
      }
    };
  }

  return {
    json: JSON.stringify(serializeProject(this))
  };
}
