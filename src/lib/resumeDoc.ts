import JSZip from "jszip";

/**
 * Builds PDF and Word files from the plain-text resume ('## ' headings, '- ' bullets) in the
 * browser. Both follow the formatting guidance in formatReview.ts: a single column, standard
 * fonts, 0.6 to 0.75 inch margins, 10 to 11 pt body text, and no tables, images, or header/footer
 * text. Lines like "Company - Role | Dates" become entry headers with the dates right-aligned.
 */

export const TEMPLATES = {
  classic: { label: "Classic", note: "Times New Roman, centered name, ruled headings" },
  modern: { label: "Modern", note: "Arial, blue accent, left-aligned name, ruled uppercase headings" },
} as const;
export type TemplateId = keyof typeof TEMPLATES;

type Block =
  | { kind: "name"; text: string }
  | { kind: "contact"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "text"; text: string };

/** Turns the resume text into blocks. The first plain line is the name, the lines until the first heading are contact details. */
export function parseResumeText(text: string): Block[] {
  const blocks: Block[] = [];
  let seenHeading = false;
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim().replace(/\*\*/g, "");
    if (!line) continue;
    const heading = /^#{1,6}\s+(.*)$/.exec(line);
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (heading) {
      seenHeading = true;
      blocks.push({ kind: "heading", text: heading[1].replace(/[*_]/g, "").trim() });
    } else if (bullet) {
      blocks.push({ kind: "bullet", text: bullet[1].trim() });
    } else if (!seenHeading && !blocks.some((b) => b.kind === "name")) {
      blocks.push({ kind: "name", text: line.replace(/[*_]/g, "") });
    } else if (!seenHeading) {
      blocks.push({ kind: "contact", text: line });
    } else {
      blocks.push({ kind: "text", text: line });
    }
  }
  return blocks;
}

const MARGIN_PT = 54; // 0.75 inch
const PAGE = { w: 612, h: 792 }; // US Letter

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const ACCENT: [number, number, number] = [29, 78, 216]; // Modern template accent (blue)
const MUTED: [number, number, number] = [90, 98, 110];
const INK: [number, number, number] = [24, 28, 36];

/** "Company - Role | June 2026 - Present" -> company, role, dates. Only lines that end in a date-like part count. */
export function parseEntryLine(text: string): { company: string; role: string; dates: string } | null {
  const i = text.lastIndexOf(" | ");
  if (i < 0) return null;
  const dates = text.slice(i + 3).trim();
  if (!/\d{4}|present|current/i.test(dates)) return null;
  const left = text.slice(0, i).trim();
  const m = /^(.+?)\s+[-–—]\s+(.+)$/.exec(left);
  return { company: m ? m[1] : left, role: m ? m[2] : "", dates };
}

/** Full URLs for the person's profile links; an empty string means none. */
export type ProfileLinkUrls = { linkedin?: string; github?: string; website?: string };

const LINK_LABELS: { key: keyof ProfileLinkUrls; label: string; words: RegExp; host: RegExp }[] = [
  { key: "linkedin", label: "LinkedIn", words: /LinkedIn/i, host: /linkedin\.com/i },
  { key: "github", label: "GitHub", words: /GitHub/i, host: /github\.com/i },
  { key: "website", label: "Portfolio", words: /Portfolio|Website/i, host: /^$/ },
];

/**
 * Turns the bare words "LinkedIn", "GitHub", and "Portfolio"/"Website" in the contact lines into links to
 * the person's saved URLs, and adds a link that isn't mentioned at all to the end of the contact lines.
 * Lines below the first heading are left alone, so "Git/GitHub" in a skills list stays plain text.
 */
