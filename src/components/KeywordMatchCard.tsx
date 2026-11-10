"use client";

import { useMemo } from "react";
import {
  compareKeywords,
  evidence,
  keywordScoreLabel,
  matchKeywords,
  type Evidence,
  type KeywordChange,
  type KeywordResult,
} from "@/lib/keywordMatch";
import { backgroundText, type Background } from "@/lib/tailor";

// Kept here for existing imports.
export { backgroundText };

/**
 * The ATS-style keyword match score. Plain code, no model, so it works without an API key and
 * updates as the person edits their resume or the posting. Given a tailored resume too, it scores
 * both against the posting and shows what tailoring changed.
 */
export function KeywordMatchCard({
  resume,
  jobPosting,
  background,
  tailoredResume,
}: {
  resume: string;
  jobPosting: string;
  background?: Background;
  /** The tailored version of the resume, once there is one. */
  tailoredResume?: string;
}) {
  const notes = useMemo(() => backgroundText(background), [background]);
  const change = useMemo(
    () => (tailoredResume?.trim() ? compareKeywords(resume, tailoredResume, jobPosting, notes) : null),
    [resume, tailoredResume, jobPosting, notes],
  );
  const original = useMemo(
    () => change?.before ?? matchKeywords(resume, jobPosting, notes),
    [change, resume, jobPosting, notes],
  );
  // The resume the rest of the card is about: the tailored one when there is one.
  const match = change?.after ?? original;
  const added = new Set(change?.added.map((k) => k.keyword));
  const required = match.keywords.filter((k) => k.importance === "required");
  const preferred = match.keywords.filter((k) => k.importance === "preferred");

  return (
    <section className="space-y-5 card p-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-lg font-medium">Keyword match score</h2>
          <span className="rounded-full bg-good-soft px-2 py-0.5 text-xs font-medium text-good">
            Free, no key needed
          </span>
        </div>
        {match.score === null || original.score === null ? (
          <p className="text-sm text-muted">
            Rolevisor didn&apos;t find any skills, tools, or credentials it knows in this posting,
            so there&apos;s nothing to score. Check that the whole posting is pasted, including the
            requirements.
          </p>
        ) : change ? (
          <>
            <BeforeAfter before={original.score} after={match.score} />
            <p className="text-sm">
              Your original resume has {original.found.length} of the {match.keywords.length}{" "}
              keywords this posting asks for. The tailored one has {match.found.length}
              {change.added.length > 0 &&
                `, adding ${list(change.added.map((k) => k.keyword), 4)}`}
              .
            </p>
          </>
        ) : (
          <>
            <Score label="Your resume" score={match.score} />
            <p className="text-sm">
              Your resume has {match.found.length} of the {match.keywords.length} keywords this
              posting asks for. Requirements count the most, nice-to-haves less, and the company
              description and benefits not at all.
            </p>
          </>
        )}
        <p className="text-xs text-muted">
          This checks words, the way an applicant tracking system scans a resume. It doesn&apos;t
          judge meaning, so &quot;ran payroll&quot; won&apos;t count for &quot;payroll
          processing&quot;. The AI fit score on the Tailored resume tab reads for meaning.
        </p>
      </div>

      {change && <TailoringChecks change={change} />}

      <HonestAdds missing={match.missing} tailored={Boolean(change)} />

      {required.length > 0 && (
        <KeywordGroup title="What the job asks for" keywords={required} added={added} tailored={Boolean(change)} />
      )}
      {preferred.length > 0 && (
        <KeywordGroup title="Nice to have" keywords={preferred} added={added} tailored={Boolean(change)} />
      )}
    </section>
  );
}

/** "A, B, C, and 2 more", for a sentence. */
function list(items: string[], max: number): string {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  if (rest > 0) return `${shown.join(", ")}, and ${rest} more`;
  if (shown.length <= 2) return shown.join(" and ");
  return `${shown.slice(0, -1).join(", ")}, and ${shown.at(-1)}`;
}

