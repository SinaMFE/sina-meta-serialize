import { customSerializeTsFiles, customSerializeVueFiles } from "../src/index";
import path from "path";
import fs from "fs";

// const out = customSerializeTsFiles([path.join(__dirname, "../template/index.ts")])
const out = customSerializeVueFiles([
  path.join(__dirname, "../template/index.vue")
]);

fs.writeFileSync("./result.json", JSON.stringify(out));
