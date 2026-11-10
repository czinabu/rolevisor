"use client";

import { useEffect, useMemo } from "react";
import { LinkPrompt } from "@/components/LinkPrompt";
import { Loading } from "@/components/Loading";
import { runTask } from "@/lib/ai";
import { useRequest } from "@/lib/useRequest";
import { checkFormat, describeLayout, type CheckStatus, type FormatReport } from "@/lib/formatCheck";
import type { FormatReview } from "@/lib/formatReview";
import type { ResumeLayout } from "@/lib/layout";
import { adviseLinks } from "@/lib/linkAdvice";
import { FreeBadge, NoModel } from "@/components/FreeLabel";
import { needsModel, type ModelSettings } from "@/lib/providers";

const ICON: Record<CheckStatus, string> = { pass: "✓", warn: "!", fail: "✕" };
const TONE: Record<CheckStatus, string> = {
  pass: "text-good",
  warn: "text-muted",
  fail: "text-bad",
};

/**
 * Grades the resume's formatting and spacing. The measured checks show right
 * away and cost nothing; the AI review reads the text for what they can't see.
 * With a job posting, it also says whether LinkedIn and GitHub links would help, from simple rules (no model).
 */
export function FormatCard({
  resume,
  layout,
  settings,
  jobPosting = "",
  targetRole = "",
}: {
  resume: string;
  layout: ResumeLayout | null;
  settings: ModelSettings;
  jobPosting?: string;
  targetRole?: string;
}) {
  const report = useMemo(() => checkFormat(resume, layout), [resume, layout]);
  const linkAdvice = useMemo(
    () => (jobPosting.trim() ? adviseLinks(jobPosting, targetRole) : undefined),
    [jobPosting, targetRole],
  );
  const request = useRequest<FormatReview>();
  const { busy, error, data: review, reset } = request;

  // An old review no longer matches once the resume changes. One still on its way is dropped too.
  useEffect(reset, [resume, layout, reset]);

  const ask = () =>
    request.run(() => runTask<FormatReview>(settings, "format", { resume, layout: describeLayout(layout, report) }), {
      keep: true,
    });

  return (
    <section className="space-y-4 card p-5">
      <FormatChecks report={report} />
      <LinkPrompt resume={resume} advice={linkAdvice} />

      <div className="space-y-3 border-t border-line pt-4">
        {!review && needsModel(settings) && <NoModel feature="The expert-style review" compact />}
        {!review && !needsModel(settings) && (
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-secondary" disabled={busy} onClick={ask}>
              {busy ? "Reviewing..." : "Get an expert-style review"}
            </button>
            <span className="text-xs text-muted">
              The AI reads your resume for section order, bullet wording, and consistency.
            </span>
          </div>
        )}
        {busy && <Loading message="Reviewing your resume..." hint="This usually takes under a minute." />}
        {error && <p role="alert" className="whitespace-pre-line text-sm text-bad">{error}</p>}
        {review && <FormatReviewView review={review} />}
      </div>
    </section>
  );
}

/** The score and the measured checks, also used by the example page. */
export function FormatChecks({ report }: { report: FormatReport }) {
  const order: CheckStatus[] = ["fail", "warn", "pass"];
  const checks = [...report.checks].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-lg font-medium">Formatting and spacing</h2>
        <FreeBadge />
        <span className="ml-auto text-3xl font-semibold">{report.score}</span>
        <span className="text-sm text-muted">/ 100{report.textOnly && " (text only)"}</span>
      </div>
      <p className="text-sm text-muted">
        Checked against advice from recruiters and resume experts.
        {report.textOnly &&
          " Margins, fonts, and spacing weren't checked, so this score only covers the text and may be higher than the full score. Upload your PDF or Word file to check those too."}
      </p>

      <ul className="space-y-2">
        {checks.map((c) => (
          <li key={c.id} className="flex gap-3 text-sm">
            <span className={`w-4 shrink-0 text-center font-bold ${TONE[c.status]}`} aria-label={c.status}>
              {ICON[c.status]}
            </span>
            <div>
              <p className="font-medium">{c.title}</p>
              <p className="text-muted">
                {c.detail}{" "}
                <a href={c.source.url} target="_blank" rel="noreferrer" className="underline">
                  {c.source.label}
                </a>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** The AI's formatting review, also used by the example page. */
export function FormatReviewView({ review }: { review: FormatReview }) {
  return (
    <div className="space-y-3 text-sm">
      <p>{review.summary}</p>
      {review.strengths.length > 0 && (
        <div>
          <h3 className="mb-1 font-medium">Doing well</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            {review.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
      {review.improvements.length > 0 && (
        <div>
          <h3 className="mb-1 font-medium">Worth changing</h3>
          <ul className="space-y-2">
            {review.improvements.map((m, i) => (
              <li key={i} className="rounded-md border border-line p-3">
                <p className="font-medium">{m.issue}</p>
                <p className="mt-1 text-muted">{m.fix}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
