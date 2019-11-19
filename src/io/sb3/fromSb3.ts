import * as JSZip from "jszip";
import * as sb3 from "../sb3";

import { OpCode } from "../../OpCode";

import Block, { BlockBase } from "../../Block";
import * as BlockInput from "../../BlockInput";
import Costume from "../../Costume";
import List from "../../List";
import Project from "../../Project";
import Sound from "../../Sound";
import { Sprite, Stage } from "../../Target";
import Variable from "../../Variable";
import Script from "../../Script";

type getAsset = (info: {
  type: "costume" | "sound";
  name: string;
  md5: string;
  ext: string;
  spriteName: string;
}) => Promise<any>;

function extractCostumes(target: sb3.Target, getAsset: getAsset): Promise<Costume[]> {
  return Promise.all(
    target.costumes.map(
      async (costumeData: sb3.Costume) =>
        new Costume({
          name: costumeData.name,
          md5: costumeData.assetId,
          ext: costumeData.dataFormat,
          bitmapResolution: 2,
          centerX: costumeData.rotationCenterX * 2,
          centerY: costumeData.rotationCenterY * 2,
          asset: await getAsset({
            type: "costume",
            name: costumeData.name,
            md5: costumeData.assetId,
            ext: costumeData.dataFormat,
            spriteName: target.name
          })
        })
    )
  );
}

async function extractSounds(target: sb3.Target, getAsset: getAsset): Promise<Sound[]> {
  return Promise.all(
    target.sounds.map(
      async (soundData: sb3.Sound) =>
        new Sound({
          name: soundData.name,
          md5: soundData.assetId,
          ext: soundData.dataFormat,
          sampleCount: soundData.sampleCount,
          sampleRate: soundData.rate,
          format: soundData.format,
          asset: await getAsset({
            type: "sound",
            name: soundData.name,
            md5: soundData.assetId,
            ext: soundData.dataFormat,
            spriteName: target.name
          })
        })
    )
  );
}

