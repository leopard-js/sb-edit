import * as BlockInput from "./BlockInput";
import { OpCode } from "./OpCode";
import { generateId } from "./util/id";

export class BlockBase<MyOpCode extends OpCode, MyInputs extends { [key: string]: BlockInput.Any }> {
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

export type KnownBlock =
  // Motion
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
  | BlockBase<OpCode.motion_direction, {}>

  // Looks
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
  | BlockBase<OpCode.looks_setstretchto, { STRETCH: BlockInput.Number }>

  // Sound
  | BlockBase<OpCode.sound_playuntildone, { SOUND_MENU: BlockInput.Sound }>
  | BlockBase<OpCode.sound_play, { SOUND_MENU: BlockInput.Sound }>
  | BlockBase<OpCode.sound_stopallsounds, {}>
  | BlockBase<OpCode.sound_changeeffectby, { VALUE: BlockInput.Number; EFFECT: BlockInput.SoundEffect }>
  | BlockBase<OpCode.sound_seteffectto, { VALUE: BlockInput.Number; EFFECT: BlockInput.SoundEffect }>
  | BlockBase<OpCode.sound_cleareffects, {}>
  | BlockBase<OpCode.sound_changevolumeby, { VOLUME: BlockInput.Number }>
  | BlockBase<OpCode.sound_setvolumeto, { VOLUME: BlockInput.Number }>
  | BlockBase<OpCode.sound_volume, {}>

  // Events
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

  // Control
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

  // Sensing
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

  // Operators
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

  // Data
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
  | BlockBase<OpCode.data_hidelist, { LIST: BlockInput.List }>

  // Custom Blocks
  | BlockBase<
      OpCode.procedures_definition,
      { PROCCODE: BlockInput.String; ARGUMENTS: BlockInput.CustomBlockArguments; WARP: BlockInput.Boolean }
    >
  | BlockBase<OpCode.procedures_call, { PROCCODE: BlockInput.String; INPUTS: BlockInput.CustomBlockInputValues }>
  | BlockBase<OpCode.argument_reporter_string_number, { VALUE: BlockInput.String }>
  | BlockBase<OpCode.argument_reporter_boolean, { VALUE: BlockInput.String }>

  // Extension: Pen
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

export type UnknownBlock = BlockBase<Exclude<OpCode, KnownBlock["opcode"]>, { [key: string]: BlockInput.Any }>;

// TODO: This method of defining `Block` provides excellent autocomplete
// sugguestions but seems to make the Typescript compiler work very hard.
// Is there a better way?
export type Block = KnownBlock | UnknownBlock;

export default Block;
