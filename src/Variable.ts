import { generateId } from "./util/id";

type ScalarValue = number | string | boolean;

export default class Variable {
  public name: string;
  public id: string;

  public value: ScalarValue;
  public cloud = false;

  public visible = true;
  public mode: "default" | "slider" | "large" = "default";
  public x = 0;
  public y = 0;
  public sliderMin = 0;
  public sliderMax = 100;
  public isDiscrete = true;

  constructor(options: {
    name: string;
    id?: string;

    value: ScalarValue;
    cloud?: boolean;

    visible?: boolean;
    mode?: "default" | "slider" | "large";
    x?: number;
    y?: number;
    sliderMin?: number;
    sliderMax?: number;
    isDiscrete?: boolean;
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
