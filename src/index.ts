import {
  serializeTsFiles,
  serializeVueFiles,
  customEntryFilters
} from "ts-meta-extract";
import ts from "typescript";
import glob from "glob";
import path from "path";
import _ from "lodash/fp";
import fs from "fs";
import { serializeDecoratorForSina } from "./decorator-serialize";
import { sinaTransformer, sinaMeta } from "./meta-transformer";
import {
  getTsScriptContentFromVueLikeRawText,
  replaceTsScriptContentInVueLikeText,
  curryRight2
} from "./utils";
import {
  removeCompilationStageDecoratorsInTsText,
  DeleteOptions
} from "./remove-decorator";

const DECORATOR_NAME_OF_REF_CLASS = "dataType";
const PROPERTY_NAME = "code";

export interface CustomSerializerConfig {
  entryDecoratorFilters: string[];
  serializeDecoratorNameList: string[];
}

export interface CustomSerializerConfigForDirectory
  extends CustomSerializerConfig {
  withSinaFormatTransformer?: boolean;
}

export function removeCompilationStageDecoratorsForVueFile(sourceText: string, deleteOptions: DeleteOptions) {
  deleteOptions.isVueSFCSouce = true;
  return removeCompilationStageDecorators(sourceText, deleteOptions);
}

/**
 * First check if there are any classes decorated by
 * the decorators list in `deleteOptions.classDecorators` in the file.
 * If not, skip it. Then determine if it is a vue SFC file, and if it is,
 * then process it. Finally remove decorators.
 *
 * @export
 * @param {string} sourceText
 * @param {DeleteOptions} deleteOptions
 * @returns {string}
 */
export function removeCompilationStageDecorators(
  sourceText: string,
  deleteOptions: DeleteOptions
): string {
  let returnText = sourceText;
  if (
    deleteOptions.isVueSFCSouce &&
    isVueFileContentValid(sourceText, deleteOptions.classDecorators)
  ) {
    // Is a vue SFC.
    const scriptContent = getTsScriptContentFromVueLikeRawText(sourceText);
    const scriptContentAfter = removeCompilationStageDecoratorsInTsText(
      scriptContent,
      deleteOptions
    );
    returnText = replaceTsScriptContentInVueLikeText(
      sourceText,
      scriptContentAfter
    );
  } else if (
    !deleteOptions.isVueSFCSouce &&
    isTsFileContentValid(sourceText, deleteOptions.classDecorators)
  ) {
    // Is a typescript file.
    returnText = removeCompilationStageDecoratorsInTsText(
      sourceText,
      deleteOptions
    );
  }
  // Returns the original string if none of the conditions are met.
  return returnText;
}

export function customSerailizeVueFilesWithSinaFormat(
  entries: string[],
  config: CustomSerializerConfig
) {
  const validEntries = filterEntries(entries, config);
  if (validEntries.length === 0) {
    // No file to be processed.
    return undefined;
  }
  const output = customSerializeVueFiles(validEntries, config);
  return sinaTransformer(output);
}

/**
 *
 *
 * @param {string[]} entries
 * @param {CustomSerializerConfig} config
 * @returns {string[]}
 */
function filterEntries(
  entries: string[],
  config: CustomSerializerConfig
): string[] {
  const files = getFileContentFromEntries(entries);
  const validFiles = _.filter(
    curryRight2(isFileValid)(config.entryDecoratorFilters)
  )(files);
  return _.map(_.property("fileName"))(validFiles);

  function isFileValid(file: File, entryDecoratorFilters: string[]): boolean {
    const { content } = file;
    return isVueFileContentValid(content, entryDecoratorFilters);
  }
}

/**
 * A file object.
 *
 * @interface File
 */
interface File {
  fileName: string;
  content: string;
}

function getFileContentFromEntries(entries: string[]): File[] {
  return _.map(getFile)(entries);

  function getFile(path: string): File {
    return {
      fileName: path,
      content: readFile(path)
    };
  }

  function readFile(path: string): string {
    if (!isFilePath(path)) {
      throw new Error(`File ${path} is invalid.`);
    }
    return fs.readFileSync(path).toString();
  }
}

/**
 * Simply use regular matching to preliminary determine whether file should be proccessed.
 *
 */
function isVueFileContentValid(
  fileContent: string,
  entryDecoratorFilters: string[]
): boolean {
  if (entryDecoratorFilters.length === 0) {
    return false;
  }
  const scriptContent = getTsScriptContentFromVueLikeRawText(fileContent);
  return isTsFileContentValid(scriptContent, entryDecoratorFilters);
}

function isTsFileContentValid(
  scriptContent: string,
  entryDecoratorFilters: string[]
) {
  if (entryDecoratorFilters.length === 0) {
    return false;
  }
  return _.any(isScriptContainDecorator)(entryDecoratorFilters);

  /**
   * NOTE: `scriptContent` is in closure.
   *
   * @param {string} decoratorName
   * @returns
   */
  function isScriptContainDecorator(decoratorName: string) {
    return scriptContent.indexOf(`@${decoratorName}`) > -1;
  }
}

function isFilePath(path: string): boolean {
  if (!fs.existsSync(path) || !fs.statSync(path).isFile()) {
    return false;
  }
  return true;
}

/**
 * Accept a directory path and process all `.vue` files in it.
 *
 * @export
 * @param {string} dirName
 * @returns
 */
export function customSerializeVueByDirectory(
  dirName: string,
  config: CustomSerializerConfigForDirectory
): Promise<sinaMeta.TransfomedResult | any> {
  if (!isDir(dirName)) {
    throw new Error(`"${dirName}" does not exist or is not a directory.`);
  }
  return new Promise((resvole, reject) => {
    glob(`${dirName}/**/*.vue`, function(err, files) {
      if (err) {
        reject(err);
      }
      const resolvedFilePath = files.map(file => path.resolve(file));
      let output: any | sinaMeta.TransfomedResult;
      if (config.withSinaFormatTransformer) {
        output = customSerailizeVueFilesWithSinaFormat(
          resolvedFilePath,
          config
        );
      } else {
        output = customSerializeVueFiles(resolvedFilePath, config);
      }
      resvole(output);
    });
  });
}

/**
 * Return `true` if path is a directory.
 *
 * @param {string} path
 * @returns
 */
function isDir(path: string) {
  return fs.existsSync(path) && fs.statSync(path).isDirectory();
}

export function customSerializeTsFiles(
  entries: string[],
  config: CustomSerializerConfig
): any {
  const output = serializeTsFiles(entries, {
    classEntryFilter: customEntryFilters.isDecoratedBy(
      config.entryDecoratorFilters
    ),
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
    classEntryFilter: customEntryFilters.isDecoratedBy(
      config.entryDecoratorFilters
    ),
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
          return ((node as ts.PropertyAssignment)
            .initializer as ts.LiteralExpression).text;
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
