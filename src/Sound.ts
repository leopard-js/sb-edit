export default class Sound {
  public name: string;
  public md5: string;
  public ext: string;
  public sampleCount: number;
  public sampleRate: number;
  public format: string;
  public asset: any;

  constructor(options: {
    name: string;
    md5: string;
    ext: string;
    sampleCount: number;
    sampleRate: number;
    format: string;
    asset: any;
  }) {
    Object.assign(this, options);
  }

  public setName(name: string) {
    this.name = name;
  }
}