export function addProfileLinks(text: string, links?: ProfileLinkUrls): string {
  const wanted = LINK_LABELS.filter((l) => links?.[l.key]?.trim());
  if (!wanted.length) return text;
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const firstHeading = lines.findIndex((l) => /^\s*#{1,6}\s/.test(l));
  const end = firstHeading < 0 ? lines.length : firstHeading;
  const nameAt = lines.findIndex((l) => l.trim());
  if (nameAt < 0 || nameAt >= end) return text;
  const contact: number[] = [];
  for (let i = nameAt + 1; i < end; i++) if (lines[i].trim()) contact.push(i);

  const missing: string[] = [];
  for (const l of wanted) {
    const url = links![l.key]!.trim();
    // Already linked (a markdown link to it, or the address written out): nothing to do.
    if (contact.some((i) => lines[i].includes(`](${url})`) || (l.key !== "website" && l.host.test(lines[i])))) continue;
    // A bare word, not already inside [label](url).
    const word = new RegExp(`(^|[^\\w\\[/.])(${l.words.source})(?![\\w\\]])`, "i");
    const at = contact.find((i) => word.test(lines[i]));
    if (at !== undefined) lines[at] = lines[at].replace(word, (_m, pre, w) => `${pre}[${w}](${url})`);
    else missing.push(`[${l.label}](${url})`);
  }
  if (missing.length) {
    if (contact.length) {
      const last = contact[contact.length - 1];
      const sep = lines[last].includes("|") && !lines[last].includes("•") ? " | " : " • ";
      lines[last] = `${lines[last].trimEnd()}${sep}${missing.join(sep)}`;
    } else {
      lines.splice(nameAt + 1, 0, missing.join(" • "));
    }
  }
  return lines.join("\n");
}

type Word = { text: string; url?: string };

/** Splits a contact line into words, keeping links: [label](url), bare URLs, and email addresses become clickable. */
export function contactWords(line: string): Word[] {
  const words: Word[] = [];
  const re = /\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)\s]+)\)|((?:https?:\/\/|www\.)[^\s•|]+|\b(?:[a-z]{2,3}\.)?(?:linkedin|github)\.com\/[^\s•|]+)|([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/g;
  const plain = (t: string) => {
    for (const w of t.split(/\s+/)) if (w) words.push({ text: w });
  };
  let last = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    plain(line.slice(last, m.index));
    if (m[1]) for (const w of m[1].split(/\s+/)) words.push({ text: w, url: m[2] });
    else if (m[3]) {
      const href = /^https?:\/\//i.test(m[3]) ? m[3] : `https://${m[3]}`;
      words.push({ text: m[3].replace(/^https?:\/\/(www\.)?/, "").replace(/^www\./, "").replace(/\/$/, ""), url: href });
    }
    else words.push({ text: m[4], url: `mailto:${m[4]}` });
    last = m.index + m[0].length;
  }
  plain(line.slice(last));
  return words;
}

/** Layout settings tried in order until the resume fits on one page. Type never drops below 10 pt, margins below 0.6 inch. */
type Fit = { type: number; space: number; margin: number };
const FITS: Fit[] = [
  { type: 1, space: 1, margin: MARGIN_PT },
  { type: 1, space: 0.8, margin: MARGIN_PT },
  { type: 0.96, space: 0.7, margin: 47 },
  { type: 0.92, space: 0.6, margin: 43 },
];

/**
 * jsPDF is large, so it loads only when someone asks for a PDF. A resume that is a little too long for one page
 * is tightened step by step (spacing, then type size and margins) until it fits. One that can't fit even at the
 * tightest step is laid out at full size, which reads best across two pages.
 */
export async function makeResumePdf(text: string, template: TemplateId, links?: ProfileLinkUrls): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const blocks = parseResumeText(addProfileLinks(text, links));
  for (const fit of FITS) {
    const doc = renderResume(new jsPDF({ unit: "pt", format: "letter" }), blocks, template, fit);
    if (doc.getNumberOfPages() === 1) return doc.output("blob");
  }
  return renderResume(new jsPDF({ unit: "pt", format: "letter" }), blocks, template, FITS[0]).output("blob");
}

type Doc = InstanceType<typeof import("jspdf").jsPDF>;
type Rgb = [number, number, number];
type Style = "normal" | "bold" | "italic";

