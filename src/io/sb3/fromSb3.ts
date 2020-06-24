import * as JSZip from "jszip";
import * as sb3 from "./interfaces";

import { OpCode } from "../../OpCode";

import Block, { BlockBase } from "../../Block";
import * as BlockInput from "../../BlockInput";
import Costume from "../../Costume";
import Project from "../../Project";
import Sound from "../../Sound";
import { Sprite, Stage, TargetOptions } from "../../Target";
import { List, Variable } from "../../Data";
import Script from "../../Script";

interface AssetInfo {
  type: "costume" | "sound";
  name: string;
  md5: string;
  ext: string;
  spriteName: string;
}

// "any" allows user to store the asset encoded however it's useful to them.
// sb-edit doesn't care, it just stores the asset as it's provided for easy
// access later.
type GetAsset = (info: AssetInfo) => Promise<any>;

function extractCostumes(target: sb3.Target, getAsset: GetAsset): Promise<Costume[]> {
  return Promise.all(
    target.costumes.map(
      async (costumeData: sb3.Costume) =>
        new Costume({
          name: costumeData.name,
          asset: await getAsset({
            type: "costume",
            name: costumeData.name,
            md5: costumeData.assetId,
            ext: costumeData.dataFormat,
            spriteName: target.name
          }),

          md5: costumeData.assetId,
          ext: costumeData.dataFormat,

          // It's possible that the rotation center of the costume is null.
          // Because computing a rotation center ourselves would be messy and
          // easily incompatible with Scratch, pass such complexity onto the
          // Scratch implementation running a project exported from sb-edit.
          bitmapResolution: costumeData.bitmapResolution || 2,
          centerX: costumeData.rotationCenterX,
          centerY: costumeData.rotationCenterY
        })
    )
  );
}

async function extractSounds(target: sb3.Target, getAsset: GetAsset): Promise<Sound[]> {
  return Promise.all(
    target.sounds.map(
      async (soundData: sb3.Sound) =>
        new Sound({
          name: soundData.name,
          asset: await getAsset({
            type: "sound",
            name: soundData.name,
            md5: soundData.assetId,
            ext: soundData.dataFormat,
            spriteName: target.name
          }),

          md5: soundData.assetId,
          ext: soundData.dataFormat,

          sampleCount: soundData.sampleCount,
          sampleRate: soundData.rate
        })
    )
  );
}

