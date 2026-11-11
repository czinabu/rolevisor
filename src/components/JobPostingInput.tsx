"use client";

import { useState } from "react";
import { useRequest } from "@/lib/useRequest";
import { isImage, parseJobPosting } from "@/lib/parseJobPosting";
import { isJustALink } from "@/lib/jobLink";
import { readJobLink } from "@/lib/readJobLink";
import { needsModel } from "@/lib/providers";
import { useSettings } from "@/lib/useSettings";

interface Props {
  text: string;
  onChange: (text: string) => void;
}

/**
 * The job posting step: paste a link, paste text, paste or drop a screenshot, or attach a
 * file. Links are read by the Rolevisor server, not the model, so they work with every
 * provider and with no model at all. Screenshots are read by Claude when an API key is set, otherwise with
 * free OCR in this browser; the extracted text goes into the same box so it
 * can be checked and fixed before tailoring.
 */
export function JobPostingInput({ text, onChange }: Props) {
  const { settings, loaded } = useSettings();
  const claudeReads = loaded && settings.provider === "claude" && !needsModel(settings);
  // The answer of a finished read is the note saying how the text was read.
  const reading = useRequest<string>();
  const { busy, error } = reading;
  const note = reading.data ?? "";
  const [progress, setProgress] = useState<number | null>(null);
  const [link, setLink] = useState("");
  const [readingLink, setReadingLink] = useState(false);

  // A link replaces whatever was in the box: a new link is a new job.
  const readLink = (url: string) =>
    reading.run(async () => {
      setReadingLink(true);
      try {
        const page = await readJobLink(url);
        onChange(page.text);
        setLink("");
        const what = [page.title, page.company && `at ${page.company}`].filter(Boolean).join(" ");
        return `Read ${what || "the posting"} from ${page.site}. Give it a quick look: menus or other jobs from the page can sneak in.`;
      } finally {
        setReadingLink(false);
      }
    });

  const read = (file: File) =>
    reading.run(async () => {
      setProgress(null);
      try {
        const parsed = await parseJobPosting(file, loaded ? settings : null, setProgress);
        onChange(text.trim() ? `${text.trim()}\n\n${parsed.text}` : parsed.text);
        return parsed.readBy === "claude"
          ? "Text read from your screenshot by Claude. Give it a quick look before tailoring."
          : parsed.readBy === "browser"
            ? parsed.claudeError
              ? `Claude couldn't read the screenshot, so it was read in this browser instead. Check it below for mistakes. (${parsed.claudeError.replace(/\.$/, "")})`
              : "Text read from your screenshot in this browser. Check it below for mistakes. Adding a Claude API key makes screenshot reading much more accurate."
            : `Text read from ${file.name}.`;
      } finally {
        setProgress(null);
      }
    });

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
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (link.trim() && !busy) readLink(link.trim());
        }}
      >
        <input
          className="field flex-1"
          type="url"
          inputMode="url"
          aria-label="Job posting link"
          placeholder="Paste a link to the job, e.g. from Greenhouse, Lever, LinkedIn, or a careers page"
          value={link}
          disabled={busy}
          onChange={(e) => setLink(e.target.value)}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            if (isJustALink(pasted) && !busy) {
              e.preventDefault();
              setLink(pasted.trim());
              readLink(pasted.trim());
            }
          }}
        />
        <button className="btn-secondary shrink-0" disabled={busy || !link.trim()}>
          {readingLink ? "Reading the page..." : "Read posting"}
        </button>
      </form>
      <p className="text-xs text-muted">
        Or paste the posting&apos;s text below. Indeed, Glassdoor, and some LinkedIn pages block automatic
        reading, so for those, paste the text or a screenshot.
      </p>
      <textarea
        className="field h-48"
        value={text}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        onPaste={(e) => {
          // A link pasted into the empty box is read instead of left as a bare link.
          const pasted = e.clipboardData.getData("text");
          if (!text.trim() && isJustALink(pasted)) {
            e.preventDefault();
            setLink(pasted.trim());
            readLink(pasted.trim());
            return;
          }
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
