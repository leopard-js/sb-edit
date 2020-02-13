type CostumeDataFormat = "png" | "svg" | "jpeg" | "jpg" | "bmp" | "gif";

export default class Costume {
  public name: string;
  public dataFormat: CostumeDataFormat;
  public data: any;

  public md5: string;
  public ext: string;

  public bitmapResolution: number;
  public centerX: number;
  public centerY: number;

  constructor(options: {
    name: string;
    dataFormat: CostumeDataFormat;
    data: any;

    md5: string;
    ext: string;

    bitmapResolution: number;
    centerX: number;
    centerY: number;
  }) {
    this.name = options.name;
    this.dataFormat = options.dataFormat;
    this.data = options.data;

    this.md5 = options.md5;
    this.ext = options.ext;

    this.bitmapResolution = options.bitmapResolution;
    this.centerX = options.centerX;
    this.centerY = options.centerY;
  }

  public setName(name: string): void {
    this.name = name;
  }
}
