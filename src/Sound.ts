import { generateId } from "./util/id";

type SoundDataFormat = "mp3" | "wav" | "wave";

export default class Sound {
  public name: string;
  public id: string;

  public asset: unknown;

  public md5: string;
  public ext: SoundDataFormat;

  public sampleCount: number | null;
  public sampleRate: number | null;

  constructor(options: {
    name: string;
    id?: string;

    asset: unknown;

    md5: string;
    ext: SoundDataFormat;

    sampleCount?: number | null;
    sampleRate?: number | null;
  }) {
    this.name = options.name;
    this.id = options.id ?? generateId();

    this.asset = options.asset;

    this.md5 = options.md5;
    this.ext = options.ext;

    this.sampleCount = options.sampleCount ?? null;
    this.sampleRate = options.sampleRate ?? null;
  }

  public setName(name: string): void {
    this.name = name;
  }
}
