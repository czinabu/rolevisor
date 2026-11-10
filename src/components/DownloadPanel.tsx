"use client";

import { useState } from "react";
import { downloadStem, guessCompany } from "@/lib/companyName";
import { LINK_FIELDS, normalizeUrl, useProfileLinks } from "@/lib/profileLinks";
import {
  TEMPLATES,
  makeLetterDocx,
  makeLetterPdf,
  makeResumeDocx,
  makeResumePdf,
  saveBlob,
  type TemplateId,
} from "@/lib/resumeDoc";

/**
 * Template picker and PDF / Word download buttons. Files are built in the browser and named after
 * the company in the job posting ("caleb-zinabu-acme.pdf", "cover-letter-acme.pdf"), which the
 * person can correct.
 */
export function DownloadPanel({
  text,
  kind,
  jobPosting = "",
}: {
  text: string;
  kind: "resume" | "letter";
  jobPosting?: string;
}) {
  const [template, setTemplate] = useState<TemplateId>("classic");
  // The guess from the posting, until the person types their own. A new posting brings a new guess.
  const [typed, setTyped] = useState<{ posting: string; company: string } | null>(null);
  const company = typed && typed.posting === jobPosting ? typed.company : guessCompany(jobPosting);
  const stem = downloadStem(kind, text, company);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [links, setLinks] = useProfileLinks();
  const urls = {
    linkedin: normalizeUrl(links.linkedin),
    github: normalizeUrl(links.github),
    website: normalizeUrl(links.website),
  };

  async function download(format: "pdf" | "docx") {
    setBusy(true);
    setError("");
    try {
      const make =
        kind === "resume"
          ? format === "pdf" ? makeResumePdf : makeResumeDocx
          : format === "pdf" ? makeLetterPdf : makeLetterDocx;
      saveBlob(await make(text, template, urls), `${stem}.${format}`);
    } catch {
      setError("Couldn't build the file. Try the other format, or copy the text instead.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium">Template</span>
          <select
            className="field !w-auto"
            value={template}
            onChange={(e) => setTemplate(e.target.value as TemplateId)}
          >
            {Object.entries(TEMPLATES).map(([id, t]) => (
              <option key={id} value={id}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium">Company</span>
          <input
            className="field !w-40"
            placeholder="For the file name"
            value={company}
            onChange={(e) => setTyped({ posting: jobPosting, company: e.target.value })}
          />
        </label>
        <button className="btn" disabled={busy || !text.trim()} onClick={() => download("pdf")}>
          Download PDF
        </button>
        <button className="btn-secondary" disabled={busy || !text.trim()} onClick={() => download("docx")}>
          Download Word
        </button>
      </div>
      <p className="text-xs text-muted">
        Saves as <span className="font-medium">{stem}</span>. {TEMPLATES[template].note}. Single column, no tables or images, so applicant tracking
        systems can read it. Built on your device; nothing is uploaded.
      </p>
      {kind === "resume" && (
        <fieldset className="space-y-2 rounded-md border border-line p-3">
          <legend className="px-1 text-sm font-medium">Links on your resume</legend>
          <p className="text-xs text-muted">
            These become clickable links in the downloaded file. &quot;LinkedIn&quot;, &quot;GitHub&quot;, or
            &quot;Portfolio&quot; in your contact line links to them; if the word isn&apos;t there, the link is
            added at the end of that line. Saved in this browser only.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {LINK_FIELDS.map((f) => {
              const bad = links[f.key].trim() !== "" && !urls[f.key];
              return (
                <label key={f.key} className="space-y-1 text-sm">
                  <span className="font-medium">{f.label}</span>
                  <input
                    className="field"
                    type="url"
                    inputMode="url"
                    placeholder={f.placeholder}
                    value={links[f.key]}
                    aria-invalid={bad}
                    onChange={(e) => setLinks({ ...links, [f.key]: e.target.value })}
                  />
                  {bad && <span className="text-xs text-bad">That doesn&apos;t look like a web address.</span>}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </div>
  );
}
