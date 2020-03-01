import Block from "./Block";
import Costume from "./Costume";
import Project from "./Project";
import Script from "./Script";
import Sound from "./Sound";
import { List, Variable } from "./Data";

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

  public getCostume(name: string): Costume {
    return this.costumes.find(costume => costume.name === name);
  }

  public getSound(name: string): Sound {
    return this.sounds.find(sound => sound.name === name);
  }

  public getVariable(name: string): Variable {
    return this.variables.find(variable => variable.name === name);
  }

  public getList(name: string): List {
    return this.lists.find(list => list.name === name);
  }
}

export type TargetOptions = Partial<Target> & { name: string };

export class Stage extends Target {
  public name = "Stage";
  public isStage: true = true;

  constructor(options: TargetOptions = { name: "Stage" }) {
    super(options);

    Object.assign(this, options);
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
}
