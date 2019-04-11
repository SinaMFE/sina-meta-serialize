# sina-meta-serialize
A tool to serilize classes in vue files and can be used for designer. All processes are in compiling stage.

## Usage
To serialize dozens of vue files:
```javascript
const {
  customSerializeVueFiles,
} = require("@mfelibs/scp-meta-extract");
const fs = require("fs");
const path = require("path");
const glob = require("glob");

const config: CustomSerializerConfig = {
  serializeDecoratorNameList: ["Component", "Prop", "Inject", "Design"],
  entryDecoratorFilters: ["Component"],
  withSinaFormatTransformer: true
};

function main() {
  const output = customSerializeVueFiles(["./src/index.vue", "./src/card.vue"], config);
  fs.writeFileSync("classes.json", JSON.stringify(output, undefined, 2));
}

main()
```

Or you can just pass a directory to a export function `customSerializeVueByDirectory`:
```javascript
const { customSerializeVueByDirectory } = require("sina-meta-serialize");
const fs = require("fs");
const path = require("path")
const config = {
  serializeDecoratorNameList: [
    "SComponent",
    "Design",
    "dataType"
  ],
  entryDecoratorFilters: ["SComponent"],
  withSinaFormatTransformer: true
};

main();

async function main() {
  const output = await customSerializeVueByDirectory(path.join(__dirname, "./src"), config);
  fs.writeFileSync("./result.json", JSON.stringify(output, undefined, 2));
}
```

## Interface

**customSerializeVueByDirectory**`(path, config)`accept a directory path and process all vue files in it. Parameter `path` is the location of target directory. Parameter `config` is some configuration to specify serialization functions.

`config` includes:

- **serializeDecoratorNameList**: Accept a string array to specify decorators which should be serialized. 

- **entryDecoratorFilters**: Accept a string array to define decorators which entry class should be decorated by. Only classes with those decorators will be serialized.

- **withSinaFormatTransformer**: Accept a boolean. If this is `true` then the output will be transformed into format sina desire. Otherwise it will be normal format.
