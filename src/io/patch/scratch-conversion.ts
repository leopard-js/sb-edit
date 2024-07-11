import ConversionLayer, { ConversionLayerType } from "./conversion-layer";

import ScratchConversionControl from "./scratch-conversion-control";
import ScratchConversionOperator from "./scratch-conversion-operator";

import { processInputs } from "./scratch-conversion-helper";
import { PatchScratchBlock, PatchScratchProjectJSON, PatchTargetThread } from "./patch-interfaces";

const EventHats = {
  event_whenflagclicked: {
    label: "When Flag Clicked",
    restartExistingThreads: true
  },
  event_whenkeypressed: {
    label: "When Key Pressed",
    restartExistingThreads: false
  },
  event_whenthisspriteclicked: {
    label: "When This Sprite Clicked",
    restartExistingThreads: true
  },
  event_whentouchingobject: {
    label: "When Touching",
    restartExistingThreads: false,
    edgeActivated: true
  },
  event_whenstageclicked: {
    label: "When Stage Clicked",
    restartExistingThreads: true
  },
  event_whenbackdropswitchesto: {
    label: "When Backdrop Switches To",
    restartExistingThreads: true
  },
  event_whengreaterthan: {
    label: "When Greater Than",
    restartExistingThreads: false,
    edgeActivated: true
  },
  event_whenbroadcastreceived: {
    label: "When Broadcast Received",
    restartExistingThreads: true
  }
};

const ControlHats = {
  control_start_as_clone: {
    restartExistingThreads: false,
    label: "When I Start As Clone"
  }
};

export default class ScratchConverter {
  data: string = "";

  scratchControlConverter = new ScratchConversionControl();

  scratchOperatorConverter = new ScratchConversionOperator();

  /**
   *
   * @param {String} scratchData An ArrayBuffer representation of the .sb3 file to convert
   */
  constructor(scratchData: string) {
    this.data = scratchData;
  }

  getPatchProjectJson() {
    const vmState = JSON.parse(this.data) as PatchScratchProjectJSON;

    // This function will convert each target's blocks and local variables into Patch code.
    // Then, it will remove the blocks from the JSON (not strictly necessary) and handle backgrounds and other
    // things that Patch and Scratch store differently. Also, everything will be moved to being a child of a json
    // object called "vmstate" that exists for some reason.
    // TODO: add more validation of scratch project

    // Step 1: blocks + variables to code; then add code
    for (let i = 0; i < vmState.targets.length; i++) {
      vmState.targets[i].threads = this.convertTargetBlocks(vmState.targets[i].blocks, {}); //vmState.targets[i].variables);
    }

    // Step 2: remove blocks (this isn't strictly necessary) and variables + broadcasts (this is necessary)
    // Get rid of the variables removing part once sprite-wide variables are a thing. Keep the broadcasts
    // remover however.
    for (let i = 0; i < vmState.targets.length; i++) {
      vmState.targets[i].blocks = {};
      vmState.targets[i].variables = {};
      vmState.targets[i].broadcasts = {};
    }

    // Step 3: some odd jobs
    // TODO: implement these

    // Remove monitors as Patch doesn't support them
    vmState.monitors = [];

    // Step 4: make everything a child of "vmstate" and add global variables
    // TODO: global variables
    const baseJson = { vmstate: vmState, globalVariables: [] };

    return JSON.stringify(baseJson);
  }

