import ts from "typescript";
import { curryRight2, curryRight3 } from "./utils";
import _ from "lodash/fp";

export interface DeleteOptions {
  classElementDecorators: string[];
  classDecorators: string[];
  isVueSFCSouce?: boolean;
}

export function removeCompilationStageDecoratorsInTsText(
  source: string,
  removeOptions: DeleteOptions
): string {
  const ranges = getDeleteRangeList(source, removeOptions);
  return getDeletedSourceCode(source, ranges);
}

function getDeletedSourceCode(source: string, ranges: ts.TextRange[]): string {
  // Check if ranges have some errors during parsing.
  checkRanges(ranges);
  const sortedReversedRanges: ts.TextRange[] = _.compose<any, any>(
    _.reverse,
    _.sortBy(["pos"])
  )(ranges);
  return sortedReversedRanges.reduce(getSingleDeletedCode, source);

  function getSingleDeletedCode(source: string, range: ts.TextRange) {
    const { pos, end } = range;
    const out = source.substring(0, pos) + source.substring(end);
    return out;
  }
}

function checkRanges(ranges: ts.TextRange[]): void {
  const map = new Map();
  ranges.forEach(range => {
    const { pos } = range;
    if (map.has(pos)) {
      throw new Error(
        "Parse error, finding plural range of same position. Please contact maintainer."
      );
    } else {
      map.set(pos, undefined);
    }
  });
}

function getDeleteRangeList(
  source: string,
  deleteOptions: DeleteOptions
): ts.TextRange[] {
  const sourceFile = ts.createSourceFile(
    "this.ts",
    source,
    ts.ScriptTarget.ES2015,
    undefined
  );

  const deleteRangeList: ts.TextRange[] = [];
  ts.forEachChild(
    sourceFile,
    curryRight3(visitNodes)(deleteOptions)(deleteRangeList)
  );
  return deleteRangeList;
}

function visitNodes(
  node: ts.Node,
  rangeList: ts.TextRange[],
  deleteOptions: DeleteOptions
): void {
  if (ts.isClassDeclaration(node)) {
    const classRanges = getTargetDecoratorNode(
      node,
      deleteOptions.classDecorators
    ).map(getTextRangeFromNode);
    const memberRanges = getDeleteClassElementRange(
      node,
      deleteOptions.classElementDecorators
    );

    const merged: ts.TextRange[] = _.concat(classRanges, memberRanges);
    appendList1ToList2(merged, rangeList);
  }
}

function appendList1ToList2<T>(list1: T[], list2: T[]): void {
  list1.reduce((accum: T[], item: T) => {
    accum.push(item);
    return accum;
  }, list2);
}

function getDeleteClassElementRange(
  node: ts.ClassDeclaration,
  decorators: string[]
): ts.TextRange[] {
  const listOfTextRangeList = node.members
    .filter(curryRight2(isDecoratedBy)(decorators))
    .map(curryRight2(getTargetDecoratorNode)(decorators))
    .map((nodes: ts.Node[]) => {
      return nodes.map(getTextRangeFromNode);
    });

  return _.flatten(listOfTextRangeList);
}

function isDecoratedBy(
  node: ts.ClassDeclaration | ts.ClassElement,
  decoratorNameList: string[]
): boolean {
  if (getTargetDecoratorNode(node, decoratorNameList).length > 0) {
    return true;
  }
  return false;
}

function getTargetDecoratorNode(
  node: ts.ClassDeclaration | ts.ClassElement,
  decoratorNameList: string[]
): ts.Node[] {
  let includedDecorators: ts.Node[] = [];
  node.decorators &&
    node.decorators.forEach(decorator => {
      if (
        ts.isIdentifier(decorator.expression) &&
        decoratorNameList.indexOf(decorator.expression.text) > -1
      ) {
        includedDecorators.push(decorator);
      } else if (
        ts.isCallExpression(decorator.expression) &&
        decoratorNameList.indexOf(
          (decorator.expression.expression as ts.Identifier).text
        ) > -1
      ) {
        includedDecorators.push(decorator);
      }
    });
  return includedDecorators;
}

function getTextRangeFromNode(node: ts.Node): ts.TextRange {
  return createTextRange(node);
}

function createTextRange(node: ts.Node): ts.TextRange {
  return new TextRange(node);
}

class TextRange {
  public pos: number;
  public end: number;
  public constructor(node: ts.Node) {
    this.pos = node.pos;
    this.end = node.end;
  }
}
