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
import { transformMetaForPage, transfomrMetaForComp, sinaMeta } from './meta-transformer';
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
  /**
   * Determine if it is an entry declaration class that needs to extract metadata.
   *
   * @type {string[]}
   * @memberof CustomSerializerConfig
   */
  entryDecoratorFilters: string[];
  /**
   * Specify the relevant decorator name that needs to be serialized.
   *
   * @type {string[]}
   * @memberof CustomSerializerConfig
   */
  serializeDecoratorNameList: string[];
}

export interface CustomSerializerConfigForDirectory
  extends CustomSerializerConfig {
  withSinaFormatTransformer?: boolean;
  /**
   * The serialization target, should be `page` or `component`.
   *
   * @type {SerializeType}
   * @memberof CustomSerializerConfigForDirectory
   */
  serializeType: SerializeType;
  /**
   * If the serialization target is a `page`, you need to specify a specific
   * page (that is, the name of the subfile directory in the __views__ folder).
   *
   * @type {string}
   * @memberof CustomSerializerConfigForDirectory
   */
  viewDirname?: string;
}

export enum SerializeType {
  Component = "component",
  Page = "page"
}

/**
 * For backward compatibility.
 * This api was once exposed.
 *
 * @deprecated
 * @export
 * @param {string} sourceText
 * @param {DeleteOptions} deleteOptions
 * @returns
 */
export function removeCompilationStageDecoratorsForVueFile(
  sourceText: string,
  deleteOptions: DeleteOptions
) {
  deleteOptions.isVueSFCSource = true;
  return removeCompilationStageDecorators(sourceText, deleteOptions);
}

/**
 * Steps:
 * 1. First check if there are any classes decorated by the decorators listed
 *  in `deleteOptions.classDecorators` in the file.
 * 2. If not, skip it.
 * 3. Else then determine if it is a vue SFC file, and if it is then extract ts scripts.
 * 4. Finally remove decorators.
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
    deleteOptions.isVueSFCSource &&
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
    !deleteOptions.isVueSFCSource &&
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
  config: CustomSerializerConfig,
  serializeType: SerializeType
) {
  const validEntries = filterEntries(entries, config);
  if (validEntries.length === 0) {
    // No file to be processed.
    return undefined;
  }
  const output = customSerializeVueFiles(validEntries, config, serializeType);
  return transformMeta(output, serializeType);
}

function transformMeta(originalMeta: any[], serializeType: SerializeType) {
  if(serializeType === SerializeType.Component) {
    return transfomrMetaForComp(originalMeta);
  } else {
    return transformMetaForPage(originalMeta);
  }
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
 * Accept a root source file directory path of marauder and process all `.vue` 
 * files in it, which will be directory `src` In marauder project.
 *
 * @export
 * @param {string} rootDir
 * @returns
 */
export async function customSerializeVueByDirectory(
  rootDir: string,
  config: CustomSerializerConfigForDirectory
): Promise<sinaMeta.TransfomedResult | any> {
  if (!isDir(rootDir)) {
    throw new Error(`"${rootDir}" does not exist or is not a directory.`);
  }

  if (config.serializeType === SerializeType.Component) {
    return serializeComponent(rootDir, config);
  } else {
    return serializePage(rootDir, config);
  }

  function serializePage(
    rootDir: string,
    config: CustomSerializerConfigForDirectory
  ) {
    const viewDirname = config.viewDirname;
    if (!viewDirname || !_.isString(viewDirname)) {
      throw new Error(
        `A "viewDirname" must be set in config when serialize meta data of a page.`
      );
    }
    const rootDirOfPage = `${rootDir}/views/${viewDirname}`;

    if (!isDir(rootDirOfPage)) {
      throw new Error(
        `"${rootDirOfPage}" does not exist or is not a directory.`
      );
    }

    return serializeByDir(`${rootDirOfPage}/**/*.vue`, config);
  }

  async function serializeComponent(
    rootDir: string,
    config: CustomSerializerConfigForDirectory
  ) {
    return serializeByDir(`${rootDir}/**/*.vue`, config);
  }

  async function serializeByDir(
    dir: string,
    config: CustomSerializerConfigForDirectory
  ) {
    return new Promise((resvole, reject) => {
      glob(dir, function(err, files) {
        if (err) {
          reject(err);
        }
        const resolvedFilePath = files.map(file => path.resolve(file));
        let output: any | sinaMeta.TransfomedResult;
        if (config.withSinaFormatTransformer) {
          output = customSerailizeVueFilesWithSinaFormat(
            resolvedFilePath,
            config,
            config.serializeType
          );
        } else {
          output = customSerializeVueFiles(
            resolvedFilePath,
            config,
            config.serializeType
          );
        }
        resvole(output);
      });
    });
  }
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
  config: CustomSerializerConfig,
  serializeType: SerializeType
) {
  let output;

  // The serialization difference between component and page is currently
  // based on the judgment of the entry classnode.
  if (serializeType === SerializeType.Component) {
    output = serializeVueFiles(entries, {
      classEntryFilter: customEntryFilters.isDecoratedBy(
        config.entryDecoratorFilters
      ),
      serializeDecorator: serializeDecoratorForSina({
        decoratorNameList: config.serializeDecoratorNameList,
        serializeRefClass
      })
    });
  } else {
    output = serializeVueFiles(entries, {
      classEntryFilter: isValidSeriEntryOfPage,
      serializeDecorator: serializeDecoratorForSina({
        decoratorNameList: config.serializeDecoratorNameList,
        serializeRefClass
      })
    });
  }

  return output;

  function isValidSeriEntryOfPage(classNode: ts.ClassDeclaration): boolean {
    return (
      customEntryFilters.isDecoratedBy(config.entryDecoratorFilters)(
        classNode
      ) && isDefaultExport(classNode)
    );
  }

  function isDefaultExport(node: ts.ClassDeclaration): boolean {
    const modifiers = node.modifiers;

    let hasExportKeyword;
    let hasDefaultKeyword;
    modifiers &&
      modifiers.forEach(mod => {
        if (mod.kind === ts.SyntaxKind.ExportKeyword) {
          hasExportKeyword = true;
        } else {
          hasDefaultKeyword = true;
        }
      });
    return !!(hasExportKeyword && hasDefaultKeyword);
  }
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
