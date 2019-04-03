import {
  serializeTsFiles,
  serializeVueFiles,
  customEntryFilters
} from "ts-meta-extract";
import ts from "typescript";
import { serializeDecoratorForSina } from "./decoratorSerialize";

const DECORATOR_NAME_OF_REF_CLASS = "dataType";
const PROPERTY_NAME = "code";

export interface CustomSerializerConfig {
  entryDecoratorFilters: string[];
  serializeDecoratorNameList: string[];
}

export function customSerializeTsFiles(
  entries: string[],
  config: CustomSerializerConfig
) {
  const output = serializeTsFiles(entries, {
    classEntryFilter: customEntryFilters.isDecoratedBy(config.entryDecoratorFilters),
    serializeDecorator: serializeDecoratorForSina({
      decoratorNameList: config.serializeDecoratorNameList,
      serializeRefClass
    })
  });
  return output;
}

export function customSerializeVueFiles(
  entries: string[],
  config: CustomSerializerConfig
) {
  const output = serializeVueFiles(entries, {
    classEntryFilter: customEntryFilters.isDecoratedBy(config.entryDecoratorFilters),
    serializeDecorator: serializeDecoratorForSina({
      decoratorNameList: config.serializeDecoratorNameList,
      serializeRefClass
    })
  });

  return output;
}

/**
 * Serilize the classes which was referenced by object literal in decorator's arguments.
 *
 * @param {ts.ClassDeclaration} node
 * @returns {(string | undefined)}
 */
function serializeRefClass(node: ts.ClassDeclaration): string | undefined {
  const out =
    node.decorators &&
    node.decorators
      .filter(node => {
        return getDecoratorName(node) === DECORATOR_NAME_OF_REF_CLASS;
      })
      .map(node => {
        return getPropertyOfLiteralObject(node, PROPERTY_NAME);
      });
  return out && out[0];
}

/**
 * Get the property with `name` and serialize with custom rules.
 *
 * Here is the sina rule of super component. Use refered class' `dataType` decorator's first argument's
 * `code` property to define a class.
 *
 * @param {ts.Decorator} node
 * @param {string} name
 * @returns {(string | undefined)}
 */
function getPropertyOfLiteralObject(
  node: ts.Decorator,
  name: string
): string | undefined {
  if (ts.isCallExpression(node.expression)) {
    const arg = node.expression.arguments[0];
    if (ts.isObjectLiteralExpression(arg)) {
      const out = arg.properties
        .filter(node => {
          return (
            ts.isPropertyAssignment(node) &&
            ts.isLiteralExpression(node.initializer)
          );
        })
        .filter(node => {
          return (node as ts.PropertyAssignment).name.getText() === name;
        })
        .map(node => {
          return (node as ts.PropertyAssignment).initializer.getText();
        });
      return out[0];
    }
  }
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
