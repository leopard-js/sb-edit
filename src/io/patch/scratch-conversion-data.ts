import { InputProcessorType } from "./conversion-layer";
import { PatchTarget } from "./patch-interfaces";

function checkVariableName(target: PatchTarget, variable: string) {
  let trimmed = variable.substring(1, variable.length - 1);

  const variableKeys = Object.keys(target.variables);

  for (let i = 0; i < variableKeys.length; i++) {
    if (target.variables[variableKeys[i]][0] === trimmed) {
      trimmed = `${target.name}_${trimmed}`;

      return trimmed;
    }
  }

  const listKeys = Object.keys(target.lists);

  for (let i = 0; i < listKeys.length; i++) {
    if (target.lists[listKeys[i]][0] === trimmed) {
      trimmed = `${target.name}_${trimmed}`;

      return trimmed;
    }
  }

  return trimmed;
}

/**
 *
 * @param {*} target
 * @param {string} blockId
 * @param {*} processInputs
 * @returns {string}
 */
export default function convertDataBlock(
  target: PatchTarget,
  currentBlockId: string,
  processInputs: InputProcessorType
) {
  const currentBlock = target.blocks[currentBlockId];
  const { opcode } = currentBlock;

  let script = "";

  switch (opcode) {
    case "data_setvariableto": {
      // Set variable
      const { VARIABLE } = processInputs(target, currentBlockId, false);
      const { VALUE } = processInputs(target, currentBlockId, false, true);
      const VARIABLE_TRIMMED = checkVariableName(target, VARIABLE);
      // Add options to change this based on language later.
      script += `${VARIABLE_TRIMMED} = ${VALUE}`;
      break;
    }
    case "data_changevariableby": {
      // Change variable by
      const { VARIABLE } = processInputs(target, currentBlockId, false);
      const { VALUE } = processInputs(target, currentBlockId, false, true);
      const VARIABLE_TRIMMED = checkVariableName(target, VARIABLE);
      // Add options to change this based on language later.
      script += `${VARIABLE_TRIMMED} += ${VALUE}`;
      break;
    }
    case "data_showvariable": {
      // Display variable on screen
      console.warn("WARN: the Show Variable block isn't supported in Patch.");
      break;
    }
    case "data_hidevariable": {
      // Stop displaying variable on screen
      console.warn("WARN: the Hide Variable block isn't supported in Patch.");
      break;
    }
    case "data_addtolist": {
      // Append to list
      const { LIST } = processInputs(target, currentBlockId, false);
      const { ITEM } = processInputs(target, currentBlockId, false, true);
      const LIST_TRIMMED = checkVariableName(target, LIST);
      // Add options to change this based on language later.
      console.warn(
        "WARN: using lists as variables isn't currently supported in Patch. Code will be generated but it may or may not function."
      );
      script += `${LIST_TRIMMED}.append(${ITEM})`;
      break;
    }
    case "data_deleteoflist": {
      // Delete item at index from list
      const { LIST } = processInputs(target, currentBlockId, false);
      const { INDEX } = processInputs(target, currentBlockId, false, true);
      const LIST_TRIMMED = checkVariableName(target, LIST);
      // Add options to change this based on language later.
      console.warn(
        "WARN: using lists as variables isn't currently supported in Patch. Code will be generated but it may or may not function."
      );
      script += `${LIST_TRIMMED}.pop(${INDEX})`;
      break;
    }
    case "data_deletealloflist": {
      // Clear a list
      const { LIST } = processInputs(target, currentBlockId, false);
      const LIST_TRIMMED = checkVariableName(target, LIST);
      // Add options to change this based on language later.
      console.warn(
        "WARN: using lists as variables isn't currently supported in Patch. Code will be generated but it may or may not function."
      );
      script += `${LIST_TRIMMED}.clear()`;
      break;
    }
    case "data_insertatlist": {
      // Insert an item into the list
      const { LIST } = processInputs(target, currentBlockId, false);
      const { ITEM, INDEX } = processInputs(target, currentBlockId, false, true);
      const LIST_TRIMMED = checkVariableName(target, LIST);
      // Add options to change this based on language later.
      console.warn(
        "WARN: using lists as variables isn't currently supported in Patch. Code will be generated but it may or may not function."
      );
      script += `${LIST_TRIMMED}.insert(${INDEX}, ${ITEM})`;
      break;
    }
    case "data_replaceitemoflist": {
      // Replace a list item
      const { LIST } = processInputs(target, currentBlockId, false);
      const { ITEM, INDEX } = processInputs(target, currentBlockId, false, true);
      const LIST_TRIMMED = checkVariableName(target, LIST);
      // Add options to change this based on language later.
      console.warn(
        "WARN: using lists as variables isn't currently supported in Patch. Code will be generated but it may or may not function."
      );
      script += `${LIST_TRIMMED}[${INDEX}] = ${ITEM}`;
      break;
    }
    case "data_itemoflist": {
      // Get a list item
      const { LIST } = processInputs(target, currentBlockId, false);
      const { INDEX } = processInputs(target, currentBlockId, false, true);
      const LIST_TRIMMED = checkVariableName(target, LIST);
      // Add options to change this based on language later.
      console.warn(
        "WARN: using lists as variables isn't currently supported in Patch. Code will be generated but it may or may not function."
      );
      script += `${LIST_TRIMMED}[${INDEX}]`;
      break;
    }
    case "data_itemnumoflist": {
      // Get the index of an item in the list
      const { LIST } = processInputs(target, currentBlockId, false);
      const { ITEM } = processInputs(target, currentBlockId, false, true);
      const LIST_TRIMMED = checkVariableName(target, LIST);
      // Add options to change this based on language later.
      console.warn(
        "WARN: using lists as variables isn't currently supported in Patch. Code will be generated but it may or may not function."
      );
      script += `${LIST_TRIMMED}.index(${ITEM})`;
      break;
    }
    case "data_lengthoflist": {
      // Get the length of the list
      const { LIST } = processInputs(target, currentBlockId, false);
      const LIST_TRIMMED = checkVariableName(target, LIST);
      // Add options to change this based on language later.
      console.warn(
        "WARN: using lists as variables isn't currently supported in Patch. Code will be generated but it may or may not function."
      );
      script += `len(${LIST_TRIMMED})`;
      break;
    }
    case "data_listcontainsitem": {
      // Check if the list contains a certain item
      const { LIST } = processInputs(target, currentBlockId, false);
      const { ITEM } = processInputs(target, currentBlockId, false, true);
      const LIST_TRIMMED = checkVariableName(target, LIST);
      // Add options to change this based on language later.
      console.warn(
        "WARN: using lists as variables isn't currently supported in Patch. Code will be generated but it may or may not function."
      );
      script += `${ITEM} in ${LIST_TRIMMED}`;
      break;
    }
    case "data_showlist": {
      console.warn("WARN: the Show List block isn't supported in Patch.");
      break;
    }
    case "data_hidelist": {
      console.warn("WARN: the Hide List block isn't supported in Patch.");
      break;
    }
    default: {
      console.warn("The data block conversion couldn't figure out how to handle opcode %s.", currentBlock.opcode);
      break;
    }
  }

  return script;
}
