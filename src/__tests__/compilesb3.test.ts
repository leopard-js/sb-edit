import { Project } from "..";

import * as fs from "fs";
import * as path from "path";

async function loadProject(filename) {
  const file = fs.readFileSync(path.join(__dirname, filename));
  return await Project.fromSb3(file);
}

test("sb3 -> sb3", async () => {
  const project = await loadProject("test.sb3");
  expect(project.toSb3()).toMatchSnapshot();
});

test("sb3 -> scratch-js", async () => {
  const project = await loadProject("test.sb3");
  expect(project.toScratchJS()).toMatchSnapshot();
});

test("sb3 -> scratchblocks", async () => {
  const project = await loadProject("test.sb3");
  expect(project.toScratchblocks()).toMatchSnapshot();
});
