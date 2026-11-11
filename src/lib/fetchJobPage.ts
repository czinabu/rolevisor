import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { FriendlyError } from "./errors";
import {
  BLOCKED_SITES,
  MIN_POSTING_CHARS,
  parseJobUrl,
  planFetch,
  postingText,
  readHtml,
  type JobPage,
} from "./jobLink";

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_REDIRECTS = 5;

// A plain browser's headers: some career sites turn away anything that looks like a script.
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

/** True for addresses inside a private network or this machine, which a link must never reach. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v6 = ip.toLowerCase();
  const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6) || /^ff/.test(v6);
}

async function checkHost(url: URL) {
  if (url.port && url.port !== "443" && url.port !== "80") {
    throw new FriendlyError("That link uses an unusual port, so Rolevisor won't open it. Paste the posting's text instead.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  let addresses: string[];
  try {
    addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  } catch {
    throw new FriendlyError(`Couldn't find the site ${url.hostname}. Check the link for typos.`);
  }
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new FriendlyError("That link points to a private address, so Rolevisor won't open it.");
  }
}

/** Fetches a URL, following redirects only to public addresses, with a time and size limit. */
async function get(start: string, site: string): Promise<{ body: string; type: string }> {
  let url = new URL(start);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== "https:" && url.protocol !== "http:") break;
    await checkHost(url);
    let res: Response;
    try {
      res = await fetch(url, { headers: HEADERS, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new FriendlyError(`${site} took too long to answer. Try again, or paste the posting's text.`);
      }
      throw new FriendlyError(`Couldn't reach ${site}. Try again, or paste the posting's text.`);
    }
    const next = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && next) {
      url = new URL(next, url);
      continue;
    }
    if (res.status === 404 || res.status === 410) {
      throw new FriendlyError(`${site} says that posting doesn't exist. It may have closed, or the link is incomplete.`);
    }
    if (res.status === 401 || res.status === 403 || res.status === 429 || res.status === 999) {
      throw new FriendlyError(
        `${site} didn't let Rolevisor read that page (it blocks automatic reading or wants you signed in). Copy the posting's text, or a screenshot of it, and paste it here instead.`,
      );
    }
    if (!res.ok) {
      throw new FriendlyError(`${site} answered with an error (${res.status}). Try again, or paste the posting's text.`);
    }
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) throw new FriendlyError("That page is too big to read. Paste the posting's text instead.");
    const body = await readLimited(res);
    return { body, type: res.headers.get("content-type") ?? "" };
  }
  throw new FriendlyError("That link redirects too many times. Paste the posting's text instead.");
}

async function readLimited(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new FriendlyError("That page is too big to read. Paste the posting's text instead.");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export interface JobLinkResult extends JobPage {
  /** What goes in the job posting box. */
  text: string;
  /** Where it was read from, like "Greenhouse" or "acme.com". */
  site: string;
}

/** Reads the job posting at a link. Throws FriendlyError with what to do instead when it can't. */
export async function fetchJobPage(link: string): Promise<JobLinkResult> {
  const url = parseJobUrl(link);
  if (!url) throw new FriendlyError("That doesn't look like a web address. Copy the whole link from your browser.");
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const blocked = BLOCKED_SITES.find((s) => s.test.test(host));
  if (blocked) {
    throw new FriendlyError(
      `${blocked.name} doesn't let other sites read its job pages. Copy the posting's text (or take a screenshot) and paste it here instead. If the job has an "Apply on company site" link, that one usually works.`,
    );
  }

  const plan = planFetch(url);
  const { body, type } = await get(plan.url, plan.site);
  let page: JobPage | null = null;
  if (plan.kind === "json") {
    try {
      page = plan.read?.(JSON.parse(body)) ?? null;
    } catch {
      page = null;
    }
  } else if (/html|xml|text\/plain/i.test(type) || /^\s*</.test(body)) {
    page = /text\/plain/i.test(type) ? { title: "", company: "", location: "", description: body.trim() } : readHtml(body, plan.site);
  }

  if (!page || page.description.length < MIN_POSTING_CHARS) {
    throw new FriendlyError(
      `Rolevisor opened the link but couldn't find a job posting on it. Some sites only show postings after the page runs its scripts or you sign in. Copy the posting's text, or a screenshot of it, and paste it here instead.`,
    );
  }
  return { ...page, text: postingText(page), site: plan.site };
}
