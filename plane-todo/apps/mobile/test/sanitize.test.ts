import { describe, it, expect } from "vitest";
import {
  decodeEntities,
  sanitizeHtml,
  toPreview,
} from "../src/lib/sanitizeHtml";

describe("decodeEntities", () => {
  it("decodes named, decimal and hex entities", () => {
    expect(decodeEntities("Tom &amp; Jerry")).toBe("Tom & Jerry");
    expect(decodeEntities("5 &lt; 10 &gt; 3")).toBe("5 < 10 > 3");
    expect(decodeEntities("&#65;&#66;&#67;")).toBe("ABC");
    expect(decodeEntities("&#x1F600;")).toBe("\u{1F600}");
    expect(decodeEntities("&nbsp;x")).toBe(" x");
  });

  it("leaves unknown entities untouched", () => {
    expect(decodeEntities("&bogus; &amp;")).toBe("&bogus; &");
  });
});

describe("sanitizeHtml", () => {
  it("strips tags and returns plain text", () => {
    expect(sanitizeHtml("<p>Hello <strong>world</strong></p>")).toBe(
      "Hello world",
    );
  });

  it("turns block boundaries and <br> into newlines", () => {
    expect(sanitizeHtml("<p>One</p><p>Two</p>")).toBe("One\nTwo");
    expect(sanitizeHtml("a<br>b<br/>c")).toBe("a\nb\nc");
    expect(sanitizeHtml("<ul><li>a</li><li>b</li></ul>")).toBe("a\nb");
  });

  it("drops script/style content entirely", () => {
    expect(
      sanitizeHtml("<p>hi</p><script>alert('x')</script><style>.a{}</style>"),
    ).toBe("hi");
  });

  it("decodes entities in the stripped text", () => {
    expect(sanitizeHtml("<p>Fish &amp; Chips &#8212; yum</p>")).toBe(
      "Fish & Chips — yum",
    );
  });

  it("collapses runaway whitespace and blank lines", () => {
    expect(sanitizeHtml("<p>a</p>\n\n\n<p>b</p>")).toBe("a\n\nb");
    expect(sanitizeHtml("x    y\t z")).toBe("x y z");
  });

  it("handles null/undefined/empty", () => {
    expect(sanitizeHtml(null)).toBe("");
    expect(sanitizeHtml(undefined)).toBe("");
    expect(sanitizeHtml("")).toBe("");
  });

  it("never emits angle brackets from tags", () => {
    const out = sanitizeHtml('<div class="x"><img src="y">text</div>');
    expect(out).not.toMatch(/[<>]/);
    expect(out).toContain("text");
  });
});

describe("toPreview", () => {
  it("flattens newlines to a single line", () => {
    expect(toPreview("<p>a</p><p>b</p>")).toBe("a b");
  });

  it("truncates with an ellipsis past the max length", () => {
    const long = `<p>${"x".repeat(200)}</p>`;
    const preview = toPreview(long, 20);
    expect(preview).toHaveLength(20);
    expect(preview.endsWith("…")).toBe(true);
  });

  it("does not truncate short text", () => {
    expect(toPreview("<p>short</p>", 20)).toBe("short");
  });
});
