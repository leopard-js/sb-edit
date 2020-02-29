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
  public costumeNumber = 0;
  public sounds: Sound[] = [];
  public scripts: Script[] = [];
  public variables: Variable[] = [];
  public lists: List[] = [];
  public volume = 100;
  public layerOrder = 0;

  public project?: Project;

  public isStage = false;

  constructor(options: TargetOptions) {
    Object.assign(this, options);
  }

  public get blocks(): Block[] {
    return this.scripts.flatMap(script => {
      return script.blocks.flatMap(block => block.blocks);
    });
  }

  public setName(name: string): void {
    this.name = name;
  }
}

type TargetOptions = Partial<Target> & { name: string };

export class Stage extends Target {
  public name = "Stage";
  public isStage = true;

  constructor(options: TargetOptions = { name: "Stage" }) {
    super(options);

    Object.assign(this, options);
  }

  public toObject() {
    const result = { ...this };
    delete result.project;
    return result;
  }
}

type SpriteOptions = TargetOptions & Partial<Sprite>;

export class Sprite extends Target {
  public x = 0;
  public y = 0;
  public size = 1;
  public direction = 90;
  public rotationStyle: "normal" | "leftRight" | "none" = "normal";
  public isDraggable = true;
  public visible = true;

  constructor(options: SpriteOptions) {
    super(options);

    Object.assign(this, options);
  }

  public delete(): void {
    const index = this.project.sprites.indexOf(this);
    this.project.sprites.splice(index, 1);
  }

  public toObject() {
    const result = { ...this };
    delete result.project;
    return result;
  }
}
