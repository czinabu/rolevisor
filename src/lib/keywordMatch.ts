import { SKILL_TERMS, type SkillTerm, type Variant } from "./skillTerms";

/**
 * An ATS-style keyword match score, in plain code with no model. It pulls the skills, tools, and
 * credentials a job posting names, weighs each one by where the posting puts it (requirements
 * count most, "nice to have" least, the company blurb and benefits not at all), then checks which
 * of them appear word for word in the resume. That's roughly what an applicant tracking system
 * does, so the score says nothing about meaning: "ran payroll" doesn't match "payroll processing".
 * The model's fit score covers that.
 */

export type Importance = "required" | "preferred";

export interface PostingKeyword {
  /** How the keyword is shown: the bundled term's name, or a phrase as the posting writes it. */
  keyword: string;
  /** Every spelling that counts as this keyword. */
  variants: Variant[];
  importance: Importance;
  /** How much the keyword counts toward the score. */
  weight: number;
  /** How many times the posting uses it, outside the company blurb and benefits. */
  mentions: number;
  /** "skill" comes from the bundled list; "phrase" is a phrase the posting repeats. */
  kind: "skill" | "phrase";
}

export interface KeywordResult extends PostingKeyword {
  /** In the resume itself, which is all an applicant tracking system reads. */
  inResume: boolean;
  /** Not in the resume, but in the background notes or skills the person gave. */
  inBackground: boolean;
  /**
   * Not in the resume as written, but the resume uses a word from it in some form ("inventory
   * counts" for "Inventory management", "forecasts" for "Forecasting"). Those are the resume's own
   * words, so a rewording may be honest, if the person really did the thing.
   */
  related: string[];
}

/** How honestly a missing keyword could be added, from what the person already gave. */
export type Evidence = "background" | "related" | "none";

export function evidence(k: KeywordResult): Evidence {
  if (k.inBackground) return "background";
  return k.related.length ? "related" : "none";
}

export interface KeywordMatch {
  /** 0 to 100: the weighted share of the posting's keywords the resume contains. Null when none were found. */
  score: number | null;
  keywords: KeywordResult[];
  found: KeywordResult[];
  missing: KeywordResult[];
}

// ---------------------------------------------------------------------------------------------
// Matching

// Straight and curly apostrophes match each other, so "Bachelor’s" pasted from a web page still counts.
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/['’]/g, "['’]");

const patterns = new Map<string, RegExp | null>();

// Not inside a longer word, and not part of "R&D" or "AT&T".
const BEFORE = "(?<![\\p{L}\\p{N}])(?<!\\p{L}&)";
const AFTER = "(?![\\p{L}\\p{N}])(?!&\\p{L})";
// The start of a line, a sentence, or a bullet, where every word is capitalized anyway.
const NOT_SENTENCE_START = "(?<!^[\\s•·▪◦●■►▸➢✓*–—-]*)(?<![.!?]\\s+)";

/**
 * A pattern for a keyword as a whole word or phrase, allowing any spacing between words. A
 * case-sensitive name that's also an everyday word ("Go", "Slack", "Epic") isn't counted at the
 * start of a sentence or line, where "Go above and beyond" would otherwise look like the language.
 */
export function keywordPattern(keyword: string, { caseSensitive = false, global = false } = {}): RegExp | null {
  const flags = `mu${caseSensitive ? "" : "i"}${global ? "g" : ""}`;
  const key = `${flags} ${keyword}`;
  if (patterns.has(key)) return patterns.get(key)!;
  const words = keyword.trim().split(/\s+/).filter(Boolean);
  const wordLike = caseSensitive && /^\p{Lu}\p{Ll}+$/u.test(keyword.trim());
  const re = words.length
    ? new RegExp(`${BEFORE}${wordLike ? NOT_SENTENCE_START : ""}${words.map(escape).join("\\s+")}${AFTER}`, flags)
    : null;
  patterns.set(key, re);
  return re;
}

/** Whether a keyword appears as a whole word or phrase, ignoring case and extra spacing. */
export function hasKeyword(text: string, keyword: string, caseSensitive = false): boolean {
  const re = keywordPattern(keyword, { caseSensitive });
  return re ? re.test(text) : false;
}

