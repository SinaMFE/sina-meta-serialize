import { removeCompilationStageDecoratorsForVueFile } from "../src/index";
import path from "path";
import fs from "fs";

const removeOptions = {
  classElementDecorators: ["Design"],
  classDecorators: ["SComponent"]
};

const source = fs
  .readFileSync(path.join(__dirname, "../template/index.vue"))
  .toString();

const output = removeCompilationStageDecoratorsForVueFile(
  source,
  removeOptions
);

console.log(output)