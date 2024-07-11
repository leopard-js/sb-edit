import { ConversionLayerType, PartialConverterType } from "./conversion-layer";
import { PatchScratchBlock } from "./patch-interfaces";
import ScratchConverter from "./scratch-conversion";
import { indentLines, processInputs } from "./scratch-conversion-helper";

export default class ScratchConversionControl {
  convertControlBlock(
    blocks: { [key: string]: PatchScratchBlock },
    currentBlockId: string,
    patchApi: ConversionLayerType,
    patchApiKeys: string[],
    partialConverter: PartialConverterType,
    partialConverterThis: ScratchConverter
  ) {
    const convertBlocksPart = partialConverter.bind(partialConverterThis);

    const currentBlock = blocks[currentBlockId];
    const { opcode } = currentBlock;

    let script = "";

    switch (opcode) {
      case "control_forever": {
        // Forever loop
        let SUBSTACK = convertBlocksPart(
          blocks,
          currentBlockId,
          currentBlock.inputs.SUBSTACK[1] as string,
          patchApi,
          patchApiKeys
        ).script;
        SUBSTACK = SUBSTACK.substring(0, SUBSTACK.length - 1);
        script += "\n";
        script += "while True:";
        script += indentLines(SUBSTACK);
        break;
      }
      case "control_if": {
        // If (but no else) statement
        // 2 args: "CONDITION" and "SUBSTACK"
        let CONDITION = convertBlocksPart(
          blocks,
          currentBlockId,
          currentBlock.inputs.CONDITION[1] as string,
          patchApi,
          patchApiKeys
        ).script;
        CONDITION = CONDITION.substring(0, CONDITION.length - 1);
        let SUBSTACK = convertBlocksPart(
          blocks,
          currentBlockId,
          currentBlock.inputs.SUBSTACK[1] as string,
          patchApi,
          patchApiKeys
        ).script;
        SUBSTACK = SUBSTACK.substring(0, SUBSTACK.length - 1);
        script += `if ${CONDITION}:`;
        script += indentLines(SUBSTACK);
        script += "\n";
        break;
      }
      case "control_if_else": {
        // If + else statement
        // 3 args: "CONDITION", "SUBSTACK", and "SUBSTACK2"
        let CONDITION = convertBlocksPart(
          blocks,
          currentBlockId,
          currentBlock.inputs.CONDITION[1] as string,
          patchApi,
          patchApiKeys
        ).script;
        CONDITION = CONDITION.substring(0, CONDITION.length - 1);
        let SUBSTACK = convertBlocksPart(
          blocks,
          currentBlockId,
          currentBlock.inputs.SUBSTACK[1] as string,
          patchApi,
          patchApiKeys
        ).script;
        SUBSTACK = SUBSTACK.substring(0, SUBSTACK.length - 1);
        let SUBSTACK2 = convertBlocksPart(
          blocks,
          currentBlockId,
          currentBlock.inputs.SUBSTACK2[1] as string,
          patchApi,
          patchApiKeys
        ).script;
        SUBSTACK2 = SUBSTACK2.substring(0, SUBSTACK2.length - 1);
        script += `if ${CONDITION}:`;
        script += indentLines(SUBSTACK);
        script += "\nelse:";
        script += indentLines(SUBSTACK2);
        script += "\n";
        break;
      }
      case "control_repeat": {
        const { SUBSTACK } = processInputs(
          blocks,
          currentBlockId,
          currentBlock,
          patchApi,
          patchApiKeys,
          convertBlocksPart,
          false
        );
        const { TIMES } = processInputs(
          blocks,
          currentBlockId,
          currentBlock,
          patchApi,
          patchApiKeys,
          convertBlocksPart,
          true,
          true
        );
        script += `for _ in range(${TIMES}):`;
        script += indentLines(SUBSTACK);
        script += "\n";
        break;
      }
      case "control_wait_until": {
        const { CONDITION } = processInputs(
          blocks,
          currentBlockId,
          currentBlock,
          patchApi,
          patchApiKeys,
          convertBlocksPart,
          false
        );
        console.warn("WARN: the Wait Until block isn't supported in Patch, so a basic substitute will be used.");
        script += `while True:`;
        script += indentLines(`if ${CONDITION}:${indentLines(`break`)}`);
        script += "\n";
        break;
      }
      case "control_repeat_until": {
        const { SUBSTACK, CONDITION } = processInputs(
          blocks,
          currentBlockId,
          currentBlock,
          patchApi,
          patchApiKeys,
          convertBlocksPart,
          false
        );
        console.warn("WARN: the Repeat Until block isn't supported in Patch, so a basic substitute will be used.");
        script += `while True:`;
        script += indentLines(`if ${CONDITION}:${indentLines(`break`)}\nelse:${indentLines(SUBSTACK)}`);
        script += "\n";
        break;
      }
      default: {
        console.warn("The control block conversion couldn't figure out how to handle opcode %s.", currentBlock.opcode);
        break;
      }
    }

    return script;
  }
}
