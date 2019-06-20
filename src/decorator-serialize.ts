import ts from "typescript";
import { curryRight3 } from "./utils";

// Directly analyze type of a symbol object by `ts.SymbolFlags`.
namespace SymbolType {
  export function isClass(symbol: ts.Symbol) {
    return symbol.getFlags() === ts.SymbolFlags.Class;
  }
  export function isInterface(symbol: ts.Symbol) {
    return symbol.getFlags() === ts.SymbolFlags.Interface;
  }
  export function isAlias(symbol: ts.Symbol) {
    return symbol.getFlags() === ts.SymbolFlags.Alias;
  }
}

// Includes functions that indicate semantic type of node.
namespace NodeType {
  export function isBooleanLiteralNode(node: ts.Node) {
    return isTrueKeywordNode(node) || isFalseKeywordNode(node);
  }
  export function isTrueKeywordNode(node: ts.Node) {
    return node.kind === ts.SyntaxKind.TrueKeyword;
  }

  export function isFalseKeywordNode(node: ts.Node) {
    return node.kind === ts.SyntaxKind.FalseKeyword;
  }
}

// Includes functions that analyze the symbol type of node.
namespace NodeSymbolType {
  export function isClassTypeIdentifier(
    node: ts.Identifier,
    checker: ts.TypeChecker
  ) {
    const type = checker.getTypeAtLocation(node);
    const symbol = type.getSymbol();
    if (symbol && SymbolType.isClass(symbol)) {
      return true;
    }
    return false;
  }
  export function isInterfaceTypeIdentifier(
    node: ts.Identifier,
    checker: ts.TypeChecker
  ) {
    const type = checker.getTypeAtLocation(node);
    const symbol = type.getSymbol();
    if (symbol && SymbolType.isInterface(symbol)) {
      return true;
    }
    return false;
  }
}

namespace decoratorInfo {
  // Structured decorator info
  export interface Decorator {
    name: string;
    args: ArgumentListItem[];
  }

  // The description of decorator auguments.
  export type ArgumentListItem =
    | LiteralContent
    | EnumContent
    | ChainContent
    | ObjectContent
    | NullContent
    | ErrorContent
    | IdentifierContent
    | BooleanContent;

  type LiteralContent = {
    type: "string literal" | "numeric literal";
    value: string;
  };

  type BooleanContent = {
    type: "boolean";
    value: "true" | "false";
  };

  type IdentifierContent = {
    type: "identifier";
    value: any;
  };

  type EnumContent = {
    type: "property";
    value: number | string;
  };

  type ObjectContent = {
    type: "object";
    value: any;
  };

  type ChainContent = {
    type: "propertyAccessRaw";
    value: string[];
  };

  type NullContent = {
    type: "null";
  };

  type ErrorContent = {
    type: "error";
    value: string;
  };
}

interface DecoratorSerializeConfig {
  decoratorNameList: string[];
  serializeRefClass?(node: ts.ClassDeclaration): string | undefined;
}

/**
 * The utility function to provide a default serialization of decorators.
 * But only the decorators named in string list will be used.
 *
 * @export
 * @param {string[]} decoratorNameList
 * @returns
 */
export function serializeDecoratorForSina(config: DecoratorSerializeConfig) {
  return (node: ts.Decorator, checker: ts.TypeChecker) => {
    return serializeDecoratorNode(node, checker, config);
  };
}

/**
 * Process decorator node of TS AST and return structured node details.
 *
 * @param {ts.Decorator} node
 * @returns {DecoratorDescriptor}
 */
function serializeDecoratorNode(
  node: ts.Decorator,
  checker: ts.TypeChecker,
  config: DecoratorSerializeConfig
): decoratorInfo.Decorator | undefined {
  let structuredAugs: decoratorInfo.ArgumentListItem[] = [];
  const decoratorName = getDecoratorName(node);
  if (config.decoratorNameList.indexOf(decoratorName) < 0) {
    return undefined;
  }
  if (ts.isIdentifier(node.expression)) {
    // No argument for decorator.
  } else {
    const expression = node.expression as ts.CallExpression;
    expression.arguments
      .map(curryRight3(serializeArgument)(config)(checker))
      .forEach((content: any) => {
        structuredAugs.push(content);
      });
  }

  return { name: decoratorName, args: structuredAugs };
}

/**
 * Get the name string of decorator.
 *
 * @param {ts.Decorator} node
 * @returns {string}
 */
