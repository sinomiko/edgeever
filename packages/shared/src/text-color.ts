import { TextStyle, Color, BackgroundColor } from "@tiptap/extension-text-style";
import { Parser } from "htmlparser2";

const safeColor = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const color = value.trim();
  return /^(?:#[\da-f]{3,4}|#[\da-f]{6}|#[\da-f]{8}|[a-z]+|(?:rgb|rgba|hsl|hsla)\([\d\s.,%+\-/]+\))$/i.test(color)
    ? color : null;
};

const colorStyles = (attrs: Record<string, unknown> = {}) => {
  const color = safeColor(attrs.color);
  const background = safeColor(attrs.backgroundColor);
  return [color && `color:${color}`, background && `background-color:${background}`].filter(Boolean).join(";");
};

/** Keep inline colors in Markdown without relying on a browser DOM in the API. */
const MarkdownTextStyle = TextStyle.extend({
  priority: 1,
  renderHTML({ mark }) {
    const style = colorStyles(mark.attrs);
    return ["span", style ? { style } : {}, 0];
  },
  renderMarkdown(node, helpers) {
    const text = helpers.renderChildren(node.content || []);
    const style = colorStyles(node.attrs);
    return style ? `<span style="${style}">${text}</span>` : text;
  },
  parseMarkdown(token, helpers) {
    const content = helpers.parseInline(token.tokens || []);
    const attrs = (token.colorAttrs || {}) as Record<string, string>;
    // An inner span overrides only the properties it specifies.
    return content.map((node) => {
      if (node.type !== "text") return node;
      const inner = node.marks?.find((mark) => mark.type === "textStyle");
      return {
        ...node,
        marks: [
          ...(node.marks || []).filter((mark) => mark.type !== "textStyle"),
          ...(Object.keys(attrs).length || inner ? [{ type: "textStyle", attrs: { ...attrs, ...inner?.attrs } }] : []),
        ],
      };
    });
  },
  markdownTokenizer: {
    name: "textStyle",
    level: "inline",
    start: (source) => source.search(/<span(?:\s|>)/i),
    tokenize(source, _tokens, lexer) {
      if (!/^<span(?:\s|>)/i.test(source)) return undefined;
      let depth = 0;
      let openingEnd = -1;
      let closingStart = -1;
      let end = -1;
      const attrs: Record<string, string> = {};
      const parser = new Parser({
        onopentag(name, attributes) {
          if (name !== "span") return;
          depth += 1;
          if (openingEnd >= 0) return;
          openingEnd = parser.endIndex + 1;
          for (const declaration of (attributes.style || "").split(";")) {
            const separator = declaration.indexOf(":");
            const property = declaration.slice(0, separator).trim().toLowerCase();
            const value = safeColor(declaration.slice(separator + 1));
            if (separator < 0 || !value) continue;
            if (property === "color") attrs.color = value;
            if (property === "background-color") attrs.backgroundColor = value;
          }
        },
        onclosetag(name, implied) {
          if (name !== "span") return;
          depth -= 1;
          if (depth !== 0 || implied) return;
          closingStart = parser.startIndex;
          end = parser.endIndex + 1;
          parser.pause();
        },
      }, { decodeEntities: true });
      parser.end(source);
      if (end < 0 || openingEnd < 0) return undefined;
      const inner = source.slice(openingEnd, closingStart).replace(/&#(\d+);/g, (entity, digits) => {
        const code = Number(digits);
        if (code > 0x10ffff) return entity;
        const character = String.fromCodePoint(code);
        return /\s/.test(character) ? character : entity;
      });
      return {
        type: "textStyle", raw: source.slice(0, end), colorAttrs: attrs,
        tokens: lexer.inlineTokens(inner),
      };
    },
  },
});

export const createTextColorExtensions = () => [MarkdownTextStyle, Color, BackgroundColor];
