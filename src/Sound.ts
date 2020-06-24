import { generateId } from "./util/id";

type SoundDataFormat = "mp3" | "wav" | "wave";

export default class Sound {
  public name: string;
  public id: string;

  public asset: any;

  public md5: string;
  public ext: SoundDataFormat;

  public sampleCount: number;
  public sampleRate: number;

  constructor(options: {
    name: string;
    id?: string;

    asset: any;

    md5: string;
    ext: SoundDataFormat;

    sampleCount: number;
    sampleRate: number;
  }) {
    Object.assign(this, options);

    if (!this.id) {
      this.id = generateId();
    }
  }

  public setName(name: string): void {
    this.name = name;
  }
}
