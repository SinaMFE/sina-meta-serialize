import _ from "lodash/fp";

enum SComponentName {
  Version = "sversion",
  Name = "sname"
}

export namespace sinaMeta {
  /**
   * The definition of transformed result of `sinaTransformer`.
   *
   * @export
   * @interface TransfomedResult
   */
  export interface TransfomedResult {
    /**
     * Mainly are the dependencies of `components`.
     *
     * @type {ClassMap}
     * @memberof TransfomedResult
     */
    dataTypes: ClassMap;
    /**
     * Components of sina project.
     *
     * @type {ClassMap}
     * @memberof TransfomedResult
     */
    components: ClassMap;
  }
  export interface ClassMap {
    [className: string]: Class;
  }
  export interface Class {
    name: string;
    props: Property;
    originalTypeName?: string;
  }

  export interface Property {
    [prop: string]: PropertyValue;
  }

  export interface PropertyValue {
    name: string;
    returnType: string;
    isPrimitiveType: boolean;
    design: any;
    isArray: boolean;
  }
}

/**
 * Transfrom result of ts serializer into sina required format.
 *
 * @export
 * @param {*} meta
 * @returns
 */
export function sinaTransformer(meta: any): sinaMeta.TransfomedResult {
  const dataTypes = collectDataType(meta);
  const components = collectComponents(meta);
  const processedComponents = transformComponentsTypeReferToDecoratorValue(
    components,
    dataTypes
  );
  return {
    dataTypes,
    components: processedComponents
  };
}

function collectComponents(datalist: any[]): sinaMeta.ClassMap {
  const components = getAllComponents(datalist);
  return _.compose<any, any, any>(
    _.mapValues(_.head),
    _.groupBy("name"),
    _.map(transformComponent)
  )(components);
}

/**
 * Property item specified of each serialized class in final result files.
 *
 * @interface Prop
 */
interface Prop {
  isPrimitiveType: boolean;
  name: string;
  returnType: string;
  isArray: boolean;
}

/**
 * Mainly handle the type reference of components' property, and use sina specified id
 * in decorator of class instead.
 *
 * @param {*} components
 * @param {*} dataTypes
 * @returns
 */
function transformComponentsTypeReferToDecoratorValue(
  components: sinaMeta.ClassMap,
  dataTypes: sinaMeta.ClassMap
): sinaMeta.ClassMap {
  const output = _.mapValues<any, any>(handleComponent)(components);
  return output;

  function handleComponent(component: any) {
    const props = _.mapValues(handleProps)(component.props);
    return {
      ...component,
      props
    };
  }

  function handleProps(prop: Prop) {
    let returnType = prop.returnType;
    if (
      !prop.isPrimitiveType &&
      !isBoxedObjectTypeProp(prop) &&
      !isPrimitiveArrayTypeProp(prop)
    ) {
      // Despite situation of Array type and primitive type.
      returnType = findTypeStringtoDecoratorValue(prop.returnType, dataTypes);
    }
    return {
      ...prop,
      returnType
    };
  }

  function isBoxedObjectTypeProp(prop: Prop): boolean {
    const BOXED_OBJECT_STRING = ["Boolean", "String", "Number", "Object"];
    return BOXED_OBJECT_STRING.indexOf(prop.returnType) > -1
  }

  function isPrimitiveArrayTypeProp(prop: Prop) {
    return prop.isArray && isPrimitiveTypeByString(prop.returnType);
  }

  function findTypeStringtoDecoratorValue(
    type: string,
    dataTypes: any
  ): string {
    const nameInDecoratorLiteral = _.compose(
      _.property("name"),
      _.find(_.matches({ originalTypeName: type }))
    )(dataTypes);
    return nameInDecoratorLiteral;
  }
}

function collectDataType(datalist: any[]): sinaMeta.ClassMap {
  const dependencies = getAllDenpendecies(datalist);
  return _.compose<any, any, any, any>(
    _.mapValues(_.head),
    _.groupBy("name"),
    _.compact,
    _.map(transformDataType)
  )(dependencies);
}

function transformComponent(component: any): sinaMeta.Class {
  // Components are unlike dependencies because deps need to be filtered.
  const name = getIdOfComponent(component);
  const props = transformProps(component.members);
  if (!name) {
    throw new Error(
      `Cannot get "name" from "SComponent" decorator from class declaration ${component}.`
    );
  }
  return {
    name,
    props
  };

  function getIdOfComponent(component: any) {
    return getParsedSComponentDecorator(component)[SComponentName.Name];
  }

  /**
   * ?? Havenot implmented because is a runtime feature.
   *
   * @param {*} component
   * @returns
   */
  function getVersionOfComponent(component: any) {
    // Meaningless.
    return getParsedSComponentDecorator(component)[SComponentName.Version];
  }

  function getParsedSComponentDecorator(component: any) {
    const decorator = getDecoratorByName(component.decorators, "SComponent");
    let out;
    try {
      out = _.compose<any, any, any, any, any>(
        JSON.parse,
        _.property("value"),
        _.head,
        _.property("args")
      )(decorator);
    } catch (e) {
      throw new Error(
        `Cannot get valid meta data for SComponent decorator of class ${component}`
      );
    }
    return out;
  }
}

