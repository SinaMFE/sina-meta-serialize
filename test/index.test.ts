import {
  customSerializeTsFiles,
  customSerailizeVueFilesWithSinaFormat,
  customSerializeVueFiles,
  CustomSerializerConfig,
  CustomSerializerConfigForDirectory,
  SerializeType
} from "../src/index";
import { removeCompilationStageDecoratorsInTsText } from "../src/remove-decorator";
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
  serializeType: SerializeType.Component,
  withSinaFormatTransformer: true
};

const testConfig: CustomSerializerConfig = {
  serializeDecoratorNameList: ["SComponent", "Design", "dataType"],
  entryDecoratorFilters: ["SComponent"]
};

// const out = customSerializeTsFiles([path.join(__dirname, "../template/index.ts")], config)
const out = customSerailizeVueFilesWithSinaFormat(
  [path.join(__dirname, "../template/index.vue")],
  testConfig,
  SerializeType.Component
);
fs.writeFileSync("./result.json", JSON.stringify(out, undefined, 2));

// const sourceText = fs
//   .readFileSync(path.join(__dirname, "../template/index.ts"))
//   .toString();
// removeCompilationStageDecorators(sourceText, );
