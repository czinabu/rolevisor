// Tidies the raw text the screenshot reader (Tesseract) returns. Kept free of
// browser APIs so it can be tested on its own.

/**
 * Bullet dots that Tesseract misreads as other characters at the start of a
 * line: "«", "+", "*", "e", "o", ".", "©" and friends. A lone letter or dot only counts
 * when it is followed by a space and a capital or digit, like "e Design and
 * analyze", so real words are left alone.
 */
const FAKE_BULLET = /^[ \t]*(?:[•·«»*+©®°¢■□▪◦●○➢➤✓✔>-]|[eoa.=](?=\s+[A-Z0-9]))[ \t]+(?=\S)/;

const SENTENCE_END = /[.!?:;)]$/;

function isBullet(line: string): boolean {
  return line.startsWith("• ");
}

/**
 * Cleans OCR output so it reads like the posting did:
 * - turns misread bullets back into "• "
 * - rejoins sentences the screenshot wrapped across lines
 * - drops the blank lines Tesseract puts between bullet points
 */
export function cleanOcrText(raw: string): string {
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[​﻿]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/ﬁ/g, "fi")
    .replace(/ﬂ/g, "fl")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .map((line) => (FAKE_BULLET.test(line) ? line.replace(FAKE_BULLET, "• ") : line.trim()));

  // Wrapped lines run close to the full width of the text; a line much shorter
  // than that ended on purpose (a heading, the end of a paragraph or bullet).
  const longest = Math.max(0, ...lines.map((line) => line.length));
  // A bullet's second line usually continues mid-sentence in lowercase; a
  // capitalized line after a bullet is more often the next paragraph.
  const wraps = (line: string, next: string | undefined, inBullet: boolean) =>
    next !== undefined &&
    next !== "" &&
    line !== "" &&
    !isBullet(next) &&
    line.length >= Math.max(40, longest * 0.7) &&
    (inBullet
      ? /^[a-z0-9(]/.test(next)
      : !SENTENCE_END.test(line) || /^[a-z]/.test(next));

  const joined: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    const inBullet = isBullet(line);
    while (wraps(line, lines[i + 1], inBullet)) {
      const next = lines[++i];
      line = line.endsWith("-") ? line + next : `${line} ${next}`;
    }
    joined.push(line);
  }

  // Blank lines between two bullets come from Tesseract's spacing, not the posting.
  const out = joined.filter((line, i) => {
    if (line !== "") return true;
    const before = joined.slice(0, i).reverse().find((l) => l !== "");
    const after = joined.slice(i + 1).find((l) => l !== "");
    return !(before && after && isBullet(before) && isBullet(after));
  });

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
