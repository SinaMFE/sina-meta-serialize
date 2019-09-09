import _ from "lodash/fp";
import { serializer } from "ts-meta-extract";
import { setContext, getContext } from "./context";

export namespace sinaMeta {
  /**
   * The declaration of transformed result of function `sinaTransformer()`.
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

  export interface OLD_ProperyValue {
    name: string | undefined;
    returnType: string | undefined;
    isPrimitiveType: boolean;
    isArray: boolean;
    design: any;
  }

  export interface MetaTransformerHost {
    getUniqueIdOfComponent(component: string): string;
  }
}

/**
 * Transfrom result of ts serializer into sina required format.
 *
 * @export
 * @param {*} meta
 * @returns
 */
export function transformMeta(
  meta: any,
  metaTransformerHost: sinaMeta.MetaTransformerHost
): sinaMeta.TransfomedResult {
  // Set host to global context.
  setContext(metaTransformerHost);

  const dataTypes = collectDataType(meta);
  const components = collectComponents(meta);
  const processedComponents = transformComponentsTypeReferToDecoratorValue(
    components,
    dataTypes
  );
  const oldDataTypes = processCompatibility(dataTypes);
  const oldComponents = processCompatibility(processedComponents);
  return {
    dataTypes: oldDataTypes,
    components: oldComponents
  };
}

/**
 * In order to satisfy the old structure.
 * If you can use a new structure to represent a complex type, you
 * only need to delete the call to this function.
 *
 * @param {sinaMeta.ClassMap} map
 * @returns
 */
function processCompatibility(map: sinaMeta.ClassMap) {
  const output = _.mapValues(handleEachType)(map);
  return output;

  function handleEachType(type: sinaMeta.Class) {
    const props = _.mapValues<any, any>(handleProps)(type.props);
    // Filter out the original type name of type
    return {
      name: type.name,
      props
    };

    /**
     * In order to satisfy the old structure, the first type of the complex
     * type such as the union type is taken as the final output type.
     *
     * @param {sinaMeta.PropertyValue} prop
     * @returns {sinaMeta.OLD_ProperyValue}
     */
    function handleProps(
      prop: sinaMeta.PropertyValue
    ): sinaMeta.OLD_ProperyValue {
      const returnTypeObject = Array.isArray(prop.returnType)
        ? prop.returnType[0]
        : prop.returnType;
      const initial = {
        ...prop,
        returnType: returnTypeObject.typeString,
        ...returnTypeObject
      };
      delete initial.typeString;
      return initial;
    }
  }
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
  const transformedComp = _.mapValues<any, any>(handleComponent)(components);
  return transformedComp;

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
    let parsedTypeString = type.typeString;

    // If a type is array type, use first generic type as type instead.
    if (type.isArray) {
      if (!type.genericTypeArgs || type.genericTypeArgs.length === 0) {
        throw new Error(
          `An error occurred during the parsing of the type ${type.typeString}: ` +
            "the type is parsed as an array type, but the generic of the array cannot be found.\n" +
            "Please contact the maintainer."
        );
      }
      parsedTypeString = type.genericTypeArgs[0];
    }

    // If a type is a Class, transform the type identifier to its decorator id.
    if (
      !type.isPrimitiveType &&
      !isBoxedObjectType(type) &&
      !isPrimitiveArrayType(type)
    ) {
      // Despite situation of Array type and primitive type.
      if (!parsedTypeString) {
        throw new Error(
          `Error in transform type to class component identify decorator: \n` +
            JSON.stringify(type) +
            ";\nUnkonw type string."
        );
      }
      parsedTypeString = mapTypeStringToDecoratorIdVal(
        parsedTypeString,
        dataTypes
      );
    }
    return {
      ...type,
      typeString: parsedTypeString
    };
  }

  function isBoxedObjectType(prop: serializer.SerializedType): boolean {
    const BOXED_OBJECT_STRING = ["Boolean", "String", "Number", "Object"];
    return BOXED_OBJECT_STRING.indexOf(prop.typeString || "") > -1;
  }

  function isPrimitiveArrayType(prop: serializer.SerializedType) {
    return (
      prop.isArray &&
      prop.genericTypeArgs &&
      isPrimitiveTypeByString(prop.genericTypeArgs[0] || "")
    );
  }

  function mapTypeStringToDecoratorIdVal(type: string, dataTypes: any): string {
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
  const { getUniqueIdOfComponent } = getContext();
  // Components are unlike dependencies because deps need to be filtered.
  const name = getUniqueIdOfComponent(component);
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

  let typeName = getOriginalTypeName(dep);

  const nameInDecoratorValue = getNameInDecoratorVal(decorators);

  const props = transformProps(members);

  return {
    // Use id in decorator to define a dependency instead of the parsed class name.
    name: nameInDecoratorValue,
    props,
    // Original typeName is for postprocess to identify type reference of root class members.
    originalTypeName: typeName
  };

  function getNameInDecoratorVal(decorators: any) {
    return _.compose<any, any, any>(
      getDataTypeId,
      _.head,
      _.filter(isDataTypeDecorator)
    )(decorators);
  }

  /**
   * In ts, the default exported name is "default". Since complex types
   * are not supported, in order to find the original defined class name,
   * the first class of the complex type is taken first, and the defined
   * type name is obtained by string matching.
   *
   * @param {*} dep
   * @returns
   */
  function getOriginalTypeName(dep: any) {
    const { name, type } = dep;
    let typeString;
    if (Array.isArray(type)) {
      typeString = type[0].typeString;
    } else {
      typeString = type.typeString;
    }
    let typeName = name;
    if (name === "default") {
      // This class is a default module export, thus it's name is `default`.
      // Use type in `type` property instead.
      typeName = _.compose(
        _.last,
        _.split("typeof ")
      )(typeString);
    }
    return typeName;
  }
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
      ? typeOfSymbol.childTypes
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
 * @deprecated Do this when mapping types.
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
