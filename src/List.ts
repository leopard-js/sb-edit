import { generateID } from "./util/id";

export default class List {
  public name: string;
  public value: string[];

  public visible = true;
  public x = 0;
  public y = 0;
  public width: number = null;
  public height: number = null;

  public id: string;

  constructor(
    options: {
      name: string;
      value: string[];

      visible?: boolean;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    },
    id?: string
  ) {
    Object.assign(this, options);

    if (id) {
      this.id = id;
    } else {
      // If not provided, generate id randomly.
      this.id = generateID();
    }
  }

  public setName(name: string): void {
    this.name = name;
  }
}
