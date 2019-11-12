export default class Costume {
  public name: string;
  public md5: string;
  public ext: string;
  public bitmapResolution: number;
  public centerX: number;
  public centerY: number;
  public asset: any;

  constructor(options: {
    name: string;
    md5: string;
    ext: string;
    bitmapResolution: number;
    centerX: number;
    centerY: number;
    asset: any;
  }) {
    Object.assign(this, options);
  }

  public setName(name: string) {
    this.name = name;
  }
}
