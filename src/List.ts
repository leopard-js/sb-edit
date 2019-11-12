export default class List {
  public name: string;
  public value: string[];

  public visible: boolean = true;
  public x: number = 0;
  public y: number = 0;
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
