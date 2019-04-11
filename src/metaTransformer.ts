import _ from "lodash/fp";

enum SComponentName {
  Version = "sversion",
  Name = "sname"
}

/**
 * Transfrom result of ts serializer into sina required format.
 *
 * @export
 * @param {*} meta
 * @returns
 */
export function sinaTransformer(meta: any) {
  const dataTypes = collectDataType(meta);
  const components = collectComponents(meta);
  const processedComponents = transformComponentsTypeReferToDecoratorValue(components, dataTypes);

  return {
    dataTypes,
    components: processedComponents
  };
}

function collectComponents(datalist: any[]): { name: string; props: any } {
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
}

/**
 * Mainly handle the type reference of components' property, and use sina specified id
 * in decorator of class instead.
 *
 * @param {*} components
 * @param {*} dataTypes
 * @returns
 */
function transformComponentsTypeReferToDecoratorValue(components: any, dataTypes: any) {
  const output = _.mapValues(handleComponent)(components);
  return output;

  function handleComponent(component: any) {
    const props = _.mapValues(handleProps)(component.props)
    return {
      ...component,
      props
    }
  }

  function handleProps(prop: Prop) {
      let returnType = prop.returnType;
      if(!prop.isPrimitiveType) {
        returnType = findTypeStringtoDecoratorValue(
          prop.returnType,
          dataTypes
        );
      }
      return {
        ...prop,
        returnType
      }
    }

  function findTypeStringtoDecoratorValue(type: string, dataTypes: any): string {
    const nameInDecoratorLiteral = _.compose(_.property("name"), _.find(_.matches({originalTypeName: type})))(dataTypes)
    return nameInDecoratorLiteral
  }
}

function collectDataType(datalist: any[]): { name: string; props: any } {
  const dependencies = getAllDenpendecies(datalist);
  return _.compose<any, any, any, any>(
    _.mapValues(_.head),
    _.groupBy("name"),
    _.compact,
    _.map(transformDataType)
  )(dependencies);
}

function transformComponent(component: any): { name: string; props: any } {
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

  function getVersionOfComponent(component: any) {
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

function transformDataType(dep: any) {
  if (isDepContainDataTypeDecorator(dep)) {
    const out = transformSingleDep(dep);
    if (!out.name) {
      throw new Error(
        `Cannot get "code" from "dataType" decorator in type declaration ${dep}`
      );
    }
    return out;
  }
}

function isDepContainDataTypeDecorator(dep: any): boolean {
  const { decorators } = dep;
  return _.any((decorator: any) => decorator.name === "dataType")(decorators);
}
function transformSingleDep(dep: any): { name: string; props: any, originalTypeName: string } {
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
function transformProps(members: any[]) {
  return _.compose<any, any, any, any, any, any>(
    _.mapValues(filterAndMapProps),
    _.mapValues(_.head),
    _.groupBy("name"),
    _.map(transformDecoratorForMember),
    _.filter(isMemberhasDesginDecorator)
  )(members);

  
  function filterAndMapProps(prop: any) {
    return {
      name: prop.name,
      returnType: prop.type,
      isPrimitiveType: prop.isPrimitiveType,
      design: prop.design
    };
  }
}

/**
 * Called by transformProps
 *
 * @param {*} member
 * @returns
 */
function isMemberhasDesginDecorator(member: any) {
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
