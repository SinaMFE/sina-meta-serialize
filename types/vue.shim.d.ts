// A shim for "vue" module, because we are using "vue-template-compiler" to
// parse vue SFC without depend on "vue". But ts compiler will emit errors 
// when vue type files were not included.
declare module "vue" {
  export const VNode: any;
}

declare interface VNode {}
