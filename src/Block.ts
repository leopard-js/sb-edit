import * as BlockInput from "./BlockInput";
import { OpCode } from "./OpCode";
import { generateId } from "./util/id";

interface DefaultInput {
  type: BlockInput.Any["type"];
  initial: any; // TODO: How to make this correspond to "type" above?
}

export class BlockBase<MyOpCode extends OpCode, MyInputs extends { [key: string]: BlockInput.Any }> {
  public static getDefaultInput(opcode: KnownBlock["opcode"], input: string): DefaultInput | void {
    return KnownBlockInputMap[opcode][input];
  }

  public static isKnownBlock(opcode: OpCode): opcode is KnownBlock["opcode"] {
    return opcode in KnownBlockInputMap;
  }

  public id: string;

  public opcode: MyOpCode;
  public inputs: MyInputs;

  public parent: string = null;
  public next: string = null;

  constructor(options: {
    id?: string;

    opcode: MyOpCode;
    inputs: MyInputs;

    parent?: string;
    next?: string
  }) {
    Object.assign(this, options);

    if (!this.id) {
      this.id = generateId();
    }
  }

  // TODO: Can we reference MyInputs here?
  public getDefaultInput(input: string): DefaultInput | void {
    if (this.isKnownBlock()) {
      return BlockBase.getDefaultInput(this.opcode, input);
    }
  }

  public isKnownBlock(): this is KnownBlock {
    return BlockBase.isKnownBlock(this.opcode);
  }

  get blocks(): Block[] {
    return [
      this as Block,
      ...Object.values(this.inputs).flatMap(input => {
        if (input.type === "block") {
          return input.value as BlockInput.Block["value"];
        } else if (input.type === "blocks") {
          return input.value;
        } else {
          return [];
        }
      })
    ];
  }

  get isHat(): boolean {
    const hatTypes: OpCode[] = [
      OpCode.event_whenflagclicked,
      OpCode.event_whenkeypressed,
      OpCode.event_whenthisspriteclicked,
      OpCode.event_whenstageclicked,
      OpCode.event_whenbackdropswitchesto,
      OpCode.event_whengreaterthan,
      OpCode.event_whenbroadcastreceived,
      OpCode.control_start_as_clone,
      OpCode.procedures_definition
    ];
    return hatTypes.includes(this.opcode);
  }
}

export type MotionBlock =
  | BlockBase<OpCode.motion_movesteps, { STEPS: BlockInput.Number }>
  | BlockBase<OpCode.motion_turnright, { DEGREES: BlockInput.Number }>
  | BlockBase<OpCode.motion_turnleft, { DEGREES: BlockInput.Number }>
  | BlockBase<OpCode.motion_goto, { TO: BlockInput.GoToTarget }>
  | BlockBase<OpCode.motion_gotoxy, { X: BlockInput.Number; Y: BlockInput.Number }>
  | BlockBase<OpCode.motion_glideto, { SECS: BlockInput.Number; TO: BlockInput.GoToTarget }>
  | BlockBase<OpCode.motion_glidesecstoxy, { SECS: BlockInput.Number; X: BlockInput.Number; Y: BlockInput.Number }>
  | BlockBase<OpCode.motion_pointindirection, { DIRECTION: BlockInput.Angle }>
  | BlockBase<OpCode.motion_pointtowards, { TOWARDS: BlockInput.PointTowardsTarget }>
  | BlockBase<OpCode.motion_changexby, { DX: BlockInput.Number }>
  | BlockBase<OpCode.motion_setx, { X: BlockInput.Number }>
  | BlockBase<OpCode.motion_changeyby, { DY: BlockInput.Number }>
  | BlockBase<OpCode.motion_sety, { Y: BlockInput.Number }>
  | BlockBase<OpCode.motion_ifonedgebounce, {}>
  | BlockBase<OpCode.motion_setrotationstyle, { STYLE: BlockInput.RotationStyle }>
  | BlockBase<OpCode.motion_xposition, {}>
  | BlockBase<OpCode.motion_yposition, {}>
  | BlockBase<OpCode.motion_direction, {}>;

