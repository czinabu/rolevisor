"use client";

// Gets a screenshot ready to be read. Tesseract reads best when lines of text
// are roughly 30 to 50 pixels tall and dark on a light background, which most
// screenshots are not: browser text is often 15 to 20 pixels tall, gray, or
// light on dark. Claude has its own size limit, so tall screenshots are cut
// into pieces for it instead.

/** The line height (in pixels) Tesseract is happiest with. */
const TARGET_LINE_HEIGHT = 44;
const MAX_SCALE = 4;
/** Keeps big upscales from running the tab out of memory. */
const MAX_OCR_PIXELS = 24_000_000;
const PADDING = 24;

/** Claude scales anything bigger than this down, which blurs small text. */
const CLAUDE_MAX_EDGE = 2576;
const CLAUDE_MAX_PIECES = 8;

function canvasOf(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not available");
  return { canvas, ctx };
}

/** Brightness of each pixel, 0 (black) to 255 (white). */
function luminance(data: Uint8ClampedArray): Float32Array {
  const out = new Float32Array(data.length / 4);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    // Transparent pixels in a pasted image are treated as white.
    const a = data[i + 3] / 255;
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    out[p] = l * a + 255 * (1 - a);
  }
  return out;
}

function percentile(sorted: Float32Array, p: number) {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

/**
 * Guesses how tall a line of text is by finding bands of rows that contain
 * ink. Returns 0 when it can't tell.
 */
export function estimateLineHeight(lum: Float32Array, width: number, height: number, background: number): number {
  const runs: number[] = [];
  let run = 0;
  for (let y = 0; y < height; y++) {
    let ink = 0;
    for (let x = 0; x < width; x++) {
      if (Math.abs(lum[y * width + x] - background) > 60) ink++;
    }
    // A row counts as text when a little of it, but not most of it, is ink
    // (most of it is a photo, a banner, or a button).
    const isText = ink > width * 0.003 && ink < width * 0.6;
    if (isText) run++;
    else {
      if (run >= 4) runs.push(run);
      run = 0;
    }
  }
  if (run >= 4) runs.push(run);
  if (runs.length < 3) return 0;
  runs.sort((a, b) => a - b);
  return runs[Math.floor(runs.length / 2)];
}

/**
 * Returns a cleaned-up copy of the screenshot for Tesseract: enlarged so the
 * text is a comfortable size, gray, dark text on light (dark mode is flipped),
 * with the contrast stretched so pale text stands out, and a white margin.
 */
export async function prepareForOcr(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = bitmap;
    const original = canvasOf(width, height);
    original.ctx.drawImage(bitmap, 0, 0);
    const lum = luminance(original.ctx.getImageData(0, 0, width, height).data);

    const sorted = Float32Array.from(lum).sort();
    const background = percentile(sorted, 0.5);
    const dark = background < 128;

    const lineHeight = estimateLineHeight(lum, width, height, background);
    let scale = lineHeight ? TARGET_LINE_HEIGHT / lineHeight : width < 1400 ? 2 : 1;
    scale = Math.min(MAX_SCALE, Math.max(1, scale));
    scale = Math.min(scale, Math.max(1, Math.sqrt(MAX_OCR_PIXELS / (width * height))));

    // Flip dark mode to dark-on-light, then stretch so the page is pure white
    // and the text near black. Percentiles (not one "background" color) keep
    // this working when the page has gray panels around a white card.
    if (dark) for (let p = 0; p < lum.length; p++) lum[p] = 255 - lum[p];
    const levels = dark ? Float32Array.from(lum).sort() : sorted;
    const black = percentile(levels, 0.005);
    const white = Math.max(black + 1, percentile(levels, 0.98));
    const pixels = original.ctx.createImageData(width, height);
    for (let p = 0; p < lum.length; p++) {
      const v = Math.round((255 * (lum[p] - black)) / (white - black));
      const i = p * 4;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = Math.min(255, Math.max(0, v));
      pixels.data[i + 3] = 255;
    }
    original.ctx.putImageData(pixels, 0, 0);

    const out = canvasOf(width * scale + PADDING * 2, height * scale + PADDING * 2);
    out.ctx.fillStyle = "#fff";
    out.ctx.fillRect(0, 0, out.canvas.width, out.canvas.height);
    out.ctx.imageSmoothingEnabled = true;
    out.ctx.imageSmoothingQuality = "high";
    out.ctx.drawImage(original.canvas, PADDING, PADDING, width * scale, height * scale);
    return out.canvas;
  } finally {
    bitmap.close();
  }
}

export interface ImagePiece {
  mediaType: "image/png" | "image/jpeg";
  /** Base64, without the data: prefix. */
  data: string;
}

/** Finds the quietest row near `target`, so a cut doesn't slice through a line of text. */
function quietRow(lum: Float32Array, width: number, from: number, to: number): number {
  let best = to;
  let bestScore = Infinity;
  for (let y = to; y >= from; y--) {
    let min = 255;
    let max = 0;
    for (let x = 0; x < width; x += 2) {
      const v = lum[y * width + x];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const score = max - min;
    if (score < bestScore) {
      bestScore = score;
      best = y;
      if (score < 8) break;
    }
  }
  return best;
}

/**
 * Splits a screenshot into pieces Claude can read at full detail. Wide images
 * are scaled to fit; tall ones (a whole scrolled page) are cut at blank rows
 * between lines of text.
 */
export async function piecesForClaude(file: Blob): Promise<ImagePiece[]> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, CLAUDE_MAX_EDGE / bitmap.width);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const whole = canvasOf(width, height);
    whole.ctx.fillStyle = "#fff";
    whole.ctx.fillRect(0, 0, width, height);
    whole.ctx.drawImage(bitmap, 0, 0, width, height);
    const lum = luminance(whole.ctx.getImageData(0, 0, width, height).data);

    const pieces: ImagePiece[] = [];
    let top = 0;
    while (top < height && pieces.length < CLAUDE_MAX_PIECES) {
      let bottom = Math.min(height, top + CLAUDE_MAX_EDGE);
      if (bottom < height && pieces.length < CLAUDE_MAX_PIECES - 1) {
        bottom = quietRow(lum, width, top + Math.round(CLAUDE_MAX_EDGE * 0.75), bottom - 1) + 1;
      } else if (bottom < height) {
        // Out of pieces: squeeze the rest into the last one.
        bottom = height;
      }
      const piece = canvasOf(width, bottom - top);
      piece.ctx.drawImage(whole.canvas, 0, top, width, bottom - top, 0, 0, width, bottom - top);
      // PNG keeps small text sharp; very large pieces go as JPEG to stay under the upload limit.
      let url = piece.canvas.toDataURL("image/png");
      let mediaType: ImagePiece["mediaType"] = "image/png";
      if (url.length > 4_500_000) {
        url = piece.canvas.toDataURL("image/jpeg", 0.92);
        mediaType = "image/jpeg";
      }
      pieces.push({ mediaType, data: url.slice(url.indexOf(",") + 1) });
      top = bottom;
    }
    return pieces;
  } finally {
    bitmap.close();
  }
}
