// Turns a job posting link into the posting's text. The fetching happens on the Rolevisor server
// (src/app/api/job-posting/route.ts) because browsers can't read other sites' pages, and the model
// never browses: whatever model the person uses (Claude, LM Studio, Ollama, or none) gets plain
// text, the same as if they had pasted it. This file is the plain parsing, so it can be tested
// without a network.

export interface JobPage {
  title: string;
  company: string;
  location: string;
  /** The posting body as plain text, with line breaks and "- " bullets. */
  description: string;
}

/** Where to fetch a link from, and how to read the answer. */
export interface FetchPlan {
  url: string;
  /** "json" answers go to `read`; "html" pages go through readHtml. */
  kind: "json" | "html";
  /** Turns a JSON answer into a page, or null if the job isn't in it. */
  read?: (data: unknown) => JobPage | null;
  /** Shown if the page can't be read: the site's name, for "LinkedIn didn't let Rolevisor read...". */
  site: string;
}

/** The link the person typed, as a URL, or null if it isn't one. Adds https:// when it's left off. */
export function parseJobUrl(input: string): URL | null {
  const text = input.trim();
  if (!text || /\s/.test(text)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  // A real site has a dot in its name ("acme.com"), which also rules out "localhost".
  if (!url.hostname.includes(".") || url.username || url.password) return null;
  return url;
}

/** True when a pasted text is just a link, so the box can offer to read it. */
export function isJustALink(text: string): boolean {
  const t = text.trim();
  return /^(https?:\/\/|www\.)\S+$/i.test(t) && parseJobUrl(t) !== null;
}

// ---------------------------------------------------------------------------------------------
// HTML to text

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", bull: "•", middot: "·", trade: "™", reg: "®", copy: "©",
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

const BLOCK = /^(p|div|section|article|header|footer|main|h[1-6]|ul|ol|table|tr|blockquote|pre|dl|dt|dd|form)$/;

/** Readable plain text from a piece of HTML: paragraphs on their own lines, list items as "- ". */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/?([a-z0-9]+)\b[^>]*>/gi, (_, tag: string) => (BLOCK.test(tag.toLowerCase()) ? "\n\n" : " "))
    .replace(/<[^>]*>/g, " ");
  return tidy(decodeEntities(text));
}

/** One space between words, at most one blank line in a row, bullets kept tight. */
function tidy(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    // "- " items separated by blank lines read better as one list.
    .replace(/(\n- [^\n]*)\n\n(?=- )/g, "$1\n")
    .replace(/(\n- [^\n]*)\n\n(?=- )/g, "$1\n")
    .replace(/^- $/gm, "")
    .trim();
}

// ---------------------------------------------------------------------------------------------
// Reading a page

/** The JobPosting in the page's schema.org data, which most job boards and career sites include. */
export function fromJsonLd(html: string): JobPage | null {
  const scripts = html.matchAll(/<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi);
  for (const [, body] of scripts) {
    let data: unknown;
    try {
      data = JSON.parse(body.trim());
    } catch {
      continue;
    }
    const posting = findPosting(data);
    if (!posting) continue;
    const description = htmlToText(decodeEntities(str(posting.description)));
    if (!description) continue;
    return {
      title: decodeEntities(str(posting.title)).trim(),
      company: decodeEntities(str(org(posting.hiringOrganization))).trim(),
      location: placeOf(posting.jobLocation, posting.jobLocationType),
      description,
    };
  }
  return null;
}

type Obj = Record<string, unknown>;

