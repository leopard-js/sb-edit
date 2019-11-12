import Block from "./Block";
import Costume from "./Costume";
import List from "./List";
import Project from "./Project";
import Script from "./Script";
import Sound from "./Sound";
import Variable from "./Variable";

export default class Target {
  public name: string;
  public costumes: Costume[] = [];
  public costumeNumber: number = 0;
  public sounds: Sound[] = [];
  public scripts: Script[] = [];
  public variables: Variable[] = [];
  public lists: List[] = [];
  public volume: number = 100;
  public layerOrder: number = 0;

  public project?: Project;

  constructor(options: TargetOptions) {
    Object.assign(this, options);
  }

  public get blocks(): Block[] {
    return this.scripts.flatMap(script => {
      return script.blocks.flatMap(block => block.blocks);
    });
  }

  public setName(name: string) {
    this.name = name;
  }
}

type TargetOptions = Partial<Target> & { name: string };

export class Stage extends Target {
  public name: string = "Stage";

  constructor(options: TargetOptions = { name: "Stage" }) {
    super(options);

    Object.assign(this, options);
  }

  public toObject() {
    const result = { ...this };
    delete result.project;
    return result;
  }

  get isStage() {
    return true;
  }
}

type SpriteOptions = TargetOptions & Partial<Sprite>;

export class Sprite extends Target {
  public x: number = 0;
  public y: number = 0;
  public size: number = 1;
  public direction: number = 90;
  public rotationStyle: "normal" | "leftRight" | "none" = "normal";
  public isDraggable: boolean = true;
  public visible: boolean = true;

  constructor(options: SpriteOptions) {
    super(options);

    Object.assign(this, options);
  }

  public delete() {
    const index = this.project.sprites.indexOf(this);
    this.project.sprites.splice(index, 1);
  }

  public toObject() {
    const result = { ...this };
    delete result.project;
    return result;
  }

  get isStage() {
    return false;
  }
}
