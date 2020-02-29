import Block from "./Block";
import { OpCode } from "./OpCode";

export default class Script {
  public x = 0;
  public y = 0;
  public blocks: Block[];
  public name: string = null;

  constructor(options: { blocks: Block[]; x?: number; y?: number; name?: string }) {
    Object.assign(this, options);

    if (!Object.prototype.hasOwnProperty.call(options, "name")) {
      switch (this.blocks[0].opcode) {
        case OpCode.event_whenflagclicked:
          this.name = "when_green_flag_clicked";
          break;
        case OpCode.event_whenbroadcastreceived:
          this.name = `when_i_receive_${this.blocks[0].inputs.BROADCAST_OPTION.value}`;
          break;
        case OpCode.event_whenkeypressed:
          this.name = `when_key_${this.blocks[0].inputs.KEY_OPTION.value}_pressed`;
          break;
        case OpCode.procedures_definition:
          this.name = this.blocks[0].inputs.ARGUMENTS.value
            .filter(argument => argument.type === "label")
            .map(argument => argument.name)
            .join("_");
          break;
        default:
          this.name = this.blocks[0].opcode
            .split("_")
            .slice(1)
            .join("_");
      }
    }
  }

  get hat(): Block {
    if (this.blocks.length === 0) {
      return null;
    }

    const first = this.blocks[0];
    if (!first.isHat) {
      return null;
    }

    return first;
  }

  get body(): Block[] {
    return this.blocks.filter(block => !block.isHat);
  }

  public setName(name: string): void {
    this.name = name;
  }
}
