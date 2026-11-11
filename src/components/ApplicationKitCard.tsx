"use client";

import { useMemo, useState } from "react";
import { backgroundText } from "@/components/KeywordMatchCard";
import type { ApplicationKit } from "@/lib/applicationKit";
import { downloadStem, guessCompany, kitStem } from "@/lib/companyName";
import { compareKeywords } from "@/lib/keywordMatch";
import { normalizeUrl, useProfileLinks } from "@/lib/profileLinks";
import { addProjectLinks, useProjectLinks } from "@/lib/projectLinks";
import {
  TEMPLATES,
  makeLetterDocx,
  makeLetterPdf,
  makeResumeDocx,
  makeResumePdf,
  resumeForTemplate,
  saveBlob,
  type TemplateId,
} from "@/lib/resumeDoc";
import type { SuggestionsResult } from "@/lib/suggestions";
import type { Background } from "@/lib/tailor";
import { useRequest } from "@/lib/useRequest";

type Tab = "tailor" | "keywords" | "suggestions" | "letter";

/** The few pieces of advice worth doing first, highest priority first. */
function topAdvice(s: SuggestionsResult | undefined, count = 3): { title: string; detail: string }[] {
  if (!s) return [];
  const rank = (p: string) => (p === "High" ? 0 : p === "Medium" ? 1 : 2);
  return [
    ...s.gaps.map((g) => ({ priority: g.priority, title: g.gap, detail: g.howToAddress })),
    ...s.emphasize.map((e) => ({ priority: e.priority, title: e.point, detail: e.how })),
    ...s.bullets.map((b) => ({ priority: b.priority, title: `Reword: "${b.original}"`, detail: b.why })),
  ]
    .sort((a, b) => rank(a.priority) - rank(b.priority))
    .slice(0, count);
}

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note: React.ReactNode }) {
  return (
    <div className="space-y-1 rounded-lg border border-line bg-background/60 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="text-xs text-muted">{note}</p>
    </div>
  );
}

/**
 * The one-click summary: scores, the advice worth acting on first, and both files ready to
 * download, named after the company. The details stay in their own tabs.
 */
