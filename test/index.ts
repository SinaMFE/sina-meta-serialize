import { customSerializeTsFiles, customSerializeVueFiles, CustomSerializerConfig} from "../src/index";
import path from "path";
import fs from "fs";

const config: CustomSerializerConfig = {
  serializeDecoratorNameList: ["Component", "Prop", "Inject", "Design"],
  entryDecoratorFilters: ["Component"]
};

const out = customSerializeTsFiles([path.join(__dirname, "../template/index.ts")], config)
// const out = customSerializeVueFiles([
//   path.join(__dirname, "../template/index.vue")
// ], config);

fs.writeFileSync("./result.json", JSON.stringify(out));
