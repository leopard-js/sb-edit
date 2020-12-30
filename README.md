# sb-edit

sb-edit is a javascript library for manipulating Scratch project files.

> #### 🚧 Warning!
>
> sb-edit is still a work-in-progress. Not everything will work, and the API will probably change drastically. Don't get too comfortable the way things are. ;)

## Importing and exporting

sb-edit allows importing and exporting a variety of Scratch project file types:

| File Format                                            | Import     | Export         |
| ------------------------------------------------------ | ---------- | -------------- |
| Scratch 3.0 (**.sb3**)                                 | ✅ Yes     | ✅ Yes         |
| Scratch 2.0 (**.sb2**)                                 | 🕒 Planned | 🕒 Planned     |
| [Leopard](https://github.com/PullJosh/leopard)         | ❌ No      | ✅ Yes         |
| [scratchblocks](https://github.com/tjvr/scratchblocks) | 👻 Maybe!  | 🚧 In progress |

## Editing

sb-edit can also be used to modify Scratch projects. A few things you can/will be able to do with sb-edit:

|                     | Add        | Edit       | Delete     |
| ------------------- | ---------- | ---------- | ---------- |
| Sprites             | 🕒 Planned | ✅ Yes     | ✅ Yes     |
| Stage               | ❌ No      | ✅ Yes     | ❌ No      |
| Scripts             | 🕒 Planned | 🕒 Planned | 🕒 Planned |
| Costumes and sounds | 🕒 Planned | 🕒 Planned | 🕒 Planned |

## Development

If you want to help develop the sb-edit package, you'll need to follow these steps:

### Step 1: Download sb-edit and prepare to use

```shell
> git clone https://github.com/PullJosh/sb-edit.git
> cd sb-edit
> npm link # Allow using sb-edit in another local project
```

### Step 2: Add sb-edit as dependency in another project

```shell
> cd my-cool-project
> npm init # This should be a node project
> npm link sb-edit # Similar to `npm install` but uses local version
```

### Step 3: Modify sb-edit

If you make any changes to the sb-edit source code, you'll have to rebuild the package. Here's how:

```shell
> cd sb-edit # Cloned from Github and then edited
> npm run build # Build the new version!
> npm run watch # Watch files and rebuild automatically when code is changed
```

You can also run the [Jest](https://jestjs.io/) tests to make sure you didn't break anything:

```shell
> cd sb-edit # You're probably already here ;)
> npm test # Run Jest tests
> npm run lint # Check code for style problems
```

And finally, make sure everything is pretty:

```shell
> cd sb-edit
> npm run format # Format code to look nice with Prettier
```

## Code Examples

### Import an .sb3 file in Node

```js
const { Project } = require("sb-edit");
const fs = require("fs");
const path = require("path");

const file = fs.readFileSync(path.join(__dirname, "myProject.sb3"));
const project = await Project.fromSb3(file);

console.log(project);
```

### Export an .sb3 file in Node

```js
const { Project } = require("sb-edit");
const fs = require("fs");
const path = require("path");

const project = /* Get yourself a `Project`... */;

const saveLocation = path.join(__dirname, "myProject.sb3");
fs.writeFileSync(saveLocation, Buffer.from(await project.toSb3()));

// `project` is now saved at ./myProject.sb3
```

### Get Leopard code for project

```js
const project = /* Get yourself a `Project`... */;

console.log(project.toLeopard({ printWidth: 100 })); // Optionally pass a Prettier config object!
```