function countVariants(text: string, variants: Variant[]): number {
  // Count each spot once, even when two spellings match it ("Node.js" and "Node").
  const spots = new Set<number>();
  for (const v of variants) {
    const re = keywordPattern(v.text, { caseSensitive: v.caseSensitive, global: true });
    if (!re) continue;
    for (const m of text.matchAll(re)) spots.add(m.index ?? 0);
  }
  return spots.size;
}

const hasAny = (text: string, variants: Variant[]) => variants.some((v) => hasKeyword(text, v.text, v.caseSensitive));

// ---------------------------------------------------------------------------------------------
// Reading the posting's sections

/** How much a line counts, from where it sits in the posting. 0 means skip it. */
type Weight = 0 | 1 | 2 | 3;
const REQUIRED: Weight = 3;
const DUTIES: Weight = 2;
const PREFERRED: Weight = 1;
const SKIP: Weight = 0;

// Usual heading wording for each kind of section. Checked in this order, so "Preferred
// qualifications" is a nice-to-have and "About the role" isn't skipped like "About us".
const HEADINGS: [RegExp, Weight][] = [
  [/(nice[\s-]to[\s-]haves?|preferred|bonus|desired|pluses|a plus|extra credit|would be great|ideal(ly)?|good to have)\b/i, PREFERRED],
  [/about (the|this) (role|job|position|opportunity)\b/i, DUTIES],
  [/(about you|who you are|you (have|bring|are))\b/i, REQUIRED],
  [
    /(about\b|who we are|our (mission|story|values|culture|team)|benefits|perks|what we offer|we offer|compensation|salary|pay\b|equal (employment )?opportunity|eeo\b|diversity|accommodations?|why (join|work)|life at|how to apply)/i,
    SKIP,
  ],
  [
    /(requirements?|qualifications?|must[\s-]haves?|required|what you('ll| will)? (need|bring|have)|what we('re| are)? looking for|looking for|skills|experience|minimum|basic|competencies|ideal candidate)\b/i,
    REQUIRED,
  ],
  [
    /(responsibilities|what you('ll| will)? do|duties|the role|day[\s-]to[\s-]day|in this role|you will|key tasks|the job|the work|overview|summary|description)\b/i,
    DUTIES,
  ],
];

const PREFERRED_LINE = /\b(nice[\s-]to[\s-]have|preferred|is a (big )?plus|a (big )?plus|bonus|ideally|desired|not required)\b/i;
const REQUIRED_LINE = /\b(required|must|minimum|at least)\b/i;
const BULLET = /^\s*[•·▪◦●■►▸➢✓*–—-]\s/;

/** The weight a heading line sets for the lines under it, or null if the line isn't a heading. */
function headingWeight(line: string): Weight | null {
  if (BULLET.test(line)) return null;
  const colon = /:\s*$/.test(line);
  const text = line.replace(/[:*#\s]+$/, "").replace(/^[#*\s]+/, "").trim();
  // A heading is short and doesn't read like a sentence or a "Label: value" line.
  if (!text || text.length > 60 || text.split(/\s+/).length > 8 || /[.!?:]/.test(text.slice(-1)) || text.includes(":")) {
    return null;
  }
  const caps = text === text.toUpperCase() && /[A-Z]/.test(text);
  for (const [re, weight] of HEADINGS) {
    // A line that's only marked as a heading by its words has to start with them, so "Sales
    // experience" stays a line and "Experience" is a heading.
    if (colon || caps ? re.test(text) : new RegExp(`^${re.source}`, re.flags).test(text)) return weight;
  }
  // An unfamiliar heading: treat what follows as part of the job.
  return colon || caps ? DUTIES : null;
}

interface Line {
  text: string;
  weight: Weight;
}

/** Splits a posting into lines, each weighted by its section and its own wording. */
export function weighLines(posting: string): Line[] {
  const raw = posting.split(/\r?\n/);
  const anyHeading = raw.some((l) => headingWeight(l) !== null);
  // Before the first heading is usually the title and a company blurb, so it counts a little.
  // With no headings at all, the whole posting counts as the job.
  let section: Weight = anyHeading ? PREFERRED : DUTIES;
  const lines: Line[] = [];
  for (const text of raw) {
    if (!text.trim()) continue;
    const heading = headingWeight(text);
    if (heading !== null) {
      section = heading;
      // A heading's own words count too ("Python developer"), at the section's weight.
      lines.push({ text, weight: section === SKIP ? SKIP : section });
      continue;
    }
    let weight: Weight = section;
    if (section !== SKIP) {
      if (PREFERRED_LINE.test(text)) weight = PREFERRED;
      else if (REQUIRED_LINE.test(text)) weight = REQUIRED;
    }
    lines.push({ text, weight });
  }
  return lines;
}

// ---------------------------------------------------------------------------------------------
// Repeated phrases the bundled list doesn't have

const STOP = new Set(
  `a an and or the of to in on for with by at from as is are be been being was were will would can could should
  may might must our your their its this that these those you we they it us them who what which when where how
  all any each every more most other some such than too very just also into over under about across within
  per via etc not no nor so if then but up out new including include includes like well able`.split(/\s+/),
);
// Words that appear in nearly every posting and make phrases that say nothing.
const GENERIC = new Set(
  `experience experienced ability abilities skill skills team teams work working role job jobs position years year
  strong excellent good great proven demonstrated knowledge understanding familiarity candidate candidates
  company opportunity opportunities environment day days time plus preferred required requirements responsibilities
  qualifications help support make use using based level related relevant equivalent field fast paced
  people person someone things world way ways range across join part full looking help`.split(/\s+/),
);

const TOKEN = /[\p{L}\p{N}][\p{L}\p{N}+#.'’-]*[\p{L}\p{N}+#]|[\p{L}\p{N}]/gu;

interface Phrase {
  display: string;
  count: number;
  weight: Weight;
  /** True while every use so far is capitalized, which usually means a name ("Brightline Grocers"). */
  name: boolean;
}

function repeatedPhrases(lines: Line[], taken: (phrase: string) => boolean): PostingKeyword[] {
  const counts = new Map<string, Phrase>();
  for (const line of lines) {
    if (line.weight === SKIP) continue;
    // Phrases don't run across punctuation.
    for (const chunk of line.text.split(/[,;:()/|•·!?]|\.\s|\s[-–—]\s/)) {
      const tokens = chunk.match(TOKEN) ?? [];
      for (let n = 2; n <= 3; n++) {
        for (let i = 0; i + n <= tokens.length; i++) {
          const words = tokens.slice(i, i + n);
          const lower = words.map((w) => w.toLowerCase());
          if (STOP.has(lower[0]) || STOP.has(lower[n - 1])) continue;
          if (lower.some((w) => GENERIC.has(w) || /^\d/.test(w))) continue;
          if (lower.slice(1, -1).some((w) => STOP.has(w) && w !== "and" && w !== "of")) continue;
          const key = lower.join(" ");
          const entry = counts.get(key) ?? { display: words.join(" "), count: 0, weight: SKIP, name: true };
          entry.count++;
          entry.name &&= words.every((w) => /^\p{Lu}/u.test(w));
          entry.weight = Math.max(entry.weight, line.weight) as Weight;
          counts.set(key, entry);
        }
      }
    }
  }

  const phrases = [...counts.entries()]
    .filter(([key, e]) => e.count >= 2 && !e.name && !taken(key))
    .sort((a, b) => b[1].count - a[1].count || b[0].split(" ").length - a[0].split(" ").length);

  // Keep a phrase only if no longer kept phrase already covers every use of it.
  const kept: [string, Phrase][] = [];
  for (const [key, e] of phrases) {
    if (kept.some(([k, ke]) => hasKeyword(k, key) && ke.count >= e.count)) continue;
    if (kept.some(([k]) => hasKeyword(key, k))) continue;
    kept.push([key, e]);
  }

  return kept.slice(0, 8).map(([, e]) => ({
    keyword: e.display,
    variants: [{ text: e.display, caseSensitive: false }],
    importance: e.weight >= DUTIES ? "required" : "preferred",
    // Phrases are less certain than named skills, so they count for less.
    weight: phraseWeight(e.weight, e.count),
    mentions: e.count,
    kind: "phrase",
  }));
}

// ---------------------------------------------------------------------------------------------
// Pulling keywords from the posting

function skillWeight(base: Weight, mentions: number): number {
  // Saying it again adds a little, up to three mentions.
  return base * (1 + 0.25 * Math.min(Math.max(mentions - 1, 0), 2));
}

function phraseWeight(base: Weight, mentions: number): number {
  return skillWeight(base, mentions) * 0.5;
}

/** The skills, tools, credentials, and repeated phrases a job posting asks for, most important first. */
export function extractKeywords(posting: string, terms: readonly SkillTerm[] = SKILL_TERMS): PostingKeyword[] {
  const lines = weighLines(posting);
  const counted = lines.filter((l) => l.weight !== SKIP);
  const countedText = counted.map((l) => l.text).join("\n");

  const skills: PostingKeyword[] = [];
  // The spellings the posting actually uses, for spotting a term inside a longer one.
  const matched = new Map<PostingKeyword, string[]>();
  // A plain substring check first skips most of the list without building a pattern for it.
  const lower = countedText.toLowerCase();
  const firstWord = (v: Variant) => v.text.toLowerCase().split(/\s+/)[0];
  for (const term of terms) {
    if (!term.variants.some((v) => lower.includes(firstWord(v))) || !hasAny(countedText, term.variants)) continue;
    let best: Weight = SKIP;
    for (const line of counted) {
      if (line.weight > best && hasAny(line.text, term.variants)) best = line.weight;
      if (best === REQUIRED) break;
    }
    if (best === SKIP) continue;
    const mentions = countVariants(countedText, term.variants);
    const skill: PostingKeyword = {
      keyword: term.label,
      variants: term.variants,
      importance: best >= DUTIES ? "required" : "preferred",
      weight: skillWeight(best, mentions),
      mentions,
      kind: "skill",
    };
    skills.push(skill);
    matched.set(
      skill,
      term.variants.filter((v) => hasKeyword(countedText, v.text, v.caseSensitive)).map((v) => v.text),
    );
  }

  // Drop a term that only ever shows up inside a longer one: "Excel" when the posting only
  // says "Excel macros", or "SQL" when it only says "SQL Server".
  const kept = skills.filter(
    (s) =>
      !skills.some(
        (other) =>
          other !== s &&
          other.mentions >= s.mentions &&
          matched.get(other)!.some((long) =>
            matched.get(s)!.some((short) => long.length > short.length && hasKeyword(long, short)),
          ),
      ),
  );

  const taken = (phrase: string) =>
    kept.some((s) => s.variants.some((v) => hasKeyword(phrase, v.text) || hasKeyword(v.text, phrase)));
  const phrases = repeatedPhrases(lines, taken);

  return [...kept, ...phrases].sort(
    (a, b) => b.weight - a.weight || b.mentions - a.mentions || a.keyword.localeCompare(b.keyword),
  );
}

// ---------------------------------------------------------------------------------------------
// The score

/**
 * Compares a resume with a job posting. Only the resume counts toward the score, because an
 * applicant tracking system only reads the resume. Keywords that are in the person's background
 * notes but not on the resume are marked, since those are the easiest ones to add honestly.
 */
export function matchKeywords(resume: string, posting: string, background = ""): KeywordMatch {
  let resumeStems: Map<string, string> | null = null;
  const keywords: KeywordResult[] = extractKeywords(posting).map((k) => {
    const inResume = hasAny(resume, k.variants);
    const inBackground = !inResume && background.trim() !== "" && hasAny(background, k.variants);
    let related: string[] = [];
    if (!inResume) {
      resumeStems ??= stemsOf(resume);
      related = relatedWords(k, resumeStems);
    }
    return { ...k, inResume, inBackground, related };
  });
  const total = keywords.reduce((sum, k) => sum + k.weight, 0);
  const got = keywords.reduce((sum, k) => sum + (k.inResume ? k.weight : 0), 0);
  return {
    score: total > 0 ? Math.round((100 * got) / total) : null,
    keywords,
    found: keywords.filter((k) => k.inResume),
    missing: keywords.filter((k) => !k.inResume),
  };
}

// ---------------------------------------------------------------------------------------------
// Related wording, for missing keywords

// Words too broad to say the resume is close to a keyword: "analysis" in "sales analysis" says
// nothing about "Data analysis".
const WEAK = new Set(
  `data management manager analysis analyst development developer systems system services service business
  customer customers technical tools tool software process processes program programs project projects
  operations operational design engineering engineer support planning reporting reports quality control
  general basic advanced senior junior lead`.split(/\s+/),
);

/** A rough word stem, so "forecasts", "forecasted", and "forecasting" meet. */
function stem(word: string): string {
  const w = word.toLowerCase().replace(/['’]s$/, "");
  const cut = w.replace(/(ings?|ed|es|s|ions?|ments?|ers?)$/, "");
  return cut.length >= 4 ? cut : w;
}

/** Each stem in a text, with the first word that produced it. */
function stemsOf(text: string): Map<string, string> {
  const stems = new Map<string, string>();
  for (const word of text.match(TOKEN) ?? []) {
    const s = stem(word);
    if (!stems.has(s)) stems.set(s, word);
  }
  return stems;
}

/** The resume's own words that share a stem with a meaningful word of the keyword. */
function relatedWords(k: PostingKeyword, resumeStems: Map<string, string>): string[] {
  const words = new Set<string>();
  for (const v of k.variants) {
    for (const word of v.text.match(TOKEN) ?? []) {
      const lower = word.toLowerCase();
      if (lower.length < 4 || STOP.has(lower) || GENERIC.has(lower) || WEAK.has(lower)) continue;
      const found = resumeStems.get(stem(word));
      if (found) words.add(found);
    }
  }
  return [...words];
}

// ---------------------------------------------------------------------------------------------
// Before and after tailoring

/** A keyword used this many times or more in a resume starts to read as stuffing. */
export const OVERUSE = 5;

export interface KeywordChange {
  before: KeywordMatch;
  after: KeywordMatch;
  /** In the tailored resume, not the original. */
  added: KeywordResult[];
  /**
   * Added by tailoring with nothing behind it in the original resume or the background notes.
   * Usually the rewrite used the posting's words for something the person did, but it's worth a
   * check that each one is true.
   */
  unsupported: KeywordResult[];
  /** In the original resume, dropped by tailoring. */
  dropped: KeywordResult[];
  /** Keywords the tailored resume repeats often enough to look stuffed, with the count. */
  overused: { keyword: KeywordResult; count: number }[];
}

/** Scores the original and tailored resumes against the same posting, and what changed. */
export function compareKeywords(original: string, tailored: string, posting: string, background = ""): KeywordChange {
  const before = matchKeywords(original, posting, background);
  const after = matchKeywords(tailored, posting, background);
  const was = new Map(before.keywords.map((k) => [k.keyword, k]));
  const added = after.found.filter((k) => !was.get(k.keyword)?.inResume);
  return {
    before,
    after,
    added,
    unsupported: added.filter((k) => {
      const old = was.get(k.keyword);
      return !old || evidence(old) === "none";
    }),
    dropped: after.missing.filter((k) => was.get(k.keyword)?.inResume),
    overused: after.found
      .map((k) => ({ keyword: k, count: countVariants(tailored, k.variants) }))
      .filter((o) => o.count >= OVERUSE && o.count > countVariants(original, o.keyword.variants)),
  };
}

/** The posting's keywords the resume doesn't contain, most important first. */
export function missingKeywords(resume: string, posting: string, background = ""): string[] {
  return matchKeywords(resume, posting, background).missing.map((k) => k.keyword);
}

export function keywordScoreLabel(score: number): string {
  if (score >= 80) return "Strong keyword match";
  if (score >= 60) return "Good keyword match";
  if (score >= 40) return "Some keywords missing";
  return "Many keywords missing";
}
