import { customSerializeTsFiles, serailizeVueFilesWithSinaFormat, customSerializeVueFiles, CustomSerializerConfig} from "../src/index";
import path from "path";
import fs from "fs";

const config: CustomSerializerConfig = {
  serializeDecoratorNameList: ["SComponent", "Prop", "Inject", "Design", "dataType"],
  entryDecoratorFilters: ["SComponent"]
};

// const out = customSerializeTsFiles([path.join(__dirname, "../template/index.ts")], config)
const out = serailizeVueFilesWithSinaFormat(
  [path.join(__dirname, "../template/index.vue")],
  config
);

fs.writeFileSync("./result.json", JSON.stringify(out));
