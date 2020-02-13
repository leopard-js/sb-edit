type SoundDataFormat = "mp3" | "wav" | "wave";

export default class Sound {
  public name: string;
  public dataFormat: SoundDataFormat;
  public data: any;

  public md5: string;
  public ext: string;

  public sampleCount: number;
  public sampleRate: number;

  constructor(options: {
    name: string;
    dataFormat: SoundDataFormat;
    data: any;

    md5: string;
    ext: string;

    sampleCount: number;
    sampleRate: number;
  }) {
    this.name = options.name;
    this.dataFormat = options.dataFormat;
    this.data = options.data;

    this.md5 = options.md5;
    this.ext = options.ext;

    this.sampleCount = options.sampleCount;
    this.sampleRate = options.sampleRate;
  }

  public setName(name: string): void {
    this.name = name;
  }
}
