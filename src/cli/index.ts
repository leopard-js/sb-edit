#!/usr/bin/env node

import { Command, Option } from "commander";
import Project from "../Project";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import JSZip from "jszip";
import chalk from "chalk";
import wcwidth from "wcwidth";

const program = new Command();

program.name("sb-edit").description("CLI for manipulating Scratch projects");

program
  .requiredOption("-i, --input <path>", "The path to the input project")
  .addOption(new Option("-it, --input-type <type>", "The type of input file").choices(["sb3"]))
  .requiredOption("-o, --output <path>", "The path to the output project")
  .addOption(new Option("-ot, --output-type <type>", "The type of output file").choices(["leopard", "leopard-zip"]));

program.parse();

const options: {
  input: string;
  inputType: "sb3";
  output: string;
  outputType: "leopard" | "leopard-zip";
} = program.opts();

let { input, inputType, output, outputType } = options;

class InferTypeError extends Error {
  constructor(public readonly stage: "input" | "output", message: string) {
    super(message);
    this.name = "InferTypeError";
    Object.setPrototypeOf(this, InferTypeError.prototype);
  }
}

try {
  // Infer input type
  if (inputType === undefined) {
    if (input.endsWith(".sb3")) {
      inputType = "sb3";
    } else if (input.endsWith(".sb") || input.endsWith(".sprite")) {
      throw new InferTypeError("input", "Scratch 1.4 input projects are not currently supported.");
    } else if (input.endsWith(".sb2") || input.endsWith(".sprite2")) {
      throw new InferTypeError("input", "Scratch 2.0 input projects are not currently supported.");
    } else if (input.endsWith(".sprite3")) {
      throw new InferTypeError("input", "Scratch 3.0 sprite inputs are not currently supported.");
    } else {
      throw new InferTypeError("input", "Could not infer input file type.");
    }
  }

  // Infer output type
  if (outputType === undefined) {
    if (output.endsWith(".zip")) {
      outputType = "leopard-zip";
    } else if (output.endsWith(".sb")) {
      throw new InferTypeError("output", "Scratch 1.4 output projects are not currently supported.");
    } else if (output.endsWith(".sb2")) {
      throw new InferTypeError("output", "Scratch 2.0 output projects are not currently supported.");
    } else if (output.endsWith(".sb3")) {
      throw new InferTypeError("output", "Scratch 3.0 output projects are not currently supported.");
    } else if (path.extname(output) === "") {
      outputType = "leopard";
    } else {
      throw new InferTypeError("output", "Could not infer output type.");
    }
  }
} catch (err) {
  if (err instanceof InferTypeError) {
    process.stderr.write(chalk.red`${err.message}`);
    switch (err.stage) {
      case "input":
        process.stderr.write(
          chalk.gray` Please choose a different input file. (Or, if your file is actually of a supported type and just has an unusual file name, specify the correct type with --input-type.)\n`
        );
        break;
      case "output":
        process.stderr.write(
          chalk.gray` Please choose a different output path or specify the desired output type with --output-type.\n`
        );
        break;
    }
    process.exit(1);
  }
}

