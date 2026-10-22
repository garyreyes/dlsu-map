// WCAG 2.x contrast maths (10c). Pure helpers so a test can pin every text colour against what it sits on.
// styles.css and DESIGN.md write colours as #rgb, #rrggbb, rgb() and rgba() only (no oklch), so that is all this reads.

/** An sRGB colour: r, g, b in 0-255, alpha in 0-1. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export type ColorInput = string | Rgba;

const FN_FORM = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i;

/** Reads `#rgb`, `#rrggbb`, `rgb(r, g, b)` or `rgba(r, g, b, a)`. Throws on any other syntax. */
export function parseColor(input: string): Rgba {
  const text = input.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text)?.[1];
  if (hex) {
    const digits = hex.length === 3 ? hex.replace(/./g, '$&$&') : hex;
    const n = parseInt(digits, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const fn = FN_FORM.exec(text);
  if (fn) {
    const [, r, g, b, a] = fn;
    return { r: Number(r), g: Number(g), b: Number(b), a: a === undefined ? 1 : Number(a) };
  }
  throw new Error(`Unsupported colour syntax: ${input}`);
}

function toRgba(c: ColorInput): Rgba {
  return typeof c === 'string' ? parseColor(c) : c;
}

/** Relative luminance, 0 (black) to 1 (white). Alpha is ignored: composite first. */
export function relativeLuminance(c: ColorInput): number {
  const { r, g, b } = toRgba(c);
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Contrast ratio between two opaque colours, 1 to 21, the same in either order. */
export function contrastRatio(a: ColorInput, b: ColorInput): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** A (possibly translucent) colour laid over an opaque one; the result is opaque, channels rounded to whole 0-255. */
export function compositeOver(fg: ColorInput, bg: ColorInput): Rgba {
  const f = toRgba(fg);
  const b = toRgba(bg);
  const mix = (top: number, under: number) => Math.round(top * f.a + under * (1 - f.a));
  return { r: mix(f.r, b.r), g: mix(f.g, b.g), b: mix(f.b, b.b), a: 1 };
}
