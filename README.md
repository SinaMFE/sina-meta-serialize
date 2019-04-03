# Simple usage

```javascript
const {
  customSerializeVueFiles: serializeVueFiles,
  CustomSerializerConfig
} = require("@mfelibs/scp-meta-extract");
const fs = require("fs");
const path = require("path");
const glob = require("glob");

const config: CustomSerializerConfig = {
  serializeDecoratorNameList: ["Component", "Prop", "Inject", "Design"],
  entryDecoratorFilters: ["Component"]
};

function main() {
  serializeVueFromDirectory(path.join(__dirname, "modules"))
}

function serializeVueFromDirectory(dirName) {
  glob(`${dirName}/**/*.vue`, function (err, files) {
    const resolvedFilePath = files.map(file => path.resolve(file))
    const output = serializeVueFiles(resolvedFilePath, config)
    fs.writeFileSync("classes.json", JSON.stringify(output, undefined, 2));
  })
}

main()
```