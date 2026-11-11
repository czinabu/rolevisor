// Guesses the hiring company from a pasted job posting, so downloads can be named after it
// ("jane-doe-acme.pdf"). Plain rules, no model, so it works without an API key. It can miss; the
// download panel shows the guess in an editable box.

// One capitalized word of a company name, like "Acme", "AT&T", "O'Neil", "3M", "Co.".
const WORD = String.raw`[\p{Lu}\p{N}][\p{L}\p{N}&.'’-]*`;
// Up to five of them, allowing "&", "and", "of", "the" in between ("Bed Bath & Beyond", "Bank of America").
// Spaces only, never a line break, so a name can't run into the line above it.
const NAME = String.raw`${WORD}(?:[ \t]+(?:(?:&|and|of|the|for|de)[ \t]+)?${WORD}){0,4}`;

// Words that start a capitalized phrase but aren't a company.
const NOT_COMPANY = new Set(
  `the us you our we this it role job team position company opportunity what who why how
  responsibilities requirements qualifications benefits overview summary description location
  remote hybrid onsite on-site full-time part-time contract apply salary pay`.split(/\s+/),
);

function clean(name: string): string {
  return name
    .replace(/\s+/g, " ")
    .replace(/[\s,.;:!?)'’-]+$/u, "")
    .replace(/^[\s('‘"“]+/u, "")
    .trim();
}

function plausible(name: string): boolean {
  if (!name || name.length > 60) return false;
  const first = name.split(/\s+/)[0].toLowerCase().replace(/[^\p{L}-]/gu, "");
  if (NOT_COMPANY.has(first)) return false;
  if (name.split(/\s+/).length > 6) return false;
  return /\p{L}/u.test(name);
}

/** The company named in a job posting, or "" if none is found. */
export function guessCompany(posting: string): string {
  const text = posting.replace(/\r/g, "");
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const tries: string[] = [];

  // "Company: Acme Corp"
  const labeled = text.match(/^\s*(?:company(?: name)?|employer|organization|hiring company)\s*[:–—-]\s*(.+)$/imu);
  if (labeled) tries.push(labeled[1]);

  // Job boards put the company near the top: "Acme Corp · Columbus, OH" (LinkedIn) or
  // "Data Analyst at Acme Corp".
  for (const line of lines.slice(0, 4)) {
    const dot = line.split(/\s+[·•|]\s+/u);
    if (dot.length > 1 && line !== lines[0]) tries.push(dot[0]);
    const at = line.match(new RegExp(String.raw`\s(?:at|@)\s+(${NAME})`, "u"));
    if (at) tries.push(at[1]);
  }

  // Phrases in the body (the generic "X is a ..." ones last, since they misfire most): "About Acme", "Acme is hiring", "Join Acme", "At Acme, we ...".
  const patterns = [
    String.raw`^[Aa]bout\s+(${NAME})\s*$`,
    String.raw`(?:^|[.!]\s+)(${NAME})\s+(?:is|are)\s+(?:hiring|looking|seeking|searching|growing)`,
    String.raw`\b[Jj]oin\s+(?:the\s+)?(${NAME})`,
    String.raw`(?:^|[.!]\s+)[Aa]t\s+(${NAME}),\s+(?:we|our)\b`,
    String.raw`(?:^|[.!]\s+)(${NAME})\s+(?:is|was)\s+(?:a|an|the)\s`,
    String.raw`(?:^|[.!]\s+)(${NAME})\s+(?:runs|builds|makes|helps|provides|offers|operates)\s`,
  ];
  for (const p of patterns) {
    // No "i" flag: it would let \p{Lu} match lowercase and lose the capitalized-name check.
    const m = text.match(new RegExp(p, "mu"));
    if (m) tries.push(m[1]);
  }

  for (const t of tries) {
    const name = clean(t);
    if (plausible(name)) return name;
  }
  return "";
}

/** Lowercase, dash-separated piece of a file name: "Brightline Grocers, Inc." -> "brightline-grocers". */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[,\s]+(?:inc|llc|ltd|corp|corporation|co|plc|gmbh)\.?$/u, "")
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

/** The person's name from the first line of a resume, as a slug ("caleb-zinabu"), or "". */
export function nameSlug(resume: string): string {
  const first = resume.split("\n").find((l) => l.trim() && !l.startsWith("#")) ?? "";
  const words = first.replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).slice(0, 3).join(" ");
  return slug(words);
}

/**
 * Download file name without the extension.
 * Resume: "caleb-zinabu-acme", or "caleb-zinabu-resume" with no company.
 * Letter: "cover-letter-acme", or "cover-letter" with no company.
 */
export function downloadStem(kind: "resume" | "letter", text: string, company: string): string {
  const co = slug(company);
  if (kind === "letter") return co ? `cover-letter-${co}` : "cover-letter";
  const name = nameSlug(text) || "my";
  return co ? `${name}-${co}` : `${name}-resume`;
}

/** The zip of everything for one job: "caleb-zinabu-acme-application", or "my-application". */
export function kitStem(resume: string, company: string): string {
  return [nameSlug(resume) || "my", slug(company), "application"].filter(Boolean).join("-");
}
