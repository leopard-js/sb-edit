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

interface ToSb3Options {}

interface ToSb3Output {
  json: string
}

export default function toSb3(
  options: Partial<ToSb3Options> = {}
): ToSb3Output {
  const project: Project = this;

  interface BlockData {
    blocks: {[key: string]: sb3.Block},
    broadcasts: {[key: string]: string}
  }

  function applyBlockData(a: BlockData, b?: BlockData) {
    if (b) {
      Object.assign(a.blocks, b.blocks);
      Object.assign(b.broadcasts, b.broadcasts);
    }
  }

  function newBlockData(): BlockData {
    return {
      blocks: {},
      broadcasts: {}
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
    primitiveOrOpCode: number | OpCode,
    parentId: string
  }): {
    shadowValue: sb3.BlockInputValue,
    blockData: BlockData
  } {
    const {primitiveOrOpCode, parentId} = options;

    const blockData = newBlockData();
    let shadowValue = null;

    if (typeof primitiveOrOpCode === "number") {
      // Primitive shadow, can be stored in compressed form.
      shadowValue = [primitiveOrOpCode, value];
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

  function serializeInputsToInputs(inputs: {[key: string]: BlockInput.Any}, options: {
    stage: Stage,
    target: Target,

    customBlockData: CustomBlockData,

    block: Exclude<KnownBlock, ProcedureBlock>
  }): {
    inputs: sb3.Block["inputs"],
    blockData: BlockData
  } {
    const {block, customBlockData, stage, target} = options;

    const blockData = newBlockData();

    const result: {
      inputs: sb3.Block["inputs"],
      blockData: BlockData
    } = {
      inputs: {},
      blockData
    };

    if (!block.isKnownBlock()) {
      return result;
    }

    const inputEntries = prop(sb3.inputPrimitiveOrShadowMap, block.opcode);

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
          applyBlockData(blockData, serializeBlock(input.value[0], {customBlockData, parent: block, siblingBlocks: input.value, stage, target}));
        } else if (input && input.type === "block") {
          result.inputs[key] = [BIS.INPUT_BLOCK_NO_SHADOW, input.value.id];
          applyBlockData(blockData, serializeBlock(input.value, {customBlockData, parent: block, stage, target}));
        } else {
          // Empty, don't store anything.
          // (Storing [INPUT_BLOCK_NO_SHADOW, null] would also be valid.)
        }
      } else if (input.type === "block") {
        const {initial} = BlockBase.getDefaultInput((block as KnownBlock).opcode, key) || {};
        const {shadowValue, blockData: inputBlockData} = serializeInputShadow(initial, {
          primitiveOrOpCode: entry as number | OpCode,
          parentId: block.id
        });
        result.inputs[key] = [BIS.INPUT_DIFF_BLOCK_SHADOW, input.value.id, shadowValue];
        applyBlockData(blockData, inputBlockData);
        applyBlockData(blockData, serializeBlock(input.value, {customBlockData, parent: block, stage, target}));
      } else {
        const {shadowValue, blockData: inputBlockData} = serializeInputShadow(input.value, {
          primitiveOrOpCode: entry as number | OpCode,
          parentId: block.id
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

    customBlockData: CustomBlockData
  }): {
    inputs: sb3.Block["inputs"],
    fields: sb3.Block["fields"],
    mutation?: sb3.Block["mutation"],
    blockData: BlockData
  } {
    const {stage, target, customBlockData} = options;

    const {fields} = serializeInputsToFields(block.inputs, {
      blockOpCode: block.opcode,
      stage, target
    });

    const blockData = newBlockData();
    let inputs: sb3.Block["inputs"] = {};
    let mutation: sb3.Block["mutation"];

    if (block.isKnownBlock()) {
      switch (block.opcode) {
        case OpCode.procedures_definition:
          break;
        case OpCode.procedures_call:
          break;
        default: {
          const result = serializeInputsToInputs(block.inputs, {block, customBlockData, stage, target});

          inputs = result.inputs;
          applyBlockData(blockData, result.blockData);
        }
      }
    }

    return {inputs, fields, blockData};
  }

  function serializeBlock(block: Block, options: {
    stage: Stage,
    target: Target,

    customBlockData: CustomBlockData,

    parent?: Block,
    siblingBlocks?: Block[],
    x?: number,
    y?: number
  }): BlockData {
    const result = newBlockData();

    const {customBlockData, parent, siblingBlocks, stage, target} = options;

    let nextBlock;
    if (siblingBlocks) {
      const thisIndex = siblingBlocks.indexOf(block) + 1;
      nextBlock = siblingBlocks.find((x, index) => index === thisIndex);
    }

    if (nextBlock) {
      applyBlockData(result, serializeBlock(nextBlock, {
        stage, target,
        customBlockData,
        parent: block,
        siblingBlocks
      }));
    }

    const { inputs, fields, blockData: inputBlockData } = serializeInputs(block, {
      stage,
      target,

      customBlockData
    });

    applyBlockData(result, inputBlockData);

    const obj: sb3.Block = {
      opcode: block.opcode,

      parent: parent ? parent.id : null,
      next: nextBlock ? nextBlock.id : null,
      topLevel: !parent,

      inputs,
      fields,

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
    [proccode: string]: {
      args: Array<{
        default: string,
        id: string,
        name: string,
        type: "boolean" | "numberOrString"
      }>
    }
  }

  function collectCustomBlockData(target: Target): CustomBlockData {
    const result = {};

    for (const script of target.scripts) {
      const block = script.blocks[0];
      if (block.opcode !== OpCode.procedures_definition) {
        continue;
      }

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

      result[block.inputs.PROCCODE.value] = {args};
    }

    return result;
  }

  function serializeTarget(target: Target, options: {stage: Stage}): sb3.Target {
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

    const {stage} = options;

    const blockData = newBlockData();

    const customBlockData = collectCustomBlockData(target);

    for (const script of target.scripts) {
      applyBlockData(blockData, serializeBlock(script.blocks[0], {
        stage, target,
        customBlockData,
        siblingBlocks: script.blocks,
        x: script.x,
        y: script.y
      }));
    }

    const {blocks, broadcasts} = blockData;

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

      lists: mapToIdObject(target.lists, ({ name, value }) => [name, ...value])
    };
  }

  const rotationStyleMap: {[key: string]: "all around" | "left-right" | "don't rotate"} = {
    "normal": "all around",
    "leftRight": "left-right",
    "none": "don't rotate"
  };

  function serializeSprite(sprite: Sprite, options: {stage: Stage}): sb3.Sprite {
    const {stage} = options;
    return {
      ...serializeTarget(sprite, {stage}),
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
    tempo: number;
    textToSpeechLanguage: TextToSpeechLanguage;
    videoState: "on" | "off";
    videoTransparency: number;
  }

  function serializeStage(stage: Stage, options: SerializeStageOptions): sb3.Stage {
    return {
      ...serializeTarget(stage, {stage}),
      isStage: true,
      tempo: options.tempo,
      textToSpeechLanguage: options.textToSpeechLanguage,
      videoState: options.videoState,
      videoTransparency: options.videoTransparency
    };
  }

  function serializeProject(project: Project): sb3.ProjectJSON {
    return {
      targets: [
        serializeStage(project.stage, {
          tempo: project.tempo,
          textToSpeechLanguage: project.textToSpeechLanguage,
          videoState: project.videoOn ? "on" : "off",
          videoTransparency: project.videoAlpha
        }),
        ...project.sprites.map(sprite => serializeSprite(sprite, {stage: project.stage}))
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
