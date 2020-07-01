import { Sprite, Stage } from "./Target";

import fromSb3, { fromSb3JSON } from "./io/sb3/fromSb3";
import toSb3 from "./io/sb3/toSb3";
import toLeopard from "./io/leopard/toLeopard";
import toScratchblocks from "./io/scratchblocks/toScratchblocks";

export type TextToSpeechLanguage =
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

  public toSb3: typeof toSb3 = toSb3.bind(this);
  public toLeopard: typeof toLeopard = toLeopard.bind(this);
  public toScratchblocks: typeof toScratchblocks = toScratchblocks.bind(this);

  public stage: Stage = new Stage();
  public sprites: Sprite[] = [];
  public tempo = 60;
  public videoOn = false;
  public videoAlpha = 0.5;
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
}
