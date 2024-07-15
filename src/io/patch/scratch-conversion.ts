import { convertBlocksPart } from "./scratch-conversion-helper";
import { PatchScratchProjectJSON, PatchTarget, PatchTargetThread } from "./patch-interfaces";

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

  /**
   *
   * @param {String} scratchData An ArrayBuffer representation of the .sb3 file to convert
   */
  constructor(scratchData: string) {
    this.data = scratchData;
  }

  getPatchProjectJson() {
    const vmState = JSON.parse(this.data) as PatchScratchProjectJSON;

    const globalVariables: { name: string; value: string | number }[] = [];

    // This function will convert each target's blocks and local variables into Patch code.
    // Then, it will remove the blocks from the JSON (not strictly necessary) and handle backgrounds and other
    // things that Patch and Scratch store differently. Also, everything will be moved to being a child of a json
    // object called "vmstate" that exists for some reason.
    // TODO: add more validation of scratch project

    // Step 1: blocks + variables to code; then add code
    for (let i = 0; i < vmState.targets.length; i++) {
      vmState.targets[i].threads = this.convertTargetBlocks(vmState.targets[i]);
    }

    // Step 2: remove blocks (this isn't strictly necessary) and variables + broadcasts (this is necessary)
    // Get rid of the variables removing part once sprite-wide variables are a thing. Keep the broadcasts
    // remover however.
    for (let i = 0; i < vmState.targets.length; i++) {
      vmState.targets[i].blocks = {};
      const variableKeys = Object.keys(vmState.targets[i].variables);
      variableKeys.forEach(key => {
        const variable = vmState.targets[i].variables[key];
        if (vmState.targets[i].isStage) {
          // In Scratch, global variables are actually stored as sprite variables on the stage.
          globalVariables.push({ name: variable[0], value: variable[1] });
        } else {
          globalVariables.push({ name: `${vmState.targets[i].name}_${variable[0]}`, value: variable[1] });
        }
      });
      vmState.targets[i].variables = {};
      vmState.targets[i].lists = {};
      vmState.targets[i].broadcasts = {};
    }

    // Step 3: some odd jobs
    // TODO: implement these

    // Remove monitors as Patch doesn't support them
    vmState.monitors = [];

    // Step 4: make everything a child of "vmstate" and add global variables
    // TODO: global variables
    const baseJson = { vmstate: vmState, globalVariables: globalVariables };

    return JSON.stringify(baseJson);
  }

  /**
   * Converts an object representation of a Scratch target's blocks into an object
   * representation of the corresponding Patch threads and thread code.
   *
   * @param {PatchTarget} target
   * @returns {PatchTargetThread[]} An array of object representations of the patch threads
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  convertTargetBlocks(target: PatchTarget) {
    // TODO: convert variables
    // https://en.scratch-wiki.info/wiki/Scratch_File_Format#Blocks

    const { blocks } = target;

    const blocksKeys = Object.keys(blocks);

    const returnVal: PatchTargetThread[] = [];

    const hats = Object.keys({ ...EventHats, ...ControlHats });

    const hatLocations: string[] = [];

    blocksKeys.forEach(blockId => {
      const block = blocks[blockId];
      if (hats.includes(block.opcode)) {
        hatLocations.push(blockId);
      }
    });

    hatLocations.forEach(hatId => {
      const returnValPart = convertBlocksPart(target, hatId, blocks[hatId].next as string);

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
