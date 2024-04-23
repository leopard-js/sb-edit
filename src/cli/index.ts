#! /usr/bin/env node

import { Command, Option } from "commander";
import Project from "../Project";

import * as fs from "fs";
import { resolve } from "path";
import * as JSZip from "jszip";

import * as chalk from "chalk";

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

// Infer input type
if (inputType === undefined) {
  inputType = "sb3";
}

// Infer output type
if (outputType === undefined) {
  if (output.endsWith(".zip")) {
    outputType = "leopard-zip";
  } else {
    outputType = "leopard";
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
    process.stdout.write(chalk.gray`  ${stepNumber++}. ${description}`);
    let value: ReturnType;
    try {
      value = await fn();
      process.stdout.write(chalk.bold.green(" Done.\n"));
    } catch (err) {
      if (err instanceof StepError) {
        process.stdout.write(chalk.bold.red(` ${err.message}`));
        process.stdout.write(chalk.red(`\n\nProject conversion failed.\n`));
      } else {
        process.stdout.write(chalk.bold.red` An unknown error occurred.`);
        process.stderr.write(chalk.red`\n\n${err}\n`);
      }
      process.exit(1);
    }
    return value;
  }

  process.stdout.write(chalk.underline.gray`Converting project:\n`);

  const fullInputPath = resolve(process.cwd(), input);

  const project = await writeStep(
    `${chalk.bold("Importing")} ${inputType} project from path ${chalk.white(fullInputPath)}.`,
    async () => {
      let file: Buffer;
      try {
        file = fs.readFileSync(fullInputPath);
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
      const project = await Project.fromSb3(file);
      return project;
    }
  );

  switch (outputType) {
    case "leopard": {
      const leopard = await writeStep(`${chalk.bold("Converting")} project to ${chalk.white("Leopard")}.`, () => {
        const leopard = project.toLeopard();
        return leopard;
      });

      const fullOutputPath = resolve(process.cwd(), output);

      await writeStep(`${chalk.bold("Exporting")} project to directory ${chalk.white(fullOutputPath)}.`, () => {
        // First, make sure the output path is an empty directory (create it if it doesn't exist)
        let existingFiles: string[];
        try {
          existingFiles = fs.readdirSync(fullOutputPath);
        } catch (err) {
          if (err instanceof Object && "code" in err) {
            switch (err.code) {
              case "ENOENT":
                // Directory does not exist, create it
                fs.mkdirSync(output, { recursive: true });
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
          // Create directories as needed
          fs.mkdirSync(resolve(fullOutputPath, filename, ".."), { recursive: true });

          // Write the file
          fs.writeFileSync(resolve(fullOutputPath, filename), contents);
        }

        for (const target of [project.stage, ...project.sprites]) {
          for (const costume of target.costumes) {
            const filename = `${target.name}/costumes/${costume.name}.${costume.ext}`;
            const asset = Buffer.from(costume.asset as ArrayBuffer);
            fs.mkdirSync(resolve(fullOutputPath, filename, ".."), { recursive: true });
            fs.writeFileSync(resolve(fullOutputPath, filename), asset);
          }

          for (const sound of target.sounds) {
            const filename = `${target.name}/sounds/${sound.name}.${sound.ext}`;
            const asset = Buffer.from(sound.asset as ArrayBuffer);
            fs.mkdirSync(resolve(fullOutputPath, filename, ".."), { recursive: true });
            fs.writeFileSync(resolve(fullOutputPath, filename), asset);
          }
        }
      });

      process.stdout.write(chalk.green`\nProject exported to Leopard format.`);
      process.stdout.write(chalk.gray` Files written to ${chalk.white(fullOutputPath)}\n\n`);
      process.stdout.write(
        chalkBox([
          { str: "To preview the project, run:" },
          { str: `$ ${chalk.white`cd ${output}`}`, length: 5 + output.length },
          { str: `$ ${chalk.white`npx vite`}`, length: 10 }
        ])
      );
      break;
    }
    case "leopard-zip": {
      const leopard = await writeStep(`${chalk.bold("Converting")} project to ${chalk.white("Leopard")}.`, () => {
        const leopard = project.toLeopard();
        return leopard;
      });

      const fullOutputPath = resolve(process.cwd(), output);

      await writeStep(`${chalk.bold("Exporting")} project to zip file ${chalk.white(fullOutputPath)}.`, () => {
        // First, check if file name is already taken
        try {
          fs.accessSync(fullOutputPath);
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

        zip.generateNodeStream({ type: "nodebuffer", streamFiles: true }).pipe(fs.createWriteStream(fullOutputPath));
      });

      break;
    }
  }
}

function chalkBox(lines: { str: string; length?: number }[]): string {
  const lengths = lines.map(line => line.length ?? line.str.length);
  const boxInnerWidth = Math.max(...lengths) + 2;

  let outputStr = "";
  outputStr += chalk.bold.blue`╔${"═".repeat(boxInnerWidth)}╗`;
  for (const line of lines) {
    const length = line.length ?? line.str.length;
    outputStr += chalk.bold.blue`\n║ `;
    outputStr += chalk.gray(line.str);
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