export type LooksBlock =
  | BlockBase<OpCode.looks_sayforsecs, { MESSAGE: BlockInput.String; SECS: BlockInput.Number }>
  | BlockBase<OpCode.looks_say, { MESSAGE: BlockInput.String }>
  | BlockBase<OpCode.looks_thinkforsecs, { MESSAGE: BlockInput.String; SECS: BlockInput.Number }>
  | BlockBase<OpCode.looks_think, { MESSAGE: BlockInput.String }>
  | BlockBase<OpCode.looks_switchcostumeto, { COSTUME: BlockInput.Costume }>
  | BlockBase<OpCode.looks_nextcostume, {}>
  | BlockBase<OpCode.looks_switchbackdropto, { BACKDROP: BlockInput.Backdrop }>
  | BlockBase<OpCode.looks_nextbackdrop, {}>
  | BlockBase<OpCode.looks_changesizeby, { CHANGE: BlockInput.Number }>
  | BlockBase<OpCode.looks_setsizeto, { SIZE: BlockInput.Number }>
  | BlockBase<OpCode.looks_changeeffectby, { EFFECT: BlockInput.GraphicEffect; CHANGE: BlockInput.Number }>
  | BlockBase<OpCode.looks_seteffectto, { EFFECT: BlockInput.GraphicEffect; VALUE: BlockInput.Number }>
  | BlockBase<OpCode.looks_cleargraphiceffects, {}>
  | BlockBase<OpCode.looks_show, {}>
  | BlockBase<OpCode.looks_hide, {}>
  | BlockBase<OpCode.looks_gotofrontback, { FRONT_BACK: BlockInput.FrontBackMenu }>
  | BlockBase<
      OpCode.looks_goforwardbackwardlayers,
      { NUM: BlockInput.Number; FORWARD_BACKWARD: BlockInput.ForwardBackwardMenu }
    >
  | BlockBase<OpCode.looks_costumenumbername, { NUMBER_NAME: BlockInput.CostumeNumberName }>
  | BlockBase<OpCode.looks_backdropnumbername, { NUMBER_NAME: BlockInput.CostumeNumberName }>
  | BlockBase<OpCode.looks_size, {}>
  | BlockBase<OpCode.looks_hideallsprites, {}>
  | BlockBase<OpCode.looks_switchbackdroptoandwait, { BACKDROP: BlockInput.Backdrop }>
  | BlockBase<OpCode.looks_changestretchby, { CHANGE: BlockInput.Number }>
  | BlockBase<OpCode.looks_setstretchto, { STRETCH: BlockInput.Number }>;

export type SoundBlock =
  | BlockBase<OpCode.sound_playuntildone, { SOUND_MENU: BlockInput.Sound }>
  | BlockBase<OpCode.sound_play, { SOUND_MENU: BlockInput.Sound }>
  | BlockBase<OpCode.sound_stopallsounds, {}>
  | BlockBase<OpCode.sound_changeeffectby, { VALUE: BlockInput.Number; EFFECT: BlockInput.SoundEffect }>
  | BlockBase<OpCode.sound_seteffectto, { VALUE: BlockInput.Number; EFFECT: BlockInput.SoundEffect }>
  | BlockBase<OpCode.sound_cleareffects, {}>
  | BlockBase<OpCode.sound_changevolumeby, { VOLUME: BlockInput.Number }>
  | BlockBase<OpCode.sound_setvolumeto, { VOLUME: BlockInput.Number }>
  | BlockBase<OpCode.sound_volume, {}>;

export type EventBlock =
  | BlockBase<OpCode.event_whenflagclicked, {}>
  | BlockBase<OpCode.event_whenkeypressed, { KEY_OPTION: BlockInput.Key }>
  | BlockBase<OpCode.event_whenthisspriteclicked, {}>
  | BlockBase<OpCode.event_whenstageclicked, {}>
  | BlockBase<OpCode.event_whenbackdropswitchesto, { BACKDROP: BlockInput.Backdrop }>
  | BlockBase<
      OpCode.event_whengreaterthan,
      { VALUE: BlockInput.Number; WHENGREATERTHANMENU: BlockInput.GreaterThanMenu }
    >
  | BlockBase<OpCode.event_whenbroadcastreceived, { BROADCAST_OPTION: BlockInput.Broadcast }>
  | BlockBase<OpCode.event_broadcast, { BROADCAST_INPUT: BlockInput.Broadcast }>
  | BlockBase<OpCode.event_broadcastandwait, { BROADCAST_INPUT: BlockInput.Broadcast }>

export type ControlBlock =
  | BlockBase<OpCode.control_wait, { DURATION: BlockInput.Number }>
  | BlockBase<OpCode.control_repeat, { TIMES: BlockInput.Number; SUBSTACK: BlockInput.Blocks }>
  | BlockBase<OpCode.control_forever, { SUBSTACK: BlockInput.Blocks }>
  | BlockBase<OpCode.control_if, { CONDITION: BlockInput.Boolean; SUBSTACK: BlockInput.Blocks }>
  | BlockBase<
      OpCode.control_if_else,
      { CONDITION: BlockInput.Boolean; SUBSTACK: BlockInput.Blocks; SUBSTACK2: BlockInput.Blocks }
    >
  | BlockBase<OpCode.control_wait_until, { CONDITION: BlockInput.Boolean }>
  | BlockBase<OpCode.control_repeat_until, { CONDITION: BlockInput.Boolean; SUBSTACK: BlockInput.Blocks }>
  | BlockBase<OpCode.control_stop, { STOP_OPTION: BlockInput.StopMenu }>
  | BlockBase<OpCode.control_start_as_clone, {}>
  | BlockBase<OpCode.control_create_clone_of, { CLONE_OPTION: BlockInput.CloneTarget }>
  | BlockBase<OpCode.control_delete_this_clone, {}>
  | BlockBase<OpCode.control_all_at_once, { SUBSTACK: BlockInput.Blocks }>
  | BlockBase<
      OpCode.control_for_each,
      { VARIABLE: BlockInput.Variable; VALUE: BlockInput.Number; SUBSTACK: BlockInput.Blocks }
    >
  | BlockBase<OpCode.control_while, { CONDITION: BlockInput.Boolean; SUBSTACK: BlockInput.Blocks }>

