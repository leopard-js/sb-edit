import { generateId } from "./util/id";

type SoundDataFormat = "mp3" | "wav" | "wave";

export default class Sound {
  public name: string;
  public id: string;

  public dataFormat: SoundDataFormat;
  public data: any;

  public md5: string;

  public sampleCount: number;
  public sampleRate: number;

  constructor(options: {
    name: string;
    id?: string;

    dataFormat: SoundDataFormat;
    data: any;

    md5: string;

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
