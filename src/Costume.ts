import { generateId } from "./util/id";

type CostumeDataFormat = "png" | "svg" | "jpeg" | "jpg" | "bmp" | "gif";

export default class Costume {
  public name: string;
  public id: string;

  public dataFormat: CostumeDataFormat;
  public data: any;

  public md5: string;
  public ext: string;

  public bitmapResolution: number;
  public centerX: number;
  public centerY: number;

  constructor(options: {
    name: string;
    id?: string;

    dataFormat: CostumeDataFormat;
    data: any;

    md5: string;
    ext: string;

    bitmapResolution: number;
    centerX: number;
    centerY: number;
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
