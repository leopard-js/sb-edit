import { Project } from "..";

import * as fs from "fs";
import * as path from "path";

test("sb3 -> scratch-js", async () => {
  const file = fs.readFileSync(path.join(__dirname, "test.sb3"));
  const project = await Project.fromSb3(file);

  expect(project.toScratchJS()).toMatchSnapshot();
});
