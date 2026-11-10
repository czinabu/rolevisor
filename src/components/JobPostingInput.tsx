"use client";

import { useState } from "react";
import { friendlyMessage } from "@/lib/errors";
import { isImage, parseJobPosting } from "@/lib/parseJobPosting";
import { needsModel } from "@/lib/providers";
import { useSettings } from "@/lib/useSettings";

interface Props {
  text: string;
  onChange: (text: string) => void;
}

/**
 * The job posting step: paste text, paste or drop a screenshot, or attach a
 * file. Screenshots are read by Claude when an API key is set, otherwise with
 * free OCR in this browser; the extracted text goes into the same box so it
 * can be checked and fixed before tailoring.
 */
export function JobPostingInput({ text, onChange }: Props) {
  const { settings, loaded } = useSettings();
  const claudeReads = loaded && settings.provider === "claude" && !needsModel(settings);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  async function read(file: File) {
    setBusy(true);
    setProgress(null);
    setError("");
    setNote("");
    try {
      const parsed = await parseJobPosting(file, loaded ? settings : null, setProgress);
      onChange(text.trim() ? `${text.trim()}\n\n${parsed.text}` : parsed.text);
      setNote(
        parsed.readBy === "claude"
          ? "Text read from your screenshot by Claude. Give it a quick look before tailoring."
          : parsed.readBy === "browser"
            ? parsed.claudeError
              ? `Claude couldn't read the screenshot, so it was read in this browser instead. Check it below for mistakes. (${parsed.claudeError.replace(/\.$/, "")})`
              : "Text read from your screenshot in this browser. Check it below for mistakes. Adding a Claude API key makes screenshot reading much more accurate."
            : `Text read from ${file.name}.`,
      );
    } catch (e) {
      setError(friendlyMessage(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div
      className="space-y-3"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const file = e.dataTransfer.files?.[0];
        if (file && !busy) {
          e.preventDefault();
          read(file);
        }
      }}
    >
      <textarea
        className="field h-48"
        value={text}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => {
          // Some browsers leave `files` empty for a pasted screenshot but still list it in `items`.
          const image =
            Array.from(e.clipboardData.files).find(isImage) ??
            Array.from(e.clipboardData.items)
              .filter((item) => item.kind === "file")
              .map((item) => item.getAsFile())
              .find((file): file is File => file !== null && isImage(file));
          if (image) {
            e.preventDefault();
            read(image);
          }
        }}
        placeholder="Paste the job description here, paste or drop a screenshot of it, or attach a file."
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="btn-secondary inline-block cursor-pointer">
          {busy
            ? progress !== null
              ? `Reading screenshot... ${progress}%`
              : "Reading..."
            : "Upload screenshot or file"}
          <input
            type="file"
            accept="image/*,.pdf,.docx,.txt,.md"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const chosen = e.target.files?.[0];
              if (chosen) read(chosen);
              e.target.value = "";
            }}
          />
        </label>
        <span className="text-xs text-muted">
          {claudeReads
            ? "Image, PDF, Word, or text file. Screenshots are read by Claude with your key."
            : "Image, PDF, Word, or text file. Read in your browser."}
        </span>
      </div>
      {note && !error && <p className="text-xs text-muted">{note}</p>}
      {error && <p className="text-sm text-bad">{error}</p>}
    </div>
  );
}
