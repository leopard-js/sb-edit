import { OpCode } from "../../OpCode";
import { TextToSpeechLanguage } from "../../Project";
import * as BlockInput from "../../BlockInput";

// Note: This schema is designed to match the definitions in
// https://github.com/LLK/scratch-parser/blob/master/lib/sb3_definitions.json

// Values storable in variables and lists.
export type ScalarValue = string | number | boolean;

// 32-length hex string - the MD5 of the asset.
// Does not include the asset's file extension.
export type AssetId = string;

// [name, value, cloud]
// For example: ["Highscore", 3000, true]
// Note: Scratch's server prevents uploading non-number values to the cloud
// variable server, but this restriction is not enforced in the sb3 schema.
export type Variable = [string, ScalarValue, boolean?];

// [name, contents]
// For example: ["My List", [1, 2, true, "banana"]]
export type List = [string, ScalarValue[]];

export interface Costume {
  assetId: AssetId;
  dataFormat: "png" | "svg" | "jpeg" | "jpg" | "bmp" | "gif";
  name: string;

  md5ext?: string;

  bitmapResolution?: number;
  rotationCenterX?: number;
  rotationCenterY?: number;
}

export interface Sound {
  assetId: AssetId;
  dataFormat: "wav" | "wave" | "mp3";
  name: string;

  md5ext?: string;

  rate?: number;
  sampleCount?: number;
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

export interface Target {
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

export interface Stage extends Target {
  isStage: true;
  tempo: number;
  videoTransparency: number;
  videoState: "on" | "off";
  textToSpeechLanguage: TextToSpeechLanguage;
}

export interface Sprite extends Target {
  isStage: false;
  visible: boolean;
  x: number;
  y: number;
  size: number;
  direction: number;
  draggable: boolean;
  rotationStyle: "all around" | "left-right" | "don't rotate";
}

interface MonitorBase {
  id: string;
  mode: "default" | "large" | "slider" | "list";
  opcode: "data_variable" | "data_listcontents";
  params: {
    [key: string]: string;
  };
  spriteName: string;
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
  value: ScalarValue;
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
  value: ScalarValue[];
}

export type Monitor = VariableMonitor | ListMonitor;

interface Meta {
  semver: string;
  vm?: string;
  agent?: string;
}

export interface ProjectJSON {
  targets: Target[];
  monitors?: Monitor[];
  // TODO: extensions: Extension[];
  meta: Meta;
}

export const fieldTypeMap: {
  [opcode in OpCode]?: {
    [fieldName: string]: BlockInput.Any["type"];
  };
} = {
  [OpCode.motion_setrotationstyle]: { STYLE: "rotationStyle" },
  [OpCode.motion_pointtowards_menu]: { TOWARDS: "pointTowardsTarget" },
  [OpCode.motion_glideto_menu]: { TO: "goToTarget" },
  [OpCode.motion_goto_menu]: { TO: "goToTarget" },
  [OpCode.motion_align_scene]: { ALIGNMENT: "scrollAlignment" },
  [OpCode.looks_costume]: { COSTUME: "costume" },
  [OpCode.looks_gotofrontback]: { FRONT_BACK: "frontBackMenu" },
  [OpCode.looks_goforwardbackwardlayers]: { FORWARD_BACKWARD: "forwardBackwardMenu" },
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
  [OpCode.control_for_each]: { VARIABLE: "variable" },
  [OpCode.sensing_touchingobjectmenu]: { TOUCHINGOBJECTMENU: "touchingTarget" },
  [OpCode.sensing_distancetomenu]: { DISTANCETOMENU: "distanceToMenu" },
  [OpCode.sensing_keyoptions]: { KEY_OPTION: "key" },
  [OpCode.sensing_setdragmode]: { DRAG_MODE: "dragModeMenu" },
  [OpCode.sensing_of]: { PROPERTY: "propertyOfMenu" },
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
  [OpCode.argument_reporter_boolean]: { VALUE: "string" },
  [OpCode.pen_menu_colorParam]: { colorParam: "penColorParam" },
  [OpCode.music_menu_DRUM]: { DRUM: "musicDrum" },
  [OpCode.music_menu_INSTRUMENT]: { INSTRUMENT: "musicInstrument" },
  [OpCode.videoSensing_menu_ATTRIBUTE]: { ATTRIBUTE: "videoSensingAttribute" },
  [OpCode.videoSensing_menu_SUBJECT]: { SUBJECT: "videoSensingSubject" },
  [OpCode.videoSensing_menu_VIDEO_STATE]: { VIDEO_STATE: "videoSensingVideoState" },
  [OpCode.wedo2_menu_MOTOR_ID]: { MOTOR_ID: "wedo2MotorId" },
  [OpCode.wedo2_menu_MOTOR_DIRECTION]: { MOTOR_DIRECTION: "wedo2MotorDirection" },
  [OpCode.wedo2_menu_TILT_DIRECTION]: { TILT_DIRECTION: "wedo2TiltDirection" },
  [OpCode.wedo2_menu_TILT_DIRECTION_ANY]: { TILT_DIRECTION_ANY: "wedo2TiltDirectionAny" }
};
