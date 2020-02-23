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
  const project: Project = this;

  let warn = (message: string) => undefined;
  if (options.warn) {
    warn = options.warn;
  }

  interface BlockData {
    blocks: {[key: string]: sb3.Block}
  }

  function applyBlockData(a: BlockData, b?: BlockData) {
    if (b) {
      Object.assign(a.blocks, b.blocks);
    }
  }

  function newBlockData(): BlockData {
    return {
      blocks: {}
    };
  }

  function serializeInputsToFields(inputs: {[key: string]: BlockInput.Any}, options: {
    blockOpCode: OpCode,
    stage: Stage,
    target: Target
  }): {
    fields: {[key: string]: any}
  } {
    const {blockOpCode, stage, target} = options;

    const result = {
      fields: {}
    };

    const fieldEntries = sb3.fieldTypeMap[options.blockOpCode];

    if (!fieldEntries) {
      return result;
    }

    for (const [key, input] of Object.entries(fieldEntries)) {
      const input = inputs[key];
      // Fields are stored as a plain [value, id?] pair.
      let id: string;
      switch (input.type) {
        case "variable": {
          let variable = target.getVariable(input.value);
          variable = variable || stage.getVariable(input.value);
          id = variable && variable.id;
          break;
        }
        case "list": {
          let list = target.getList(input.value);
          list = list || stage.getList(input.value);
          id = list && list.id;
          break;
        }
        default:
          id = null;
      }
      result.fields[key] = [input.value, id];
      continue;
    }

    return result;
  }

  function serializeInputShadow(value: any, options: {
    getBroadcastId: GetBroadcastId,

    parentId: string,
    primitiveOrOpCode: number | OpCode
  }): {
    shadowValue: sb3.BlockInputValue,
    blockData: BlockData
  } {
    const {getBroadcastId, parentId, primitiveOrOpCode} = options;

    const blockData = newBlockData();
    let shadowValue = null;

    if (typeof primitiveOrOpCode === "number") {
      // Primitive shadow, can be stored in compressed form.
      shadowValue = [primitiveOrOpCode, value];
    } else if (primitiveOrOpCode === OpCode.event_broadcast_menu) {
      shadowValue = [BIS.BROADCAST_PRIMITIVE, value, getBroadcastId(value)];
    } else {
      // Note: Only 1-field shadow blocks are supported.
      const shadowOpCode = primitiveOrOpCode;
      const fieldEntries = sb3.fieldTypeMap[shadowOpCode];
      if (fieldEntries) {
        const fieldKey = Object.keys(fieldEntries)[0];
        const fields = {[fieldKey]: value as any};

        const id = generateId();

        blockData.blocks[id] = {
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

  function serializeInputsToInputs<PassedInputs extends {[key: string]: BlockInput.Any}>(inputs: PassedInputs, options: {
    stage: Stage,
    target: Target,

    getBroadcastId: GetBroadcastId,
    getCustomBlockData: GetCustomBlockData,

    block: Block,
    initialValues: {
      [key in keyof PassedInputs]: any
    },
    inputEntries
  }): {
    inputs: sb3.Block["inputs"],
    blockData: BlockData
  } {
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
      warn(`Missing entry for input ${key} on ${block.opcode} (${block.id})`);
    }

    for (const [key, entry] of Object.entries(inputEntries)) {
      const input = inputs[key];
      // Inputs are stored as one of two different types of value:
      // - A reference to a block (either a reporter or, in the case of C-shape
      //   inputs, a stack block), or
      // - A reference to a shadow block, though they aren't explicitly written
      //   as such; they use a compressed form which is expanded into actual
      //   shadow blocks. See compressInputTree in scratch-vm's sb3
      //   serialization code.
      if (entry === sb3.BooleanOrSubstackInputStatus) {
        if (input && input.type === "blocks" && input.value.length) {
          result.inputs[key] = [BIS.INPUT_BLOCK_NO_SHADOW, input.value[0].id];
          applyBlockData(blockData, serializeBlock(input.value[0], {getBroadcastId, getCustomBlockData, parent: block, siblingBlocks: input.value, stage, target}));
        } else if (input && input.type === "block") {
          result.inputs[key] = [BIS.INPUT_BLOCK_NO_SHADOW, input.value.id];
          applyBlockData(blockData, serializeBlock(input.value, {getBroadcastId, getCustomBlockData, parent: block, stage, target}));
        } else {
          // Empty, don't store anything.
          // (Storing [INPUT_BLOCK_NO_SHADOW, null] would also be valid.)
        }
      } else if (input.type === "block") {
        const initial = initialValues[key];
        const {shadowValue, blockData: inputBlockData} = serializeInputShadow(initial, {
          getBroadcastId,
          parentId: block.id,
          primitiveOrOpCode: entry as number | OpCode
        });
        result.inputs[key] = [BIS.INPUT_DIFF_BLOCK_SHADOW, input.value.id, shadowValue];
        applyBlockData(blockData, inputBlockData);
        applyBlockData(blockData, serializeBlock(input.value, {getBroadcastId, getCustomBlockData, parent: block, stage, target}));
      } else {
        const {shadowValue, blockData: inputBlockData} = serializeInputShadow(input.value, {
          getBroadcastId,
          parentId: block.id,
          primitiveOrOpCode: entry as number | OpCode
        });
        result.inputs[key] = [BIS.INPUT_SAME_BLOCK_SHADOW, shadowValue];
        applyBlockData(blockData, inputBlockData);
      }
    }

    return result;
  }

  function serializeInputs(block: Block, options: {
    stage: Stage,
    target: Target,

    getBroadcastId: GetBroadcastId,
    getCustomBlockData: GetCustomBlockData
  }): {
    inputs: sb3.Block["inputs"],
    fields: sb3.Block["fields"],
    mutation?: sb3.Block["mutation"],
    blockData: BlockData
  } {
    const {stage, target, getBroadcastId, getCustomBlockData} = options;

    const {fields} = serializeInputsToFields(block.inputs, {
      blockOpCode: block.opcode,
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
            blockData.blocks[shadowId] = {
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

          blockData.blocks[prototypeId] = {
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
          const {args, warp} = getCustomBlockData(block.inputs.PROCCODE.value);

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

  function serializeBlock(block: Block, options: {
    stage: Stage,
    target: Target,

    getBroadcastId: GetBroadcastId,
    getCustomBlockData: GetCustomBlockData,

    parent?: Block,
    siblingBlocks?: Block[],
    x?: number,
    y?: number
  }): BlockData {
    const result = newBlockData();

    const {getBroadcastId, getCustomBlockData, parent, siblingBlocks, stage, target} = options;

    let nextBlock;
    if (siblingBlocks) {
      const thisIndex = siblingBlocks.indexOf(block) + 1;
      nextBlock = siblingBlocks.find((x, index) => index === thisIndex);
    }

    if (nextBlock) {
      applyBlockData(result, serializeBlock(nextBlock, {
        stage, target,
        getBroadcastId,
        getCustomBlockData,
        parent: block,
        siblingBlocks
      }));
    }

    const { inputs, fields, mutation, blockData: inputBlockData } = serializeInputs(block, {
      stage,
      target,

      getBroadcastId,
      getCustomBlockData
    });

    applyBlockData(result, inputBlockData);

    const obj: sb3.Block = {
      opcode: block.opcode,

      parent: parent ? parent.id : null,
      next: nextBlock ? nextBlock.id : null,
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

    result.blocks[block.id] = obj;

    return result;
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

  type GetBroadcastId = (name: string) => string;

  function collectCustomBlockData(target: Target): GetCustomBlockData {
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

  function serializeTarget(target: Target, options: {
    stage: Stage,

    getBroadcastId: GetBroadcastId,

    broadcasts: sb3.Sprite["broadcasts"]
  }): sb3.Target {
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
      }));
    }

    const {blocks} = blockData;

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

  function serializeSprite(sprite: Sprite, options: {
    stage: Stage,

    getBroadcastId: GetBroadcastId
  }): sb3.Sprite {
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
    const broadcastNameToId: {[name: string]: string} = {};
    const broadcastIdToName: {[id: string]: string} = {};
    const getBroadcastId = (name: string): string => {
      if (!(name in broadcastNameToId)) {
        const id = generateId();
        broadcastNameToId[name] = id;
        broadcastIdToName[id] = name;
      }
      return broadcastNameToId[name];
    };

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
