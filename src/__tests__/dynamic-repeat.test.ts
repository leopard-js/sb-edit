import { Project } from "..";

import * as fs from "fs";
import * as path from "path";

async function loadProject(filename: string): Promise<Project> {
  const file = fs.readFileSync(path.join(__dirname, filename));
  return Project.fromSb3(file);
}

test("dynamic-repeat.sb3 -> leopard", async () => {
  const project = await loadProject("dynamic-repeat.sb3");
  expect(project.toLeopard()["Tests/Tests.js"]).toMatchSnapshot();
});