function getDecoratorName(node: ts.Decorator): string {
  let decoratorName: string;
  if (ts.isIdentifier(node.expression)) {
    // No argument for decorator.
    decoratorName = node.expression.text;
  } else {
    const expression = node.expression as ts.CallExpression;
    decoratorName = (expression.expression as ts.Identifier).text;
  }
  return decoratorName;
}

/**
 * Serialize object literal ts node into json object.
 *
 * NOTE: This will only serialize object literal with primitive type properties.
 * Not in usage now.
 *
 * @deprecated
 * @param {ts.ObjectLiteralExpression} node
 * @returns {string}
 */
function serializeObjectLiteral(node: ts.ObjectLiteralExpression): string {
  const printer = ts.createPrinter();
  const result = printer.printNode(
    ts.EmitHint.Unspecified,
    node,
    node.getSourceFile()
  );
  return result;
}

/**
 * Basic function of object literal serialization.
 *
 * @param {ts.ObjectLiteralExpression} node
 * @returns {string}
 */
function unstable_serializeObjectLiteral(
  node: ts.ObjectLiteralExpression,
  checker: ts.TypeChecker,
  config: DecoratorSerializeConfig
): string {
  // `accum` is a map for storing all serialized property in object literal.
  const accum = Object.create(null);
  node.properties.reduce((accum, propNode: ts.ObjectLiteralElementLike) => {
    if (ts.isPropertyAssignment(propNode)) {
      // Only support process property assignment because this is in compiling stage.
      // And only literal because identify, method declaration and call expression can't be serialized.
      // TODO: Considering the situation of object literal in property assignment(nested problem).
      return serializePropertyAssignmentOfObjectLiteral(
        propNode,
        accum,
        checker,
        config
      );
    }
  }, accum);
  return JSON.stringify(accum);
}

function serializePropertyAssignmentOfObjectLiteral(
  propNode: ts.PropertyAssignment,
  accum: any,
  checker: ts.TypeChecker,
  config: DecoratorSerializeConfig
) {
  // Only process property assignments.
  if (!ts.isPropertyAssignment(propNode)) {
    return accum;
  }
  const propertyName = propNode.name.getText();
  const initializer = propNode.initializer;
  let propertyValue;
  if (
    ts.isLiteralExpression(initializer) &&
    !ts.isComputedPropertyName(propNode.name)
  ) {
    // Every node came into this branch is considered as a `string literal` type node,
    // but in fact it can be numeric, string or boolean literal node.
    // But to describe this detail, you need to change the structure and add
    // more description fields.
    propertyValue = initializer.text;
  } else if (ts.isIdentifier(initializer)) {
    // Initializer is a identifier.
    if (
      NodeSymbolType.isInterfaceTypeIdentifier(initializer, checker)
    ) {
      // Initializer is a `Interface` type.
      // This serializes "Boolean", "String", "Number" as primitive types.
      // Although in fact they are identifiers.
      if (isBoxedObjectsOfPrimitiveTypeString(initializer.text)) {
        propertyValue = initializer.text;
      }
    } else if (
      NodeSymbolType.isClassTypeIdentifier(initializer, checker) &&
      config.serializeRefClass
    ) {
      // Property was assigned with a Class type.
      // Maybe initializer is a `Class` type.
      const cls = serializeClassInitializerIfNeeded(
        initializer,
        checker,
        config.serializeRefClass
      );
      if (cls) {
        propertyValue = cls;
      }
    }
  } else if (ts.isPropertyAccessExpression(initializer)) {
    // Is initializer a access expression.
    // Only serialize when initializer is a member of `Enum`
    const enu = serializeEnumInitializerIfNeeded(initializer, checker);
    if (enu) {
      propertyValue = enu;
    }
  } else if (NodeType.isBooleanLiteralNode(initializer)) {
    // Example:
    // @Prop({
    //   ... ,
    //   booleanProp: true
    // })
    // propertyName: type;
    propertyValue = NodeType.isTrueKeywordNode(initializer)
      ? true
      : false;
  } else if (ts.isObjectLiteralExpression(initializer)) {
    propertyValue = unstable_serializeObjectLiteral(initializer, checker, config);
  }

  if (propertyValue) {
    accum[propertyName] = propertyValue;
  }
  return accum;
}

/**
 * Sina requires to treat non-primitive boxed objects types as primitive types and
 * simply serialized to string.
 * See more: https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html
 *
 * @param {string} type
 * @returns
 */