  convertBlocksPart(
    blocks: { [id: string]: PatchScratchBlock },
    hatId: string,
    nextId: string,
    patchApi: ConversionLayerType,
    patchApiKeys: string[]
  ) {
    const thread = new PatchTargetThread();

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
          const conversionResult = this.scratchControlConverter.convertControlBlock(
            blocks,
            currentBlockId,
            patchApi,
            patchApiKeys,
            // eslint-disable-next-line @typescript-eslint/unbound-method
            this.convertBlocksPart,
            this
          );
          thread.script += `${conversionResult}\n`;
        } else if (opcode.substring(0, 9) === "operator_") {
          const conversionResult = this.scratchOperatorConverter.convertOperatorBlock(
            blocks,
            currentBlockId,
            patchApi,
            patchApiKeys,
            // eslint-disable-next-line @typescript-eslint/unbound-method
            this.convertBlocksPart,
            this
          );
          thread.script += `${conversionResult}\n`;
        } else {
          // Couldn't find the opcode in the map.
          console.error("Error translating from scratch to patch. Unable to find the key for the opcode %s.", opcode);
        }
      } else {
        // const inputsKeys = Object.keys(currentBlock.inputs);
        const detectedArgs = processInputs(
          blocks,
          currentBlockId,
          currentBlock,
          patchApi,
          patchApiKeys,
          this.convertBlocksPart.bind(this),
          true,
          false
        );

        /* for (let i = 0; i < inputsKeys.length; i++) {
               const inputsKey = inputsKeys[i];

               // Add options to change this based on language later.
               if (patchArgs !== "") {
                  patchArgs += ", ";
               }

               // TODO: validate this more
               let newArg = "";

               const argType = getArgType(currentBlock.inputs[inputsKey])

               switch (argType) {
                  case 0: {
                     newArg = `${currentBlock.inputs[inputsKey][1][1]}`;
                     break;
                  }
                  case 1: {
                     newArg = `"${currentBlock.inputs[inputsKey][1][1]}"`;
                     break;
                  }
                  case 2: {
                     // Nested block
                     const subThread = this.convertBlocksPart(blocks, currentBlockId, currentBlock.inputs[inputsKey][1], patchApi, patchApiKeys);
                     // remove the newline
                     newArg = subThread.script.substring(0, subThread.script.length - 1);
                     break;
                  }
                  default: {
                     console.error("Unknown argType.");
                     break;
                  }
               }

               patchArgs += newArg;
            } */

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
          // TODO: should this be a global variable?
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

  /**
   * Converts an object representation of a Scratch target's blocks into an object
   * representation of the corresponding Patch threads and thread code.
   *
   * @param {Object.<string, ScratchBlock>} blocks
   * @param {Object.<string, [Number, String]>} variables
   * @returns {PatchTargetThread[]} An array of object representations of the patch threads
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  convertTargetBlocks(blocks: { [key: string]: PatchScratchBlock }, variables: { [key: string]: number | string }) {
    // TODO: convert variables
    // https://en.scratch-wiki.info/wiki/Scratch_File_Format#Blocks

    const blocksKeys = Object.keys(blocks);

    const returnVal: PatchTargetThread[] = [];

    /*const eventBlocks = new Scratch3EventBlocks({ on: () => {}, startHats: () => {} });
    const controlBlocks = new Scratch3ControlBlocks({ on: () => {}, startHats: () => {} });

    const hats = Object.keys({ ...eventBlocks.getHats(), ...controlBlocks.getHats() });*/

    const hats = Object.keys({ ...EventHats, ...ControlHats });

    const hatLocations: string[] = [];

    blocksKeys.forEach(blockId => {
      const block = blocks[blockId];
      if (hats.includes(block.opcode)) {
        hatLocations.push(blockId);
      }
    });

    const { patchApi } = ConversionLayer;
    const patchApiKeys = Object.keys(patchApi);

    hatLocations.forEach(hatId => {
      const returnValPart = this.convertBlocksPart(blocks, hatId, blocks[hatId].next as string, patchApi, patchApiKeys);

      if (returnValPart.script.includes("math.")) {
        returnValPart.script = `import math\n\n${returnValPart.script}`;
      }

      if (returnValPart.script.includes("patch_random(")) {
        returnValPart.script = `import random\n\n# This mimics the behavior of Scratch's random block\ndef patch_random(num1, num2):\n  if ((num1 % 1) == 0) and ((num2 % 1) == 0):\n    return random.randint(num1, num2)\n  else:\n    return round(random.uniform(num1, num2), 2)\n\n${returnValPart.script}`;
      }

      returnVal.push(returnValPart);
    });

    return returnVal;
  }
}
