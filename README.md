# sina-meta-serialize

A tool to serilize classes in vue files and can be used for designer. All processes are in compiling stage.

## Usage

To serialize dozens of vue files:

```javascript
const { customSerializeVueFiles } = require("sina-meta-serialize");
const fs = require("fs");
const path = require("path");
const glob = require("glob");

const config: CustomSerializerConfig = {
  serializeDecoratorNameList: ["Component", "Prop", "Inject", "Design"],
  entryDecoratorFilters: ["Component"],
  withSinaFormatTransformer: true,
  serializeType: "component"
};

function main() {
  const output = customSerializeVueFiles(
    ["./src/index.vue", "./src/card.vue"],
    config
  );
  fs.writeFileSync("classes.json", JSON.stringify(output, undefined, 2));
}

main();
```

Or you can just pass a directory to a export function `customSerializeVueByDirectory`:

```javascript
const { customSerializeVueByDirectory } = require("sina-meta-serialize");
const fs = require("fs");
const path = require("path");
const config = {
  serializeDecoratorNameList: ["SComponent", "Design", "dataType"],
  entryDecoratorFilters: ["SComponent"],
  withSinaFormatTransformer: true,
  serializeType: "component"
};

main();

async function main() {
  const output = await customSerializeVueByDirectory(
    path.join(__dirname, "./src"),
    config
  );
  fs.writeFileSync("./result.json", JSON.stringify(output, undefined, 2));
}
```

If you are serializing a page (not component), you should use:

```javascript
const { customSerializeVueByDirectory } = require("sina-meta-serialize");
const fs = require("fs");
const path = require("path");

const config = {
  serializeDecoratorNameList: ["SPage", "Design", "dataType"],
  entryDecoratorFilters: ["SPage"],
  withSinaFormatTransformer: true,
  viewDirname: "taskEnvelop",
  serializeType: "page"
};

main();

async function main() {
  const output = await customSerializeVueByDirectory(
    path.join(__dirname, "./src"),
    config
  );
  fs.writeFileSync("./result.json", JSON.stringify(output, undefined, 2));
}
```

The `serializeType` indicates type of this serialization, it can be either `"page"` or `"component"`, and you should also offer a `viewDirname` property to tell which child folder the serialization excutes if you are serializing a page.

## Interface

**customSerializeVueByDirectory**`(path, config)`accept a directory path and process all vue files in it. Parameter `path` is the location of target directory. Parameter `config` is some configuration to specify serialization functions.

`config` includes:

- **serializeDecoratorNameList**: Accept a string array to specify decorators which should be serialized.

- **entryDecoratorFilters**: Accept a string array to define decorators which entry class should be decorated by. Only classes with those decorators will be serialized.

- **withSinaFormatTransformer**: Accept a boolean. If this is `true` then the output will be transformed into format sina desire. Otherwise it will be normal format.

- **serializeType**: Accept a string. Can be `"component"` or `"page"`.

- **viewDirname**: Accept a string. If the `serializeType` is set to `"page"`, then this config should be provided to indicate which child folder to be serialized.
