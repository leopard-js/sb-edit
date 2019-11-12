import { OpCode } from "../../OpCode";

type Variable = [string, string | number, boolean?];
type List = [string, string[]];

export interface Sound {
  assetId: string;
  name: string;
  dataFormat: string;
  format: string;
  rate: number;
  sampleCount: number;
  md5ext: string;
}

export interface Costume {
  assetId: string;
  name: string;
  md5ext: string;
  dataFormat: string;
  rotationCenterX: number;
  rotationCenterY: number;
}

export interface Block {
  opcode: OpCode;
  next: string;
  parent: string;
  inputs: {
    [key: string]: BlockInput;
  };
  fields: {
    [key: string]: BlockField;
  };
  shadow: boolean;
  topLevel: boolean;
  x?: number;
  y?: number;
  mutation?: {
    tagName: string;
    children: any[]; // TODO: What is this?
    proccode: string;
    argumentids: string;
    argumentnames: string;
    argumentdefaults: string;
    warp: "true" | "false";
  };
}

enum BlockInputStatus {
  MATH_NUM_PRIMITIVE = 4,
  POSITIVE_NUM_PRIMITIVE,
  WHOLE_NUM_PRIMITIVE,
  INTEGER_NUM_PRIMITIVE,
  ANGLE_NUM_PRIMITIVE,
  COLOR_PICKER_PRIMITIVE,
  TEXT_PRIMITIVE,
  BROADCAST_PRIMITIVE,
  VAR_PRIMITIVE,
  LIST_PRIMITIVE
}

export type BlockInput = [1, BlockInputValue] | [2, BlockInputValue] | [3, BlockInputValue, any];

export type BlockInputValue =
  | string // Block ID
  | [BlockInputStatus.MATH_NUM_PRIMITIVE, string]
  | [BlockInputStatus.POSITIVE_NUM_PRIMITIVE, string]
  | [BlockInputStatus.WHOLE_NUM_PRIMITIVE, string]
  | [BlockInputStatus.INTEGER_NUM_PRIMITIVE, string]
  | [BlockInputStatus.ANGLE_NUM_PRIMITIVE, string]
  | [BlockInputStatus.COLOR_PICKER_PRIMITIVE, string]
  | [BlockInputStatus.TEXT_PRIMITIVE, string]
  | [BlockInputStatus.BROADCAST_PRIMITIVE, string, string]
  | [BlockInputStatus.VAR_PRIMITIVE, string, string]
  | [BlockInputStatus.LIST_PRIMITIVE, string, string];

export type BlockField = string[];

interface Comment {
  blockId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  text: string;
}

interface SpriteStageBase {
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
    [key: string]: Block;
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

export interface Stage extends SpriteStageBase {
  isStage: true;
  tempo: number;
  videoTransparency: number;
  videoState: "on" | "off";
  textToSpeechLanguage:
    | "ar"
    | "zh-cn"
    | "da"
    | "nl"
    | "en"
    | "fr"
    | "de"
    | "hi"
    | "is"
    | "it"
    | "ja"
    | "ko"
    | "nb"
    | "pl"
    | "pt-br"
    | "pt"
    | "ro"
    | "ru"
    | "es"
    | "es-419"
    | "sv"
    | "tr"
    | "cy";
}

export interface Sprite extends SpriteStageBase {
  isStage: false;
  visible: boolean;
  x: number;
  y: number;
  size: number;
  direction: number;
  draggable: boolean;
  rotationStyle: "all around" | "left-right" | "don't rotate";
}

export type Target = Sprite | Stage;

interface MonitorBase {
  id: string;
  mode: "default" | "large" | "slider" | "list";
  opcode: "data_variable" | "data_listcontents";
  params: {
    [key: string]: string;
  };
  spriteName: string;
  value: number | string | string[];
  width: number;
  height: number;
  x: number;
  y: number;
  visible: boolean;
}

export interface VariableMonitor extends MonitorBase {
  mode: "default" | "large" | "slider";
  opcode: "data_variable";
  params: {
    VARIABLE: string;
  };
  value: number | string;
  sliderMin: number;
  sliderMax: number;
  isDiscrete: boolean;
}

export interface ListMonitor extends MonitorBase {
  mode: "list";
  opcode: "data_listcontents";
  params: {
    LIST: string;
  };
  value: string[];
}

export type Monitor = VariableMonitor | ListMonitor;

interface Meta {
  semver: string;
  vm: string;
  agent: string;
}

export interface ProjectJSON {
  targets: Target[];
  monitors: Monitor[];
  // TODO: extensions: Extension[];
  meta: Meta;
}