function getBlockScript(blocks: { [key: string]: sb3.Block }) {
  function getBlockInputs(block: sb3.Block): Block["inputs"] {
    return {
      ...translateInputs(block.inputs),
      ...translateFields(block.fields, block.opcode)
    };

    function translateInputs(inputs: sb3.Block["inputs"]): Block["inputs"] {
      let result = {};

      const addInput = (name: string, value: BlockInput.Any) => {
        result = { ...result, [name]: value };
      };

      for (const [inputName, input] of Object.entries(inputs)) {
        const value = input[1];
        if (typeof value === "string") {
          const inputScript = blockWithNext(value);
          if (inputScript.length === 1) {
            if (blocks[value].shadow) {
              // Input contains a shadow block.
              // Conceptually, shadow blocks are weird.
              // We basically just want to copy the important
              // information from the shadow block down into
              // the block containing the shadow.
              if (blocks[value].opcode === "procedures_prototype") {
                const { mutation } = blocks[value];

                // Split proccode (such as "letter %n of %s") into ["letter", "%n", "of", "%s"]
                let parts = mutation.proccode.split(/((^|[^\\])%[nsb])/);
                parts = parts.map(str => str.trim());
                parts = parts.filter(str => str !== "");

                const argNames: string[] = JSON.parse(mutation.argumentnames);
                const argDefaults: any[] = JSON.parse(mutation.argumentdefaults);

                const args: BlockInput.CustomBlockArgument[] = parts.map(part => {
                  switch (part) {
                    case "%s":
                      return {
                        type: "numberOrString",
                        name: argNames.splice(0, 1)[0],
                        defaultValue: argDefaults.splice(0, 1)[0]
                      };
                    case "%b":
                      return {
                        type: "boolean",
                        name: argNames.splice(0, 1)[0],
                        defaultValue: argDefaults.splice(0, 1)[0] === "true"
                      };
                    default:
                      return {
                        type: "label",
                        name: part
                      };
                  }
                });

                addInput("PROCCODE", { type: "string", value: mutation.proccode });
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
              addInput(inputName, { type: "block", value: inputScript[0] });
            }
          } else {
            addInput(inputName, { type: "blocks", value: inputScript });
          }
        } else if (value === null) {
          addInput(inputName, { type: "string", value: null });
        } else {
          switch (value[0]) {
            case 4:
            case 5:
            case 6:
            case 7:
              addInput(inputName, { type: "number", value: parseFloat(value[1]) });
              break;
            case 8:
              addInput(inputName, { type: "angle", value: parseFloat(value[1]) });
              break;
            case 9:
              addInput(inputName, {
                type: "color",
                value: {
                  r: parseInt(value[1].slice(1, 3), 16),
                  g: parseInt(value[1].slice(3, 5), 16),
                  b: parseInt(value[1].slice(5, 7), 16)
                }
              });
              break;
            case 10:
              addInput(inputName, { type: "string", value: value[1] });
              break;
            case 11:
              addInput(inputName, { type: "broadcast", value: value[1] });
              break;
            case 12:
              // This is a variable input. Convert it to a variable block.
              addInput(inputName, {
                type: "block",
                value: new BlockBase({
                  opcode: OpCode.data_variable,
                  inputs: { VARIABLE: { type: "variable", value: value[1] } }
                  // TODO: Set "parent"
                }) as Block
              });
              break;
            case 13:
              // This is a list input. Convert it to a list contents block.
              addInput(inputName, {
                type: "block",
                value: new BlockBase({
                  opcode: OpCode.data_listcontents,
                  inputs: { LIST: { type: "list", value: value[1] } }
                }) as Block
              });
              break;
          }
        }
      }

      // TODO: In the sb3 format, it's possible for inputs to be
      // completely missing if they were never given a value.
      // If that happens, they should be added automatically here
      // with a reasonable default (or maybe null?).

      // The challenge is determining which inputs a given block *should*
      // have. Ideally this would be done without duplicating the efforts
      // in Block.ts

      if (block.opcode === OpCode.procedures_call) {
        result = {
          PROCCODE: { type: "string", value: block.mutation.proccode },
          INPUTS: {
            type: "customBlockInputValues",
            value: JSON.parse(block.mutation.argumentids).map((argumentid: string) => {
              let value = result[argumentid];
              if (typeof value.value === "string") {
                if (!isNaN(parseFloat(value.value))) {
                  value.value = parseFloat(value.value);
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
      const fieldTypeMap: {
        [opcode in OpCode]?: {
          [fieldName: string]: BlockInput.Any["type"];
        };
      } = {
        [OpCode.motion_setrotationstyle]: { STYLE: "rotationStyle" },
        [OpCode.motion_pointtowards_menu]: { TOWARDS: "pointTowardsTarget" },
        [OpCode.motion_glideto_menu]: { TO: "goToTarget" },
        [OpCode.motion_goto_menu]: { TO: "goToTarget" },
        [OpCode.looks_costume]: { COSTUME: "costume" },
        [OpCode.looks_gotofrontback]: { FRONT_BACK: "frontBackMenu" },
        [OpCode.looks_changeeffectby]: { EFFECT: "graphicEffect" },
        [OpCode.looks_backdropnumbername]: { NUMBER_NAME: "costumeNumberName" },
        [OpCode.looks_costumenumbername]: { NUMBER_NAME: "costumeNumberName" },
        [OpCode.looks_backdrops]: { BACKDROP: "backdrop" },
        [OpCode.looks_seteffectto]: { EFFECT: "graphicEffect" },
        [OpCode.sound_seteffectto]: { EFFECT: "soundEffect" },
        [OpCode.sound_changeeffectby]: { EFFECT: "soundEffect" },
        [OpCode.sound_sounds_menu]: { SOUND_MENU: "sound" },
        [OpCode.event_whenkeypressed]: { KEY_OPTION: "key" },
        [OpCode.event_whenbackdropswitchesto]: { BACKDROP: "backdrop" },
        [OpCode.event_whengreaterthan]: { WHENGREATERTHANMENU: "greaterThanMenu" },
        [OpCode.event_whenbroadcastreceived]: { BROADCAST_OPTION: "broadcast" },
        [OpCode.control_stop]: { STOP_OPTION: "stopMenu" },
        [OpCode.control_create_clone_of_menu]: { CLONE_OPTION: "cloneTarget" },
        [OpCode.sensing_distancetomenu]: { DISTANCETOMENU: "distanceToMenu" },
        [OpCode.sensing_keyoptions]: { KEY_OPTION: "key" },
        [OpCode.sensing_setdragmode]: { DRAG_MODE: "dragModeMenu" },
        [OpCode.sensing_of]: { PROPERTY: "target" },
        [OpCode.sensing_of_object_menu]: { OBJECT: "target" },
        [OpCode.sensing_current]: { CURRENTMENU: "currentMenu" },
        [OpCode.operator_mathop]: { OPERATOR: "mathopMenu" },
        [OpCode.data_variable]: { VARIABLE: "variable" },
        [OpCode.data_setvariableto]: { VARIABLE: "variable" },
        [OpCode.data_changevariableby]: { VARIABLE: "variable" },
        [OpCode.data_showvariable]: { VARIABLE: "variable" },
        [OpCode.data_hidevariable]: { VARIABLE: "variable" },
        [OpCode.data_listcontents]: { LIST: "list" },
        [OpCode.data_addtolist]: { LIST: "list" },
        [OpCode.data_deleteoflist]: { LIST: "list" },
        [OpCode.data_deletealloflist]: { LIST: "list" },
        [OpCode.data_insertatlist]: { LIST: "list" },
        [OpCode.data_replaceitemoflist]: { LIST: "list" },
        [OpCode.data_itemoflist]: { LIST: "list" },
        [OpCode.data_itemnumoflist]: { LIST: "list" },
        [OpCode.data_lengthoflist]: { LIST: "list" },
        [OpCode.data_listcontainsitem]: { LIST: "list" },
        [OpCode.data_showlist]: { LIST: "list" },
        [OpCode.data_hidelist]: { LIST: "list" },
        [OpCode.argument_reporter_string_number]: { VALUE: "string" },
        [OpCode.argument_reporter_boolean]: { VALUE: "string" }
      };

      let result = {};
      for (const [fieldName, values] of Object.entries(fields)) {
        const type = fieldTypeMap[opcode][fieldName];
        result[fieldName] = { type, value: values[0] };
      }

      return result;
    }
  }

  function blockWithNext(blockId: string, parentId: string = null): Block[] {
    const sb3Block = blocks[blockId];
    const block = new BlockBase({
      opcode: sb3Block.opcode,
      inputs: getBlockInputs(sb3Block),
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

export async function fromSb3JSON(json: sb3.ProjectJSON, options: { getAsset: getAsset }): Promise<Project> {
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
      return new Variable(
        {
          name,
          value,
          cloud,
          visible: monitor.visible,
          mode: monitor.mode,
          x: monitor.x,
          y: monitor.y,
          sliderMin: monitor.sliderMin,
          sliderMax: monitor.sliderMax,
          isDiscrete: monitor.isDiscrete
        },
        id
      );
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
      return new List(
        {
          name,
          value,
          visible: monitor.visible,
          x: monitor.x,
          y: monitor.y,
          width: monitor.width === 0 ? null : monitor.width,
          height: monitor.height === 0 ? null : monitor.height
        },
        id
      );
    });
  }

  const stage = json.targets.find(target => target.isStage) as sb3.Stage;

  return new Project({
    stage: new Stage({
      name: stage.name,
      costumes: await extractCostumes(stage, options.getAsset),
      costumeNumber: stage.currentCostume,
      sounds: await extractSounds(stage, options.getAsset),
      scripts: Object.entries(stage.blocks)
        .filter(([id, block]) => block.topLevel)
        .map(
          ([id, block]) =>
            new Script({
              blocks: getBlockScript(stage.blocks)(id),
              x: block.x,
              y: block.y
            })
        ),
      variables: getVariables(stage),
      lists: getLists(stage),
      volume: stage.volume,
      layerOrder: stage.layerOrder
    }),
    sprites: await Promise.all(
      json.targets
        .filter(target => !target.isStage)
        .map(
          async (spriteData: sb3.Sprite) =>
            new Sprite({
              name: spriteData.name,
              costumes: await extractCostumes(spriteData, options.getAsset),
              costumeNumber: spriteData.currentCostume,
              sounds: await extractSounds(spriteData, options.getAsset),
              scripts: Object.entries(spriteData.blocks)
                .filter(([id, block]) => block.topLevel)
                .map(
                  ([id, block]) =>
                    new Script({
                      blocks: getBlockScript(spriteData.blocks)(id),
                      x: block.x,
                      y: block.y
                    })
                ),
              variables: getVariables(spriteData),
              lists: getLists(spriteData),
              volume: stage.volume,
              layerOrder: spriteData.layerOrder,
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
  const getAsset = async ({ md5, ext }) => {
    return await inZip.file(`${md5}.${ext}`).async("arraybuffer");
  };
  return await fromSb3JSON(JSON.parse(json), { getAsset });
}
