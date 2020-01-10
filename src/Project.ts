import { Sprite, Stage } from "./Target";

import fromSb3, { fromSb3JSON } from "./io/sb3/fromSb3";
import toSb3 from "./io/sb3/toSb3";
import toScratchJS from "./io/scratch-js/toScratchJS";
import toScratchblocks from "./io/scratchblocks/toScratchblocks";

type TextToSpeechLanguage =
  | "ar"
  | "zh-cn"
  | "da"
  | "nl"
  | "en"
  | "fr"
  | "de"
  | "hi"
  | "is"
  | "it"
  | "ja"
  | "ko"
  | "nb"
  | "pl"
  | "pt-br"
  | "pt"
  | "ro"
  | "ru"
  | "es"
  | "es-419"
  | "sv"
  | "tr"
  | "cy";

export default class Project {
  public static fromSb3 = fromSb3;
  public static fromSb3JSON = fromSb3JSON;

  public toScratchJS: typeof toScratchJS = toScratchJS.bind(this);
  public toScratchblocks: typeof toScratchblocks = toScratchblocks.bind(this);

  public stage: Stage = new Stage();
  public sprites: Sprite[] = [];
  public tempo: number = 60;
  public videoOn: boolean = false;
  public videoAlpha: number = 0.5;
  public textToSpeechLanguage: TextToSpeechLanguage = null;

  constructor(options: {
    stage?: Stage;
    sprites?: Sprite[];
    tempo?: number;
    videoOn?: boolean;
    videoAlpha?: number;
    textToSpeechLanguage?: TextToSpeechLanguage;
  }) {
    Object.assign(this, options);

    for (const sprite of this.sprites) {
      sprite.project = this;
    }
  }

  public sprite(id: string | number) {
    switch (typeof id) {
      case "string":
        return this.sprites.find(sprite => sprite.name === id) || null;
      case "number":
        return this.sprites[id] || null;
      default:
        return null;
    }
  }

  public toObject() {
    return {
      ...this,
      stage: this.stage.toObject(),
      sprites: this.sprites.map(sprite => sprite.toObject())
    };
  }
}