export type SensingBlock =
  | BlockBase<OpCode.sensing_touchingobject, { TOUCHINGOBJECTMENU: BlockInput.TouchingTarget }>
  | BlockBase<OpCode.sensing_touchingcolor, { COLOR: BlockInput.Color }>
  | BlockBase<OpCode.sensing_coloristouchingcolor, { COLOR: BlockInput.Color; COLOR2: BlockInput.Color }>
  | BlockBase<OpCode.sensing_distanceto, { DISTANCETOMENU: BlockInput.DistanceToMenu }>
  | BlockBase<OpCode.sensing_askandwait, { QUESTION: BlockInput.String }>
  | BlockBase<OpCode.sensing_answer, {}>
  | BlockBase<OpCode.sensing_keypressed, { KEY_OPTION: BlockInput.Key }>
  | BlockBase<OpCode.sensing_mousedown, {}>
  | BlockBase<OpCode.sensing_mousex, {}>
  | BlockBase<OpCode.sensing_mousey, {}>
  | BlockBase<OpCode.sensing_setdragmode, { DRAG_MODE: BlockInput.DragModeMenu }>
  | BlockBase<OpCode.sensing_loudness, {}>
  | BlockBase<OpCode.sensing_loud, {}>
  | BlockBase<OpCode.sensing_timer, {}>
  | BlockBase<OpCode.sensing_resettimer, {}>
  | BlockBase<OpCode.sensing_of, { OBJECT: BlockInput.Target; PROPERTY: BlockInput.PropertyOfMenu }>
  | BlockBase<OpCode.sensing_current, { CURRENTMENU: BlockInput.CurrentMenu }>
  | BlockBase<OpCode.sensing_dayssince2000, {}>
  | BlockBase<OpCode.sensing_username, {}>
  | BlockBase<OpCode.sensing_userid, {}>

export type OperatorBlock =
  | BlockBase<OpCode.operator_add, { NUM1: BlockInput.Number; NUM2: BlockInput.Number }>
  | BlockBase<OpCode.operator_subtract, { NUM1: BlockInput.Number; NUM2: BlockInput.Number }>
  | BlockBase<OpCode.operator_multiply, { NUM1: BlockInput.Number; NUM2: BlockInput.Number }>
  | BlockBase<OpCode.operator_divide, { NUM1: BlockInput.Number; NUM2: BlockInput.Number }>
  | BlockBase<OpCode.operator_random, { FROM: BlockInput.Number; TO: BlockInput.Number }>
  | BlockBase<OpCode.operator_gt, { OPERAND1: BlockInput.Number; OPERAND2: BlockInput.Number }>
  | BlockBase<OpCode.operator_lt, { OPERAND1: BlockInput.Number; OPERAND2: BlockInput.Number }>
  | BlockBase<OpCode.operator_equals, { OPERAND1: BlockInput.Number; OPERAND2: BlockInput.Number }>
  | BlockBase<OpCode.operator_and, { OPERAND1: BlockInput.Boolean; OPERAND2: BlockInput.Boolean }>
  | BlockBase<OpCode.operator_or, { OPERAND1: BlockInput.Boolean; OPERAND2: BlockInput.Boolean }>
  | BlockBase<OpCode.operator_not, { OPERAND: BlockInput.Boolean }>
  | BlockBase<OpCode.operator_join, { STRING1: BlockInput.String; STRING2: BlockInput.String }>
  | BlockBase<OpCode.operator_letter_of, { LETTER: BlockInput.Number; STRING: BlockInput.String }>
  | BlockBase<OpCode.operator_length, { STRING: BlockInput.String }>
  | BlockBase<OpCode.operator_contains, { STRING1: BlockInput.String; STRING2: BlockInput.String }>
  | BlockBase<OpCode.operator_mod, { NUM1: BlockInput.Number; NUM2: BlockInput.Number }>
  | BlockBase<OpCode.operator_round, { NUM: BlockInput.Number }>
  | BlockBase<OpCode.operator_mathop, { OPERATOR: BlockInput.MathopMenu; NUM: BlockInput.Number }>

