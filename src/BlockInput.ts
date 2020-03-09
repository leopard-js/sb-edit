import _Block from "./Block";

export interface Base {
  type: string;
  value: any;
}

export interface Number extends Base {
  type: "number";
  value: number | string;
}

export interface String extends Base {
  type: "string";
  value: string;
}

export interface Boolean extends Base {
  type: "boolean";
  value: boolean;
}

export interface Angle extends Base {
  type: "angle";
  value: number;
}

export interface Color extends Base {
  type: "color";
  value: {
    r: number;
    g: number;
    b: number;
  };
}

export interface Broadcast extends Base {
  type: "broadcast";
  value: string;
}

export interface Variable extends Base {
  type: "variable";
  value: string;
}

export interface List extends Base {
  type: "list";
  value: string;
}

export interface Block extends Base {
  type: "block";
  value: _Block;
}

export interface Blocks extends Base {
  type: "blocks";
  value: _Block[];
}

export interface Costume extends Base {
  type: "costume";
  value: string;
}

export interface Backdrop extends Base {
  type: "backdrop";
  value: string;
}

export interface GraphicEffect extends Base {
  type: "graphicEffect";
  value: "COLOR" | "FISHEYE" | "WHIRL" | "PIXELATE" | "MOSAIC" | "BRIGHTNESS" | "GHOST";
}

export interface Sound extends Base {
  type: "sound";
  value: string;
}

export interface SoundEffect extends Base {
  type: "soundEffect";
  value: "PITCH" | "PAN";
}

export interface GoToTarget extends Base {
  type: "goToTarget";
  value: "_random_" | "_mouse_" | string;
}

export interface PointTowardsTarget extends Base {
  type: "pointTowardsTarget";
  value: string;
}

export interface RotationStyle extends Base {
  type: "rotationStyle";
  value: string;
}

// Deprecated field for "align scene" block.
export interface ScrollAlignment extends Base {
  type: "scrollAlignment";
  value: string;
}

export interface PenColorParam extends Base {
  type: "penColorParam";
  value: string;
}

export interface MusicDrum extends Base {
  type: "musicDrum";
  value: string;
}

export interface MusicInstrument extends Base {
  type: "musicInstrument";
  // There's technically only specific values this menu can take, but there's so many choices it doesn't seem reasonable to copy them all here.
  value: string;
}

export interface VideoSensingAttribute extends Base {
  type: "videoSensingAttribute";
  value: "motion" | "direction";
}

export interface VideoSensingSubject extends Base {
  type: "videoSensingSubject";
  value: "Stage" | "this sprite";
}

export interface VideoSensingVideoState extends Base {
  type: "videoSensingVideoState";
  value: "off" | "on" | "on-flipped";
}

export interface WeDo2MotorId extends Base {
  type: "wedo2MotorId";
  value: "motor" | "motor A" | "motor B" | "all motors";
}

export interface WeDo2MotorDirection extends Base {
  type: "wedo2MotorDirection";
  value: "this way" | "that way" | "reverse";
}

export interface WeDo2TiltDirection extends Base {
  type: "wedo2TiltDirection";
  value: "up" | "down" | "left" | "right";
}

export interface WeDo2TiltDirectionAny extends Base {
  type: "wedo2TiltDirectionAny";
  value: "up" | "down" | "left" | "right" | "any";
}

export interface WeDo2Op extends Base {
  type: "wedo2Op";
  value: "<" | ">";
}

export interface Key extends Base {
  type: "key";
  value:
    | "space"
    | "up arrow"
    | "down arrow"
    | "right arrow"
    | "left arrow"
    | "any"
    | "a"
    | "b"
    | "c"
    | "d"
    | "e"
    | "f"
    | "g"
    | "h"
    | "i"
    | "j"
    | "k"
    | "l"
    | "m"
    | "n"
    | "o"
    | "p"
    | "q"
    | "r"
    | "s"
    | "t"
    | "u"
    | "v"
    | "w"
    | "x"
    | "y"
    | "z"
    | "0"
    | "1"
    | "2"
    | "3"
    | "4"
    | "5"
    | "6"
    | "7"
    | "8"
    | "9";
}

export interface GreaterThanMenu extends Base {
  type: "greaterThanMenu";
  value: "LOUDNESS" | "TIMER";
}

export interface StopMenu extends Base {
  type: "stopMenu";
  value: "all" | "this script" | "other scripts in sprite";
}

export interface Target extends Base {
  type: "target";
  value: string;
}

export interface CloneTarget extends Base {
  type: "cloneTarget";
  value: string;
}

export interface TouchingTarget extends Base {
  type: "touchingTarget";
  value: "_mouse_" | string;
}

export interface DistanceToMenu extends Base {
  type: "distanceToMenu";
  value: string;
}

export interface DragModeMenu extends Base {
  type: "dragModeMenu";
  value: "draggable" | "not draggable";
}

export interface PropertyOfMenu extends Base {
  type: "propertyOfMenu";
  value: string;
}

export interface CurrentMenu extends Base {
  type: "currentMenu";
  value: "YEAR" | "MONTH" | "DATE" | "DAYOFWEEK" | "HOUR" | "MINUTE" | "SECOND";
}

export interface MathopMenu extends Base {
  type: "mathopMenu";
  value:
    | "abs"
    | "floor"
    | "ceiling"
    | "sqrt"
    | "sin"
    | "cos"
    | "tan"
    | "asin"
    | "acos"
    | "atan"
    | "ln"
    | "log"
    | "e ^"
    | "10 ^";
}

export interface FrontBackMenu extends Base {
  type: "frontBackMenu";
  value: "front" | "back";
}

export interface ForwardBackwardMenu extends Base {
  type: "forwardBackwardMenu";
  value: "forward" | "backward";
}

export interface CostumeNumberName extends Base {
  type: "costumeNumberName";
  value: "number" | "name";
}

export type CustomBlockArgument =
  | { type: "label"; name: string }
  | { type: "numberOrString"; name: string; defaultValue: string | number }
  | { type: "boolean"; name: string; defaultValue: boolean };

export interface CustomBlockArguments extends Base {
  type: "customBlockArguments";
  value: CustomBlockArgument[];
}

export interface CustomBlockInputValues extends Base {
  type: "customBlockInputValues";
  value: Array<Exclude<Any, CustomBlockInputValues>>;
}

export type FieldAny =
  | Costume
  | Backdrop
  | GraphicEffect
  | Sound
  | SoundEffect
  | GoToTarget
  | PointTowardsTarget
  | RotationStyle
  | ScrollAlignment
  | PenColorParam
  | MusicDrum
  | MusicInstrument
  | VideoSensingAttribute
  | VideoSensingSubject
  | VideoSensingVideoState
  | WeDo2MotorId
  | WeDo2MotorDirection
  | WeDo2TiltDirection
  | WeDo2TiltDirectionAny
  | WeDo2Op
  | Key
  | GreaterThanMenu
  | StopMenu
  | Target
  | CloneTarget
  | TouchingTarget
  | DistanceToMenu
  | DragModeMenu
  | PropertyOfMenu
  | CurrentMenu
  | MathopMenu
  | FrontBackMenu
  | ForwardBackwardMenu
  | CostumeNumberName;

/* eslint-disable @typescript-eslint/ban-types */
export type Any =
  | Number
  | String
  | Boolean
  | Angle
  | Color
  | Broadcast
  | Variable
  | List
  | Block
  | Blocks
  | CustomBlockArguments
  | CustomBlockInputValues
  | FieldAny;
