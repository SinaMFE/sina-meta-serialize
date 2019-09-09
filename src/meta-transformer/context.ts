import { sinaMeta } from "./meta-transformer";

// Currently the context is the same as host.
let metaTransformerContext: sinaMeta.MetaTransformerHost | null = null;

export function setContext(ctx: sinaMeta.MetaTransformerHost) {
  metaTransformerContext = ctx;
}

export function getContext() {

  if(!metaTransformerContext) {
    throw new Error("Meta transformer host has not been set before get.")
  }

  return metaTransformerContext;
}