export type DataBlock =
  | BlockBase<OpCode.data_variable, { VARIABLE: BlockInput.Variable }>
  | BlockBase<OpCode.data_setvariableto, { VARIABLE: BlockInput.Variable; VALUE: BlockInput.String }>
  | BlockBase<OpCode.data_changevariableby, { VARIABLE: BlockInput.Variable; VALUE: BlockInput.Number }>
  | BlockBase<OpCode.data_showvariable, { VARIABLE: BlockInput.Variable }>
  | BlockBase<OpCode.data_hidevariable, { VARIABLE: BlockInput.Variable }>
  | BlockBase<OpCode.data_listcontents, { LIST: BlockInput.List }>
  | BlockBase<OpCode.data_addtolist, { LIST: BlockInput.List; ITEM: BlockInput.String }>
  | BlockBase<OpCode.data_deleteoflist, { LIST: BlockInput.List; INDEX: BlockInput.Number }>
  | BlockBase<OpCode.data_deletealloflist, { LIST: BlockInput.List }>
  | BlockBase<OpCode.data_insertatlist, { LIST: BlockInput.List; INDEX: BlockInput.Number; ITEM: BlockInput.String }>
  | BlockBase<
      OpCode.data_replaceitemoflist,
      { LIST: BlockInput.List; INDEX: BlockInput.Number; ITEM: BlockInput.String }
    >
  | BlockBase<OpCode.data_itemoflist, { LIST: BlockInput.List; INDEX: BlockInput.Number }>
  | BlockBase<OpCode.data_itemnumoflist, { LIST: BlockInput.List; ITEM: BlockInput.String }>
  | BlockBase<OpCode.data_lengthoflist, { LIST: BlockInput.List }>
  | BlockBase<OpCode.data_listcontainsitem, { LIST: BlockInput.List; ITEM: BlockInput.String }>
  | BlockBase<OpCode.data_showlist, { LIST: BlockInput.List }>
  | BlockBase<OpCode.data_hidelist, { LIST: BlockInput.List }>;

export type ProcedureBlock =
  | BlockBase<
      OpCode.procedures_definition,
      { PROCCODE: BlockInput.String; ARGUMENTS: BlockInput.CustomBlockArguments; WARP: BlockInput.Boolean }
    >
  | BlockBase<OpCode.procedures_call, { PROCCODE: BlockInput.String; INPUTS: BlockInput.CustomBlockInputValues }>;

export type ArgumentBlock =
  | BlockBase<OpCode.argument_reporter_string_number, { VALUE: BlockInput.String }>
  | BlockBase<OpCode.argument_reporter_boolean, { VALUE: BlockInput.String }>;

export type CustomBlock =
  | ProcedureBlock
  | ArgumentBlock;

export type MusicBlock =
  | BlockBase<OpCode.music_playDrumForBeats, { DRUM: BlockInput.MusicDrum, BEATS: BlockInput.Number }>
  | BlockBase<OpCode.music_restForBeats, { BEATS: BlockInput.Number }>
  | BlockBase<OpCode.music_playNoteForBeats, { NOTE: BlockInput.MusicInstrument, BEATS: BlockInput.Number }>
  | BlockBase<OpCode.music_setInstrument, { INSTRUMENT: BlockInput.Number }>
  | BlockBase<OpCode.music_setTempo, { TEMPO: BlockInput.Number }>
  | BlockBase<OpCode.music_changeTempo, { TEMPO: BlockInput.Number }>
  | BlockBase<OpCode.music_getTempo, {}>
  // Deprecated:
  | BlockBase<OpCode.music_midiPlayDrumForBeats, { DRUM: BlockInput.Number, BEATS: BlockInput.Number }>
  | BlockBase<OpCode.music_midiSetInstrument, { INSTRUMENT: BlockInput.Number }>

export type PenBlock =
  | BlockBase<OpCode.pen_clear, {}>
  | BlockBase<OpCode.pen_stamp, {}>
  | BlockBase<OpCode.pen_penDown, {}>
  | BlockBase<OpCode.pen_penUp, {}>
  | BlockBase<OpCode.pen_setPenColorToColor, { COLOR: BlockInput.Color }>
  | BlockBase<OpCode.pen_changePenColorParamBy, { colorParam: BlockInput.PenColorParam; VALUE: BlockInput.Number }>
  | BlockBase<OpCode.pen_setPenColorParamTo, { colorParam: BlockInput.PenColorParam; VALUE: BlockInput.Number }>
  | BlockBase<OpCode.pen_changePenSizeBy, { SIZE: BlockInput.Number }>
  | BlockBase<OpCode.pen_setPenSizeTo, { SIZE: BlockInput.Number }>
  // Deprecated:
  | BlockBase<OpCode.pen_setPenShadeToNumber, { SHADE: BlockInput.Number }>
  | BlockBase<OpCode.pen_changePenShadeBy, { SHADE: BlockInput.Number }>
  | BlockBase<OpCode.pen_setPenHueToNumber, { HUE: BlockInput.Number }>
  | BlockBase<OpCode.pen_changePenHueBy, { HUE: BlockInput.Number }>;