function getDecoratorByName(decorators: any[], name: string) {
  return _.find(_.matches({ name }), decorators);
}

function transformDataType(dep: any): sinaMeta.Class | undefined {
  if (isDepContainDataTypeDecorator(dep)) {
    const out = transformSingleDep(dep);
    if (!out.name) {
      throw new Error(
        `Cannot get "code" from "dataType" decorator in type declaration ${dep}`
      );
    }
    return out;
  } else {
    return undefined;
  }
}

function isDepContainDataTypeDecorator(dep: any): boolean {
  const { decorators } = dep;
  return _.any((decorator: any) => decorator.name === "dataType")(decorators);
}
function transformSingleDep(dep: any): sinaMeta.Class {
  const { decorators, members, name } = dep;

  const nameInDecoratorValue = _.compose<any, any, any>(
    getDataTypeId,
    _.head,
    _.filter(isDataTypeDecorator)
  )(decorators);

  const props = transformProps(members);
  // Original typeName is for postprocess to identify type reference of root class members.
  return {
    name: nameInDecoratorValue,
    props,
    originalTypeName: name
  };
}

/**
 * Transform members meta data to props format.
 *
 * @param {any[]} members
 * @returns
 */
function transformProps(members: any[]): sinaMeta.Property {
  return _.compose<any, any, any, any, any, any>(
    _.mapValues(filterAndMapProps),
    _.mapValues(_.head),
    _.groupBy("name"),
    _.map(transformReturnTypeIfArray),
    _.map(transformDecoratorForMember),
    _.filter(isMemberhasDesginDecorator)
  )(members);

  function filterAndMapProps(prop: any): sinaMeta.PropertyValue {
    return {
      name: prop.name,
      returnType: prop.returnType,
      isPrimitiveType: prop.isPrimitiveType,
      isArray: prop.isArray,
      design: prop.design
    };
  }
}

function isPrimitiveTypeByString(type: string): boolean {
  return type === "string" || type === "boolean" || type === "number";
}

/**
 * Called by transformProps
 *
 * @param {*} member
 * @returns
 */
function isMemberhasDesginDecorator(member: any): boolean {
  const decorators = member.decorators;
  return _.filter(isDesignDecorator)(decorators).length > 0;
}

/**
 * Called by transformProps
 *
 * @param {*} decorator
 * @returns
 */
function isDesignDecorator(decorator: any) {
  return decorator.name === "Design";
}

function transformReturnTypeIfArray(member: any) {
  let returnType = member.type;
  if (member.isArray) {
    returnType = member.genericTypeArgs[0];
  }
  member.returnType = returnType;
  return member;
}

/**
 * Called by transformProps
 *
 * @param {*} member
 * @returns
 */
function transformDecoratorForMember(member: any) {
  const decorators = member.decorators;
  const transformedDecorator = _.compose<any, any, any>(
    _.head,
    _.compact,
    _.map(transformDecorator)
  )(decorators);
  member.design = transformedDecorator;

  return member;

  function transformDecorator(decorator: any) {
    const { name, args } = decorator;
    const arg: any = _.head(args);
    if (name === "Design" && arg && arg.type === "object") {
      return JSON.parse(arg.value);
    }
    return undefined;
  }
}

function isDataTypeDecorator(decorator: any) {
  return decorator.name === "dataType";
}

/**
 * Get property `code` value of the first argument(object literal) in data type decorator
 *
 * @param {*} decorator
 * @returns
 */
function getDataTypeId(decorator: any) {
  const jsonString = _.compose<any, any, any>(
    _.property("value"),
    _.head,
    _.property("args")
  )(decorator);
  const type = _.compose<any, any, any>(
    _.property("type"),
    _.head,
    _.property("args")
  )(decorator);

  if (type !== "object") {
    throw new Error(
      "First argument type of decorator `dataType` is not an object literal."
    );
  }
  return JSON.parse(jsonString).code;
}

/**
 * Get all Dependencies from a data list, which is produced by meta extractor.
 *
 * @param {any[]} dataList
 * @returns
 */
function getAllDenpendecies(dataList: any[]) {
  const getDependencies = _.compose<any, any, any, any>(
    _.flatten,
    _.map(_.property("dependencies")),
    _.property("result")
  );
  const dependencies = _.compose<any, any>(
    _.flatten,
    _.map(getDependencies)
  )(dataList);

  return dependencies;
}

/**
 * Get all components from a data list.
 *
 * @param {any[]} dataList
 */
function getAllComponents(dataList: any[]) {
  const getComponents = _.compose<any, any, any>(
    _.flatten,
    _.map(_.property("root")),
    _.property("result")
  );
  return _.compose<any, any>(
    _.flatten,
    _.map(getComponents)
  )(dataList);
}
