import { OpCode } from "../../OpCode";
import { KnownBlock, ProcedureBlock } from "../../Block";
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
export type Variable =
  | [string, ScalarValue]
  | [string, ScalarValue, true];

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
    argumentnames?: string;
    argumentdefaults?: string;
    warp: "true" | "false";
  };
}

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

export enum BlockInputStatus {
  INPUT_SAME_BLOCK_SHADOW = 1,
  INPUT_BLOCK_NO_SHADOW,
  INPUT_DIFF_BLOCK_SHADOW,
  MATH_NUM_PRIMITIVE,
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

export import BIS = BlockInputStatus;

export const BooleanOrSubstackInputStatus = BIS.INPUT_BLOCK_NO_SHADOW;

export type BlockInput =
  | [BIS.INPUT_SAME_BLOCK_SHADOW, BlockInputValue]
  | [BIS.INPUT_BLOCK_NO_SHADOW, BlockInputValue]
  | [BIS.INPUT_DIFF_BLOCK_SHADOW, BlockInputValue, any];

export type BlockInputValue =
  | string // Block ID
  | [BIS.MATH_NUM_PRIMITIVE, number | string]
  | [BIS.POSITIVE_NUM_PRIMITIVE, number | string]
  | [BIS.WHOLE_NUM_PRIMITIVE, number | string]
  | [BIS.INTEGER_NUM_PRIMITIVE, number | string]
  | [BIS.ANGLE_NUM_PRIMITIVE, number | string]
  | [BIS.COLOR_PICKER_PRIMITIVE, string]
  | [BIS.TEXT_PRIMITIVE, string]
  | [BIS.BROADCAST_PRIMITIVE, string, string]
  | [BIS.VAR_PRIMITIVE, string, string]
  | [BIS.LIST_PRIMITIVE, string, string];

// Most values in this mapping are taken from scratch-gui/src/lib/make-
// toolbox-xml.js. They're used so that the primitive/opcode values of
// outputted shadow blocks are correct.
//
// Many of the entries here may seem to be missing inputs. That's becuase it
// only maps Scratch 3.0 inputs - not fields. sb-edit doesn't distinguish
// between fields and inputs, but it's critical that projects that export to
// sb3 do.
//
// Note: Boolean and substack inputs are weird. They alone are stored using
// the INPUT_BLOCK_NO_SHADOW (2) input status; when empty, they may be either
// stored as [2, null] or simply not stored at all.
//
// The BooleanOrSubstackInputStatus constant is exported for use in finding
// these values, rather than directly accessing BIS.INPUT_BLOCK_NO_SHADOW
// (which could imply special handling for the other INPUT_BLOCK_* values,
// when none such is required and whose values are never specified in this
// mapping).
export const inputPrimitiveOrShadowMap: {
  // Custom procedure blocks should be serialized separately from how normal
  // blocks are, since most of their data is stored on a "mutation" field not
  // accounted for here.
  [opcode in Exclude<KnownBlock["opcode"], ProcedureBlock["opcode"]>]: {
    [fieldName: string]: number | OpCode;
  }
} = {
  [OpCode.motion_movesteps]: {STEPS: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.motion_turnright]: {DEGREES: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.motion_turnleft]: {DEGREES: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.motion_pointindirection]: {DIRECTION: BIS.ANGLE_NUM_PRIMITIVE},
  [OpCode.motion_pointtowards]: {TOWARDS: OpCode.motion_pointtowards_menu},
  [OpCode.motion_gotoxy]: {X: BIS.MATH_NUM_PRIMITIVE, Y: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.motion_goto]: {TO: OpCode.motion_goto_menu},
  [OpCode.motion_glidesecstoxy]: {SECS: BIS.MATH_NUM_PRIMITIVE, X: BIS.MATH_NUM_PRIMITIVE, Y: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.motion_glideto]: {SECS: BIS.MATH_NUM_PRIMITIVE, TO: OpCode.motion_glideto_menu},
  [OpCode.motion_changexby]: {DX: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.motion_setx]: {X: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.motion_changeyby]: {DY: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.motion_sety]: {Y: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.motion_ifonedgebounce]: {},
  [OpCode.motion_setrotationstyle]: {},
  [OpCode.motion_xposition]: {},
  [OpCode.motion_yposition]: {},
  [OpCode.motion_direction]: {},
  [OpCode.looks_sayforsecs]: {MESSAGE: BIS.TEXT_PRIMITIVE, SECS: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.looks_say]: {MESSAGE: BIS.TEXT_PRIMITIVE},
  [OpCode.looks_thinkforsecs]: {MESSAGE: BIS.TEXT_PRIMITIVE, SECS: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.looks_think]: {MESSAGE: BIS.TEXT_PRIMITIVE},
  [OpCode.looks_show]: {},
  [OpCode.looks_hide]: {},
  [OpCode.looks_switchcostumeto]: {COSTUME: OpCode.looks_costume},
  [OpCode.looks_nextcostume]: {},
  [OpCode.looks_nextbackdrop]: {},
  [OpCode.looks_switchbackdropto]: {BACKDROP: OpCode.looks_backdrops},
  [OpCode.looks_switchbackdroptoandwait]: {BACKDROP: OpCode.looks_backdrops},
  [OpCode.looks_changeeffectby]: {CHANGE: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.looks_seteffectto]: {VALUE: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.looks_changesizeby]: {CHANGE: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.looks_setsizeto]: {SIZE: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.looks_changeeffectby]: {CHANGE: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.looks_seteffectto]: {VALUE: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.looks_cleargraphiceffects]: {},
  [OpCode.looks_gotofrontback]: {},
  [OpCode.looks_goforwardbackwardlayers]: {NUM: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.looks_costumenumbername]: {},
  [OpCode.looks_backdropnumbername]: {},
  [OpCode.looks_size]: {},
  [OpCode.looks_hideallsprites]: {},
  [OpCode.looks_changestretchby]: {CHANGE: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.looks_setstretchto]: {STRETCH: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.sound_play]: {SOUND_MENU: OpCode.sound_sounds_menu},
  [OpCode.sound_playuntildone]: {SOUND_MENU: OpCode.sound_sounds_menu},
  [OpCode.sound_stopallsounds]: {},
  [OpCode.sound_changeeffectby]: {VALUE: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.sound_seteffectto]: {VALUE: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.sound_cleareffects]: {},
  [OpCode.sound_changevolumeby]: {VOLUME: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.sound_setvolumeto]: {VOLUME: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.sound_volume]: {},
  [OpCode.event_whenflagclicked]: {},
  [OpCode.event_whenkeypressed]: {},
  [OpCode.event_whenstageclicked]: {},
  [OpCode.event_whenthisspriteclicked]: {},
  [OpCode.event_whenbackdropswitchesto]: {},
  [OpCode.event_whengreaterthan]: {VALUE: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.event_whenbroadcastreceived]: {},
  [OpCode.event_broadcast]: {BROADCAST_INPUT: OpCode.event_broadcast_menu},
  [OpCode.event_broadcastandwait]: {BROADCAST_INPUT: OpCode.event_broadcast_menu},
  [OpCode.control_wait]: {DURATION: BIS.POSITIVE_NUM_PRIMITIVE},
  [OpCode.control_repeat]: {TIMES: BIS.WHOLE_NUM_PRIMITIVE},
  [OpCode.control_forever]: {SUBSTACK: BooleanOrSubstackInputStatus},
  [OpCode.control_if]: {CONDITION: BooleanOrSubstackInputStatus, SUBSTACK: BooleanOrSubstackInputStatus},
  [OpCode.control_if_else]: {CONDITION: BooleanOrSubstackInputStatus, SUBSTACK: BooleanOrSubstackInputStatus, SUBSTACK2: BooleanOrSubstackInputStatus},
  [OpCode.control_wait_until]: {CONDITION: BooleanOrSubstackInputStatus},
  [OpCode.control_repeat_until]: {CONDITION: BooleanOrSubstackInputStatus, SUBSTACK: BooleanOrSubstackInputStatus},
  [OpCode.control_while]: {CONDITION: BooleanOrSubstackInputStatus, SUBSTACK: BooleanOrSubstackInputStatus},
  [OpCode.control_for_each]: {VALUE: BIS.MATH_NUM_PRIMITIVE, SUBSTACK: BooleanOrSubstackInputStatus},
  [OpCode.control_all_at_once]: {SUBSTACK: BooleanOrSubstackInputStatus},
  [OpCode.control_stop]: {},
  [OpCode.control_start_as_clone]: {},
  [OpCode.control_create_clone_of]: {CLONE_OPTION: OpCode.control_create_clone_of_menu},
  [OpCode.control_delete_this_clone]: {},
  [OpCode.sensing_touchingobject]: {TOUCHINGOBJECTMENU: OpCode.sensing_touchingobjectmenu},
  [OpCode.sensing_touchingcolor]: {COLOR: BIS.COLOR_PICKER_PRIMITIVE},
  [OpCode.sensing_coloristouchingcolor]: {COLOR: BIS.COLOR_PICKER_PRIMITIVE, COLOR2: BIS.COLOR_PICKER_PRIMITIVE},
  [OpCode.sensing_distanceto]: {DISTANCETOMENU: OpCode.sensing_distancetomenu},
  [OpCode.sensing_askandwait]: {QUESTION: BIS.TEXT_PRIMITIVE},
  [OpCode.sensing_answer]: {},
  [OpCode.sensing_keypressed]: {KEY_OPTION: OpCode.sensing_keyoptions},
  [OpCode.sensing_mousedown]: {},
  [OpCode.sensing_mousex]: {},
  [OpCode.sensing_mousey]: {},
  [OpCode.sensing_setdragmode]: {},
  [OpCode.sensing_loudness]: {},
  [OpCode.sensing_timer]: {},
  [OpCode.sensing_resettimer]: {},
  [OpCode.sensing_of]: {OBJECT: OpCode.sensing_of_object_menu},
  [OpCode.sensing_current]: {},
  [OpCode.sensing_dayssince2000]: {},
  [OpCode.sensing_username]: {},
  [OpCode.sensing_userid]: {},
  [OpCode.sensing_loud]: {},
  [OpCode.operator_add]: {NUM1: BIS.MATH_NUM_PRIMITIVE, NUM2: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.operator_subtract]: {NUM1: BIS.MATH_NUM_PRIMITIVE, NUM2: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.operator_multiply]: {NUM1: BIS.MATH_NUM_PRIMITIVE, NUM2: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.operator_divide]: {NUM1: BIS.MATH_NUM_PRIMITIVE, NUM2: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.operator_random]: {FROM: BIS.MATH_NUM_PRIMITIVE, TO: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.operator_lt]: {OPERAND1: BIS.TEXT_PRIMITIVE, OPERAND2: BIS.TEXT_PRIMITIVE},
  [OpCode.operator_equals]: {OPERAND1: BIS.TEXT_PRIMITIVE, OPERAND2: BIS.TEXT_PRIMITIVE},
  [OpCode.operator_gt]: {OPERAND1: BIS.TEXT_PRIMITIVE, OPERAND2: BIS.TEXT_PRIMITIVE},
  [OpCode.operator_and]: {OPERAND1: BooleanOrSubstackInputStatus, OPERAND2: BooleanOrSubstackInputStatus},
  [OpCode.operator_or]: {OPERAND1: BooleanOrSubstackInputStatus, OPERAND2: BooleanOrSubstackInputStatus},
  [OpCode.operator_not]: {OPERAND: BooleanOrSubstackInputStatus},
  [OpCode.operator_join]: {STRING1: BIS.TEXT_PRIMITIVE, STRING2: BIS.TEXT_PRIMITIVE},
  [OpCode.operator_letter_of]: {LETTER: BIS.WHOLE_NUM_PRIMITIVE, STRING: BIS.TEXT_PRIMITIVE},
  [OpCode.operator_length]: {STRING: BIS.TEXT_PRIMITIVE},
  [OpCode.operator_contains]: {STRING1: BIS.TEXT_PRIMITIVE, STRING2: BIS.TEXT_PRIMITIVE},
  [OpCode.operator_mod]: {NUM1: BIS.MATH_NUM_PRIMITIVE, NUM2: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.operator_round]: {NUM: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.operator_mathop]: {NUM: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.pen_clear]: {},
  [OpCode.pen_stamp]: {},
  [OpCode.pen_penDown]: {},
  [OpCode.pen_penUp]: {},
  [OpCode.pen_setPenColorToColor]: {COLOR: BIS.COLOR_PICKER_PRIMITIVE},
  [OpCode.pen_changePenColorParamBy]: {COLOR_PARAM: OpCode.pen_menu_colorParam, VALUE: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.pen_setPenColorParamTo]: {COLOR_PARAM: OpCode.pen_menu_colorParam, VALUE: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.pen_changePenSizeBy]: {SIZE: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.pen_setPenSizeTo]: {SIZE: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.pen_setPenShadeToNumber]: {SHADE: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.pen_changePenShadeBy]: {SHADE: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.pen_setPenHueToNumber]: {HUE: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.pen_changePenHueBy]: {HUE: BIS.MATH_NUM_PRIMITIVE},
  // Data category values from scratch-blocks/core/data_category.js
  [OpCode.data_variable]: {},
  [OpCode.data_setvariableto]: {VALUE: BIS.TEXT_PRIMITIVE},
  [OpCode.data_changevariableby]: {VALUE: BIS.MATH_NUM_PRIMITIVE},
  [OpCode.data_showvariable]: {},
  [OpCode.data_hidevariable]: {},
  [OpCode.data_listcontents]: {},
  [OpCode.data_addtolist]: {ITEM: BIS.TEXT_PRIMITIVE},
  [OpCode.data_deleteoflist]: {INDEX: BIS.INTEGER_NUM_PRIMITIVE},
  [OpCode.data_deletealloflist]: {},
  [OpCode.data_insertatlist]: {INDEX: BIS.INTEGER_NUM_PRIMITIVE, ITEM: BIS.TEXT_PRIMITIVE},
  [OpCode.data_replaceitemoflist]: {INDEX: BIS.INTEGER_NUM_PRIMITIVE, ITEM: BIS.TEXT_PRIMITIVE},
  [OpCode.data_itemoflist]: {INDEX: BIS.INTEGER_NUM_PRIMITIVE},
  [OpCode.data_itemnumoflist]: {ITEM: BIS.TEXT_PRIMITIVE},
  [OpCode.data_lengthoflist]: {},
  [OpCode.data_listcontainsitem]: {ITEM: BIS.TEXT_PRIMITIVE},
  [OpCode.data_showlist]: {},
  [OpCode.data_hidelist]: {},
  [OpCode.argument_reporter_boolean]: {},
  [OpCode.argument_reporter_string_number]: {}
};
