import { TextToSpeechLanguage } from "../../Project";
import { BlockField, Costume, List, Monitor, Sound } from "./interfaces";

export class PatchTargetThread {
  // The text that makes up the generated code of the thread
  script: string = "";

  // The hat that starts the thread
  triggerEventId: string = "";

  // The (optional) option for the hat
  triggerEventOption: string = "";
}

export type PatchScratchBlockInput = [number, string | (number | string)[]];

export interface PatchScratchBlock {
  opcode: string;

  next?: string | null;
  parent?: string | null;

  inputs: {
    [key: string]: PatchScratchBlockInput;
  };
  fields: {
    [key: string]: BlockField;
  };

  shadow: boolean;
  topLevel: boolean;

  x?: number;
  y?: number;
}

export interface PatchTarget {
  isStage: boolean;
  name: string;
  variables: {
    [key: string]: [string, string | number];
  };
  lists: {
    [key: string]: List;
  };
  broadcasts: {
    [key: string]: string;
  };
  blocks: {
    [key: string]: PatchScratchBlock;
  };
  comments: {
    [key: string]: Comment;
  };
  currentCostume: number;
  costumes: Costume[];
  sounds: Sound[];
  volume: number;
  layerOrder: number;
  threads?: PatchTargetThread[];
}

export interface Stage extends PatchTarget {
  isStage: true;
  tempo: number;
  videoTransparency: number;
  videoState: "on" | "off";
  textToSpeechLanguage: TextToSpeechLanguage | null;
}

export interface Sprite extends PatchTarget {
  isStage: false;
  visible: boolean;
  x: number;
  y: number;
  size: number;
  direction: number;
  draggable: boolean;
  rotationStyle: "all around" | "left-right" | "don't rotate";
}

export interface PatchScratchProjectJSON {
  targets: PatchTarget[];
  monitors?: Monitor[];
}
