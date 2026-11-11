"use client";

import { useEffect, useState } from "react";
import { DownloadPanel } from "@/components/DownloadPanel";
import { Loading } from "@/components/Loading";
import { runTask } from "@/lib/ai";
import {
  LENGTHS,
  TONES,
  type CoverLetterResult,
  type Length,
  type Tone,
} from "@/lib/coverLetter";
import { useRequest } from "@/lib/useRequest";
import { NoModel } from "@/components/FreeLabel";
import { needsModel, type ModelSettings } from "@/lib/providers";
import type { Background } from "@/lib/tailor";

/** Writes a cover letter for the job from the resume and About you details. */
export function CoverLetterCard({
  resume,
  background,
  jobPosting,
  settings,
  initial,
  onLetterChange,
}: {
  resume: string;
  background: Background;
  jobPosting: string;
  settings: ModelSettings;
  /** A letter already written, e.g. by "Get everything". Give the card a new key to load a new one. */
  initial?: CoverLetterResult;
  /** Hears every new or edited version, so the page can save it with the application. */
  onLetterChange?: (letter: string) => void;
}) {
  const [tone, setTone] = useState<Tone>("professional");
  const [length, setLength] = useState<Length>("standard");
  const [instructions, setInstructions] = useState("");
  const [letter, setLetter] = useState(initial?.letter ?? "");
  const [notes, setNotes] = useState<string[]>(initial?.notes ?? []);
  // The letter lives in its own state because the person can edit it after it's written.
  const request = useRequest<CoverLetterResult>();
  const { busy, error } = request;
  const [copied, setCopied] = useState(false);
  useEffect(() => onLetterChange?.(letter), [letter, onLetterChange]);

  const ready = resume.trim() && jobPosting.trim();

  const write = () =>
    request.run(async () => {
      const result = await runTask<CoverLetterResult>(settings, "coverLetter", {
        resume,
        background,
        jobPosting,
        tone,
        length,
        instructions,
        previous: letter,
      });
      setLetter(result.letter);
      setNotes(result.notes);
      setCopied(false);
      return result;
    });

  async function copy() {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
    } catch {
      request.fail("Couldn't copy. Select the text and copy it yourself.");
    }
  }

  return (
    <section className="space-y-4 card p-5">
      <h2 className="text-lg font-medium">Cover letter</h2>
      <p className="text-sm text-muted">
        Written from your resume, your About you details, and the job posting. It only uses what
        you&apos;ve told Rolevisor, so check it before you send it.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Tone</span>
          <select className="field" value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
            {Object.entries(TONES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Length</span>
          <select
            className="field"
            value={length}
            onChange={(e) => setLength(e.target.value as Length)}
          >
            {Object.entries(LENGTHS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input
        className="field"
        placeholder="Anything to include? e.g. company name, or that you're relocating (optional)"
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
      />

      {needsModel(settings) ? (
        <NoModel feature="Writing a cover letter" compact />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn" disabled={!ready || busy} onClick={write}>
            {busy ? "Writing..." : letter ? "Regenerate" : "Write my cover letter"}
          </button>
          {!ready && <span className="text-xs text-muted">Add your resume and a job posting first.</span>}
        </div>
      )}

      {busy && <Loading message="Writing your cover letter..." hint="This usually takes under a minute." />}

      {error && <p role="alert" className="whitespace-pre-line text-sm text-bad">{error}</p>}

      {letter && (
        <div className="space-y-3">
          <textarea
            className="field h-96"
            aria-label="Cover letter"
            value={letter}
            onChange={(e) => {
              setLetter(e.target.value);
              setCopied(false);
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-secondary" onClick={copy}>
              {copied ? "Copied!" : "Copy"}
            </button>
            <span className="text-xs text-muted">
              Edit it above. Regenerating writes a new version and replaces your edits.
            </span>
          </div>
          <DownloadPanel text={letter} kind="letter" jobPosting={jobPosting} />
          {notes.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              {notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
