"use client";

import { useCallback, useEffect, useState } from "react";

export const APPLICATIONS_KEY = "job-helper:applications";

export const STATUSES = {
  applied: "Applied",
  heard_back: "Heard back",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  ghosted: "No response",
} as const;

export type ApplicationStatus = keyof typeof STATUSES;

export interface Application {
  id: string;
  company: string;
  role: string;
  link: string;
  /** YYYY-MM-DD */
  dateApplied: string;
  status: ApplicationStatus;
  /** YYYY-MM-DD, or empty */
  followUp: string;
  notes: string;
  /** The tailored resume sent with this application, or empty. */
  resume: string;
  /** The cover letter sent with this application, or empty. */
  coverLetter: string;
  /** The job posting text, kept because postings often come down after they close. */
  jobPosting: string;
}

/** How long after applying to suggest a follow-up. */
export const FOLLOW_UP_DAYS = 7;

/** Statuses where a follow-up still makes sense. */
const WAITING: readonly ApplicationStatus[] = ["applied", "heard_back"];

export const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD

export function newApplication(patch: Partial<Application> = {}): Application {
  return {
    id: crypto.randomUUID(),
    company: "",
    role: "",
    link: "",
    dateApplied: today(),
    status: "applied",
    followUp: "",
    notes: "",
    resume: "",
    coverLetter: "",
    jobPosting: "",
    ...patch,
  };
}

/** Keeps only well-formed fields, so imported files can't break the page. */
function clean(raw: unknown): Application | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const company = str(r.company);
  const role = str(r.role);
  if (!company && !role) return null;
  const status = str(r.status).toLowerCase().replace(/[\s-]+/g, "_");
  const byLabel = Object.entries(STATUSES).find(([, l]) => l.toLowerCase() === str(r.status).toLowerCase());
  return {
    id: str(r.id) || crypto.randomUUID(),
    company,
    role,
    link: str(r.link),
    dateApplied: str(r.dateApplied),
    status: status in STATUSES ? (status as ApplicationStatus) : ((byLabel?.[0] as ApplicationStatus) ?? "applied"),
    followUp: str(r.followUp),
    notes: typeof r.notes === "string" ? r.notes : "",
    resume: typeof r.resume === "string" ? r.resume : "",
    coverLetter: typeof r.coverLetter === "string" ? r.coverLetter : "",
    jobPosting: typeof r.jobPosting === "string" ? r.jobPosting : "",
  };
}

export function loadApplications(): Application[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(APPLICATIONS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.map(clean).filter((a): a is Application => !!a) : [];
  } catch {
    return [];
  }
}

/** Fired on this tab whenever the log is saved, so the nav badge stays current. */
export const APPLICATIONS_EVENT = "rolevisor:applications";

function store(apps: Application[]) {
  localStorage.setItem(APPLICATIONS_KEY, JSON.stringify(apps));
  window.dispatchEvent(new Event(APPLICATIONS_EVENT));
}

/** Adds one entry straight to storage (used by "Save to log" on the Tailor and Role finder pages). */
export function addApplication(app: Application) {
  store([app, ...loadApplications()]);
}

/** Replaces a saved entry with the same id, or adds it if it was deleted meanwhile. */
export function updateApplication(app: Application) {
  const apps = loadApplications();
  store(apps.some((a) => a.id === app.id) ? apps.map((a) => (a.id === app.id ? app : a)) : [app, ...apps]);
}

/** YYYY-MM-DD plus a number of days. Empty in, empty out. */
export function addDays(date: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from one YYYY-MM-DD to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** True when the follow-up date has come and the company still hasn't given an answer. */
export function isDue(app: Application, on: string = today()): boolean {
  return !!app.followUp && app.followUp <= on && WAITING.includes(app.status);
}

/** "today", "yesterday", "5 days ago". */
export function ago(date: string, on: string = today()): string {
  const n = daysBetween(date, on);
  if (Number.isNaN(n)) return "";
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  return `${n} days ago`;
}

/** How many saved applications are ready for a follow-up, kept current as the log changes. */
export function useDueCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const read = () => {
      try {
        setCount(loadApplications().filter((a) => isDue(a)).length);
      } catch {
        setCount(0);
      }
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === APPLICATIONS_KEY) read();
    };
    window.addEventListener(APPLICATIONS_EVENT, read);
    window.addEventListener("storage", onStorage);
    // A tab left open overnight should pick up reminders that came due.
    window.addEventListener("focus", read);
    return () => {
      window.removeEventListener(APPLICATIONS_EVENT, read);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", read);
    };
  }, []);
  return count;
}

/**
 * A calendar file with an all-day reminder on the follow-up date, so the reminder reaches the
 * person even when Rolevisor isn't open. Works with Google Calendar, Apple Calendar and Outlook.
 */
export function followUpIcs(app: Application, now: Date = new Date()): string {
  const esc = (v: string) => v.replace(/\\/g, "\\\\").replace(/[;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");
  const day = app.followUp.replace(/-/g, "");
  const next = addDays(app.followUp, 1).replace(/-/g, "");
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const what = [app.role, app.company].filter(Boolean).join(" at ");
  const details = [
    app.dateApplied && `Applied ${app.dateApplied}.`,
    "A short, polite note asking about the timeline is enough.",
    app.link,
  ]
    .filter(Boolean)
    .join("\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rolevisor//Application log//EN",
    "BEGIN:VEVENT",
    `UID:${app.id}-follow-up@rolevisor`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${day}`,
    `DTEND;VALUE=DATE:${next}`,
    `SUMMARY:${esc(`Follow up: ${what || "job application"}`)}`,
    `DESCRIPTION:${esc(details)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(`Follow up: ${what || "job application"}`)}`,
    "TRIGGER:PT9H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** The application log, remembered in this browser only. */
export function useApplications() {
  const [apps, setAppsState] = useState<Application[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setAppsState(loadApplications());
    setLoaded(true);
  }, []);

  const setApps = useCallback((next: Application[]) => {
    setAppsState(next);
    try {
      store(next);
    } catch {
      // Storage can be blocked; the log still works until the tab closes.
    }
  }, []);

  return [apps, setApps, loaded] as const;
}

const CSV_COLUMNS = ["company", "role", "link", "dateApplied", "status", "followUp", "notes"] as const;

export function toCsv(apps: Application[]): string {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = apps.map((a) =>
    CSV_COLUMNS.map((c) => cell(c === "status" ? STATUSES[a.status] : a[c])).join(","),
  );
  return [CSV_COLUMNS.join(","), ...rows].join("\r\n");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

/** Reads a file exported from this page (JSON or CSV). Throws a readable error. */
export function parseImport(text: string, filename: string): Application[] {
  let raw: unknown[];
  if (filename.toLowerCase().endsWith(".csv")) {
    const [header, ...rows] = parseCsv(text.replace(/^﻿/, ""));
    if (!header) throw new Error("That file is empty.");
    raw = rows.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i] ?? ""])));
  } else {
    try {
      const data = JSON.parse(text);
      raw = Array.isArray(data) ? data : data?.applications;
    } catch {
      throw new Error("That doesn't look like a Rolevisor export.");
    }
  }
  if (!Array.isArray(raw)) throw new Error("That doesn't look like a Rolevisor export.");
  const apps = raw.map(clean).filter((a): a is Application => !!a);
  if (apps.length === 0) throw new Error("No applications were found in that file.");
  return apps;
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
