import { generateId } from "./util/id";

type CostumeDataFormat = "png" | "svg" | "jpeg" | "jpg" | "bmp" | "gif";

export default class Costume {
  public name: string;
  public id: string;

  public asset: unknown;

  public md5: string;
  public ext: CostumeDataFormat;

  public bitmapResolution: number;
  public centerX: number | null;
  public centerY: number | null;

  constructor(options: {
    name: string;
    id?: string;

    asset: unknown;

    md5: string;
    ext: CostumeDataFormat;

    bitmapResolution: number;
    centerX?: number | null;
    centerY?: number | null;
  }) {
    this.name = options.name;
    this.id = options.id ?? generateId();

    this.asset = options.asset;

    this.md5 = options.md5;
    this.ext = options.ext;

    this.bitmapResolution = options.bitmapResolution;
    this.centerX = options.centerX ?? null;
    this.centerY = options.centerY ?? null;
  }

  public setName(name: string): void {
    this.name = name;
  }
}