function getBlockScript(blocks: { [key: string]: sb3.Block }) {
  function getBlockInputs(block: sb3.Block, blockId: string): Block["inputs"] {
    return {
      ...translateInputs(block.inputs),
      ...translateFields(block.fields, block.opcode)
    };

    function translateInputs(inputs: sb3.Block["inputs"]): Block["inputs"] {
      let result = {};

      const addInput = (name: string, value: BlockInput.Any): void => {
        result = { ...result, [name]: value };
      };

      for (const [inputName, input] of Object.entries(inputs)) {
        const value = input[1];
        if (typeof value === "string") {
          const inputScript = blockWithNext(value, blockId);
          if (inputScript.length === 1 && blocks[value].shadow) {
            // Input contains a shadow block.
            // Conceptually, shadow blocks are weird.
            // We basically just want to copy the important
            // information from the shadow block down into
            // the block containing the shadow.
            if (blocks[value].opcode === "procedures_prototype") {
              const { mutation } = blocks[value];

              // Split proccode (such as "letter %n of %s") into ["letter", "%n", "of", "%s"]
              let parts = (mutation.proccode as string).split(/((^|[^\\])%[nsb])/);
              parts = parts.map(str => str.trim());
              parts = parts.filter(str => str !== "");

              const argNames: string[] = JSON.parse(mutation.argumentnames as string);
              const argDefaults: string[] = JSON.parse(mutation.argumentdefaults as string);

              const args: BlockInput.CustomBlockArgument[] = parts.map(part => {
                const optionalToNumber = (value: string | number): string | number => {
                  if (typeof value !== "string") {
                    return value;
                  }
                  const asNum = Number(value);
                  if (!isNaN(asNum)) {
                    return asNum;
                  }
                  return value;
                };

                switch (part) {
                  case "%s":
                  case "%n":
                    return {
                      type: "numberOrString",
                      name: argNames.shift(),
                      defaultValue: optionalToNumber(argDefaults.shift())
                    };
                  case "%b":
                    return {
                      type: "boolean",
                      name: argNames.shift(),
                      defaultValue: argDefaults.shift() === "true"
                    };
                  default:
                    return {
                      type: "label",
                      name: part
                    };
                }
              });

              addInput("PROCCODE", { type: "string", value: mutation.proccode as string });
              addInput("ARGUMENTS", { type: "customBlockArguments", value: args });
              addInput("WARP", { type: "boolean", value: mutation.warp === "true" });
            } else {
              // In most cases, just copy the shadow block's fields and inputs
              // into its parent
              result = {
                ...result,
                ...translateInputs(blocks[value].inputs),
                ...translateFields(blocks[value].fields, blocks[value].opcode)
              };
            }
          } else {
            let isBlocks;
            if (BlockBase.isKnownBlock(block.opcode)) {
              const defaultInput = BlockBase.getDefaultInput(block.opcode, inputName);
              if (defaultInput && defaultInput.type === "blocks") {
                isBlocks = true;
              }
            }
            isBlocks = isBlocks || inputScript.length > 1;
            if (isBlocks) {
              addInput(inputName, { type: "blocks", value: inputScript });
            } else {
              addInput(inputName, { type: "block", value: inputScript[0] });
            }
          }
        } else if (value === null) {
          addInput(inputName, { type: "string", value: null });
        } else {
          const BIS = sb3.BlockInputStatus;
          switch (value[0]) {
            case BIS.MATH_NUM_PRIMITIVE:
            case BIS.POSITIVE_NUM_PRIMITIVE:
            case BIS.WHOLE_NUM_PRIMITIVE:
            case BIS.INTEGER_NUM_PRIMITIVE: {
              let storedValue: string | number = value[1];
              const asNum = Number(storedValue as string);
              if (!isNaN(asNum)) {
                storedValue = asNum;
              }
              addInput(inputName, { type: "number", value: storedValue });
              break;
            }
            case BIS.ANGLE_NUM_PRIMITIVE:
              addInput(inputName, { type: "angle", value: Number(value[1] as string) });
              break;
            case BIS.COLOR_PICKER_PRIMITIVE:
              addInput(inputName, {
                type: "color",
                value: {
                  r: parseInt(value[1].slice(1, 3), 16),
                  g: parseInt(value[1].slice(3, 5), 16),
                  b: parseInt(value[1].slice(5, 7), 16)
                }
              });
              break;
            case BIS.TEXT_PRIMITIVE:
              addInput(inputName, { type: "string", value: value[1] });
              break;
            case BIS.BROADCAST_PRIMITIVE:
              addInput(inputName, { type: "broadcast", value: value[1] });
              break;
            case BIS.VAR_PRIMITIVE:
              // This is a variable input. Convert it to a variable block.
              addInput(inputName, {
                type: "block",
                value: new BlockBase({
                  opcode: OpCode.data_variable,
                  inputs: { VARIABLE: { type: "variable", value: value[1] } },
                  parent: blockId
                }) as Block
              });
              break;
            case BIS.LIST_PRIMITIVE:
              // This is a list input. Convert it to a list contents block.
              addInput(inputName, {
                type: "block",
                value: new BlockBase({
                  opcode: OpCode.data_listcontents,
                  inputs: { LIST: { type: "list", value: value[1] } },
                  parent: blockId
                }) as Block
              });
              break;
          }
        }
      }

      if (block.opcode === OpCode.procedures_call) {
        result = {
          PROCCODE: { type: "string", value: block.mutation.proccode },
          INPUTS: {
            type: "customBlockInputValues",
            value: (JSON.parse(block.mutation.argumentids as string) as string[]).map(argumentid => {
              let value = result[argumentid];
              if (value === undefined) {
                // TODO: Find a way to determine type of missing input value
                // (Caused by things like boolean procedure_call inputs that
                // were never filled at any time.)
                return { type: "string", value: null };
              }
              if (typeof value.value === "string") {
                const asNum = Number(value.value);
                if (!isNaN(asNum)) {
                  value.value = asNum;
                }
              }
              return value;
            })
          }
        };
      }

      return result;
    }

    function translateFields(fields: sb3.Block["fields"], opcode: OpCode): Block["inputs"] {
      let result = {};
      for (const [fieldName, values] of Object.entries(fields)) {
        const type = sb3.fieldTypeMap[opcode][fieldName];
        result[fieldName] = { type, value: values[0] };
      }

      return result;
    }
  }

  function blockWithNext(blockId: string, parentId: string = null): Block[] {
    const sb3Block = blocks[blockId];
    const block = new BlockBase({
      opcode: sb3Block.opcode,
      inputs: getBlockInputs(sb3Block, blockId),
      id: blockId,
      parent: parentId,
      next: sb3Block.next
    }) as Block;
    let next: Block[] = [];
    if (sb3Block.next !== null) {
      next = blockWithNext(sb3Block.next, blockId);
    }
    return [block, ...next];
  }

  return blockWithNext;
}

