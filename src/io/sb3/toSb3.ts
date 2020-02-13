import Block from "../../Block";
import Costume from "../../Costume";
import Project, { TextToSpeechLanguage} from "../../Project";
import Script from "../../Script";
import Sound from "../../Sound";
import Target, { Sprite, Stage } from "../../Target";
import * as BlockInput from "../../BlockInput";
import * as sb3 from "../sb3";
import { OpCode } from "../../OpCode";
import { generateId } from "../../util/id";

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

  function serializeInputs(block: Block, options: {stage: Stage, target: Target}): {
    inputs: {
      [key: string]: sb3.BlockInput
    },
    fields: {
      [key: string]: any
    },
    blockData: BlockData
  } {
    const inputs: {[key: string]: sb3.BlockInput} = {};
    const fields: {[key: string]: any} = {};
    const blockData = newBlockData();

    const {stage, target} = options;

    const fieldEntries = sb3.fieldTypeMap[block.opcode];

    const makeShadowBlock = (opcode: OpCode, fields: {[key: string]: any}): string => {
      const id = generateId();

      blockData.blocks[id] = {
        opcode,
        next: null,
        parent: block.id,

        fields,
        inputs: {},

        shadow: true,
        topLevel: false
      };

      return id;
    };

    for (const [key, input] of Object.entries(block.inputs)) {
      // Fields are stored as a plain [value, id?] pair.
      if (fieldEntries && key in fieldEntries) {
        let id: string;
        switch (input.type) {
          case "variable": {
            let variable = target.getVariable(input.value);
            variable = variable || stage.getVariable(input.value);
            id = variable && variable.id;
            break;
          }
          default:
            id = null;
        }
        fields[key] = [input.value, id];
        continue;
      }

      // Inputs are stored as one of two different types of value:
      // - A reference to a block (either a reporter or, in the case of C-shape
      //   inputs, a stack block), or
      // - A reference to a shadow block, though they aren't explicitly written
      //   as such; they use a compressed form which is expanded into actual
      //   shadow blocks. See compressInputTree in scratch-vm's sb3
      //   serialization code.
      switch (input.type) {
        case "blocks":
          if (input.value.length) {
            inputs[key] = [2, input.value[0].id];
            applyBlockData(blockData, serializeBlock(input.value[0], {parent: block, siblingBlocks: input.value, stage, target}));
          }
          break;
        case "block":
          input[key] = [3, input.value.id, [4, "0"]];
          applyBlockData(blockData, serializeBlock(input.value, {parent: block, stage, target}));
          break;
        default: {
          let value: sb3.BlockInputValue;
          switch (input.type) {
            case "costume":
              value = makeShadowBlock(OpCode.looks_costume, {COSTUME: [input.value]});
              break;
            case "sound":
              value = makeShadowBlock(OpCode.sound_sounds_menu, {SOUND_MENU: [input.value]});
              break;
            case "number":
              value = [4, input.value.toString()];
              break;
          }
          inputs[key] = [1, value];
        }
      }
    }

    return {inputs, fields, blockData};
  }

  function serializeBlock(block: Block, options: {
    stage: Stage,
    target: Target,

    parent?: Block,
    siblingBlocks?: Block[],
    x?: number,
    y?: number
  }): BlockData {
    const result = newBlockData();

    const {parent, siblingBlocks, stage, target} = options;

    let nextBlock;
    if (siblingBlocks) {
      const thisIndex = siblingBlocks.indexOf(block) + 1;
      nextBlock = siblingBlocks.find((x, index) => index === thisIndex);
    }

    if (nextBlock) {
      applyBlockData(result, serializeBlock(nextBlock, {parent: block, siblingBlocks, stage, target}));
    }

    const { inputs, fields, blockData: inputBlockData } = serializeInputs(block, {stage, target});
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

    for (const script of target.scripts) {
      applyBlockData(blockData, serializeBlock(script.blocks[0], {
        stage, target,
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
