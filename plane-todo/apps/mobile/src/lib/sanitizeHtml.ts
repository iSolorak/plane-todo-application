const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/**
 * Decode HTML entities: named (&amp;), decimal (&#65;) and hex (&#x1F600;).
 * Unknown named entities are left untouched.
 */
export function decodeEntities(input: string): string {
  return input.replace(
    /&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g,
    (match, body: string) => {
      if (body[0] === "#") {
        const isHex = body[1] === "x" || body[1] === "X";
        const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        if (Number.isNaN(code)) return match;
        try {
          return String.fromCodePoint(code);
        } catch {
          return match;
        }
      }
      const decoded = NAMED_ENTITIES[body.toLowerCase()];
      return decoded !== undefined ? decoded : match;
    },
  );
}

/**
 * Convert Plane's `description_html` into readable plain text: drop
 * script/style, turn block boundaries and `<br>` into newlines, strip all
 * remaining tags, decode entities, and normalize whitespace. Never emits
 * angle brackets. Returns "" for null/undefined/empty input.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  let text = html;
  // Remove <script>/<style> blocks including their content.
  text = text.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
  // <br> → newline.
  text = text.replace(/<br\s*\/?>/gi, "\n");
  // Closing block-level tags → newline.
  text = text.replace(/<\/(p|div|li|ul|ol|h[1-6]|blockquote|tr|section|article)>/gi, "\n");
  // Strip any remaining tags.
  text = text.replace(/<[^>]+>/g, "");
  // Decode entities after tags are gone.
  text = decodeEntities(text);
  // Normalize whitespace.
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/ *\n */g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

/**
 * A single-line preview of `description_html`, truncated with an ellipsis
 * past `max` characters.
 */
export function toPreview(html: string | null | undefined, max = 140): string {
  const text = sanitizeHtml(html).replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}

/**
 * Convert user-entered plain text into safe `description_html`: escape HTML
 * special characters and turn newlines into `<br />`. Returns `null` for
 * blank/whitespace-only input.
 */
export function plainTextToDescriptionHtml(text: string): string | null {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return null;
  const escaped = trimmed
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\r?\n/g, "<br />");
}