function Score({ label, score, faded = false }: { label: string; score: number; faded?: boolean }) {
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <p className="text-xs text-muted">{label}</p>
      <div className="flex items-baseline gap-3">
        <span className={`text-5xl font-semibold tracking-tight ${faded ? "text-muted" : ""}`}>{score}</span>
        <span className="text-sm text-muted">/ 100 · {keywordScoreLabel(score)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line">
        <div
          className={`h-full rounded-full ${faded ? "bg-muted" : "bg-accent"}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

/** The original and tailored scores side by side. */
export function BeforeAfter({ before, after }: { before: number; after: number }) {
  const diff = after - before;
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <Score label="Original resume" score={before} faded />
        <Score label="Tailored resume" score={after} />
      </div>
      <p className="text-sm font-medium">
        {diff > 0 ? (
          <span className="text-good">Up {diff} points after tailoring</span>
        ) : diff < 0 ? (
          <span className="text-bad">Down {-diff} points after tailoring</span>
        ) : (
          <span className="text-muted">No change after tailoring</span>
        )}
      </p>
    </div>
  );
}

/** Honesty and stuffing checks on what tailoring added. */
export function TailoringChecks({ change }: { change: KeywordChange }) {
  if (!change.unsupported.length && !change.overused.length && !change.dropped.length) return null;
  return (
    <div className="space-y-3">
      {change.unsupported.length > 0 && (
        <div role="status" className="space-y-2 rounded-lg border border-bad/30 bg-bad-soft/50 p-3 text-sm">
          <p className="font-medium">Check these are true</p>
          <p className="text-muted">
            The tailored resume now uses these words, but your original resume and background
            notes don&apos;t. Usually that&apos;s the posting&apos;s wording for something you did.
            Keep each one only if it really describes your work.
          </p>
          <KeywordChips keywords={change.unsupported} />
        </div>
      )}
      {change.overused.length > 0 && (
        <div className="space-y-1 rounded-lg border border-line p-3 text-sm">
          <p className="font-medium">Used a lot</p>
          <p className="text-muted">
            {change.overused.map((o) => `${o.keyword.keyword} appears ${o.count} times`).join(", ")}.
            Saying a keyword once or twice is enough for most systems, and repeating it can read as
            keyword stuffing to the person who reads your resume.
          </p>
        </div>
      )}
      {change.dropped.length > 0 && (
        <div className="space-y-2 rounded-lg border border-line p-3 text-sm">
          <p className="font-medium">Dropped by tailoring</p>
          <p className="text-muted">
            Your original resume had these and the tailored one doesn&apos;t. Put them back if
            they still fit.
          </p>
          <KeywordChips keywords={change.dropped} />
        </div>
      )}
    </div>
  );
}

const HONEST: Record<Evidence, { title: string; body: string }> = {
  background: {
    title: "In your background notes",
    body: "You told Rolevisor about these, but applicant tracking systems only read the resume. Add each one where it fits.",
  },
  related: {
    title: "Close to something on your resume",
    body: "Your resume uses a related word. If the posting's wording describes what you did, use it, since many systems only count the exact words.",
  },
  none: {
    title: "No sign of these yet",
    body: "Nothing you gave mentions these. Add one only if it's true. If it isn't, leave it off; your cover letter can say what you're learning.",
  },
};

/** Missing keywords, sorted by how honestly the person could add them. */
export function HonestAdds({ missing, tailored = false }: { missing: KeywordResult[]; tailored?: boolean }) {
  if (!missing.length) return null;
  const groups = (["background", "related", "none"] as Evidence[])
    .map((e) => ({ e, keywords: missing.filter((k) => evidence(k) === e) }))
    .filter((g) => g.keywords.length);
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">
          Missing keywords you could honestly add{tailored ? " to the tailored resume" : ""}
        </h3>
        <p className="text-xs text-muted">
          Use the posting&apos;s exact wording, since many systems won&apos;t count
          &quot;spreadsheets&quot; for &quot;Excel&quot;. Never add a skill you don&apos;t have.
        </p>
      </div>
      {groups.map(({ e, keywords }) => (
        <div
          key={e}
          className={`space-y-2 rounded-lg border p-3 text-sm ${
            e === "background" ? "border-accent bg-accent-soft" : "border-line"
          }`}
        >
          <p className="font-medium">
            {HONEST[e].title} <span className="font-normal text-muted">({keywords.length})</span>
          </p>
          <p className="text-muted">{HONEST[e].body}</p>
          {e === "related" ? (
            <ul className="space-y-1">
              {keywords.map((k) => (
                <li key={k.keyword} className="flex flex-wrap items-center gap-2">
                  <Chip keyword={k} />
                  <span className="text-xs text-muted">
                    your resume says {k.related.map((w) => `“${w}”`).join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <KeywordChips keywords={keywords} />
          )}
        </div>
      ))}
    </div>
  );
}

function KeywordGroup({
  title,
  keywords,
  added,
  tailored,
}: {
  title: string;
  keywords: KeywordResult[];
  added: Set<string>;
  tailored: boolean;
}) {
  const found = keywords.filter((k) => k.inResume);
  const missing = keywords.filter((k) => !k.inResume);
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">
        {title} <span className="font-normal text-muted">({found.length} of {keywords.length} found)</span>
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs text-muted">{tailored ? "On your tailored resume" : "On your resume"}</p>
          {found.length ? <KeywordChips keywords={found} added={added} /> : <p className="text-sm text-muted">None yet.</p>}
        </div>
        <div>
          <p className="mb-2 text-xs text-muted">Missing</p>
          {missing.length ? <KeywordChips keywords={missing} /> : <p className="text-sm text-muted">Nothing missing.</p>}
        </div>
      </div>
    </div>
  );
}

function KeywordChips({ keywords, added }: { keywords: KeywordResult[]; added?: Set<string> }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {keywords.map((k) => (
        <li key={k.keyword}>
          <Chip keyword={k} added={added?.has(k.keyword)} />
        </li>
      ))}
    </ul>
  );
}

function Chip({ keyword: k, added = false }: { keyword: KeywordResult; added?: boolean }) {
  return (
    <span
      title={`${k.mentions === 1 ? "Mentioned once" : `Mentioned ${k.mentions} times`} in the posting${
        k.kind === "phrase" ? ". A phrase the posting repeats" : ""
      }${k.inBackground ? ". In your background notes, not your resume" : ""}${
        added ? ". Added by tailoring" : ""
      }`}
      className={`inline-block rounded-full border px-3 py-1 text-xs ${
        k.inResume ? "border-good/30 bg-good-soft text-good" : "border-bad/30 bg-bad-soft text-bad"
      }`}
    >
      {k.inResume ? "✓ " : ""}
      {k.keyword}
      {added ? " (added)" : ""}
    </span>
  );
}