function isBoxedObjectsOfPrimitiveTypeString(type: string) {
  const BOXED_OBJECT_STRING = ["Boolean", "String", "Number", "Object"];
  return BOXED_OBJECT_STRING.indexOf(type) > -1;
}

function serializeClassInitializerIfNeeded(
  node: ts.Identifier,
  checker: ts.TypeChecker,
  classNodeSerializeFunction: (node: ts.ClassDeclaration) => string | undefined
): string | undefined {
  const type = checker.getTypeAtLocation(node);
  const symbol = type.getSymbol();
  if (symbol && SymbolType.isClass(symbol)) {
    // do sth...
    const classNode = symbol.valueDeclaration as ts.ClassDeclaration;
    return classNodeSerializeFunction(classNode);
  }
  return undefined;
}

function serializeEnumInitializerIfNeeded(
  node: ts.PropertyAccessExpression,
  checker: ts.TypeChecker
): string | undefined {
  const symbol = checker.getSymbolAtLocation(node);

  if (symbol && symbol.valueDeclaration) {
    let enumSerializedValue;
    if ((symbol.valueDeclaration as ts.EnumMember).initializer) {
      if (
        !ts.isLiteralExpression((symbol.valueDeclaration as ts.EnumMember)
          .initializer as ts.Expression)
      ) {
        // Enum has initializer but is not literal expression can not be serialized.
        throw new Error(
          `Enum ${
            symbol.name
          } has an unsupported initializer, cannot be serialized thus.`
        );
      }
      // Enum member has initializer.
      enumSerializedValue = ((symbol.valueDeclaration as ts.EnumMember)
        .initializer as ts.LiteralExpression).text;
    } else {
      // Doesnot have initializer.
      // In this case the value of type will be a incremental number type generated by
      // typescript compiler.
      const type: any = checker.getTypeAtLocation(node);
      enumSerializedValue = type.value;
    }
    return enumSerializedValue;
  }
  return undefined;
}

/**
 * Because the point expressions in TS AST can be nested structured.
 * This function flatten the relationship and return an array of each property.
 *
 * @param {string[]} chain
 * @param {ts.PropertyAccessExpression} node
 */
function getExpressionReverse(
  chain: string[],
  node: ts.PropertyAccessExpression
) {
  chain.push(node.name.text);

  if (!ts.isIdentifier(node.expression)) {
    getExpressionReverse(chain, node.expression as ts.PropertyAccessExpression);
  } else {
    chain.push(node.expression.text);
  }
}

/**
 * Parse the statement of param in a function invoking.
 *
 * @param {(ts.Expression | undefined)} contentNode
 * @returns {AugumentListItem}
 */
function serializeArgument(
  contentNode: ts.Expression | undefined,
  checker: ts.TypeChecker,
  config: DecoratorSerializeConfig
): decoratorInfo.ArgumentListItem {
  // ts.Identifier | ts.PropertyAccessExpression | undefined

  let content: decoratorInfo.ArgumentListItem;

  if (!contentNode) {
    content = { type: "null" };
  } else {
    switch (contentNode.kind) {
      case ts.SyntaxKind.StringLiteral:
        content = {
          type: "string literal",
          value: (contentNode as ts.LiteralExpression).text
        };
        break;
      case ts.SyntaxKind.NumericLiteral:
        content = {
          type: "numeric literal",
          value: (contentNode as ts.LiteralExpression).text
        };
        break;
      case ts.SyntaxKind.TrueKeyword:
        content = {
          type: "boolean",
          value: "true"
        };
        break;
      case ts.SyntaxKind.FalseKeyword:
        content = {
          type: "boolean",
          value: "false"
        };
        break;
      case ts.SyntaxKind.Identifier:
        throw new Error("First argument of decorator is a identifier!!!");
        // content = {
        //   type: "identifier",
        //   value: "1"
        // };
        break;
      case ts.SyntaxKind.ObjectLiteralExpression:
        content = {
          type: "object",
          value: unstable_serializeObjectLiteral(
            contentNode as ts.ObjectLiteralExpression,
            checker,
            config
          )
        };
        break;
      case ts.SyntaxKind.PropertyAccessExpression:
        const chain = [] as string[];
        getExpressionReverse(chain, contentNode as ts.PropertyAccessExpression);
        const entityChain = chain.reverse();
        content = { type: "propertyAccessRaw", value: entityChain };
        break;
      default:
        content = { type: "error", value: "unidentified node" };
    }
  }

  return content;
}