export async function fromSb3JSON(json: sb3.ProjectJSON, options: { getAsset: GetAsset }): Promise<Project> {
  function getVariables(target: sb3.Target): Variable[] {
    return Object.entries(target.variables).map(([id, [name, value, cloud = false]]) => {
      let monitor = json.monitors.find(monitor => monitor.id === id) as sb3.VariableMonitor;
      if (!monitor) {
        // Sometimes .sb3 files are missing monitors. Fill in with reasonable defaults.
        monitor = {
          id,
          mode: "default",
          opcode: "data_variable",
          params: { VARIABLE: name },
          spriteName: target.name,
          value,
          width: null,
          height: null,
          x: 0,
          y: 0,
          visible: false,
          sliderMin: 0,
          sliderMax: 100,
          isDiscrete: true
        };
      }
      return new Variable({
        name,
        id,
        value,
        cloud,
        visible: monitor.visible,
        mode: monitor.mode,
        x: monitor.x,
        y: monitor.y,
        sliderMin: monitor.sliderMin,
        sliderMax: monitor.sliderMax,
        isDiscrete: monitor.isDiscrete
      });
    });
  }

  function getLists(target: sb3.Target): List[] {
    return Object.entries(target.lists).map(([id, [name, value]]) => {
      let monitor = json.monitors.find(monitor => monitor.id === id) as sb3.ListMonitor;
      if (!monitor) {
        // Sometimes .sb3 files are missing monitors. Fill in with reasonable defaults.
        monitor = {
          id,
          mode: "list",
          opcode: "data_listcontents",
          params: { LIST: name },
          spriteName: target.name,
          value,
          width: null,
          height: null,
          x: 0,
          y: 0,
          visible: false
        };
      }
      return new List({
        name,
        id,
        value,
        visible: monitor.visible,
        x: monitor.x,
        y: monitor.y,
        width: monitor.width === 0 ? null : monitor.width,
        height: monitor.height === 0 ? null : monitor.height
      });
    });
  }

  const stage = json.targets.find(target => target.isStage) as sb3.Stage;

  async function getTargetOptions(target: sb3.Target): Promise<TargetOptions> {
    const [costumes, sounds] = await Promise.all([
      extractCostumes(target, options.getAsset),
      extractSounds(target, options.getAsset)
    ]);

    return {
      name: target.name,
      isStage: target.isStage,
      costumes,
      costumeNumber: target.currentCostume,
      sounds,
      scripts: Object.entries(target.blocks)
        .filter(([, block]) => block.topLevel && !block.shadow)
        .map(
          ([id, block]) =>
            new Script({
              blocks: getBlockScript(target.blocks)(id),
              x: block.x,
              y: block.y
            })
        ),
      variables: getVariables(target),
      lists: getLists(target),
      volume: target.volume,
      layerOrder: target.layerOrder
    };
  }

  return new Project({
    stage: new Stage(await getTargetOptions(stage)),
    sprites: await Promise.all(
      json.targets
        .filter(target => !target.isStage)
        .map(
          async (spriteData: sb3.Sprite) =>
            new Sprite({
              ...(await getTargetOptions(spriteData)),
              x: spriteData.x,
              y: spriteData.y,
              size: spriteData.size,
              direction: spriteData.direction,
              rotationStyle: {
                "all around": "normal",
                "left-right": "leftRight",
                "don't rotate": "none"
              }[spriteData.rotationStyle] as "normal" | "leftRight" | "none",
              isDraggable: spriteData.draggable,
              visible: spriteData.visible
            })
        )
    ),
    tempo: stage.tempo,
    videoOn: stage.videoState === "on",
    videoAlpha: stage.videoTransparency
  });
}

export default async function fromSb3(fileData: Parameters<typeof JSZip.loadAsync>[0]): Promise<Project> {
  const inZip = await JSZip.loadAsync(fileData);
  const json = await inZip.file("project.json").async("text");
  const getAsset = async ({ md5, ext }): Promise<ArrayBuffer> => {
    return inZip.file(`${md5}.${ext}`).async("arraybuffer");
  };
  return fromSb3JSON(JSON.parse(json), { getAsset });
}