async function run() {
  class StepError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "StepError";
      Object.setPrototypeOf(this, StepError.prototype);
    }
  }

  let stepNumber = 1;
  async function writeStep<ReturnType>(description: string, fn: () => ReturnType | Promise<ReturnType>) {
    const thisStepNumber = stepNumber++;
    process.stdout.write(chalk.gray`  ${thisStepNumber}. ${description}`);
    let value: ReturnType;
    try {
      value = await fn();
      process.stdout.write(chalk.bold.green(" Done.\n"));
    } catch (err) {
      if (err instanceof StepError) {
        process.stdout.write(chalk.bold.red(`\n${" ".repeat(4 + String(thisStepNumber).length)}${err.message}`));
        process.stdout.write(chalk.red(`\n\nProject conversion failed.\n`));
      } else {
        process.stdout.write(
          chalk.bold.red`\n${" ".repeat(4 + String(thisStepNumber).length)}An unknown error occurred.`
        );
        process.stderr.write(chalk.red`\n\n${err}\n`);
      }
      process.exit(1);
    }
    return value;
  }

  process.stdout.write(chalk.underline.gray`Converting project:\n`);

  const fullInputPath = path.resolve(process.cwd(), input);

  const project = await writeStep(
    `${chalk.bold("Importing")} ${inputType} project from path ${chalk.white(fullInputPath)}.`,
    async () => {
      let file: Buffer;
      try {
        file = await fs.readFile(fullInputPath);
      } catch (err) {
        if (err instanceof Object && "code" in err) {
          switch (err.code) {
            case "ENOENT":
              throw new StepError("File not found.");
            case "EISDIR":
              throw new StepError("Input path is a directory but should be a file.");
          }
        }
        throw err;
      }

      let project: Project;
      switch (inputType) {
        case "sb3": {
          project = await Project.fromSb3(file);
          break;
        }
      }
      return project;
    }
  );

  switch (outputType) {
    case "leopard": {
      const leopard = await writeStep(`${chalk.bold("Converting")} project to ${chalk.white("Leopard")}.`, () => {
        return project.toLeopard();
      });

      const fullOutputPath = path.resolve(process.cwd(), output);

      await writeStep(`${chalk.bold("Exporting")} project to directory ${chalk.white(fullOutputPath)}.`, async () => {
        // First, make sure the output path is an empty directory (create it if it doesn't exist)
        let existingFiles: string[];
        try {
          existingFiles = await fs.readdir(fullOutputPath);
        } catch (err) {
          if (err instanceof Object && "code" in err) {
            switch (err.code) {
              case "ENOENT":
                // Directory does not exist, create it
                await fs.mkdir(output, { recursive: true });
                existingFiles = [];
                break;
              case "ENOTDIR":
                throw new StepError("Output path is a file, not a directory.");
              default:
                throw err;
            }
          } else {
            throw err;
          }
        }

        if (existingFiles.length > 0) {
          throw new StepError("Output directory is not empty.");
        }

        // Write the files
        for (const [filename, contents] of Object.entries(leopard)) {
          const filePath = path.resolve(fullOutputPath, filename);

          // Create directories as needed
          await fs.mkdir(path.dirname(filePath), { recursive: true });

          // Write the file
          await fs.writeFile(filePath, contents);
        }

        for (const target of [project.stage, ...project.sprites]) {
          const costumeDir = path.join(target.name, "costumes");
          for (const costume of target.costumes) {
            const filename = path.join(costumeDir, `${costume.name}.${costume.ext}`);
            const asset = Buffer.from(costume.asset as ArrayBuffer);
            await fs.mkdir(path.resolve(fullOutputPath, filename, ".."), { recursive: true });
            await fs.writeFile(path.resolve(fullOutputPath, filename), asset);
          }

          const soundDir = path.join(target.name, "sounds");
          for (const sound of target.sounds) {
            const filename = path.join(soundDir, `${sound.name}.${sound.ext}`);
            const asset = Buffer.from(sound.asset as ArrayBuffer);
            await fs.mkdir(path.resolve(fullOutputPath, filename, ".."), { recursive: true });
            await fs.writeFile(path.resolve(fullOutputPath, filename), asset);
          }
        }
      });

      process.stdout.write(chalk.green`\nProject exported to Leopard format.`);
      process.stdout.write(chalk.gray` Files written to ${chalk.white(fullOutputPath)}\n\n`);
      process.stdout.write(
        chalkBox([
          "To preview the project, run:",
          `$ ${chalk.white`cd ${output}`}`,
          `$ ${chalk.white`npx vite`} # or serve with any HTTP server`
        ])
      );
      break;
    }
    case "leopard-zip": {
      const leopard = await writeStep(`${chalk.bold("Converting")} project to ${chalk.white("Leopard")}.`, () => {
        const leopard = project.toLeopard();
        return leopard;
      });

      const fullOutputPath = path.resolve(process.cwd(), output);

      await writeStep(`${chalk.bold("Exporting")} project to zip file ${chalk.white(fullOutputPath)}.`, async () => {
        // First, check if file name is already taken
        try {
          await fs.access(fullOutputPath);
          throw new StepError("Output file already exists.");
        } catch (err) {
          if (err instanceof Object && "code" in err && err.code === "ENOENT") {
            // File does not exist, good
          } else {
            throw err;
          }
        }

        const zip = new JSZip();

        for (const [filename, contents] of Object.entries(leopard)) {
          zip.file(filename, contents);
        }

        for (const target of [project.stage, ...project.sprites]) {
          for (const costume of target.costumes) {
            const filename = `${target.name}/costumes/${costume.name}.${costume.ext}`;
            const asset = Buffer.from(costume.asset as ArrayBuffer);
            zip.file(filename, asset);
          }

          for (const sound of target.sounds) {
            const filename = `${target.name}/sounds/${sound.name}.${sound.ext}`;
            const asset = Buffer.from(sound.asset as ArrayBuffer);
            zip.file(filename, asset);
          }
        }

        zip
          .generateNodeStream({ type: "nodebuffer", streamFiles: true })
          .pipe((await fs.open(fullOutputPath)).createWriteStream());
      });

      break;
    }
  }
}

function chalkBox(lines: string[]): string {
  const lengths = lines.map(line => wcwidth(line));
  const boxInnerWidth = Math.max(...lengths) + 2;

  let outputStr = "";
  outputStr += chalk.bold.blue`╔${"═".repeat(boxInnerWidth)}╗`;
  for (const line of lines) {
    const length = wcwidth(line);
    outputStr += chalk.bold.blue`\n║ `;
    outputStr += chalk.gray(line);
    outputStr += " ".repeat(boxInnerWidth - length - 2);
    outputStr += chalk.bold.blue` ║`;
  }
  outputStr += chalk.bold.blue(`\n╚${"═".repeat(boxInnerWidth)}╝\n`);

  return outputStr;
}

run().catch(err => {
  if (err instanceof Error) {
    console.error(err.stack);
  }

  process.exit(1);
});
