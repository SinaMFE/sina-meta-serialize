import ts from "typescript";
import { curryRight3 } from "./utils";

namespace symbolType {
  export function isClass(symbol: ts.Symbol) {
    return symbol.getFlags() === ts.SymbolFlags.Class;
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
 *
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
  const accum = Object.create(null);
  node.properties.reduce((accum, propNode: ts.ObjectLiteralElementLike) => {
    // Only support process property assignment because this is in compiling stage.
    // And only literal because identify or method declaration or call expression can't be serialized.
    // TODO: Consider the situation of object literal in property assignment.
    if (
      ts.isPropertyAssignment(propNode) &&
      ts.isLiteralExpression(propNode.initializer) &&
      !ts.isComputedPropertyName(propNode.name)
    ) {
      // Here every value is a `string` type, but in fact they can be numeric or string or boolean literal.
      // If needed.
      accum[propNode.name.getText()] = propNode.initializer.getText();
    } else if (
      ts.isPropertyAssignment(propNode) &&
      ts.isIdentifier(propNode.initializer) &&
      config.serializeRefClass
    ) {
      // Maybe initializer is a `Class`
      const cls = serializeClassInitializerIfNeeded(
        propNode.initializer,
        checker,
        config.serializeRefClass
      );
      if (cls) {
        accum[propNode.name.getText()] = cls;
      }
    } else if (
      ts.isPropertyAssignment(propNode) &&
      ts.isPropertyAccessExpression(propNode.initializer)
    ) {
      // Only serialize when initializer is a member of `Enum`
      const enu = serializeEnumInitializerIfNeeded(
        propNode.initializer,
        checker
      );
      if (enu) {
        accum[propNode.name.getText()] = enu;
      }
    }
    return accum;
  }, accum);
  return JSON.stringify(accum);
}

function serializeClassInitializerIfNeeded(
  node: ts.Identifier,
  checker: ts.TypeChecker,
  serializeFunction: (node: ts.ClassDeclaration) => string | undefined
): string | undefined {
  const symbol = checker.getSymbolAtLocation(node);

  if (symbol && symbolType.isClass(symbol)) {
    // do sth...
    const classNode = symbol.valueDeclaration as ts.ClassDeclaration;
    return serializeFunction(classNode);
  }
  return undefined;
}

function serializeEnumInitializerIfNeeded(
  node: ts.PropertyAccessExpression,
  checker: ts.TypeChecker
): string | undefined {
  const symbol = checker.getSymbolAtLocation(node);

  if (
    symbol &&
    symbol.valueDeclaration &&
    ts.isLiteralExpression(
      (symbol.valueDeclaration as ts.PropertyAssignment).initializer
    )
  ) {
    return (symbol.valueDeclaration as ts.PropertyAssignment).initializer.getText();
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
