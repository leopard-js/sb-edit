import { generateId } from "./util/id";

type CostumeDataFormat = "png" | "svg" | "jpeg" | "jpg" | "bmp" | "gif";

export default class Costume {
  public name: string;
  public id: string;

  public asset: any;

  public md5: string;
  public ext: CostumeDataFormat;

  public bitmapResolution: number;
  public centerX: number | null;
  public centerY: number | null;

  constructor(options: {
    name: string;
    id?: string;

    asset: any;

    md5: string;
    ext: CostumeDataFormat;

    bitmapResolution: number;
    centerX: number | null;
    centerY: number | null;
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
