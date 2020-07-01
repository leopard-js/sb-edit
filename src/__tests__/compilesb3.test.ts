import { Project } from "..";

import * as fs from "fs";
import * as path from "path";

async function loadProject(filename): Promise<Project> {
  const file = fs.readFileSync(path.join(__dirname, filename));
  return Project.fromSb3(file);
}

test("sb3 -> sb3", async () => {
  const project = await loadProject("test.sb3");
  expect(JSON.parse(project.toSb3().json)).toMatchSnapshot();
});

test("sb3 -> leopard", async () => {
  const project = await loadProject("test.sb3");
  expect(project.toLeopard()).toMatchSnapshot();
});

test("sb3 -> scratchblocks", async () => {
  const project = await loadProject("test.sb3");
  expect(project.toScratchblocks()).toMatchSnapshot();
});
