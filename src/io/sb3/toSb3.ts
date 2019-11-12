const doesThisCodeHaveErrors = "not if I comment it out";
export default doesThisCodeHaveErrors;

/*
import * as JSZip from "jszip";
import * as sb3 from "../sb3";

import Project from "../../Project";
import Target from "../../Target";

import List from "../../List";
import Variable from "../../Variable";

export default async function toSb3(project: Project): Promise<ArrayBuffer> {
  const outZip = new JSZip();

  for (const target of [project.stage, ...project.sprites]) {
    for (const costume of target.costumes) {
      outZip.file(`${costume.md5}.${costume.ext}`, costume.asset);
    }
  }

  outZip.file("project.json", JSON.stringify(getProjectJSON(project)));

  return await outZip.generateAsync({ type: "arraybuffer" });
}

function extractCostumes(target: Target): sb3.Costume[] {
  return target.costumes.map(costume => {
    const sb3Costume: sb3.Costume = {
      assetId: costume.md5,
      name: costume.name,
      md5ext: `${costume.md5}.${costume.ext}`,
      dataFormat: costume.ext,
      rotationCenterX: costume.centerX / 2,
      rotationCenterY: costume.centerY / 2
    };
    return sb3Costume;
  });
}

function extractSounds(target: Target): sb3.Sound[] {
  return target.sounds.map(sound => {
    const sb3Sound: sb3.Sound = {
      assetId: sound.md5,
      name: sound.name,
      dataFormat: sound.ext,
      format: "",
      rate: sound.sampleRate,
      sampleCount: sound.sampleCount,
      md5ext: `${sound.md5}.${sound.ext}`
    };
    return sb3Sound;
  });
}

function extractMonitors(targets: Target[]): sb3.Monitor[] {
  return targets.flatMap((target: Target) => [
    ...target.variables.map((variable: Variable) => {
      const monitor: sb3.VariableMonitor = {
        mode: variable.mode,
        opcode: "data_variable",
        params: {
          VARIABLE: variable.name
        },
        value: variable.value,
        spriteName: target.isStage ? null : target.name,
        width: 0,
        height: 0,
        x: variable.x,
        y: variable.y,
        visible: variable.visible,
        sliderMin: variable.sliderMin,
        sliderMax: variable.sliderMax,
        isDiscrete: variable.isDiscrete
      };
      return monitor;
    }),
    ...target.lists.map((list: List) => {
      const monitor: sb3.ListMonitor = {
        mode: "list",
        opcode: "data_listcontents",
        params: {
          LIST: list.name
        },
        height: list.height === null ? 0 : list.height,
        width: list.width === null ? 0 : list.width,
        x: list.x,
        y: list.y,
        spriteName: target.isStage ? null : target.name,
        value: list.value,
        visible: list.visible
      };
      return monitor;
    })
  ]);
}

function getProjectJSON(project: Project): sb3.ProjectJSON {
  const stage: sb3.Stage = {
    name: project.stage.name,
    isStage: true,
    currentCostume: project.stage.costumeNumber,
    videoState: project.videoOn ? "on" : "off",
    videoTransparency: project.videoAlpha,
    costumes: extractCostumes(project.stage),
    sounds: extractSounds(project.stage),
    volume: project.stage.volume,
    tempo: project.tempo,
    variables: project.stage.variables.reduce((variables: sb3.Stage["variables"], variable) => {
      let varData: [string, string | number, boolean?] = [variable.name, variable.value];
      if (variable.cloud) {
        varData.push(true);
      }
      return { ...variables, [variable.id]: varData };
    }, {}),
    lists: project.stage.lists.reduce(
      (lists: sb3.Stage["lists"], list) => ({
        ...lists,
        [list.id]: [list.name, list.value]
      }),
      {}
    ),
    layerOrder: project.stage.layerOrder,
    textToSpeechLanguage: project.textToSpeechLanguage,
    blocks: project.stage.blocks.reduce((blocks, block) => {
      const sb3Block: sb3.Block = {
        opcode: block.opcode,
        next: block.next,
        parent: block.parent,
        x: 0, // TODO: Retrieve actual x/y
        y: 0
      };
      return { ...blocks, [block.id]: sb3Block };
    }, {})
  };

  const sprites: sb3.Sprite[] = project.sprites.map(sprite => {
    const sb3Sprite: sb3.Sprite = {
      name: sprite.name,
      costumes: extractCostumes(sprite),
      sounds: extractSounds(sprite),
      currentCostume: sprite.costumeNumber,
      rotationStyle: { normal: "all around", "left-right": "leftRight", none: "don't rotate" }[sprite.rotationStyle],
      x: sprite.x,
      y: sprite.y,
      size: sprite.size,
      direction: sprite.direction,
      visible: sprite.visible,
      draggable: sprite.isDraggable,
      isStage: false,
      volume: sprite.volume
    };
    return sb3Sprite;
  });

  return {
    targets: [stage, ...sprites],
    monitors: extractMonitors([project.stage, ...project.sprites]),
    meta: "waddup"
  };
}
*/
