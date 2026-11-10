"use client";

import { useEffect, useState } from "react";
import { normalizeUrl } from "./profileLinks";

/**
 * Links for the projects on a resume: a live demo and the code. Resumes often say "Live demo | GitHub repo"
 * next to a project with nothing behind the words, because copying text out of a file drops the links. The
 * person types each address once; it's kept in this browser and turned into a clickable link when a resume
 * is downloaded.
 */

export type ProjectLinkKind = "demo" | "code";

export interface ProjectLinkUrls {
  demo: string;
  code: string;
}

/** Saved links, by project key (see `projectKey`). */
export type ProjectLinks = Record<string, ProjectLinkUrls>;

export interface ResumeProject {
  /** The project's name as the resume writes it, e.g. "Rolevisor". */
  name: string;
  key: string;
  /** Index of the line that names the project, in the resume text split on newlines. */
  line: number;
  /** The words for each link already on that line, e.g. "Live demo" or "GitHub repo", when there are any. */
  words: Partial<Record<ProjectLinkKind, string>>;
  /** Kinds that already have a web address on the line, so there's nothing to add. */
  linked: ProjectLinkKind[];
}

export const PROJECT_LINK_FIELDS: { kind: ProjectLinkKind; label: string; placeholder: string }[] = [
  { kind: "demo", label: "Live demo", placeholder: "your-project.com" },
  { kind: "code", label: "Code (GitHub repo)", placeholder: "github.com/you/project" },
];

/**
 * Words that stand for each link. Phrases like "Live demo" count anywhere after the project's name; plain words
 * like "Demo" or "Code" count only as their own item ("Rolevisor | Demo | Code"), so "Claude Code plugin" stays text.
 */
const PHRASES: Record<ProjectLinkKind, string> = {
  demo: "live\\s+demo|live\\s+site|live\\s+app|live\\s+version",
  code: "github\\s+repo(?:sitory)?|github|gitlab|source\\s+code|code\\s+repo",
};
const PLAIN: Record<ProjectLinkKind, string> = {
  demo: "demo|website|site|app",
  code: "repo(?:sitory)?|code",
};

/** Finds a link word that isn't already the label of a [label](url) link. Group 2 is the word. */
const bareWords = (kind: ProjectLinkKind) => [
  new RegExp(`(^|[^\\w\\[/.])(${PHRASES[kind]})(?![\\w\\]])`, "i"),
  new RegExp(`(^|[|•·,(]\\s*)(${PLAIN[kind]})(?=\\s*(?:[|•·,)]|$))`, "i"),
];
const findWord = (kind: ProjectLinkKind, s: string) => {
  for (const re of bareWords(kind)) {
    const m = re.exec(s);
    if (m) return { re, word: m[2] };
  }
  return null;
};

/** "Rolevisor (Next.js)" and "rolevisor" share a key, so a link saved once still applies after tailoring. */
export function projectKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The project's name: the part of the line before the first separator, without link syntax or bullets. */
function nameOf(line: string): string {
  const plain = line
    .replace(/^[-*•]\s+/, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|__/g, "");
  return plain.split(/\s+[|•·–—-]\s+|:\s|\s\(|\s{2,}/)[0].trim();
}

const PROJECT_HEADING = /project|portfolio/i;
const LINK_ON_LINE = /\]\((https?:\/\/[^)\s]+)\)|https?:\/\/\S+|\bwww\.\S+|\b[\w-]+\.(?:com|dev|app|net|org|me|co|site|page)(?:\/\S*)?|\b[\w-]+\.github\.io\S*|\bgithub\.com\/\S+/i;

/**
 * The projects in the resume's Projects (or Portfolio) sections. Each plain line under the heading names a project,
 * like "Rolevisor | Live demo | GitHub repo" or "Rolevisor - AI resume helper | 2026". When a section is only
 * bullets, a bullet that starts with a short name ("Rolevisor: built a ...") counts as a project instead.
 */
