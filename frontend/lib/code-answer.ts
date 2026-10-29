import type { LogLine } from "@/lib/sandbox";

export const CODE_LANGUAGES = [
  { id: "javascript", label: "JavaScript", runnable: true },
  { id: "typescript", label: "TypeScript", runnable: false },
  { id: "python", label: "Python", runnable: false },
  { id: "java", label: "Java", runnable: false },
  { id: "cpp", label: "C++", runnable: false },
  { id: "go", label: "Go", runnable: false },
  { id: "other", label: "Other", runnable: false },
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGES)[number]["id"];

/** A Markdown fence long enough that `text` cannot close it early. */
export function fenceFor(text: string): string {
  const longest = (text.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0);
  return "`".repeat(Math.max(3, longest + 1));
}

function block(text: string, info = ""): string {
  const fence = fenceFor(text);
  return `${fence}${info}\n${text}\n${fence}`;
}

/**
 * The text appended to an answer for a coding question: the code in a fenced
 * block and, optionally, what it printed. The output is labelled as
 * self-reported because the backend never verifies it; the evaluator is told
 * to judge the code itself.
 */
export function composeCodeAnswer(language: CodeLanguage, code: string, output?: LogLine[] | null): string {
  const trimmed = code.replace(/\s+$/, "");
  if (!trimmed.trim()) return "";
  let result = block(trimmed, language === "other" ? "" : language);
  if (output && output.length > 0) {
    const printed = output.map((l) => (l.level === "log" ? l.text : `[${l.level}] ${l.text}`)).join("\n");
    result += `\n\nOutput when I ran it (self-reported):\n${block(printed)}`;
  }
  return result;
}
