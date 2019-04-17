import { customSerializeTsFiles, customSerailizeVueFilesWithSinaFormat, customSerializeVueFiles, CustomSerializerConfig, CustomSerializerConfigForDirectory} from "../src/index";
import {removeCompilationStageDecorator} from "../src/removeDecorator";
import path from "path";
import fs from "fs";

const config: CustomSerializerConfigForDirectory = {
  serializeDecoratorNameList: [
    "SComponent",
    "Prop",
    "Inject",
    "Design",
    "dataType"
  ],
  entryDecoratorFilters: ["SComponent"],
  withSinaFormatTransformer: true
};

// const out = customSerializeTsFiles([path.join(__dirname, "../template/index.ts")], config)
// const out = customSerailizeVueFilesWithSinaFormat(
//   [path.join(__dirname, "../template/index.vue")],
//   config
// );
// fs.writeFileSync("./result.json", JSON.stringify(out, undefined, 2));

const sourceText = fs.readFileSync(
  path.join(__dirname, "../template/index.ts"),
).toString();
removeCompilationStageDecorator(sourceText, ["asd"]);