export function findProjects(text: string): ResumeProject[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const out: ResumeProject[] = [];
  let section: number[] | null = null;
  const sections: number[][] = [];
  lines.forEach((raw, i) => {
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(raw);
    if (heading) {
      section = PROJECT_HEADING.test(heading[1]) ? [] : null;
      if (section) sections.push(section);
    } else if (section && raw.trim()) section.push(i);
  });

  for (const s of sections) {
    const titles = s.filter((i) => !/^\s*[-*•]\s+/.test(lines[i]));
    const candidates = titles.length ? titles : s;
    for (const i of candidates) {
      const line = lines[i].trim();
      const name = nameOf(line);
      // A bullet with no short name in front is a description, not a project.
      if (!name || name.length > 60 || (!titles.length && name === line.replace(/^[-*•]\s+/, "").trim())) continue;
      const rest = line.slice(line.indexOf(name) + name.length);
      const words: ResumeProject["words"] = {};
      const linked: ProjectLinkKind[] = [];
      for (const kind of ["demo", "code"] as const) {
        const found = findWord(kind, titles.length ? rest : rest.slice(0, 80));
        if (found) words[kind] = found.word;
      }
      // An address already written on the line: GitHub ones are the code, anything else the demo.
      for (const m of rest.matchAll(new RegExp(LINK_ON_LINE.source, "gi"))) {
        const kind: ProjectLinkKind = /github\.com|gitlab\.com/i.test(m[0]) ? "code" : "demo";
        if (!linked.includes(kind)) linked.push(kind);
      }
      const key = projectKey(name);
      if (key && !out.some((p) => p.key === key)) out.push({ name, key, line: i, words, linked });
    }
  }
  return out;
}

/** Saved links for this project. A name that changed a little in tailoring ("Rolevisor" to "Rolevisor app") still matches. */
export function linksFor(key: string, links: ProjectLinks): ProjectLinkUrls | undefined {
  if (links[key]) return links[key];
  const near = Object.keys(links).find((k) => k.length >= 4 && key.length >= 4 && (key.startsWith(k) || k.startsWith(key)));
  return near ? links[near] : undefined;
}

/**
 * Turns "Live demo" and "GitHub repo" next to each project into links to the person's saved addresses. A link
 * whose word isn't on the line is added at the end of the line, before any dates so they stay on the right.
 */
export function addProjectLinks(text: string, links?: ProjectLinks): string {
  if (!links || !Object.keys(links).length) return text;
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  for (const p of findProjects(text)) {
    const saved = linksFor(p.key, links);
    if (!saved) continue;
    let line = lines[p.line];
    const missing: string[] = [];
    for (const kind of ["demo", "code"] as const) {
      const url = normalizeUrl(saved[kind] ?? "");
      if (!url || p.linked.includes(kind) || line.includes(`](${url})`)) continue;
      const start = line.indexOf(p.name) + p.name.length;
      const tail = line.slice(start);
      const found = p.words[kind] ? findWord(kind, tail) : null;
      if (found) {
        line = line.slice(0, start) + tail.replace(found.re, (_m, pre, w) => `${pre}[${w}](${url})`);
      } else {
        const label = kind === "demo" ? "Live demo" : /github\.com/i.test(url) ? "GitHub" : "Code";
        missing.push(`[${label}](${url})`);
      }
    }
    if (missing.length) {
      const bullet = /^(\s*[-*•]\s+)(.*)$/.exec(line);
      if (bullet) {
        // "- Rolevisor: built ..." -> "- Rolevisor ([Live demo](...)): built ..."
        const at = bullet[1].length + bullet[2].indexOf(p.name) + p.name.length;
        line = `${line.slice(0, at)} (${missing.join(", ")})${line.slice(at)}`;
      } else {
        const dates = /\s\|\s[^|]*(?:\d{4}|present|current)[^|]*$/i.exec(line);
        const at = dates ? dates.index : line.trimEnd().length;
        line = `${line.slice(0, at).trimEnd()} | ${missing.join(" | ")}${line.slice(at)}`;
      }
    }
    lines[p.line] = line;
  }
  return lines.join("\n");
}

const KEY = "job-helper:project-links";
const EVENT = "job-helper:project-links-changed";

export function loadProjectLinks(): ProjectLinks {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

export function saveProjectLinks(links: ProjectLinks) {
  try {
    localStorage.setItem(KEY, JSON.stringify(links));
  } catch {
    // Storage can be blocked (private windows); the links still work until the page closes.
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: links }));
}

/** The saved project links, kept in step across every component that shows them. */
export function useProjectLinks() {
  const [links, setLinks] = useState<ProjectLinks>({});
  useEffect(() => {
    setLinks(loadProjectLinks());
    const onChange = (e: Event) => setLinks((e as CustomEvent<ProjectLinks>).detail);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  const update = (next: ProjectLinks) => {
    setLinks(next);
    saveProjectLinks(next);
  };
  return [links, update] as const;
}
