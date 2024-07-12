import { PatchScratchBlockInput, PatchTarget } from "./patch-interfaces";
import { PatchTargetThread } from "./patch-interfaces";

import patchApi from "./conversion-layer";
import convertControlBlock from "./scratch-conversion-control";
import convertOperatorBlock from "./scratch-conversion-operator";
import convertDataBlock from "./scratch-conversion-data";

// 0: number, 1: string, 2: nested, -1: error
export function getArgType(inputJson: PatchScratchBlockInput) {
  const argType = inputJson[1][0];
  // See here for meanings of the numbers: https://en.scratch-wiki.info/wiki/Scratch_File_Format#Blocks

  if (inputJson[0] === 1) {
    // TODO: check proper validation for argType === 8 (angle)
    if (argType === 4 || argType === 5 || argType === 6 || argType === 7 || argType === 8) {
      return 0;
    }
    // Type 11 has 2 strings after the 11; the first one is a name and the second one is an ID.
    // We will just treat it as a regular string; the user-inputted name will end up being used
    // and not the randomly generated id
    if (argType === 9 || argType === 10 || argType === 11 || argType === 12 || argType === 13) {
      return 1;
    }
    return 2;
  }
  if (inputJson[0] === 2 || inputJson[0] === 3) {
    // Blocks
    return 2;
  }

  console.warn("Couldn't determine argument type.");
  return -1;
}

export function indentLines(lines: string) {
  let newLines = "";

  const lineList = lines.split("\n");
  // Make sure the lines have proper indentation
  lineList.forEach(line => {
    newLines += `\n  ${line}`;
  });

  return newLines;
}

/**
 *
 * @param {String} code
 * @returns {Boolean}
 */
function needsParentheses(code: string) {
  // First, check if code is just a string
  if (code[0] === '"' && code[code.length - 1] === '"') {
    // double quotes string
    // yes, the for loop should start at 1 not 0 and it should go until 1 before the end
    for (let i = 1; i < code.length - 1; i++) {
      if (code[i] === '"' && code[i - 1] !== "\\") {
        // this isn't just one continuous string
        return true;
      }
    }

    return false;
  }
  if (code[0] === "'" && code[code.length - 1] === "'") {
    // single quotes string
    // yes, the for loop should start at 1 not 0 and it should go until 1 before the end
    for (let i = 1; i < code.length - 1; i++) {
      if (code[i] === "'" && code[i - 1] !== "\\") {
        // this isn't just one continuous string
        return true;
      }
    }

    return false;
  }

  return true;
}

export function processInputs(
  target: PatchTarget,
  currentBlockId: string,
  autoParentheses = false,
  tryMakeNum = false
) {
  const returnVal: {
    [key: string]: string;
  } = {};

  const currentBlock = target.blocks[currentBlockId];

  const inputsKeys = Object.keys(currentBlock.inputs);
  for (let i = 0; i < inputsKeys.length; i++) {
    const inputsKey = inputsKeys[i];

    let arg = "";

    const argType = getArgType(currentBlock.inputs[inputsKey]);
    if (argType === 0) {
      arg = `${currentBlock.inputs[inputsKey][1][1]}`;
    } else if (argType === 1) {
      arg = `"${currentBlock.inputs[inputsKey][1][1]}"`;
    } else if (argType === 2) {
      // TODO: check this line
      arg = convertBlocksPart(target, currentBlockId, currentBlock.inputs[inputsKey][1] as string).script;
      arg = arg.substring(0, arg.length - 1);
      if (autoParentheses && needsParentheses(arg)) {
        arg = `(${arg})`;
      }
    }

    // eslint-disable-next-line no-restricted-globals
    if (tryMakeNum && argType === 1 && arg.length >= 3 && !isNaN(Number.parseInt(arg.substring(1, arg.length - 1)))) {
      arg = arg.substring(1, arg.length - 1);
    }

    returnVal[inputsKey] = arg;
  }

  const fieldsKeys = Object.keys(currentBlock.fields);
  for (let i = 0; i < fieldsKeys.length; i++) {
    const fieldsKey = fieldsKeys[i];

    if (returnVal[fieldsKey]) {
      console.warn(
        "The parameter %s was found in both the fields and the inputs. Using the one in the fields.",
        fieldsKey
      );
    }
    returnVal[fieldsKey] = `"${currentBlock.fields[fieldsKey][0]}"`;
  }

  return returnVal;
}

