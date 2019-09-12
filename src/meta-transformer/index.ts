import { transformMeta } from "./meta-transformer";
import { curryRight2 } from "../utils";
import { getIdOfPage, getIdOfComponent, getCompTitle, getPageTitle } from './getUniqueId';

export const transformMetaForPage = curryRight2(transformMeta)({
  getUniqueIdOfRootClass: getIdOfPage,
  getTitleOfRootClass: getPageTitle
});
export const transfomrMetaForComp = curryRight2(transformMeta)({
  getUniqueIdOfRootClass: getIdOfComponent,
  getTitleOfRootClass: getCompTitle
});

export { sinaMeta } from "./meta-transformer";
