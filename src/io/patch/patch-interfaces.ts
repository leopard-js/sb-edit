import { TextToSpeechLanguage } from "../../Project";
import { Block, Costume, List, Sound, Variable } from "./interfaces";

export class PatchTargetThread {
  // The text that makes up the generated code of the thread
  script: string = "";

  // The hat that starts the thread
  triggerEventId: string = "";

  // The (optional) option for the hat
  triggerEventOption: string = "";
}

export interface PatchTarget {
  isStage: boolean;
  name: string;
  variables: {
    [key: string]: Variable;
  };
  lists: {
    [key: string]: List;
  };
  broadcasts: {
    [key: string]: string;
  };
  blocks: {
    [key: string]: PatchScratchBlock<string>;
  };
  comments: {
    [key: string]: Comment;
  };
  currentCostume: number;
  costumes: Costume[];
  sounds: Sound[];
  volume: number;
  layerOrder: number;
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
}