function renderResume(doc: Doc, blocks: Block[], template: TemplateId, fit: Fit): Doc {
  const modern = template === "modern";
  const font = modern ? "helvetica" : "times";
  const { margin } = fit;
  const width = PAGE.w - margin * 2;
  const bottom = PAGE.h - margin;
  const t = (pt: number) => pt * fit.type; // type size
  const sp = (pt: number) => pt * fit.space; // vertical spacing
  const LEAD = 1.22;
  const body = t(11);
  const entrySize = t(11.5);
  let y = margin;

  const ink = (c: Rgb) => doc.setTextColor(c[0], c[1], c[2]);
  const face = (size: number, style: Style = "normal") => {
    doc.setFont(font, style);
    doc.setFontSize(size);
  };
  const room = (h: number) => {
    if (y + h > bottom && y > margin) {
      doc.addPage();
      y = margin;
    }
  };
  /** Moves down one line and returns its baseline. */
  const nextLine = (size: number) => {
    room(size * LEAD);
    y += size * LEAD;
    return y - size * 0.25;
  };

  /** Wrapped text. `before` draws something on the first line ahead of the text, so extraction reads it first. */
  const write = (
    str: string,
    o: { size: number; style?: Style; center?: boolean; indent?: number; gap?: number; rgb?: Rgb; keep?: boolean; before?: (base: number) => void },
  ) => {
    const indent = o.indent ?? 0;
    face(o.size, o.style);
    const lines: string[] = doc.splitTextToSize(str, width - indent);
    if (o.keep) room(lines.length * o.size * LEAD); // don't split a bullet across pages
    lines.forEach((line, n) => {
      const base = nextLine(o.size);
      if (n === 0) o.before?.(base);
      face(o.size, o.style);
      ink(o.rgb ?? INK);
      if (o.center) doc.text(line, PAGE.w / 2, base, { align: "center" });
      else doc.text(line, margin + indent, base);
    });
    y += o.gap ?? 0;
  };

  const writeContact = (line: string) => {
    const size = t(10);
    face(size);
    const space = doc.getTextWidth(" ");
    const rows: Word[][] = [[]];
    let rowW = 0;
    for (const w of contactWords(line)) {
      const ww = doc.getTextWidth(w.text);
      if (rowW && rowW + space + ww > width) {
        rows.push([]);
        rowW = 0;
      }
      rows[rows.length - 1].push(w);
      rowW += (rowW ? space : 0) + ww;
    }
    for (const row of rows) {
      const base = nextLine(size);
      const total = row.reduce((sum, w, i) => sum + doc.getTextWidth(w.text) + (i ? space : 0), 0);
      let x = modern ? margin : (PAGE.w - total) / 2;
      for (const w of row) {
        const ww = doc.getTextWidth(w.text);
        ink(w.url ? (modern ? ACCENT : INK) : modern ? MUTED : INK);
        doc.text(w.text, x, base);
        if (w.url) {
          doc.link(x, base - size, ww, size * 1.25, { url: w.url });
          doc.setDrawColor(...(modern ? ACCENT : INK));
          doc.setLineWidth(0.4);
          doc.line(x, base + 1.2, x + ww, base + 1.2);
        }
        x += ww + space;
      }
    }
    y += sp(1);
  };

  /** Space a block needs for its first line, plus an entry's first bullet line, so nothing is stranded at a page bottom. */
  const leadIn = (i: number): number => {
    const b = blocks[i];
    if (!b) return 0;
    if (b.kind === "text" && parseEntryLine(b.text)) {
      return sp(5) + entrySize * LEAD + sp(2) + (blocks[i + 1]?.kind === "bullet" ? body * LEAD : 0);
    }
    return body * LEAD;
  };

  const writeEntry = (entry: NonNullable<ReturnType<typeof parseEntryLine>>, i: number) => {
    y += sp(5); // space between roles
    room(leadIn(i));
    face(entrySize - 0.5);
    const datesW = doc.getTextWidth(entry.dates);
    const leftW = width - datesW - 12;
    const roleStyle: Style = modern ? "normal" : "italic";
    // Company in bold, then the role; whatever doesn't fit beside the dates wraps under them.
    face(entrySize, "bold");
    const [company, ...companyRest] = doc.splitTextToSize(entry.company, leftW) as string[];
    const compW = doc.getTextWidth(company);
    const base = nextLine(entrySize);
    ink(INK);
    doc.text(company, margin, base);
    let rest: string[] = companyRest.length ? [companyRest.join(" ")] : [];
    if (entry.role) {
      face(entrySize, roleStyle);
      const role = `  |  ${entry.role}`;
      const fits = !rest.length && compW + doc.getTextWidth(role) <= leftW;
      if (fits) doc.text(role, margin + compW, base);
      else rest = [...rest, entry.role];
    }
    face(entrySize - 0.5);
    ink(modern ? MUTED : INK);
    doc.text(entry.dates, PAGE.w - margin, base, { align: "right" });
    for (const r of rest) write(r, { size: entrySize, style: roleStyle });
    y += sp(2);
  };

  blocks.forEach((b, i) => {
    if (b.kind === "name") {
      write(b.text, { size: t(modern ? 26 : 20), style: "bold", center: !modern, gap: sp(2) });
    } else if (b.kind === "contact") {
      writeContact(b.text);
    } else if (b.kind === "heading") {
      const size = t(modern ? 11 : 12);
      y += sp(modern ? 10 : 9);
      room(size * LEAD + sp(5) + leadIn(i + 1));
      if (modern) {
        doc.setCharSpace(0.8);
        write(b.text.toUpperCase(), { size, style: "bold", rgb: ACCENT });
        doc.setCharSpace(0);
        doc.setDrawColor(...ACCENT);
        doc.setLineWidth(0.9);
        doc.line(margin, y + 1.5, PAGE.w - margin, y + 1.5);
        y += sp(5);
      } else {
        write(b.text, { size, style: "bold", gap: 1 });
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(margin, y, PAGE.w - margin, y);
        y += sp(4);
      }
    } else if (b.kind === "bullet") {
      write(b.text, {
        size: body,
        indent: 14,
        gap: sp(1.5),
        keep: true,
        before: (base) => {
          face(body);
          ink(modern ? ACCENT : INK);
          doc.text("•", margin + 3, base);
        },
      });
    } else {
      const entry = parseEntryLine(b.text);
      if (entry) writeEntry(entry, i);
      else write(b.text, { size: body, gap: sp(1) });
    }
  });
  return doc;
}

