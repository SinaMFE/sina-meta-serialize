import { transformMeta } from "./meta-transformer";
import { curryRight2 } from "../utils";
import { getIdOfPage, getIdOfComponent } from "./getUniqueId";

export const transformMetaForPage = curryRight2(transformMeta)({
  getUniqueIdOfComponent: getIdOfPage
});
export const transfomrMetaForComp = curryRight2(transformMeta)({
  getUniqueIdOfComponent: getIdOfComponent
});

export { sinaMeta } from "./meta-transformer";
