import { describe, expect, it } from "vitest";
import { composeCodeAnswer, fenceFor } from "@/lib/code-answer";

describe("fenceFor", () => {
  it("uses three backticks normally", () => {
    expect(fenceFor("const a = 1;")).toBe("```");
  });

  it("uses a longer fence than any backtick run inside the text, so code cannot close it early", () => {
    expect(fenceFor("a ``` b")).toBe("````");
    expect(fenceFor("x ````` y ```")).toBe("``````");
  });
});

describe("composeCodeAnswer", () => {
  it("wraps code in a fenced block with the language", () => {
    expect(composeCodeAnswer("javascript", "const a = 1;\n\n")).toBe("```javascript\nconst a = 1;\n```");
  });

  it("omits the language label for 'other'", () => {
    expect(composeCodeAnswer("other", "SELECT 1;")).toBe("```\nSELECT 1;\n```");
  });

  it("returns nothing for empty code", () => {
    expect(composeCodeAnswer("python", "  \n ")).toBe("");
  });

  it("adds output labelled as self-reported", () => {
    const out = composeCodeAnswer("javascript", "console.log(6)", [{ level: "log", text: "6" }]);
    expect(out).toBe("```javascript\nconsole.log(6)\n```\n\nOutput when I ran it (self-reported):\n```\n6\n```");
  });

  it("marks warnings and errors in the output", () => {
    const out = composeCodeAnswer("javascript", "x", [
      { level: "log", text: "a" },
      { level: "warn", text: "careful" },
      { level: "error", text: "boom" },
    ]);
    expect(out).toContain("a\n[warn] careful\n[error] boom");
  });

  it("does not let backticks in the code or the output break the structure", () => {
    const out = composeCodeAnswer("javascript", "const s = `a ``` b`;", [{ level: "log", text: "``` hi" }]);
    expect(out.startsWith("````javascript\n")).toBe(true);
    expect(out).toContain("\n````\n\nOutput when I ran it");
  });

  it("omits the output section when there is none", () => {
    expect(composeCodeAnswer("javascript", "x", [])).not.toContain("Output");
    expect(composeCodeAnswer("javascript", "x", null)).not.toContain("Output");
  });
});
