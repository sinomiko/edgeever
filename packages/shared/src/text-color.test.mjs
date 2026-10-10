import { describe, expect, test } from "bun:test";
import { getSchema } from "@tiptap/core";
import { docToMarkdown, markdownToDoc, resolveMemoContentDoc } from "./content.ts";
import { createEdgeEverDocumentExtensions } from "./document-extensions.ts";
import { prepareNativeEditorContent, restoreNativeEditorContent } from "./mobile-content-compatibility.ts";

const coloredText = (text, attrs, otherMarks = []) => ({ type: "text", text, marks: [{ type: "textStyle", attrs }, ...otherMarks] });
const document = (content) => ({ type: "doc", content: [{ type: "paragraph", content }] });
const normalizeMarks = (value) => {
  if (Array.isArray(value)) return value.map(normalizeMarks);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key, key === "marks" ? item.map(normalizeMarks).sort((a, b) => a.type.localeCompare(b.type)) : normalizeMarks(item),
  ]));
};

describe("Markdown text colors", () => {
  test("loads an imported colored document without a missing-mark blank editor", () => {
    const schema = getSchema(createEdgeEverDocumentExtensions({ mathematics: [] }));
    const imported = {
      type: "doc", content: [
        { type: "paragraph", content: [coloredText("imported body", { color: "#202325" })] },
        { type: "paragraph", content: [] },
        { type: "codeBlock", attrs: { language: "proto" }, content: [{ type: "text", text: "message Request {\n  string id = 1;\n}" }] },
      ],
    };
    const node = schema.nodeFromJSON(resolveMemoContentDoc(imported, "imported body"));
    expect(() => node.check()).not.toThrow();
    expect(node.textContent).toBe("imported bodymessage Request {\n  string id = 1;\n}");
    expect(node.child(0).firstChild.marks[0].attrs.color).toBe("#202325");
    expect(node.child(1).content.size).toBe(0);
  });

  test("registers color marks in the shared editor schema", () => {
    const names = createEdgeEverDocumentExtensions({ mathematics: [] }).map((extension) => extension.name);
    expect(names).toContain("textStyle");
    expect(names).toContain("color");
    expect(names).toContain("backgroundColor");
  });

  test("preserves foreground and background colors through Markdown without a DOM", () => {
    const doc = document([coloredText("red", { color: "#ff0000", backgroundColor: "#ffff00" })]);
    const markdown = docToMarkdown(doc);
    expect(markdown).toBe('<span style="color:#ff0000;background-color:#ffff00">red</span>');
    expect(markdownToDoc(markdown)).toEqual(doc);
  });

  test("preserves overlapping bold and links, and does not turn color into bold", () => {
    const doc = document([
      coloredText("plain ", { color: "#008000" }),
      coloredText("bold", { color: "#008000" }, [{ type: "bold" }]),
    ]);
    const parsed = markdownToDoc(docToMarkdown(doc));
    expect(normalizeMarks(parsed)).toEqual(normalizeMarks(doc));
    expect(parsed.content[0].content[0].marks.some((mark) => mark.type === "bold")).toBe(false);
    const linked = markdownToDoc('<span style="color:#ff0000">[link](https://example.com)</span>');
    expect(linked.content[0].content[0].marks.map((mark) => mark.type)).toContain("link");
    expect(linked.content[0].content[0].marks.find((mark) => mark.type === "textStyle").attrs.color).toBe("#ff0000");
  });

  test("nested spans override only their own colors", () => {
    const doc = markdownToDoc('<span style="color:#ff0000;background-color:#ffff00">a<span style="color:#008000">b</span>c</span>');
    expect(doc.content[0].content.map((node) => node.marks.find((mark) => mark.type === "textStyle").attrs)).toEqual([
      { color: "#ff0000", backgroundColor: "#ffff00" },
      { color: "#008000", backgroundColor: "#ffff00" },
      { color: "#ff0000", backgroundColor: "#ffff00" },
    ]);
  });

  test("ignores unrelated attributes and unsafe color values", () => {
    const doc = markdownToDoc('<span onclick="alert(1)" style="color:url(https://example.com);position:fixed">text</span>');
    expect(doc.content[0].content[0]).toEqual({ type: "text", text: "text", marks: [] });
    expect(docToMarkdown(document([coloredText("text", { color: 'red;position:fixed' })]))).toBe("text");
  });

  test("leaves color syntax in code fences and inline code as code", () => {
    const source = '<span style="color:#ff0000">red</span>';
    const doc = markdownToDoc('```html\n' + source + '\n```\n\n`' + source + '`');
    expect(doc.content[0].type).toBe("codeBlock");
    expect(doc.content[0].content[0].text).toBe(source);
    expect(doc.content[1].content[0].marks).toEqual([{ type: "code" }]);
  });

  test("native compatibility and content resolution retain colored JSON", () => {
    const doc = document([coloredText("value", { color: "#ff0000" })]);
    expect(restoreNativeEditorContent(prepareNativeEditorContent(doc))).toEqual(doc);
    expect(resolveMemoContentDoc(doc, docToMarkdown(doc))).toEqual(doc);
    expect(resolveMemoContentDoc(document([{ type: "text", text: "value" }]), docToMarkdown(doc))).toEqual(doc);
  });

  test("keeps adjacent color changes, Unicode and underline", () => {
    const doc = document([
      coloredText("red", { color: "#ff0000" }),
      coloredText("中文", { color: "#008000" }, [{ type: "underline" }]),
      coloredText(" blue", { color: "rgb(0, 0, 255)" }),
    ]);
    const parsed = markdownToDoc(docToMarkdown(doc));
    expect(normalizeMarks(parsed)).toEqual(normalizeMarks(doc));
  });

  test("retains colors on whitespace-only runs and leading and trailing spaces", () => {
    const doc = document([
      coloredText(" \t", { color: "#ff0000" }),
      coloredText(" green \u00a0", { color: "#008000" }),
    ]);
    expect(markdownToDoc(docToMarkdown(doc))).toEqual(doc);
  });

  test("retains empty and uncolored whitespace paragraphs around colored text", () => {
    const doc = { type: "doc", content: [
      { type: "paragraph", content: [] },
      { type: "paragraph", content: [{ type: "text", text: "\u00a0" }] },
      ...document([coloredText("value", { color: "#ff0000" })]).content,
      { type: "paragraph", content: [] },
    ] };
    const parsed = markdownToDoc(docToMarkdown(doc));
    expect(parsed.content.length).toBe(4);
    expect(parsed.content[1].content[0].text).toBe("\u00a0");
    expect(docToMarkdown(parsed)).toBe(docToMarkdown(doc));
  });
});
