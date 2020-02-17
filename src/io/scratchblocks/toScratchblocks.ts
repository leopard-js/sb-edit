import Project from "../../Project";
import Script from "../../Script";
import Target from "../../Target";
import Block from "../../Block";
import * as BlockInput from "../../BlockInput";
import { OpCode } from "../../OpCode";

interface ToScratchblocksOptions {
  indent: string;
}

export default function toScratchblocks(
  options: Partial<ToScratchblocksOptions> = {}
): { [targetName: string]: string } {
  const project: Project = this;

  const defaultOptions: ToScratchblocksOptions = {
    indent: "\t"
  };
  options = { ...defaultOptions, ...options };

  function indent(str: string): string {
    return str
      .split("\n")
      .map(l => options.indent + l)
      .join("\n");
  }

  function input(inp: BlockInput.Any, target: Target, flag: boolean = false): string {
    if (!inp) {
      return "";
    }

    const escape = (value: string): string => (value || "").toString().replace(/[()\[\]]|v$/g, m => "\\" + m);

    switch (inp.type) {
      case "number":
        if (typeof inp.value === "number" || inp.value.trim().length === 0) {
          return `(${inp.value})`;
        } else {
          return `[${escape(inp.value)}]`;
        }

      case "angle":
        return `(${inp.value || ""})`;

      case "string":
        return `[${escape(inp.value)}]`;

      case "graphicEffect":
      case "soundEffect":
      case "currentMenu":
      case "greaterThanMenu":
        const value =
          {
            PAN: "pan left/right",
            DAYOFWEEK: "day of week"
          }[inp.value] || (inp.value || "").toLowerCase();
        return `[${escape(value)} v]`;

      case "variable":
      case "list":
      case "rotationStyle":
      case "scrollAlignment":
      case "stopMenu":
      case "dragModeMenu":
      case "propertyOfMenu":
      case "mathopMenu":
      case "frontBackMenu":
      case "forwardBackwardMenu":
      case "costumeNumberName":
        return `[${escape(inp.value)} v]`;

      case "goToTarget":
      case "pointTowardsTarget":
      case "cloneTarget":
      case "distanceToMenu":
      case "touchingTarget":
      case "target": {
        const value =
          {
            _mouse_: "mouse-pointer",
            _myself_: "myself",
            _random_: "random position",
            _stage_: "Stage"
          }[inp.value] || inp.value;
        return `(${escape(value)} v)`;
      }

      case "costume":
      case "sound":
      case "penColorParam":
      case "musicDrum":
      case "musicInstrument":
      case "videoSensingAttribute":
      case "videoSensingSubject":
      case "videoSensingVideoState":
        return `(${escape(inp.value)} v)`;

      case "broadcast":
      case "backdrop":
      case "key":
        if (flag) {
          return `[${escape(inp.value)} v]`;
        } else {
          return `(${escape(inp.value)} v)`;
        }

      case "color":
        const hex = (k: string): string => (inp.value || { r: 0, g: 0, b: 0 })[k].toString(16).padStart(2, "0");
        return `[#${hex("r") + hex("g") + hex("b")}]`;

      case "block":
        if (flag) {
          if (inp.value) {
            return "\n" + indent(blockToScratchblocks(inp.value, target)) + "\n";
          } else {
            return "\n";
          }
        } else {
          if (inp.value) {
            const ret: string = blockToScratchblocks(inp.value, target);
            if (ret[0] === "(" || ret[0] === "<") {
              return ret;
            } else {
              return "(" + ret + ")";
            }
          } else {
            return "()";
          }
        }

      case "blocks":
        if (inp.value) {
          return "\n" + indent(blocksToScratchblocks(inp.value, target)) + "\n";
        } else {
          return "\n";
        }

      default:
        return `(unknown input type [${inp.type}])`;
    }
  }

  function blockToScratchblocks(block: Block, target: Target): string {
    if (!target) {
      throw new Error("expected target");
    }

    const i = (key: string, ...args): string => input(block.inputs[key], target, ...args);
    const operator = (op: string): string => `(${i("NUM1")} ${op} ${i("NUM2")})`;
    const boolop = (op: string, flag: boolean = false): string => {
      if (flag) {
        return `<${i("OPERAND1") || "<>"} ${op} ${i("OPERAND2") || "<>"}>`;
      } else {
        return `<${i("OPERAND1")} ${op} ${i("OPERAND2")}>`;
      }
    };

    switch (block.opcode) {
      // motion ------------------------------------------------------ //
      case OpCode.motion_movesteps:
        return `move ${i("STEPS")} steps`;
      case OpCode.motion_turnright:
        return `turn cw ${i("DEGREES")} degrees`;
      case OpCode.motion_turnleft:
        return `turn ccw ${i("DEGREES")} degrees`;
      case OpCode.motion_goto:
        return `go to ${i("TO")}`;
      case OpCode.motion_gotoxy:
        return `go to x: ${i("X")} y: ${i("Y")}`;
      case OpCode.motion_glideto:
        return `glide ${i("SECS")} secs to ${i("TO")}`;
      case OpCode.motion_glidesecstoxy:
        return `glide ${i("SECS")} secs to x: ${i("X")} y: ${i("Y")}`;
      case OpCode.motion_pointindirection:
        return `point in direction ${i("DIRECTION")}`;
      case OpCode.motion_pointtowards:
        return `point towards ${i("TOWARDS")}`;
      case OpCode.motion_changexby:
        return `change x by ${i("DX")}`;
      case OpCode.motion_setx:
        return `set x to ${i("X")}`;
      case OpCode.motion_changeyby:
        return `change y by ${i("DY")}`;
      case OpCode.motion_sety:
        return `set y to ${i("Y")}`;
      case OpCode.motion_ifonedgebounce:
        return "if on edge, bounce";
      case OpCode.motion_setrotationstyle:
        return `set rotation style ${i("STYLE")}`;
      case OpCode.motion_xposition:
        return "(x position)";
      case OpCode.motion_yposition:
        return "(y position)";
      case OpCode.motion_direction:
        return "(direction)";
      case OpCode.motion_scroll_right:
        return `scroll right ${i("DISTANCE")} :: motion`;
      case OpCode.motion_scroll_up:
        return `scroll up ${i("DISTANCE")} :: motion`;
      case OpCode.motion_align_scene:
        return `align scene ${i("ALIGNMENT")} :: motion`;
      case OpCode.motion_xscroll:
        return `(x scroll)`;
      case OpCode.motion_yscroll:
        return `(y scroll)`;

      // looks ------------------------------------------------------- //
      case OpCode.looks_sayforsecs:
        return `say ${i("MESSAGE")} for ${i("SECS")} seconds`;
      case OpCode.looks_say:
        return `say ${i("MESSAGE")}`;
      case OpCode.looks_thinkforsecs:
        return `think ${i("MESSAGE")} for ${i("SECS")} seconds`;
      case OpCode.looks_think:
        return `think ${i("MESSAGE")}`;
      case OpCode.looks_switchcostumeto:
        return `switch costume to ${i("COSTUME")}`;
      case OpCode.looks_nextcostume:
        return "next costume";
      case OpCode.looks_switchbackdropto:
        return `switch backdrop to ${i("BACKDROP")}`;
      case OpCode.looks_nextbackdrop:
        return `next backdrop`;
      case OpCode.looks_changesizeby:
        return `change size by ${i("CHANGE")}`;
      case OpCode.looks_setsizeto:
        return `set size to ${i("SIZE")}%`;
      case OpCode.looks_changeeffectby:
        return `change ${i("EFFECT")} effect by ${i("CHANGE")} :: looks`;
      case OpCode.looks_seteffectto:
        return `set ${i("EFFECT")} effect to ${i("VALUE")} :: looks`;
      case OpCode.looks_cleargraphiceffects:
        return "clear graphic effects";
      case OpCode.looks_show:
        return "show";
      case OpCode.looks_hide:
        return "hide";
      case OpCode.looks_gotofrontback:
        return `go to ${i("FRONT_BACK")} layer`;
      case OpCode.looks_goforwardbackwardlayers:
        return `go ${i("FORWARD_BACKWARD")} ${i("NUM")} layers`;
      case OpCode.looks_costumenumbername:
        return `(costume ${i("NUMBER_NAME")})`;
      case OpCode.looks_backdropnumbername:
        return `(backdrop ${i("NUMBER_NAME")})`;
      case OpCode.looks_size:
        return "(size)";
      case OpCode.looks_hideallsprites:
        return "hide all sprites :: looks";
      case OpCode.looks_switchbackdroptoandwait:
        return `switch backdrop to ${i("BACKDROP")} and wait`;
      case OpCode.looks_changestretchby:
        return `change stretch by ${i("CHANGE")} :: looks`;
      case OpCode.looks_setstretchto:
        return `set stretch to ${i("STRETCH")} % :: looks`;

      // sound ------------------------------------------------------- //
      case OpCode.sound_playuntildone:
        return `play sound ${i("SOUND_MENU")} until done`;
      case OpCode.sound_play:
        return `start sound ${i("SOUND_MENU")}`;
      case OpCode.sound_stopallsounds:
        return "stop all sounds";
      case OpCode.sound_changeeffectby:
        return `change ${i("EFFECT")} effect by ${i("VALUE")} :: sound`;
      case OpCode.sound_seteffectto:
        return `set ${i("EFFECT")} effect to ${i("VALUE")} :: sound`;
      case OpCode.sound_cleareffects:
        return "clear sound effects";
      case OpCode.sound_changevolumeby:
        return `change volume by ${i("VOLUME")}`;
      case OpCode.sound_setvolumeto:
        return `set volume to ${i("VOLUME")} %`;
      case OpCode.sound_volume:
        return "(volume)";

      // events ------------------------------------------------------ //
      case OpCode.event_whenflagclicked:
        return "when green flag clicked";
      case OpCode.event_whenkeypressed:
        return `when ${i("KEY_OPTION", true)} key pressed`;
      case OpCode.event_whenthisspriteclicked:
        return "when this sprite clicked";
      case OpCode.event_whenstageclicked:
        return "when stage clicked :: control hat";
      case OpCode.event_whenbackdropswitchesto:
        return `when backdrop switches to ${i("BACKDROP", true)}`;
      case OpCode.event_whengreaterthan:
        return `when ${i("WHENGREATERTHANMENU")} > ${i("VALUE")}`;
      case OpCode.event_whenbroadcastreceived:
        return `when I receive ${i("BROADCAST_OPTION", true)}`;
      case OpCode.event_broadcast:
        return `broadcast ${i("BROADCAST_INPUT")}`;
      case OpCode.event_broadcastandwait:
        return `broadcast ${i("BROADCAST_INPUT")} and wait`;

      // control ----------------------------------------------------- //
      case OpCode.control_wait:
        return `wait ${i("DURATION")} seconds`;
      case OpCode.control_repeat:
        return `repeat ${i("TIMES")}` + (i("SUBSTACK", true) || "\n") + "end";
      case OpCode.control_forever:
        return "forever" + (i("SUBSTACK", true) || "\n") + "end";
      case OpCode.control_if:
        return `if ${i("CONDITION") || "<>"} then` + (i("SUBSTACK", true) || "\n") + "end";
      case OpCode.control_if_else:
        return (
          `if ${i("CONDITION") || "<>"} then` +
          (i("SUBSTACK", true) || "\n") +
          "else" +
          (i("SUBSTACK2", true) || "\n") +
          "end"
        );
      case OpCode.control_wait_until:
        return `wait until ${i("CONDITION") || "<>"}`;
      case OpCode.control_repeat_until:
        return `repeat until ${i("CONDITION") || "<>"}` + (i("SUBSTACK", true) || "\n") + "end";
      case OpCode.control_while:
        return `while ${i("CONDITION") || "<>"} {` + (i("SUBSTACK", true) || "\n") + "} :: control";
      case OpCode.control_for_each:
        return `for each ${i("VARIABLE")} in ${i("VALUE")} {` + (i("SUBSTACK", true) || "\n") + "} :: control";
      case OpCode.control_all_at_once:
        return `all at once {` + (i("SUBSTACK", true) || "\n") + `} :: control`;
      case OpCode.control_stop:
        return `stop ${i("STOP_OPTION")}`;
      case OpCode.control_start_as_clone:
        return "when I start as a clone";
      case OpCode.control_create_clone_of:
        return `create clone of ${i("CLONE_OPTION")}`;
      case OpCode.control_delete_this_clone:
        return "delete this clone";
      case OpCode.control_get_counter:
        return `(counter :: control)`;
      case OpCode.control_incr_counter:
        return `increment counter :: control`;
      case OpCode.control_clear_counter:
        return `clear coutner :: control`;

      // sensing ----------------------------------------------------- //
      case OpCode.sensing_touchingobject:
        return `<touching ${i("TOUCHINGOBJECTMENU")} ?>`;
      case OpCode.sensing_touchingcolor:
        return `<touching ${i("COLOR")} ?>`;
      case OpCode.sensing_coloristouchingcolor:
        return `<color ${i("COLOR")} is touching ${i("COLOR2")} ?>`;
      case OpCode.sensing_distanceto:
        return `(distance to ${i("DISTANCETOMENU")})`;
      case OpCode.sensing_askandwait:
        return `ask ${i("QUESTION")} and wait`;
      case OpCode.sensing_answer:
        return "(answer)";
      case OpCode.sensing_keypressed:
        return `<key ${i("KEY_OPTION")} pressed?>`;
      case OpCode.sensing_mousedown:
        return "<mouse down?>";
      case OpCode.sensing_mousex:
        return "(mouse x)";
      case OpCode.sensing_mousey:
        return "(mouse y)";
      case OpCode.sensing_setdragmode:
        return `set drag mode ${i("DRAG_MODE")}`;
      case OpCode.sensing_loudness:
        return "(loudness)";
      case OpCode.sensing_loud:
        return "<loud? :: sensing>";
      case OpCode.sensing_timer:
        return "(timer)";
      case OpCode.sensing_resettimer:
        return "reset timer";
      case OpCode.sensing_of:
        return `(${i("PROPERTY")} of ${i("OBJECT")})`;
      case OpCode.sensing_current:
        return `(current ${i("CURRENTMENU")})`;
      case OpCode.sensing_dayssince2000:
        return "(days since 2000)";
      case OpCode.sensing_username:
        return "(username)";
      case OpCode.sensing_userid:
        return "(user id :: sensing)";

      // operators --------------------------------------------------- //
      case OpCode.operator_add:
        return operator("+");
      case OpCode.operator_subtract:
        return operator("-");
      case OpCode.operator_multiply:
        return operator("*");
      case OpCode.operator_divide:
        return operator("/");
      case OpCode.operator_random:
        return `(pick random ${i("FROM")} to ${i("TO")})`;
      case OpCode.operator_gt:
        return boolop(">");
      case OpCode.operator_lt:
        return boolop("<");
      case OpCode.operator_equals:
        return boolop("=");
      case OpCode.operator_and:
        return boolop("and", true);
      case OpCode.operator_or:
        return boolop("or", true);
      case OpCode.operator_not:
        return `<not ${i("OPERAND") || "<>"}>`;
      case OpCode.operator_join:
        return `(join ${i("STRING1")} ${i("STRING2")})`;
      case OpCode.operator_letter_of:
        return `(letter ${i("LETTER")} of ${i("STRING")})`;
      case OpCode.operator_length:
        return `(length of ${i("STRING")})`;
      case OpCode.operator_contains:
        return `<${i("STRING1")} contains ${i("STRING2")} ? :: operators>`;
      case OpCode.operator_mod:
        return operator("mod");
      case OpCode.operator_round:
        return `(round ${i("NUM")})`;
      case OpCode.operator_mathop:
        return `(${i("OPERATOR")} of ${i("NUM")})`;

      // data -------------------------------------------------------- //
      case OpCode.data_variable:
        return `(${block.inputs.VARIABLE.value} :: variables)`;
      case OpCode.data_setvariableto:
        return `set ${i("VARIABLE")} to ${i("VALUE")}`;
      case OpCode.data_changevariableby:
        return `change ${i("VARIABLE")} by ${i("VALUE")}`;
      case OpCode.data_showvariable:
        return `show variable ${i("VARIABLE")}`;
      case OpCode.data_hidevariable:
        return `hide variable ${i("VARIABLE")}`;
      case OpCode.data_listcontents:
        return `(${block.inputs.LIST.value} :: list)`;
      case OpCode.data_addtolist:
        return `add ${i("ITEM")} to ${i("LIST")}`;
      case OpCode.data_deleteoflist:
        return `delete ${i("INDEX")} of ${i("LIST")}`;
      case OpCode.data_deletealloflist:
        return `delete all of ${i("LIST")}`;
      case OpCode.data_insertatlist:
        return `insert ${i("ITEM")} at ${i("INDEX")} of ${i("LIST")}`;
      case OpCode.data_replaceitemoflist:
        return `replace item ${i("INDEX")} of ${i("LIST")} with ${i("ITEM")}`;
      case OpCode.data_itemoflist:
        return `(item ${i("INDEX")} of ${i("LIST")})`;
      case OpCode.data_itemnumoflist:
        return `(item # of ${i("ITEM")} in ${i("LIST")})`;
      case OpCode.data_lengthoflist:
        return `(length of ${i("LIST")})`;
      case OpCode.data_listcontainsitem:
        return `<${i("LIST")} contains ${i("ITEM")} ? :: list>`;
      case OpCode.data_showlist:
        return `show list ${i("LIST")}`;
      case OpCode.data_hidelist:
        return `hide list ${i("LIST")}`;

      // custom blocks ----------------------------------------------- //
      case OpCode.procedures_definition:
        const spec = block.inputs.ARGUMENTS.value
          .map(({ type, name }) => {
            switch (type) {
              case "label":
                return name.replace(/\//g, "\\/");
              case "numberOrString":
                return `(${name})`;
              case "boolean":
                return `<${name}>`;
            }
          })
          .join(" ");
        return `define ${spec}` + (block.inputs.WARP.value ? " // run without screen refresh" : "");
      case OpCode.procedures_call:
        const definition = target.scripts
          .map(s => s.blocks[0])
          .find(
            b => b.opcode === OpCode.procedures_definition && b.inputs.PROCCODE.value === block.inputs.PROCCODE.value
          );
        // we guarantee the opcode check is true already by checking it in find(), but typescript doesn't seem to notice that, so we include this assert here
        if (definition && definition.opcode === OpCode.procedures_definition) {
          let index = 0;
          return (
            definition.inputs.ARGUMENTS.value
              .map(({ type, name }) => {
                switch (type) {
                  case "label":
                    return name.replace(/\//g, "\\/");
                  default:
                    // TODO: deal with empty boolean inputs, which can't even load yet
                    return input(block.inputs.INPUTS.value[index++], target);
                }
              })
              .join(" ") + " :: custom"
          );
        } else {
          return `... // missing custom block definition for ${block.inputs.PROCCODE.value}`;
        }
      case OpCode.argument_reporter_string_number:
        return `(${block.inputs.VALUE.value} :: custom-arg)`;
      case OpCode.argument_reporter_boolean:
        return `<${block.inputs.VALUE.value} :: custom-arg>`;

      // extension: music -------------------------------------------- //
      case OpCode.music_playDrumForBeats:
        return `play drum ${i("DRUM")} for ${i("BEATS")} beats`;
      case OpCode.music_midiPlayDrumForBeats:
        return `play (old midi) drum ${i("DRUM")} for ${i("BEATS")} beats :: music`;
      case OpCode.music_restForBeats:
        return `rest for ${i("BEATS")} beats`;
      case OpCode.music_playNoteForBeats:
        return `play note ${i("NOTE")} for ${i("BEATS")} beats`;
      case OpCode.music_setInstrument:
        return `set instrument to ${i("INSTRUMENT")}`;
      case OpCode.music_midiSetInstrument:
        return `set (old midi) instrument to ${i("INSTRUENT")} :: music`;
      case OpCode.music_setTempo:
        return `set tempo to ${i("TEMPO")}`;
      case OpCode.music_changeTempo:
        return `change tempo by ${i("TEMPO")}`;
      case OpCode.music_getTempo:
        return `(tempo)`;

      // extension: pen ---------------------------------------------- //
      case OpCode.pen_clear:
        return "erase all";
      case OpCode.pen_stamp:
        return "stamp";
      case OpCode.pen_penDown:
        return "pen down";
      case OpCode.pen_penUp:
        return "pen up";
      case OpCode.pen_setPenColorToColor:
        return `set pen color to ${i("COLOR")}`;
      case OpCode.pen_changePenColorParamBy:
        return `change pen ${i("COLOR_PARAM")} by ${i("VALUE")}`;
      case OpCode.pen_setPenColorParamTo:
        return `set pen ${i("COLOR_PARAM")} to ${i("VALUE")}`;
      case OpCode.pen_changePenSizeBy:
        return `change pen size by ${i("SIZE")}`;
      case OpCode.pen_setPenSizeTo:
        return `set pen size to ${i("SIZE")}`;
      case OpCode.pen_changePenShadeBy:
        return `change pen shade by ${i("SHADE")}`;
      case OpCode.pen_setPenShadeToNumber:
        return `set pen shade to ${i("SHADE")}`;
      case OpCode.pen_changePenHueBy:
        return `change pen color by ${i("HUE")}`;
      case OpCode.pen_setPenHueToNumber:
        return `set pen hue to ${i("HUE")}`;

      // extension: video sensing ----------------------------------- //
      case OpCode.videoSensing_whenMotionGreaterThan:
        return `when video motion > ${i("REFERENCE")}`;
      case OpCode.videoSensing_videoOn:
        return `(video ${i("ATTRIBUTE")} on ${i("SUBJECT")})`;
      case OpCode.videoSensing_videoToggle:
        return `turn video ${i("VIDEO_STATE")}`;
      case OpCode.videoSensing_setVideoTransparency:
        return `set video transparency to ${i("TRANSPARENCY")}`;

      // leftover menu "blocks" ----------------------------------- //
      case OpCode.motion_pointtowards_menu:
      case OpCode.motion_glideto_menu:
      case OpCode.motion_goto_menu:
      case OpCode.looks_costume:
      case OpCode.looks_backdrops:
      case OpCode.sound_sounds_menu:
      case OpCode.control_create_clone_of_menu:
      case OpCode.sensing_touchingobjectmenu:
      case OpCode.sensing_distancetomenu:
      case OpCode.sensing_keyoptions:
      case OpCode.sensing_of_object_menu:
      case OpCode.pen_menu_colorParam:
      case OpCode.music_menu_DRUM:
      case OpCode.music_menu_INSTRUMENT:
      case OpCode.videoSensing_menu_ATTRIBUTE:
      case OpCode.videoSensing_menu_SUBJECT:
      case OpCode.videoSensing_menu_VIDEO_STATE:
      case OpCode.wedo2_menu_MOTOR_ID:
      case OpCode.wedo2_menu_MOTOR_DIRECTION:
      case OpCode.wedo2_menu_TILT_DIRECTION:
      case OpCode.wedo2_menu_TILT_DIRECTION_ANY:
        return "";

      default:
        return `unknown block [${block.opcode}] \\(${Object.keys(block.inputs)
          .map(k => `[${k}]`)
          .join(", ")}\\)`;
    }
  }

  function blocksToScratchblocks(blocks: Block[], target: Target): string {
    return blocks.map(b => blockToScratchblocks(b, target)).join("\n");
  }

  function scriptToScratchblocks(script: Script, target: Target): string {
    return blocksToScratchblocks(script.blocks, target);
  }

  const targets: { [targetName: string]: string } = {};

  for (const target of [project.stage, ...project.sprites]) {
    targets[target.name] = target.scripts
      .map(script => scriptToScratchblocks(script, target))
      .filter(scratchblocks => scratchblocks.length > 0)
      .join("\n\n");
  }

  return targets;
}