/** Plain-text letter: first lines are kept as written, blank lines separate paragraphs. */
export async function makeLetterPdf(text: string, template: TemplateId): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const font = template === "classic" ? "times" : "helvetica";
  doc.setFont(font, "normal");
  doc.setFontSize(11.5);
  const lead = 11.5 * 1.35;
  const width = PAGE.w - MARGIN_PT * 2;
  let y = MARGIN_PT;
  for (const para of text.replace(/\r\n?/g, "\n").split("\n")) {
    const lines: string[] = para.trim() ? doc.splitTextToSize(para, width) : [""];
    for (const line of lines) {
      if (y + lead > PAGE.h - MARGIN_PT) {
        doc.addPage();
        y = MARGIN_PT;
      }
      y += lead;
      if (line) doc.text(line, MARGIN_PT, y - 3);
    }
  }
  return doc.output("blob");
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Run = { text: string; bold?: boolean; italic?: boolean; color?: string; size?: number; rId?: string };
type Para = {
  text: string;
  size: number;
  bold?: boolean;
  center?: boolean;
  rule?: string; // bottom border color
  hang?: boolean;
  before?: number;
  after?: number;
  color?: string;
  keepNext?: boolean; // keep on the same page as the next paragraph
  runs?: Run[]; // replaces text when set
  tabRight?: boolean; // a right-aligned tab stop at the right margin, for dates
};

const runXml = (r: Run, size: number) =>
  `<w:r><w:rPr>${r.bold ? "<w:b/>" : ""}${r.italic ? "<w:i/>" : ""}${r.color ? `<w:color w:val="${r.color}"/>` : ""}<w:sz w:val="${(r.size ?? size) * 2}"/></w:rPr>${r.text
    .split("\t")
    .map((part) => `<w:t xml:space="preserve">${esc(part)}</w:t>`)
    .join("<w:tab/>")}</w:r>`;

const linkedRunXml = (r: Run, size: number) =>
  r.rId ? `<w:hyperlink r:id="${r.rId}">${runXml({ ...r, rId: undefined }, size).replace("</w:rPr>", '<w:u w:val="single"/></w:rPr>')}</w:hyperlink>` : runXml(r, size);

