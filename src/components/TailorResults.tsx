"use client";

import { useState } from "react";
import { DownloadPanel } from "@/components/DownloadPanel";
import { LinkPrompt } from "@/components/LinkPrompt";
import { hasKeyword, type TailorResult } from "@/lib/tailor";

function scoreLabel(score: number) {
  if (score >= 75) return "Strong match";
  if (score >= 50) return "Partial match";
  return "Stretch role";
}

export function TailorResults({
  result,
  originalResume,
  jobPosting = "",
}: {
  result: TailorResult;
  originalResume: string;
  /** Used to name the download after the company. */
  jobPosting?: string;
}) {
  const [copied, setCopied] = useState(false);
  // Editable copy of the model's resume; resets when a new result arrives.
  const [edited, setEdited] = useState({ source: result.tailoredResume, text: result.tailoredResume });
  const resumeText = edited.source === result.tailoredResume ? edited.text : result.tailoredResume;
  const score = Math.max(0, Math.min(100, Math.round(result.matchScore)));
  // Checked here rather than trusting the model, so the counts are exact.
  const keywords = [...new Set(result.keywords.map((k) => k.trim()).filter(Boolean))].map(
    (keyword) => ({
      keyword,
      before: hasKeyword(originalResume, keyword),
      after: hasKeyword(result.tailoredResume, keyword),
    }),
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(resumeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the text is still selectable on the page.
    }
  }

  return (
    <div className="space-y-8">
      <section className="card p-5">
        <h2 className="mb-2 text-lg font-medium">AI fit score</h2>
        <div className="flex items-baseline gap-3">
          <span className="text-5xl font-semibold tracking-tight">{score}</span>
          <span className="text-sm text-muted">/ 100 · {scoreLabel(score)}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-accent" style={{ width: `${score}%` }} />
        </div>
        <p className="mt-4 text-sm">{result.summary}</p>
        <p className="mt-2 text-xs text-muted">
          This score is for your original resume. The AI reads it for meaning; the Keyword match
          tab counts the posting&apos;s exact words, the way an applicant tracking system does.
        </p>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <SkillList
          title="What you already have"
          skills={result.matchedSkills}
          empty="No clear matches found."
          tone="good"
        />
        <SkillList
          title="What the job wants that's missing"
          skills={result.missingSkills}
          empty="Nothing major is missing."
          tone="bad"
        />
      </section>

      {keywords.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Job posting keywords</h2>
          <p className="text-sm text-muted">
            Your original resume has {keywords.filter((k) => k.before).length} of {keywords.length}.
            The tailored one has {keywords.filter((k) => k.after).length}. Keywords still missing
            are ones your materials didn&apos;t support, so add them only if they&apos;re true.
          </p>
          <ul className="flex flex-wrap gap-2">
            {keywords.map((k) => (
              <li
                key={k.keyword}
                title={
                  k.before
                    ? "Already in your resume"
                    : k.after
                      ? "Added in the tailored resume"
                      : "Not in either resume"
                }
                className={`rounded-full border px-3 py-1 text-xs ${
                  k.after ? "border-good/30 bg-good-soft text-good" : "border-line bg-card text-muted"
                }`}
              >
                {k.after ? "✓ " : ""}
                {k.keyword}
                {!k.before && k.after ? " (added)" : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.educationAdvice && <EducationAdvice advice={result.educationAdvice} />}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Your tailored resume</h2>
          <button className="btn-secondary" onClick={copy}>
            {copied ? "Copied!" : "Copy text"}
          </button>
        </div>
        <p className="text-sm text-muted">
          Read it over before using it. The AI is told not to invent anything, but you know your
          history best. You can edit it here before you download it. Use &quot;## &quot; for a
          section heading and &quot;- &quot; for a bullet.
        </p>
        <textarea
          className="field h-96 font-sans leading-relaxed"
          aria-label="Tailored resume"
          value={resumeText}
          onChange={(e) => setEdited({ source: result.tailoredResume, text: e.target.value })}
        />
        <LinkPrompt resume={resumeText} advice={result.linkAdvice} />
        <DownloadPanel text={resumeText} kind="resume" jobPosting={jobPosting} />
      </section>

      {result.changes.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">What changed and why</h2>
          <ul className="space-y-3">
            {result.changes.map((c, i) => (
              <li key={i} className="card p-4 text-sm">
                <p className="font-medium">{c.change}</p>
                <p className="mt-1 text-muted">{c.reason}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function EducationAdvice({ advice }: { advice: TailorResult["educationAdvice"] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">Education for this job</h2>
      <div className="space-y-3 card p-5 text-sm">
        <p>
          <span className="rounded-full border border-line bg-card px-3 py-1 text-xs font-medium">
            {advice.recommendation}
          </span>
        </p>
        <p>{advice.reasoning}</p>
        {advice.placement && (
          <p>
            <span className="font-medium">Where it goes: </span>
            {advice.placement}
          </p>
        )}
        {advice.howToList.trim() && (
          <div>
            <p className="font-medium">How to list it</p>
            <pre className="field mt-1 whitespace-pre-wrap break-words p-3 font-sans">
              {advice.howToList}
            </pre>
          </div>
        )}
        {advice.coursework && (
          <p>
            <span className="font-medium">Relevant coursework: </span>
            {advice.coursework}
          </p>
        )}
      </div>
    </section>
  );
}

function SkillList({
  title,
  skills,
  empty,
  tone,
}: {
  title: string;
  skills: string[];
  empty: string;
  tone: "good" | "bad";
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      {skills.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {skills.map((s) => (
            <li
              key={s}
              className={`rounded-full border px-3 py-1 text-xs ${
                tone === "good" ? "border-good/30 bg-good-soft text-good" : "border-bad/30 bg-bad-soft text-bad"
              }`}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
