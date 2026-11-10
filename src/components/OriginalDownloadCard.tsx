"use client";

import { useEffect, useMemo, useState } from "react";
import { DownloadPanel } from "@/components/DownloadPanel";
import { structureResume } from "@/lib/structureResume";

/**
 * Lets someone download the resume they added, unchanged, in the Classic or Modern template. No model is
 * involved: the text is sorted into headings, entries, and bullets by plain rules, and the person can fix
 * anything in the box before downloading.
 */
export function OriginalDownloadCard({ resume, jobPosting = "" }: { resume: string; jobPosting?: string }) {
  const structured = useMemo(() => structureResume(resume), [resume]);
  const [text, setText] = useState(structured);
  // Start over from the new resume when it changes.
  useEffect(() => setText(structured), [structured]);
  const edited = text !== structured;

  return (
    <section className="card space-y-4 p-5">
      <div className="space-y-1">
        <h2 className="text-lg font-medium">Download your resume in a clean template</h2>
        <p className="text-sm text-muted">
          Your own resume, word for word, in a simple layout applicant tracking systems can read. Useful if
          your file has columns, tables, or text boxes. Free, no API key needed.
        </p>
      </div>

      <details className="space-y-2 rounded-lg border border-line bg-background/60 p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Check how it was read{edited ? " (edited)" : ""}
        </summary>
        <p className="text-xs text-muted">
          Lines starting with <code>## </code> become section headings and lines starting with{" "}
          <code>- </code> become bullets. A line like <code>Company - Role | Jan 2024 – Present</code>{" "}
          puts the dates on the right. Fix anything that looks off; your original resume above stays as it
          is.
        </p>
        <textarea
          className="field h-72 font-mono text-xs"
          aria-label="Resume text for the template"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {edited && (
          <button className="text-sm text-muted underline" onClick={() => setText(structured)}>
            Undo my changes
          </button>
        )}
      </details>

      <DownloadPanel text={text} kind="resume" jobPosting={jobPosting} />
    </section>
  );
}
