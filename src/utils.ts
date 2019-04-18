import { parseComponent } from "vue-template-compiler";

/**
 * Transform function into a curried function with 2 parameters.
 *
 * @export
 * @param {Function} func
 * @returns
 */
export const curryRight2 = <T, U, V>(func: (arg1: T, arg2: U) => V) => (
  arg2: U
) => (arg1: T): V => func(arg1, arg2);

/**
 * Transform function into a curried function with 3 parameters.
 *
 * @export
 * @param {Function} func
 * @returns
 */
export const curryRight3 = <T, U, V, W>(
  func: (arg1: T, arg2: U, arg3: V) => W
) => (arg3: V) => (arg2: U) => (arg1: T): W => func(arg1, arg2, arg3);

interface TextRange {
  start: number;
  end: number;
}

/**
 * This function may not work properly in some situations.
 * Need to be considered precisely.
 * Maybe change the implementation.
 *
 * @param content
 * @returns
 */
export function getTsScriptContentFromVueLikeRawText(content: string): string {
  const { start, end } = getScriptStartAndEndOfVueLikeTextByVueTemplateCompiler(
    content
  );
  return content.substring(start, end);
}

/**
 * Replace script part of vue single file component with provided text.
 *
 * @export
 * @param {string} sourceText
 * @param {string} replaceScript
 * @returns
 */
export function replaceTsScriptContentInVueLikeText(
  sourceText: string,
  replaceScript: string
) {
  const {
    start: scriptStart,
    end: scriptEnd
  } = getScriptStartAndEndOfVueLikeTextByVueTemplateCompiler(sourceText);
  const header = sourceText.substring(0, scriptStart);
  const footer = sourceText.substring(scriptEnd);
  return `${header}${replaceScript}${footer}`;
}

/**
 * It's unsafe to use a simple match, because there can be situations like
 * spaces in html tags.
 *
 * @param {string} content
 * @returns {TextRange}
 */
function getScriptStartAndEndOfVueLikeText(content: string): TextRange {
  const openTagString = `<script lang="ts">`;
  const closeTagString = `</script>`;
  const start = content.indexOf(openTagString) + openTagString.length;
  if (start < 0) {
    return { start: 0, end: 0 };
  }
  const end = content.indexOf(closeTagString, start);
  return { start, end };
}

function getScriptStartAndEndOfVueLikeTextByVueTemplateCompiler(
  content: string
): TextRange {
  // Here use vue's template compiler for html parse.
  const { script } = parseComponent(content);
  if (script && script.lang === "ts") {
    if (!script.start || !script.end) {
      throw new Error("Error in parsing SFC using vue template compiler.");
    }
    return {
      start: script.start,
      end: script.end
    };
  } else {
    return {
      start: 0,
      end: 0
    };
  }
}