function paraXml(p: Para): string {
  const ppr = [
    p.keepNext ? "<w:keepNext/>" : "",
    p.hang ? "<w:keepLines/>" : "", // a bullet's lines stay on one page
    p.rule ? `<w:pBdr><w:bottom w:val="single" w:sz="${p.color ? 8 : 4}" w:space="1" w:color="${p.rule}"/></w:pBdr>` : "",
    p.tabRight ? `<w:tabs><w:tab w:val="right" w:pos="${RIGHT_TAB}"/></w:tabs>` : "",
    `<w:spacing w:before="${p.before ?? 0}" w:after="${p.after ?? 20}" w:line="240" w:lineRule="auto"/>`,
    p.hang ? '<w:ind w:left="360" w:hanging="260"/>' : "",
    p.center ? '<w:jc w:val="center"/>' : "",
  ].join("");
  const runs = p.runs ?? [{ text: p.text, bold: p.bold, color: p.color }];
  return `<w:p><w:pPr>${ppr}</w:pPr>${runs.map((r) => linkedRunXml(r, p.size)).join("")}</w:p>`;
}

/** Page margin in twentieths of a point. Resumes use a slightly tighter margin than letters so a full page fits. */
const DOCX_MARGIN = { resume: 936, letter: 1080 }; // 0.65 and 0.75 inch
const RIGHT_TAB = 12240 - DOCX_MARGIN.resume * 2;

async function zipDocx(paras: Para[], font: string, links: string[] = [], margin = DOCX_MARGIN.letter): Promise<Blob> {
  const linkRels = links
    .map((url, n) => `<Relationship Id="rLink${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(url)}" TargetMode="External"/>`)
    .join("");
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  zip.file(
    "word/_rels/document.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${linkRels}</Relationships>`,
  );
  zip.file(
    "word/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${paras.map(paraXml).join("")}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="${margin}" w:right="${margin}" w:bottom="${margin}" w:left="${margin}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`,
  );
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export function makeResumeDocx(text: string, template: TemplateId, links?: ProfileLinkUrls): Promise<Blob> {
  const classic = template === "classic";
  const accent = "1D4ED8";
  const linkTargets: string[] = [];
  const blocks = parseResumeText(addProfileLinks(text, links));
  const paras: Para[] = blocks.map((b, i): Para => {
    switch (b.kind) {
      case "name":
        return { text: b.text, size: classic ? 20 : 26, bold: true, center: classic, after: 40 };
      case "contact": {
        const muted = classic ? undefined : "5A626E";
        const runs = contactWords(b.text).flatMap((w, n): Run[] => {
          const gap: Run[] = n ? [{ text: " " }] : [];
          if (!w.url) return [...gap, { text: w.text, color: muted }];
          linkTargets.push(w.url);
          return [...gap, { text: w.text, color: classic ? undefined : accent, rId: `rLink${linkTargets.length - 1}` }];
        });
        return { text: b.text, size: 10, center: classic, runs };
      }
      case "heading":
        return {
          text: classic ? b.text : b.text.toUpperCase(),
          size: classic ? 12 : 11,
          bold: true,
          color: classic ? undefined : accent,
          rule: classic ? "000000" : accent,
          before: 120,
          after: 80,
          keepNext: true,
        };
      case "bullet":
        return {
          text: "",
          size: 11,
          hang: true,
          after: 10,
          runs: [{ text: "•", color: classic ? undefined : accent }, { text: `\t${b.text}` }],
        };
      default: {
        const entry = parseEntryLine(b.text);
        if (!entry) return { text: b.text, size: 11, keepNext: blocks[i - 1]?.kind === "heading" };
        return {
          text: "",
          size: 11.5,
          before: 80,
          after: 20,
          keepNext: true,
          tabRight: true,
          runs: [
            { text: entry.company, bold: true },
            ...(entry.role ? [{ text: `  |  ${entry.role}`, italic: classic }] : []),
            { text: `\t${entry.dates}`, size: 11, color: classic ? undefined : "5A626E" },
          ],
        };
      }
    }
  });
  return zipDocx(paras, classic ? "Times New Roman" : "Arial", linkTargets, DOCX_MARGIN.resume);
}

export function makeLetterDocx(text: string, template: TemplateId): Promise<Blob> {
  const paras = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line): Para => ({ text: line, size: 11, after: 0 }));
  return zipDocx(paras, template === "classic" ? "Times New Roman" : "Arial");
}
