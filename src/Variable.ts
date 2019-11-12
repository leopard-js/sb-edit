export default class Variable {
  public name: string;
  public value: number | string;
  public cloud: boolean = false;

  public visible: boolean = true;
  public mode: "default" | "slider" | "large" = "default";
  public x: number = 0;
  public y: number = 0;
  public sliderMin: number = 0;
  public sliderMax: number = 100;
  public isDiscrete: boolean = true;

  public id: string;

  constructor(
    options: {
      name: string;
      value: number | string;
      cloud?: boolean;

      visible?: boolean;
      mode?: "default" | "slider" | "large";
      x?: number;
      y?: number;
      sliderMin?: number;
      sliderMax?: number;
      isDiscrete?: boolean;
    },
    id?: string
  ) {
    Object.assign(this, options);

    if (id) {
      this.id = id;
    } else {
      // If not provided, generate id randomly.
      let id = "";
      for (let i = 0; i < 24; i++) {
        id += Math.floor(Math.random() * 36).toString(36);
      }
      this.id = id;
    }
  }

  public setName(name: string) {
    this.name = name;
  }
}