export function ApplicationKitCard({
  kit,
  resume,
  letter,
  originalResume,
  jobPosting,
  background,
  onOpen,
}: {
  kit: ApplicationKit;
  /** The tailored resume, with the person's edits. */
  resume: string;
  /** The cover letter, with the person's edits, or "" if there isn't one. */
  letter: string;
  originalResume: string;
  jobPosting: string;
  background: Background;
  onOpen: (tab: Tab) => void;
}) {
  const [template, setTemplate] = useState<TemplateId>("classic");
  const [typed, setTyped] = useState<{ posting: string; company: string } | null>(null);
  const company = typed && typed.posting === jobPosting ? typed.company : guessCompany(jobPosting);
  const notes = useMemo(() => backgroundText(background), [background]);
  const change = useMemo(
    () => compareKeywords(originalResume, resume, jobPosting, notes),
    [originalResume, resume, jobPosting, notes],
  );
  const fit = Math.max(0, Math.min(100, Math.round(kit.result.matchScore)));
  const advice = topAdvice(kit.suggestions);

  const [links] = useProfileLinks();
  const [projectLinks] = useProjectLinks();
  const request = useRequest<void>();

  const files = {
    resume: downloadStem("resume", resume, company),
    letter: downloadStem("letter", letter, company),
  };

  async function build(kind: "resume" | "letter", format: "pdf" | "docx"): Promise<Blob> {
    if (kind === "letter") return format === "pdf" ? makeLetterPdf(letter, template) : makeLetterDocx(letter, template);
    const urls = {
      linkedin: normalizeUrl(links.linkedin),
      github: normalizeUrl(links.github),
      website: normalizeUrl(links.website),
    };
    const body = addProjectLinks(resumeForTemplate(resume), projectLinks);
    return format === "pdf" ? makeResumePdf(body, template, urls) : makeResumeDocx(body, template, urls);
  }

  const describe = () => "Couldn't build the file. Try the other format, or copy the text from its tab.";
  const one = (kind: "resume" | "letter", format: "pdf" | "docx") =>
    request.run(async () => saveBlob(await build(kind, format), `${files[kind]}.${format}`), { describe });
  // One download instead of four, since browsers ask before letting a page save several files.
  const all = () =>
    request.run(
      async () => {
        const { default: JSZip } = await import("jszip");
        const zip = new JSZip();
        const kinds = letter.trim() ? (["resume", "letter"] as const) : (["resume"] as const);
        for (const kind of kinds) {
          for (const format of ["pdf", "docx"] as const) {
            zip.file(`${files[kind]}.${format}`, await build(kind, format));
          }
        }
        saveBlob(await zip.generateAsync({ type: "blob" }), `${kitStem(resume, company)}.zip`);
      },
      { describe },
    );

  return (
    <section className="card space-y-5 p-5" aria-labelledby="kit-heading">
      <div className="space-y-1">
        <h3 id="kit-heading" className="text-lg font-semibold">
          Everything for {company ? `your ${company} application` : "this job"}
        </h3>
        <p className="text-sm text-muted">
          Your tailored resume, cover letter, keyword score, and advice. Check each one in its tab before you send
          anything; your edits there are what gets downloaded.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="Keyword match"
          value={
            change.before.score === null || change.after.score === null
              ? "–"
              : `${change.before.score} → ${change.after.score}`
          }
          note={
            <button className="link" onClick={() => onOpen("keywords")}>
              Before and after tailoring
            </button>
          }
        />
        <Stat
          label="AI fit score"
          value={`${fit}/100`}
          note={
            <button className="link" onClick={() => onOpen("tailor")}>
              Skills you have and are missing
            </button>
          }
        />
        <Stat
          label="Cover letter"
          value={letter.trim() ? `${letter.trim().split(/\s+/).length} words` : "Not written"}
          note={
            <button className="link" onClick={() => onOpen("letter")}>
              {letter.trim() ? "Read and edit it" : "Write it"}
            </button>
          }
        />
      </div>

      {advice.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Do these first</h4>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {advice.map((a, i) => (
              <li key={i}>
                <p className="font-medium">{a.title}</p>
                <p className="text-muted">{a.detail}</p>
              </li>
            ))}
          </ol>
          <button className="link text-sm" onClick={() => onOpen("suggestions")}>
            See all suggestions
          </button>
        </div>
      )}

      {kit.letter && kit.letter.notes.length > 0 && (
        <div className="space-y-1 text-sm">
          <h4 className="font-medium">Before you send the letter</h4>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            {kit.letter.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {kit.problems.length > 0 && (
        <ul role="status" className="space-y-1 rounded-lg border border-bad/30 bg-bad-soft/50 p-3 text-sm">
          {kit.problems.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}

      <div className="space-y-3 border-t border-line pt-4">
        <h4 className="text-sm font-medium">Download</h4>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <span>Template</span>
            <select className="field !w-auto" value={template} onChange={(e) => setTemplate(e.target.value as TemplateId)}>
              {Object.entries(TEMPLATES).map(([id, t]) => (
                <option key={id} value={id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span>Company</span>
            <input
              className="field !w-40"
              placeholder="For the file names"
              value={company}
              onChange={(e) => setTyped({ posting: jobPosting, company: e.target.value })}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn" disabled={request.busy} onClick={all}>
            Download everything (.zip)
          </button>
          <button className="btn-secondary" disabled={request.busy} onClick={() => one("resume", "pdf")}>
            Resume PDF
          </button>
          <button className="btn-secondary" disabled={request.busy} onClick={() => one("resume", "docx")}>
            Resume Word
          </button>
          <button className="btn-secondary" disabled={request.busy || !letter.trim()} onClick={() => one("letter", "pdf")}>
            Cover letter PDF
          </button>
          <button className="btn-secondary" disabled={request.busy || !letter.trim()} onClick={() => one("letter", "docx")}>
            Cover letter Word
          </button>
        </div>
        <p className="text-xs text-muted">
          Saves as <span className="font-medium">{files.resume}</span>
          {letter.trim() && (
            <>
              {" "}and <span className="font-medium">{files.letter}</span>
            </>
          )}
          , as PDF and Word. Built on your device; nothing is uploaded. Profile and project links come from the
          Tailored resume tab.
        </p>
        {request.error && (
          <p role="alert" className="text-sm text-bad">
            {request.error}
          </p>
        )}
      </div>
    </section>
  );
}
