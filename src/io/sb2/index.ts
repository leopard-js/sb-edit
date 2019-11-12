interface Variable {
  name: string;
  value: number; // TODO: Is this always a number?
  isPersistent: boolean;
}

type ScriptComment = [number, number, number, number, boolean, number, string];

interface Sound {
  soundName: string;
  soundID: number;
  md5: string;
  sampleCount: number;
  rate: number;
  format: string;
}

interface Costume {
  costumeName: string;
  baseLayerID: number;
  baseLayerMD5: string;
  bitmapResolution: number;
  rotationCenterX: number;
  rotationCenterY: number;
}

interface Info {
  swfVersion: string;
  userAgent: string;
  projectID: string;
  flashVersion: string;
  scriptCount: number;
  videoOn: boolean;
  spriteCount: number;
}

type Script = [number, number, [Block]];

type Block = [string, ...any[]];

export interface ProjectJSON {
  objName: string;
  variables: Variable[];
  // TODO: scripts
  scriptComments: ScriptComment[];
  sounds: Sound[];
  costumes: Costume[];
  currentCostumeIndex: number;
  penLayerMD5: string;
  penLayerID: number;
  tempoBPM: number;
  videoAlpha: number;
  // TODO: children
  info: Info;
}