export function convertBlocksPart(target: PatchTarget, hatId: string, nextId: string) {
  const thread = new PatchTargetThread();
  const { blocks } = target;

  thread.triggerEventId = blocks[hatId].opcode;
  // TODO: triggerEventOption
  const hatFieldsKeys = Object.keys(blocks[hatId].fields);
  if (hatFieldsKeys && hatFieldsKeys.length > 0) {
    if (blocks[hatId].opcode === "event_whenkeypressed") {
      // eslint-disable-next-line prefer-destructuring
      thread.triggerEventOption = blocks[hatId].fields[hatFieldsKeys[0]][0].toUpperCase();
    } else {
      // eslint-disable-next-line prefer-destructuring
      thread.triggerEventOption = blocks[hatId].fields[hatFieldsKeys[0]][0];
    }
  }

  // Convert code
  let currentBlockId = nextId;
  while (currentBlockId) {
    const currentBlock = blocks[currentBlockId];
    // Store a copy of the opcode so we don't have to keep doing currentBlock.opcode
    const { opcode } = currentBlock;

    // TODO: figure out nested blocks

    const patchApiKeys = Object.keys(patchApi);

    // Convert the block
    // Duplicates shouldn't exist in the translation API, but if they do the first entry will be used
    let patchKey = null;
    for (let i = 0; i < patchApiKeys.length; i++) {
      const key = patchApiKeys[i];

      if (patchApi[key].opcode === opcode) {
        patchKey = key;
        break;
      }
    }

    if (!patchKey) {
      if (opcode.substring(0, 8) === "control_") {
        const conversionResult = convertControlBlock(
          target,
          currentBlockId,
          processInputs,
          indentLines,
          convertBlocksPart
        );
        thread.script += `${conversionResult}\n`;
      } else if (opcode.substring(0, 9) === "operator_") {
        const conversionResult = convertOperatorBlock(target, currentBlockId, processInputs);
        thread.script += `${conversionResult}\n`;
      } else if (opcode.substring(0, 5) === "data_") {
        const conversionResult = convertDataBlock(target, currentBlockId, processInputs);
        thread.script += `${conversionResult}\n`;
      } else {
        // Couldn't find the opcode in the map.
        console.error("Error translating from scratch to patch. Unable to find the key for the opcode %s.", opcode);
      }
    } else {
      // const inputsKeys = Object.keys(currentBlock.inputs);
      const detectedArgs = processInputs(target, currentBlockId, true, false);

      let patchCode = "";

      const conversionLayerResult = patchApi[patchKey];
      if (conversionLayerResult.returnInstead) {
        let patchArgs = "";
        for (let i = 0; i < conversionLayerResult.returnInstead.length; i++) {
          const val = conversionLayerResult.returnInstead[i];

          // Add options to change this based on language later.
          if (patchArgs !== "") {
            patchArgs += ", ";
          }

          patchArgs += val;
        }

        patchCode = `${patchArgs}\n`;
      } else if (conversionLayerResult.returnParametersInstead) {
        let patchArgs = "";
        for (let i = 0; i < conversionLayerResult.returnParametersInstead.length; i++) {
          const parameter = conversionLayerResult.returnParametersInstead[i]; // .toUpperCase();

          // Add options to change this based on language later.
          if (patchArgs !== "") {
            patchArgs += ", ";
          }

          if (detectedArgs[parameter]) {
            patchArgs += detectedArgs[parameter];
          } else {
            console.warn("Couldn't find parameter with opcode %s.", parameter);
            patchArgs += '"# Error: couldn\'t find the parameter to go here."';
          }
        }

        patchCode = `${patchArgs}\n`;
      } else {
        let patchArgs = "";
        for (let i = 0; i < conversionLayerResult.parameters.length; i++) {
          const parameter = conversionLayerResult.parameters[i]; // .toUpperCase();

          // Add options to change this based on language later.
          if (patchArgs !== "") {
            patchArgs += ", ";
          }

          if (detectedArgs[parameter]) {
            patchArgs += detectedArgs[parameter];
          } else {
            console.warn("Couldn't find parameter with opcode %s.", parameter);
            patchArgs += '"# Error: couldn\'t find the parameter to go here."';
          }
        }

        // Handle a special case: Patch implements the Ask block differently
        if (currentBlock.opcode === "sensing_askandwait") {
          patchKey = `_patchAnswer = ${patchKey}`;
        }

        // Join all the bits and pieces together. Add options to change this based on language later.
        patchCode = `${patchKey}(${patchArgs})\n`;
      }

      thread.script += patchCode;
    }

    // Next block
    currentBlockId = currentBlock.next as string;
  }

  return thread;
}
