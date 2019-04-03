import { customSerializeTsFiles} from "../src/index";
import path from "path";
import fs from "fs";

const out = customSerializeTsFiles([path.join(__dirname, "../template/index.ts")])

fs.writeFileSync("./result.json", JSON.stringify(out));