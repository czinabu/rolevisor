/**
 * Turns resume text as it comes out of a PDF, a Word file, or a paste into the simple structure the PDF and
 * Word templates read ('## ' headings, '- ' bullets, "Company - Role | Dates" entry lines). No model is used:
 * these are plain rules, so the person can check the result and fix anything before downloading.
 */

const SECTION_NOUNS = [
  "summary", "profile", "objective", "about me", "experience", "employment", "work history", "career history",
  "education", "training", "skills", "competencies", "expertise", "certifications", "certificates", "certification",
  "licenses", "licensure", "projects", "publications", "awards", "honors", "honours", "achievements",
  "accomplishments", "volunteer", "volunteering", "community", "languages", "interests", "activities",
  "leadership", "references", "qualifications", "affiliations", "memberships", "coursework", "tools",
  "technologies", "highlights", "military service", "research", "presentations",
];
const SECTION_RE = new RegExp(`\\b(${SECTION_NOUNS.join("|")})\\b`, "i");

/** Sections whose plain lines are usually bullet points, even when the file lost its bullet symbols. */
const LIST_SECTION_RE = /experience|employment|work history|career history|projects|volunteer|leadership|military|research|achievements|accomplishments/i;

const BULLET_START = /^(?:[•·▪◦●■□►▸➢➤✓✔∙*]|[-–—](?=\s)|o(?=\s+[A-Z]))\s*/;

const MONTH = "(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
const SEASON = "(?:spring|summer|fall|autumn|winter)";
const DATE = `(?:(?:${MONTH}|${SEASON})\\s+)?(?:\\d{1,2}/)?\\d{4}`;
const RANGE = `${DATE}(?:\\s*(?:[-–—]|to)\\s*(?:${DATE}|present|current|now|today))?|(?:expected|anticipated)\\s+${DATE}`;
/** A line that ends in a date or a date range, like "Acme Corp, Analyst    Jan 2020 – Present". */
const ENTRY_RE = new RegExp(`^(.*?\\S)[\\s,|·•(\\t–—-]+(${RANGE})\\)?$`, "i");

const CONTACT_RE = /@|\+?\d[\d\s().-]{8,}\d|linkedin|github|https?:\/\/|www\./i;

/** True when the text already uses the template structure, so it should be left as it is. */
function alreadyStructured(lines: string[]): boolean {
  return lines.some((l) => /^#{1,6}\s+\S/.test(l));
}

function isHeading(line: string): boolean {
  const bare = line.replace(/:$/, "").trim();
  if (!bare || bare.length > 45 || /[.,;@|]|\d/.test(bare)) return false;
  if (bare.split(/\s+/).length > 5) return false;
  if (!SECTION_RE.test(bare)) return false;
  // "Skills" or "PROFESSIONAL EXPERIENCE" or "Work Experience", not "Managed the experience team".
  const words = bare.split(/\s+/).filter((w) => !/^(and|&|of|the|in|for|\/)$/i.test(w));
  return words.every((w) => /^[A-Z0-9&/(]/.test(w));
}

function entryLine(line: string): string | null {
  if (line.length > 140) return null;
  if (/ \| [^|]*(\d{4}|present|current)[^|]*$/i.test(line)) return line; // already "Company - Role | Dates"
  const m = ENTRY_RE.exec(line.replace(/\t+/g, "  "));
  if (!m) return null;
  const left = m[1].replace(/[\s,|·•(–—-]+$/, "").trim();
  if (!left || left.split(/\s+/).length > 14 || /[.!?]$/.test(left)) return null;
  return `${left} | ${m[2].replace(/\s*[-–—]\s*|\s+to\s+/i, " – ")}`;
}

function titleCase(heading: string): string {
  if (heading !== heading.toUpperCase()) return heading;
  return heading
    .toLowerCase()
    .replace(/(^|[\s/(&-])(\p{L})/gu, (_m, pre, ch) => pre + ch.toUpperCase())
    .replace(/\b(And|Of|The|In|For)\b/g, (w) => w.toLowerCase());
}

export function structureResume(text: string): string {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    // A line that is all bold ("**Experience**") is read as if it weren't, so a bold heading still counts.
    .map((l) => l.replace(/\s+$/, "").replace(/^(\s*)(?:\*\*|__)([^*_]+?)(?:\*\*|__)(:?)$/, "$1$2$3"));
  if (alreadyStructured(lines)) return text.trim();

  const out: string[] = [];
  let seenName = false;
  let seenHeading = false;
  let section = "";
  // Whether the current section has any real bullet symbols. If it doesn't, its plain lines become bullets.
  const sectionHasBullets = new Map<number, boolean>();
  let sectionStart = -1;

  // First pass: find which sections already have bullet symbols.
  {
    let s = -1;
    lines.forEach((raw, i) => {
      const line = raw.trim();
      if (isHeading(line)) s = i;
      else if (BULLET_START.test(line)) sectionHasBullets.set(s, true);
    });
  }

  lines.forEach((raw, i) => {
    const line = raw.trim().replace(/\t+/g, "  ");
    if (!line) {
      const last = out[out.length - 1];
      if (last && !last.startsWith("## ")) out.push("");
      return;
    }

    if (!seenName) {
      seenName = true;
      out.push(line.replace(/\s{2,}/g, " "));
      return;
    }

    if (isHeading(line)) {
      seenHeading = true;
      section = line;
      sectionStart = i;
      if (out.length && out[out.length - 1] !== "") out.push("");
      out.push(`## ${titleCase(line.replace(/:$/, "").trim())}`);
      return;
    }

    if (!seenHeading) {
      // A long paragraph under the contact lines is a summary without a heading.
      if (line.length > 100 && !CONTACT_RE.test(line)) {
        seenHeading = true;
        section = "Summary";
        sectionStart = i;
        if (out[out.length - 1] !== "") out.push("");
        out.push("## Summary");
        out.push(line);
        return;
      }
      out.push(line.replace(/\s{2,}/g, " "));
      return;
    }

    if (BULLET_START.test(line)) {
      out.push(`- ${line.replace(BULLET_START, "").trim()}`);
      return;
    }

    const entry = entryLine(line);
    if (entry) {
      if (out.length && out[out.length - 1] !== "" && !out[out.length - 1].startsWith("## ")) out.push("");
      out.push(entry);
      return;
    }

    const listy = LIST_SECTION_RE.test(section) && !sectionHasBullets.get(sectionStart);
    if (listy && line.split(/\s+/).length >= 8 && /^[A-Z]/.test(line) && !/:$/.test(line)) {
      out.push(`- ${line}`);
      return;
    }
    out.push(line.replace(/\s{2,}/g, " "));
  });

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
