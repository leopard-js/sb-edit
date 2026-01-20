import { InputProcessorType } from "./conversion-layer";
import { PatchTarget } from "./patch-interfaces";

/**
 *
 * @param {Target} target
 * @param {string} currentBlockId
 * @param {InputProcessorType} processinputs
 * @returns {string}
 */
export default function convertOperatorBlock(
  target: PatchTarget,
  currentBlockId: string,
  processInputs: InputProcessorType
) {
  const currentBlock = target.blocks[currentBlockId];
  const { opcode } = currentBlock;

  let script = "";

  switch (opcode) {
    case "operator_add": {
      const { NUM1, NUM2 } = processInputs(target, currentBlockId, true);

      script += `${NUM1} + ${NUM2}`;
      break;
    }
    case "operator_subtract": {
      const { NUM1, NUM2 } = processInputs(target, currentBlockId, true);

      script += `${NUM1} - ${NUM2}`;
      break;
    }
    case "operator_multiply": {
      const { NUM1, NUM2 } = processInputs(target, currentBlockId, true);

      script += `${NUM1} * ${NUM2}`;
      break;
    }
    case "operator_divide": {
      const { NUM1, NUM2 } = processInputs(target, currentBlockId, true);

      script += `${NUM1} / ${NUM2}`;
      break;
    }
    case "operator_lt": {
      const { OPERAND1, OPERAND2 } = processInputs(target, currentBlockId, true, true);

      script += `${OPERAND1} < ${OPERAND2}`;
      break;
    }
    case "operator_equals": {
      const { OPERAND1, OPERAND2 } = processInputs(target, currentBlockId, true, true);

      script += `${OPERAND1} == ${OPERAND2}`;
      break;
    }
    case "operator_gt": {
      const { OPERAND1, OPERAND2 } = processInputs(target, currentBlockId, true, true);

      script += `${OPERAND1} > ${OPERAND2}`;
      break;
    }
    case "operator_and": {
      const { OPERAND1, OPERAND2 } = processInputs(target, currentBlockId, true, true);

      script += `${OPERAND1} and ${OPERAND2}`;
      break;
    }
    case "operator_or": {
      const { OPERAND1, OPERAND2 } = processInputs(target, currentBlockId, true, true);

      script += `${OPERAND1} or ${OPERAND2}`;
      break;
    }
    case "operator_not": {
      const { OPERAND } = processInputs(target, currentBlockId, true, true);

      script += `not ${OPERAND}`;
      break;
    }
    case "operator_random": {
      const { FROM, TO } = processInputs(target, currentBlockId, true, true);

      script += `patch_random(${FROM}, ${TO})`;
      break;
    }
    case "operator_join": {
      const { STRING1, STRING2 } = processInputs(target, currentBlockId, true, false);

      // TODO: is there a more pythonic way to implement this?
      script += `${STRING1} + ${STRING2}`;
      break;
    }
    case "operator_letter_of": {
      const { STRING } = processInputs(target, currentBlockId, true, false);
      const { LETTER } = processInputs(target, currentBlockId, true, true);

      script += `${STRING}[${parseInt(LETTER) - 1}]`;
      break;
    }
    case "operator_length": {
      const { STRING } = processInputs(target, currentBlockId, true, false);

      script += `len(${STRING})`;
      break;
    }
    case "operator_contains": {
      const { STRING1, STRING2 } = processInputs(target, currentBlockId, true, false);

      script += `${STRING2} in ${STRING1}`;
      break;
    }
    case "operator_mod": {
      const { NUM1, NUM2 } = processInputs(target, currentBlockId, true);

      script += `${NUM1} % ${NUM2}`;
      break;
    }
    case "operator_round": {
      const { NUM } = processInputs(target, currentBlockId, true);

      script += `round(${NUM})`;
      break;
    }
    case "operator_mathop": {
      const { OPERATOR } = processInputs(target, currentBlockId, true);
      const { NUM } = processInputs(target, currentBlockId, true, true);

      // Remove the quotation marks that processInputs adds
      const formattedOperator = OPERATOR.substring(1, OPERATOR.length - 1);

      const mathOpsDict: { [key: string]: string } = {
        abs: `abs(${NUM})`,
        ceiling: `math.ceil(${NUM})`,
        sqrt: `math.sqrt(${NUM})`,
        floor: `math.floor(${NUM})`,
        /* Trig in scratch uses degrees. To keep this consistent, we must convert the inputs of
                  trig (but not inverse trig) */
        sin: `math.sin(math.radians(${NUM}))`,
        cos: `math.cos(math.radians(${NUM}))`,
        tan: `math.tan(math.radians(${NUM}))`,
        asin: `math.degrees(math.asin(${NUM}))`,
        acos: `math.degrees(math.acos(${NUM}))`,
        atan: `math.degrees(math.atan(${NUM}))`,
        /* in Python, math.log defaults to base e, not base 10 */
        ln: `math.log(${NUM})`,
        log: `math.log(${NUM}, 10)`,
        "e ^": `pow(math.e, ${NUM})` /* `math.exp(${ NUM })`, */,
        "10 ^": `pow(10, ${NUM})`
      };

      script += mathOpsDict[formattedOperator];
      break;
    }
    default: {
      break;
    }
  }

  return script;
}
