import _ from "lodash/fp";
import { serializer } from "ts-meta-extract";

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
    name: string | undefined;
    returnType: serializer.SerializedType[] | serializer.SerializedType;
    design: any;
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

  function handleProps(prop: sinaMeta.PropertyValue): sinaMeta.PropertyValue {
    return {
      ...prop,
      returnType: Array.isArray(prop.returnType)
        ? prop.returnType.map(handleReturnValue)
        : handleReturnValue(prop.returnType)
    };
  }

  function handleReturnValue(type: serializer.SerializedType) {
    let typeString = type.typeString;
    if (
      !type.isPrimitiveType &&
      !isBoxedObjectType(type) &&
      !isPrimitiveArrayType(type)
    ) {
      // Despite situation of Array type and primitive type.
      if (!type.typeString) {
        throw new Error(
          `Error in transform type to class component identify decorator: \n` +
            JSON.stringify(type) +
            ";\nUnkonw type string."
        );
      }
      typeString = findTypeStringtoDecoratorValue(type.typeString, dataTypes);
    }
    return {
      ...type,
      typeString
    };
  }

  function isBoxedObjectType(prop: serializer.SerializedType): boolean {
    const BOXED_OBJECT_STRING = ["Boolean", "String", "Number", "Object"];
    return BOXED_OBJECT_STRING.indexOf(prop.typeString || "") > -1;
  }

  function isPrimitiveArrayType(prop: serializer.SerializedType) {
    return prop.isArray && isPrimitiveTypeByString(prop.typeString || "");
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
  const { decorators, members, name, type } = dep;

  let typeName = name;
  if (name === "default") {
    // This class is a default module export, thus it's name is `default`.
    // Use type in `type` property instead.
    typeName = _.compose(
      _.last,
      _.split("typeof ")
    )(type);
  }

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
    originalTypeName: typeName
  };
}

/**
 * Transform members meta data to props format.
 *
 * @param {any[]} members
 * @returns
 */
function transformProps(
  members: serializer.SerializedSymbol[]
): sinaMeta.Property {
  const props = members.filter(isMemberhasDesginDecorator).map(member => {
    const typeOfSymbol = member.type;
    const design = transformDecoratorToDesignForMember(member);
    // If a type is advanced type, it must have `childTypes`.
    // Note: this step didn't consider situation that type itself an array type.
    // If this kind of type should be supported, transformer should be redesigned.
    const returnType = typeOfSymbol.typeOfAdvancedType
      ? typeOfSymbol.childTypes!.map(transformReturnTypeForArrayType)
      : typeOfSymbol;
    return {
      name: member.name,
      returnType,
      design
    };
  });
  return _.compose<any, any>(
    _.mapValues(_.head),
    _.groupBy("name")
  )(props);
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

/**
 * Array was represented as an `Array` generic.
 * So replace return type with first generic type if props is an array.
 *
 * @param {*} type
 * @returns
 */
function transformReturnTypeForArrayType(type: any) {
  let returnType = type;
  if (type.isArray) {
    returnType = type.genericTypeArgs[0];
  }
  return returnType;
}

/**
 * Called by transformProps
 *
 * @param {*} member
 * @returns
 */
function transformDecoratorToDesignForMember(member: any) {
  const decorators = member.decorators;
  const transformedDecorator = _.compose<any, any, any>(
    _.head,
    _.compact,
    _.map(transformDecorator)
  )(decorators);

  return transformedDecorator;

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
