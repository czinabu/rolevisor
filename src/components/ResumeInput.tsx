"use client";

import { useEffect, useRef, useState } from "react";
import { useRequest } from "@/lib/useRequest";
import { readLayout, type ResumeLayout } from "@/lib/layout";
import { openPdf, parseResume, resumeFileKind } from "@/lib/parseResume";
import { fillLinksFromFile } from "@/lib/profileLinks";
import { useStoredState } from "@/lib/useStoredState";

interface Props {
  text: string;
  onChange: (text: string) => void;
  /** Called with the measured page layout of an uploaded file, or null if there is none. */
  onLayout: (layout: ResumeLayout | null) => void;
}

/**
 * The resume step: shows the uploaded file instead of dumping its text into a
 * box. The text is still kept (the AI reads it), behind a "view or edit" toggle.
 * Everything is read in this browser; the file is never uploaded.
 */
export function ResumeInput({ text, onChange, onLayout }: Props) {
  const [stored, setStored] = useStoredState<{ fileName: string }>("job-helper:resume-file", {
    fileName: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const reading = useRequest<void>();
  const { busy, error } = reading;
  const [showText, setShowText] = useState(false);
  const [pasting, setPasting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // After a refresh the text is remembered but the file itself isn't, so only the name is shown.
  const fileName = file?.name ?? (text.trim() ? stored.fileName : "");
  const hasFile = Boolean(fileName) && !pasting;
  const isPdf = file ? resumeFileKind(file.name) === "pdf" : false;

  useEffect(() => {
    if (!file || !isPdf) return;
    let cancelled = false;
    (async () => {
      try {
        const pdf = await openPdf(file);
        const page = await pdf.getPage(1);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (320 * (window.devicePixelRatio || 1)) / base.width });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, viewport }).promise;
      } catch {
        // The preview is a nicety; the file name still shows.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, isPdf]);

  const upload = (chosen: File) =>
    reading.run(async () => {
      const parsed = await parseResume(chosen);
      onLayout(await readLayout(chosen));
      await fillLinksFromFile(chosen, parsed);
      setFile(chosen);
      setStored({ fileName: chosen.name });
      setPasting(false);
      setShowText(false);
      onChange(parsed);
    });

  function remove() {
    setFile(null);
    setStored({ fileName: "" });
    setShowText(false);
    setPasting(false);
    onLayout(null);
    onChange("");
  }

  const picker = (label: string) => (
    <label className="btn-secondary inline-block cursor-pointer">
      {busy ? "Reading file..." : label}
      <input
        type="file"
        accept=".pdf,.docx,.txt,.md"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const chosen = e.target.files?.[0];
          if (chosen) upload(chosen);
          e.target.value = "";
        }}
      />
    </label>
  );

  return (
    <div className="space-y-3">
      {hasFile ? (
        <div className="flex flex-wrap items-start gap-4 rounded-md border border-line bg-card p-3">
          {file && isPdf && (
            <canvas
              ref={canvasRef}
              className="w-40 rounded border border-line bg-white"
              aria-label="Preview of the first page of your resume"
            />
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <p className="break-words text-sm font-medium">{fileName}</p>
            <p className="text-xs text-muted">
              Read in your browser. {text.trim().split(/\s+/).length} words found.
              {!file && " (Reloaded from your last visit; the file itself isn't kept.)"}
            </p>
            <div className="flex flex-wrap gap-2">
              {picker("Replace")}
              <button className="btn-secondary" onClick={remove}>
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {picker("Upload PDF or Word file")}
          {!pasting && (
            <button className="text-sm text-muted underline" onClick={() => setPasting(true)}>
              Paste text instead
            </button>
          )}
        </div>
      )}
      {error && <p className="text-sm text-bad">{error}</p>}

      {hasFile ? (
        <>
          <button className="text-sm text-muted underline" onClick={() => setShowText(!showText)}>
            {showText ? "Hide extracted text" : "View or edit extracted text"}
          </button>
          {showText && (
            <textarea
              className="field h-64 font-mono"
              value={text}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        </>
      ) : (
        (pasting || text.trim()) && (
          <textarea
            className="field h-64 font-mono"
            value={text}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Paste your resume text here."
            autoFocus={pasting}
          />
        )
      )}
    </div>
  );
}