function findPosting(data: unknown, depth = 0): Obj | null {
  if (depth > 4 || !data || typeof data !== "object") return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findPosting(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const obj = data as Obj;
  const type = obj["@type"];
  if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return obj;
  return findPosting(obj["@graph"], depth + 1);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function org(value: unknown): string {
  if (Array.isArray(value)) return org(value[0]);
  if (value && typeof value === "object") return str((value as Obj).name);
  return str(value);
}

function placeOf(location: unknown, type: unknown): string {
  const places = (Array.isArray(location) ? location : [location])
    .map((l) => {
      if (!l || typeof l !== "object") return str(l);
      const address = (l as Obj).address;
      if (!address || typeof address !== "object") return str(address);
      const a = address as Obj;
      return [a.addressLocality, a.addressRegion].map(str).filter(Boolean).join(", ") || str(a.addressCountry);
    })
    .filter(Boolean);
  const remote = str(type) === "TELECOMMUTE" ? "Remote" : "";
  return [...new Set([...places, remote].filter(Boolean))].slice(0, 3).join("; ");
}

function meta(html: string, name: string): string {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${name}["'][^>]*>`, "i"))?.[0];
  return tag ? decodeEntities(tag.match(/content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i)?.slice(1).find(Boolean) ?? "").trim() : "";
}

/** The part of an HTML element with this class, from its opening tag to the matching close. */
function byClass(html: string, cls: string): string {
  const open = new RegExp(`<([a-z0-9]+)\\b[^>]*class\\s*=\\s*["'][^"']*\\b${cls}\\b[^"']*["'][^>]*>`, "i").exec(html);
  if (!open) return "";
  const tag = open[1].toLowerCase();
  const rest = html.slice(open.index + open[0].length);
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  let depth = 1;
  for (let m = re.exec(rest); m; m = re.exec(rest)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return rest.slice(0, m.index);
  }
  return rest;
}

/**
 * Any page: the schema.org posting if there is one, otherwise the page's main text. The page
 * text can include the site's menus; the person sees it in the box and can trim it.
 */
export function readHtml(html: string, site = ""): JobPage | null {
  // LinkedIn's public job page and its guest version.
  if (/linkedin/i.test(site)) {
    const body = byClass(html, "show-more-less-html__markup") || byClass(html, "description__text");
    if (body) {
      return {
        title: htmlToText(byClass(html, "top-card-layout__title") || byClass(html, "topcard__title")),
        company: htmlToText(byClass(html, "topcard__org-name-link") || byClass(html, "topcard__flavor")),
        location: htmlToText(byClass(html, "topcard__flavor--bullet")),
        description: htmlToText(body),
      };
    }
  }
  const ld = fromJsonLd(html);
  if (ld) return ld;

  const main =
    html.match(/<main\b[^>]*>([\s\S]*)<\/main>/i)?.[1] ??
    html.match(/<article\b[^>]*>([\s\S]*)<\/article>/i)?.[1] ??
    html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ??
    html;
  const description = htmlToText(main.replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1\s*>/gi, ""));
  if (!description) return null;
  const title = meta(html, "og:title") || htmlToText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  return { title, company: meta(html, "og:site_name"), location: "", description };
}

// ---------------------------------------------------------------------------------------------
// Job boards with a public API, which answers faster and cleaner than their pages

/** "acme-corp" -> "Acme Corp", for boards whose API doesn't say the company's name. */
function nameFromSlug(slug: string): string {
  return decodeURIComponent(slug)
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

function greenhouse(board: string, id: string): FetchPlan {
  return {
    site: "Greenhouse",
    kind: "json",
    url: `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs/${encodeURIComponent(id)}`,
    read: (data) => {
      const d = data as Obj;
      if (!d || typeof d.content !== "string") return null;
      return {
        title: str(d.title),
        company: str(d.company_name) || nameFromSlug(board),
        location: str((d.location as Obj | undefined)?.name),
        // Greenhouse sends the HTML with its tags escaped.
        description: htmlToText(decodeEntities(d.content)),
      };
    },
  };
}

function lever(company: string, id: string): FetchPlan {
  return {
    site: "Lever",
    kind: "json",
    url: `https://api.lever.co/v0/postings/${encodeURIComponent(company)}/${encodeURIComponent(id)}`,
    read: (data) => {
      const d = data as Obj;
      if (!d || typeof d.text !== "string") return null;
      const lists = Array.isArray(d.lists) ? (d.lists as Obj[]) : [];
      const parts = [
        str(d.descriptionPlain) || htmlToText(str(d.description)),
        ...lists.map((l) => `${str(l.text)}\n${htmlToText(`<ul>${str(l.content)}</ul>`)}`),
        str(d.additionalPlain) || htmlToText(str(d.additional)),
      ];
      const cat = (d.categories ?? {}) as Obj;
      return {
        title: d.text,
        company: nameFromSlug(company),
        location: [str(cat.location), str(cat.commitment)].filter(Boolean).join(" · "),
        description: tidy(parts.filter((p) => p.trim()).join("\n\n")),
      };
    },
  };
}

function ashby(board: string, id: string): FetchPlan {
  return {
    site: "Ashby",
    kind: "json",
    url: `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}`,
    read: (data) => {
      const jobs = (data as Obj)?.jobs;
      if (!Array.isArray(jobs)) return null;
      const job = (jobs as Obj[]).find((j) => j.id === id || str(j.jobUrl).includes(id));
      if (!job) return null;
      return {
        title: str(job.title),
        company: nameFromSlug(board),
        location: [str(job.location), job.isRemote ? "Remote" : ""].filter(Boolean).join(" · "),
        description: str(job.descriptionPlain) ? tidy(str(job.descriptionPlain)) : htmlToText(str(job.descriptionHtml)),
      };
    },
  };
}

/** Sites that won't show a posting to a server at all, with what to do instead. */
export const BLOCKED_SITES: { test: RegExp; name: string }[] = [
  { test: /(^|\.)indeed\.[a-z.]+$/, name: "Indeed" },
  { test: /(^|\.)glassdoor\.[a-z.]+$/, name: "Glassdoor" },
  { test: /(^|\.)ziprecruiter\.com$/, name: "ZipRecruiter" },
];

/** How to fetch a job link: a job board's API when it has one, otherwise the page itself. */
export function planFetch(url: URL): FetchPlan {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  // boards.greenhouse.io/acme/jobs/123 and job-boards.greenhouse.io/acme/jobs/123
  if (/(^|\.)greenhouse\.io$/.test(host)) {
    const at = parts.indexOf("jobs");
    const id = url.searchParams.get("token") ?? (at > 0 ? parts[at + 1] : undefined);
    const board = url.searchParams.get("for") ?? (at > 0 ? parts[at - 1] : undefined);
    if (board && id && /^\d+$/.test(id)) return greenhouse(board, id);
  }
  // jobs.lever.co/acme/<id>, with or without /apply
  if (host === "jobs.lever.co" || host === "jobs.eu.lever.co") {
    if (parts.length >= 2) return lever(parts[0], parts[1]);
  }
  // jobs.ashbyhq.com/acme/<id>
  if (host === "jobs.ashbyhq.com" && parts.length >= 2) return ashby(parts[0], parts[1]);

  // linkedin.com/jobs/view/123, /jobs/view/some-title-123, or any page with ?currentJobId=123.
  // The guest version of the page works without signing in.
  if (/(^|\.)linkedin\.com$/.test(host)) {
    const id =
      url.searchParams.get("currentJobId") ??
      (parts[0] === "jobs" && parts[1] === "view" ? parts[2]?.match(/(\d{6,})\/?$/)?.[1] : undefined);
    if (id && /^\d+$/.test(id)) {
      return { site: "LinkedIn", kind: "html", url: `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${id}` };
    }
    return { site: "LinkedIn", kind: "html", url: url.href };
  }

  return { site: host, kind: "html", url: url.href };
}

/**
 * The text that goes in the job posting box. The title and "Company:" lines come first so the
 * download names and the keyword check find them, the same as with a pasted posting.
 */
export function postingText(page: JobPage): string {
  const head = [
    page.title,
    page.company && `Company: ${page.company}`,
    page.location && `Location: ${page.location}`,
  ].filter(Boolean);
  return [head.join("\n"), page.description].filter((p) => p.trim()).join("\n\n").trim();
}

/** Under this many characters, what was read is a login wall or an empty shell, not a posting. */
export const MIN_POSTING_CHARS = 200;
