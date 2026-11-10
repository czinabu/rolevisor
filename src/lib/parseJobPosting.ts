"use client";

import { FriendlyError } from "./errors";
import { readScreenshotWithClaude } from "./claude";
import { cleanOcrText } from "./ocrText";
import { parseResume } from "./parseResume";
import { needsModel, type ModelSettings } from "./providers";
import { piecesForClaude, prepareForOcr } from "./screenshot";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = /^image\/(png|jpe?g|webp|bmp|gif)$/;

export function isImage(file: File): boolean {
  return IMAGE_TYPES.test(file.type) || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name);
}

/**
 * Reads a screenshot with OCR in the browser, so it works with every provider
 * and the image never leaves this device. The OCR engine and English language
 * data are served from this site (public/tesseract, copied there by
 * scripts/copy-ocr-assets.mjs) because the Content-Security-Policy blocks the
 * library's default CDN. They download once on first use, then are cached.
 */
async function imageText(file: File, onProgress?: (percent: number) => void): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new FriendlyError("That image is over 10 MB. Try a smaller screenshot.");
  }
  const { createWorker } = await import("tesseract.js");
  const base = `${window.location.origin}/tesseract`;
  const worker = await createWorker("eng", 1, {
    workerPath: `${base}/worker.min.js`,
    corePath: `${base}/core`,
    langPath: `${base}/lang`,
    logger: (m) => {
      if (m.status === "recognizing text") onProgress?.(Math.round(m.progress * 100));
    },
  });
  try {
    // Assume print resolution: the image has been enlarged so text is about that size.
    await worker.setParameters({ user_defined_dpi: "300", preserve_interword_spaces: "1" });
    const image = await prepareForOcr(file).catch(() => file);
    const { data } = await worker.recognize(image);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

export interface ParsedPosting {
  text: string;
  /** Who read a screenshot: Claude, the free in-browser reader, or neither (not an image). */
  readBy: "claude" | "browser" | null;
  /** Set when Claude was tried and failed, so the free reader was used instead. */
  claudeError?: string;
}

async function readInBrowser(file: File, onProgress?: (percent: number) => void): Promise<string> {
  let text: string;
  try {
    text = await imageText(file, onProgress);
  } catch (error) {
    if (error instanceof FriendlyError) throw error;
    throw new FriendlyError(
      "That image couldn't be read. Check your connection (the reader downloads on first use), or paste the text instead.",
    );
  }
  text = cleanOcrText(text);
  if (!text) {
    throw new FriendlyError("No text was found in that image. Try a sharper screenshot, or paste the text.");
  }
  return text;
}

/**
 * Turns a screenshot, PDF, Word, or text file into the text of a job posting.
 * With a Claude API key, screenshots are read by Claude, which gets nearly
 * every word right and skips the website around the posting. Without one (or
 * if Claude fails) they are read in this browser for free.
 */
export async function parseJobPosting(
  file: File,
  settings: ModelSettings | null,
  onProgress?: (percent: number) => void,
): Promise<ParsedPosting> {
  if (!isImage(file)) return { text: await parseResume(file, "job posting"), readBy: null };
  if (file.size > MAX_IMAGE_BYTES) {
    throw new FriendlyError("That image is over 10 MB. Try a smaller screenshot.");
  }

  let claudeError: string | undefined;
  if (settings && settings.provider === "claude" && !needsModel(settings)) {
    try {
      const text = await readScreenshotWithClaude(settings, await piecesForClaude(file));
      if (!text) {
        throw new FriendlyError("No text was found in that image. Try a sharper screenshot, or paste the text.");
      }
      return { text, readBy: "claude" };
    } catch (error) {
      // A rejected key or a network problem shouldn't block the free reader.
      claudeError = error instanceof FriendlyError ? error.message : "Claude couldn't read it.";
      if (/No text was found/.test(claudeError)) throw error;
    }
  }
  return { text: await readInBrowser(file, onProgress), readBy: "browser", claudeError };
}