export type ExtensionBlock =
  | MusicBlock
  | PenBlock

export type KnownBlock =
  | MotionBlock
  | LooksBlock
  | SoundBlock
  | EventBlock
  | ControlBlock
  | SensingBlock
  | OperatorBlock
  | DataBlock
  | CustomBlock
  | ExtensionBlock;

// TODO: This is largely a copy of the above data, formatted as a runtime
// constant instead of as type information. Is it possible to construct a type
// from the value of this mapping? I don't know enough ts-fu to risk doing so
// in some way that seems to function as it's supposed to but actually isn't
// carrying type information correctly.
const KnownBlockInputMap: {
  [key in KnownBlock["opcode"]]: {
    [inputName: string]: DefaultInput
  }
} = {
  // Motion
  [OpCode.motion_movesteps]: {
    STEPS: {type: "number", initial: 10}
  },
  [OpCode.motion_turnright]: {
    DEGREES: {type: "number", initial: 15}
  },
  [OpCode.motion_turnleft]: {
    DEGREES: {type: "number", initial: 15}
  },
  [OpCode.motion_goto]: {
    TO: {type: "goToTarget", initial: "_random_"}
  },
  [OpCode.motion_gotoxy]: {
    X: {type: "number", initial: 0},
    Y: {type: "number", initial: 0}
  },
  [OpCode.motion_glideto]: {
    SECS: {type: "number", initial: 1},
    TO: {type: "goToTarget", initial: "_random_"}
  },
  [OpCode.motion_glidesecstoxy]: {
    SECS: {type: "number", initial: 1},
    X: {type: "number", initial: 0},
    Y: {type: "number", initial: 0}
  },
  [OpCode.motion_pointindirection]: {
    DIRECTION: {type: "angle", initial: 90}
  },
  [OpCode.motion_pointtowards]: {
    TOWARDS: {type: "pointTowardsTarget", initial: "_mouse_"}
  },
  [OpCode.motion_changexby]: {
    DX: {type: "number", initial: 10}
  },
  [OpCode.motion_setx]: {
    X: {type: "number", initial: 0}
  },
  [OpCode.motion_changeyby]: {
    DY: {type: "number", initial: 10}
  },
  [OpCode.motion_sety]: {
    Y: {type: "number", initial: 0}
  },
  [OpCode.motion_ifonedgebounce]: {},
  [OpCode.motion_setrotationstyle]: {
    STYLE: {type: "rotationStyle", initial: "leftRight"}
  },
  [OpCode.motion_xposition]: {},
  [OpCode.motion_yposition]: {},
  [OpCode.motion_direction]: {},

  // Looks
  [OpCode.looks_sayforsecs]: {
    MESSAGE: {type: "string", initial: "Hello!"},
    SECS: {type: "number", initial: 2}
  },
  [OpCode.looks_say]: {
    MESSAGE: {type: "string", initial: "Hello!"}
  },
  [OpCode.looks_thinkforsecs]: {
    MESSAGE: {type: "string", initial: "Hmm..."},
    SECS: {type: "number", initial: 2}
  },
  [OpCode.looks_think]: {
    MESSAGE: {type: "string", initial: "Hmmm..."}
  },
  [OpCode.looks_switchcostumeto]: {
    COSTUME: {type: "costume", initial: "costume1"}
  },
  [OpCode.looks_nextcostume]: {},
  [OpCode.looks_switchbackdropto]: {
    BACKDROP: {type: "backdrop", initial: "backdrop1"}
  },
  [OpCode.looks_nextbackdrop]: {},
  [OpCode.looks_changesizeby]: {
    CHANGE: {type: "number", initial: 10}
  },
  [OpCode.looks_setsizeto]: {
    SIZE: {type: "number", initial: 100}
  },
  [OpCode.looks_changeeffectby]: {
    EFFECT: {type: "graphicEffect", initial: "COLOR"},
    CHANGE: {type: "number", initial: 25}
  },
  [OpCode.looks_seteffectto]: {
    EFFECT: {type: "graphicEffect", initial: "COLOR"},
    VALUE: {type: "number", initial: 0}
  },
  [OpCode.looks_cleargraphiceffects]: {},
  [OpCode.looks_show]: {},
  [OpCode.looks_hide]: {},
  [OpCode.looks_gotofrontback]: {
    FRONT_BACK: {type: "frontBackMenu", initial: "front"}
  },
  [OpCode.looks_goforwardbackwardlayers]: {
    FORWARD_BACKWARD: {type: "forwardBackwardMenu", initial: "forward"},
    NUM: {type: "number", initial: 1}
  },
  [OpCode.looks_costumenumbername]: {
    NUMBER_NAME: {type: "costumeNumberName", initial: "number"}
  },
  [OpCode.looks_backdropnumbername]: {
    NUMBER_NAME: {type: "costumeNumberName", initial: "number"}
  },
  [OpCode.looks_size]: {},
  [OpCode.looks_hideallsprites]: {},
  [OpCode.looks_switchbackdroptoandwait]: {
    BACKDROP: {type: "backdrop", initial: "backdrop1"}
  },
  [OpCode.looks_changestretchby]: {
    CHANGE: {type: "number", initial: 10}
  },
  [OpCode.looks_setstretchto]: {
    STRETCH: {type: "number", initial: 0}
  },

  // Sound
  [OpCode.sound_playuntildone]: {
    SOUND_MENU: {type: "sound", initial: "pop"}
  },
  [OpCode.sound_play]: {
    SOUND_MENU: {type: "sound", initial: "sound"}
  },
  [OpCode.sound_stopallsounds]: {},
  [OpCode.sound_changeeffectby]: {
    EFFECT: {type: "soundEffect", initial: "PITCH"},
    VALUE: {type: "number", initial: 10}
  },
  [OpCode.sound_seteffectto]: {
    EFFECT: {type: "soundEffect", initial: "PITCH"},
    VALUE: {type: "number", initial: 0}
  },
  [OpCode.sound_cleareffects]: {},
  [OpCode.sound_changevolumeby]: {
    VOLUME: {type: "number", initial: -10}
  },
  [OpCode.sound_setvolumeto]: {
    VOLUME: {type: "number", initial: 100}
  },
  [OpCode.sound_volume]: {},

  // Events
  [OpCode.event_whenflagclicked]: {},
  [OpCode.event_whenkeypressed]: {
    KEY_OPTION: {type: "key", initial: "space"}
  },
  [OpCode.event_whenthisspriteclicked]: {},
  [OpCode.event_whenstageclicked]: {},
  [OpCode.event_whenbackdropswitchesto]: {
    BACKDROP: {type: "backdrop", initial: "backdrop1"}
  },
  [OpCode.event_whengreaterthan]: {
    WHENGREATERTHANMENU: {type: "greaterThanMenu", initial: "LOUDNESS"},
    VALUE: {type: "number", initial: 10}
  },
  [OpCode.event_whenbroadcastreceived]: {
    BROADCAST_OPTION: {type: "broadcast", initial: "message1"}
  },
  [OpCode.event_broadcast]: {
    BROADCAST_INPUT: {type: "broadcast", initial: "message1"}
  },
  [OpCode.event_broadcastandwait]: {
    BROADCAST_INPUT: {type: "broadcast", initial: "message1"}
  },

  // Control
  [OpCode.control_wait]: {
    DURATION: {type: "number", initial: 1}
  },
  [OpCode.control_repeat]: {
    TIMES: {type: "number", initial: 10},
    SUBSTACK: {type: "blocks", initial: null}
  },
  [OpCode.control_forever]: {
    SUBSTACK: {type: "blocks", initial: null}
  },
  [OpCode.control_if]: {
    CONDITION: {type: "boolean", initial: false},
    SUBSTACK: {type: "blocks", initial: null}
  },
  [OpCode.control_if_else]: {
    CONDITION: {type: "boolean", initial: false},
    SUBSTACK: {type: "blocks", initial: null},
    SUBSTACK2: {type: "blocks", initial: null}
  },
  [OpCode.control_wait_until]: {
    CONDITION: {type: "boolean", initial: false}
  },
  [OpCode.control_repeat_until]: {
    CONDITION: {type: "boolean", initial: false},
    SUBSTACK: {type: "blocks", initial: null}
  },
  [OpCode.control_stop]: {
    STOP_OPTION: {type: "stopMenu", initial: "all"}
  },
  [OpCode.control_start_as_clone]: {},
  [OpCode.control_create_clone_of]: {
    CLONE_OPTION: {type: "cloneTarget", initial: "_myself_"}
  },
  [OpCode.control_delete_this_clone]: {},
  [OpCode.control_all_at_once]: {
    SUBSTACK: {type: "blocks", initial: null}
  },
  [OpCode.control_for_each]: {
    VARIABLE: {type: "variable", initial: "i"},
    VALUE: {type: "number", initial: 10},
    SUBSTACK: {type: "blocks", initial: null}
  },
  [OpCode.control_while]: {
    CONDITION: {type: "boolean", initial: "false"},
    SUBSTACK: {type: "blocks", initial: null}
  },

  // Sensing
  [OpCode.sensing_touchingobject]: {
    TOUCHINGOBJECTMENU: {type: "touchingTarget", initial: "_mouse_"}
  },
  [OpCode.sensing_touchingcolor]: {
    COLOR: {type: "color", initial: "#9966ff"}
  },
  [OpCode.sensing_coloristouchingcolor]: {
    COLOR: {type: "color", initial: "#9966ff"},
    COLOR2: {type: "color", initial: "#ffab19"}
  },
  [OpCode.sensing_distanceto]: {
    DISTANCETOMENU: {type: "distanceToMenu", initial: "_mouse_"}
  },
  [OpCode.sensing_askandwait]: {
    QUESTION: {type: "string", initial: "What's your name?"}
  },
  [OpCode.sensing_answer]: {},
  [OpCode.sensing_keypressed]: {
    KEY_OPTION: {type: "key", initial: "space"}
  },
  [OpCode.sensing_mousedown]: {},
  [OpCode.sensing_mousex]: {},
  [OpCode.sensing_mousey]: {},
  [OpCode.sensing_setdragmode]: {
    DRAG_MODE: {type: "dragModeMenu", initial: false}
  },
  [OpCode.sensing_loudness]: {},
  [OpCode.sensing_loud]: {},
  [OpCode.sensing_timer]: {},
  [OpCode.sensing_resettimer]: {},
  [OpCode.sensing_of]: {
    PROPERTY: {type: "propertyOfMenu", initial: "backdrop #"},
    OBJECT: {type: "target", initial: "_stage_"}
  },
  [OpCode.sensing_current]: {
    CURRENTMENU: {type: "currentMenu", initial: "YEAR"}
  },
  [OpCode.sensing_dayssince2000]: {},
  [OpCode.sensing_username]: {},
  [OpCode.sensing_userid]: {},

  // Operators
  [OpCode.operator_add]: {
    NUM1: {type: "number", initial: ""},
    NUM2: {type: "number", initial: ""}
  },
  [OpCode.operator_subtract]: {
    NUM1: {type: "number", initial: ""},
    NUM2: {type: "number", initial: ""}
  },
  [OpCode.operator_multiply]: {
    NUM1: {type: "number", initial: ""},
    NUM2: {type: "number", initial: ""}
  },
  [OpCode.operator_divide]: {
    NUM1: {type: "number", initial: ""},
    NUM2: {type: "number", initial: ""}
  },
  [OpCode.operator_random]: {
    FROM: {type: "number", initial: 1},
    TO: {type: "number", initial: 10}
  },
  [OpCode.operator_gt]: {
    OPERAND1: {type: "number", initial: ""},
    OPERAND2: {type: "number", initial: 50}
  },
  [OpCode.operator_lt]: {
    OPERAND1: {type: "number", initial: ""},
    OPERAND2: {type: "number", initial: 50}
  },
  [OpCode.operator_equals]: {
    OPERAND1: {type: "number", initial: ""},
    OPERAND2: {type: "number", initial: 50}
  },
  [OpCode.operator_and]: {
    OPERAND1: {type: "boolean", initial: false},
    OPERAND2: {type: "boolean", initial: false}
  },
  [OpCode.operator_or]: {
    OPERAND1: {type: "boolean", initial: false},
    OPERAND2: {type: "boolean", initial: false}
  },
  [OpCode.operator_not]: {
    OPERAND: {type: "boolean", initial: false}
  },
  [OpCode.operator_join]: {
    STRING1: {type: "string", initial: "apple "},
    STRING2: {type: "string", initial: "banana"}
  },
  [OpCode.operator_letter_of]: {
    LETTER: {type: "number", initial: 1},
    STRING: {type: "string", initial: "apple"}
  },
  [OpCode.operator_length]: {
    STRING: {type: "string", initial: "apple"}
  },
  [OpCode.operator_contains]: {
    STRING1: {type: "string", initial: "apple"},
    STRING2: {type: "string", initial: "a"}
  },
  [OpCode.operator_mod]: {
    NUM1: {type: "number", initial: ""},
    NUM2: {type: "number", initial: ""}
  },
  [OpCode.operator_round]: {
    NUM: {type: "number", initial: ""}
  },
  [OpCode.operator_mathop]: {
    OPERATOR: {type: "mathopMenu", initial: "abs"},
    NUM: {type: "number", initial: ""}
  },

  // Data
  [OpCode.data_variable]: {
    VARIABLE: {type: "variable", initial: "my variable"}
  },
  [OpCode.data_setvariableto]: {
    VARIABLE: {type: "variable", initial: "my variable"},
    VALUE: {type: "string", initial: "0"}
  },
  [OpCode.data_changevariableby]: {
    VARIABLE: {type: "variable", initial: "my variable"},
    VALUE: {type: "number", initial: 1}
  },
  [OpCode.data_showvariable]: {
    VARIABLE: {type: "variable", initial: "my variable"}
  },
  [OpCode.data_hidevariable]: {
    VARIABLE: {type: "variable", initial: "my variable"}
  },
  [OpCode.data_listcontents]: {
    LIST: {type: "list", initial: "my list"}
  },
  [OpCode.data_addtolist]: {
    ITEM: {type: "string", initial: "thing"},
    LIST: {type: "list", initial: "my list"}
  },
  [OpCode.data_deleteoflist]: {
    INDEX: {type: "number", initial: 1},
    LIST: {type: "list", initial: "my list"}
  },
  [OpCode.data_deletealloflist]: {
    LIST: {type: "list", initial: "my list"}
  },
  [OpCode.data_insertatlist]: {
    ITEM: {type: "string", initial: "thing"},
    INDEX: {type: "number", initial: 1},
    LIST: {type: "list", initial: "my list"}
  },
  [OpCode.data_replaceitemoflist]:{
    INDEX: {type: "number", initial: 1},
    LIST: {type: "list", initial: "my list"},
    ITEM: {type: "string", initial: "thing"}
  },
  [OpCode.data_itemoflist]: {
    INDEX: {type: "number", initial: 1},
    LIST: {type: "list", initial: "my list"}
  },
  [OpCode.data_itemnumoflist]: {
    ITEM: {type: "string", initial: "thing"},
    LIST: {type: "list", initial: "my list"}
  },
  [OpCode.data_lengthoflist]: {
    LIST: {type: "list", initial: "my list"}
  },
  [OpCode.data_listcontainsitem]: {
    LIST: {type: "list", initial: "my list"},
    ITEM: {type: "string", initial: "thing"}
  },
  [OpCode.data_showlist]: {
    LIST: {type: "list", initial: "my list"}
  },
  [OpCode.data_hidelist]: {
    LIST: {type: "list", initial: "my list"}
  },

  // Custom Blocks
  [OpCode.procedures_definition]:{
    PROCCODE: {type: "string", initial: "hello"},
    ARGUMENTS: {type: "customBlockArguments", initial: [
      {type: "label", name: "hello"},
      {type: "numberOrString", name: "who"},
      {type: "boolean", name: "casually"}
    ]},
    WARP: {type: "boolean", initial: false}
  },
  [OpCode.procedures_call]: {
    PROCCODE: {type: "string", initial: "hello"},
    INPUTS: {type: "customBlockInputValues", initial: ["world", true]}
  },
  [OpCode.argument_reporter_string_number]: {
    VALUE: {type: "string", initial: "who"}
  },
  [OpCode.argument_reporter_boolean]: {
    VALUE: {type: "string", initial: "casually"}
  },

  // Extension: Music
  [OpCode.music_playDrumForBeats]: {
    DRUM: {type: "musicDrum", initial: 1},
    BEATS: {type: "number", initial: 0.25}
  },
  [OpCode.music_restForBeats]: {
    BEATS: {type: "number", initial: 0.25}
  },
  [OpCode.music_playNoteForBeats]: {
    NOTE: {type: "number", initial: 60},
    BEATS: {type: "number", initial: 0.25}
  },
  [OpCode.music_setInstrument]: {
    INSTRUMENT: {type: "musicInstrument", initial: 1}
  },
  [OpCode.music_setTempo]: {
    TEMPO: {type: "number", initial: 60}
  },
  [OpCode.music_changeTempo]: {
    TEMPO: {type: "number", initial: 20}
  },
  [OpCode.music_getTempo]: {},
  // Deprecated:
  [OpCode.music_midiPlayDrumForBeats]: {
    DRUM: {type: "number", initial: 1},
    BEATS: {type: "number", initial: 0.25}
  },
  [OpCode.music_midiSetInstrument]: {
    INSTRUMENT: {type: "number", initial: 1}
  },

  // Extension: Pen
  [OpCode.pen_clear]: {},
  [OpCode.pen_stamp]: {},
  [OpCode.pen_penDown]: {},
  [OpCode.pen_penUp]: {},
  [OpCode.pen_setPenColorToColor]: {
    COLOR: {type: "color", initial: "#9966ff"}
  },
  [OpCode.pen_changePenColorParamBy]: {
    colorParam: {type: "penColorParam", initial: "color"},
    VALUE: {type: "number", initial: 10}
  },
  [OpCode.pen_setPenColorParamTo]: {
    colorParam: {type: "penColorParam", initial: "color"},
    VALUE: {type: "number", initial: 50}
  },
  [OpCode.pen_changePenSizeBy]: {
    SIZE: {type: "number", initial: 1}
  },
  [OpCode.pen_setPenSizeTo]: {
    SIZE: {type: "number", initial: 1}
  },
  // Deprecated:
  [OpCode.pen_setPenShadeToNumber]: {
    SHADE: {type: "number", initial: 50}
  },
  [OpCode.pen_changePenShadeBy]: {
    SHADE: {type: "number", initial: 10}
  },
  [OpCode.pen_setPenHueToNumber]: {
    HUE: {type: "number", initial: 0}
  },
  [OpCode.pen_changePenHueBy]: {
    HUE: {type: "number", initial: 10}
  }
}

export type UnknownBlock = BlockBase<Exclude<OpCode, KnownBlock["opcode"]>, { [key: string]: BlockInput.Any }>;

// TODO: This method of defining `Block` provides excellent autocomplete
// sugguestions but seems to make the Typescript compiler work very hard.
// Is there a better way?
export type Block = KnownBlock | UnknownBlock;

export default Block;
