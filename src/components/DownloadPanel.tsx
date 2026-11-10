"use client";

import { useMemo, useState } from "react";
import { LINK_FIELDS, normalizeUrl, useProfileLinks } from "@/lib/profileLinks";
import { PROJECT_LINK_FIELDS, addProjectLinks, findProjects, linksFor, useProjectLinks } from "@/lib/projectLinks";
import {
  TEMPLATES,
  fileStem,
  makeLetterDocx,
  makeLetterPdf,
  makeResumeDocx,
  makeResumePdf,
  saveBlob,
  type TemplateId,
} from "@/lib/resumeDoc";

/** Template picker and PDF / Word download buttons. Files are built in the browser. */
export function DownloadPanel({ text, kind }: { text: string; kind: "resume" | "letter" }) {
  const [template, setTemplate] = useState<TemplateId>("classic");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [links, setLinks] = useProfileLinks();
  const urls = {
    linkedin: normalizeUrl(links.linkedin),
    github: normalizeUrl(links.github),
    website: normalizeUrl(links.website),
  };
  const [projectLinks, setProjectLinks] = useProjectLinks();
  const projects = useMemo(() => (kind === "resume" ? findProjects(text) : []), [kind, text]);

  async function download(format: "pdf" | "docx") {
    setBusy(true);
    setError("");
    try {
      const make =
        kind === "resume"
          ? format === "pdf" ? makeResumePdf : makeResumeDocx
          : format === "pdf" ? makeLetterPdf : makeLetterDocx;
      const stem = kind === "resume" ? fileStem(text, "resume") : "cover-letter";
      const body = kind === "resume" ? addProjectLinks(text, projectLinks) : text;
      saveBlob(await make(body, template, urls), `${stem}.${format}`);
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
        <button className="btn" disabled={busy || !text.trim()} onClick={() => download("pdf")}>
          Download PDF
        </button>
        <button className="btn-secondary" disabled={busy || !text.trim()} onClick={() => download("docx")}>
          Download Word
        </button>
      </div>
      <p className="text-xs text-muted">
        {TEMPLATES[template].note}. Single column, no tables or images, so applicant tracking
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
      {projects.length > 0 && (
        <fieldset className="space-y-3 rounded-md border border-line p-3">
          <legend className="px-1 text-sm font-medium">Project links</legend>
          <p className="text-xs text-muted">
            Add the address for each project&apos;s live demo or code. Words like &quot;Live demo&quot; or
            &quot;GitHub repo&quot; next to the project become clickable links; if they aren&apos;t there, the
            link is added after the project&apos;s name. Leave a box blank to skip it. Saved in this browser only.
          </p>
          {projects.map((p) => {
            const saved = linksFor(p.key, projectLinks) ?? { demo: "", code: "" };
            return (
              <div key={p.key} className="space-y-1">
                <p className="text-sm font-medium">{p.name}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PROJECT_LINK_FIELDS.map((f) => {
                    const value = saved[f.kind] ?? "";
                    const bad = value.trim() !== "" && !normalizeUrl(value);
                    const word = p.words[f.kind];
                    return (
                      <label key={f.kind} className="space-y-1 text-sm">
                        <span className="text-muted">{f.label}</span>
                        <input
                          className="field"
                          type="url"
                          inputMode="url"
                          placeholder={f.placeholder}
                          value={value}
                          aria-invalid={bad}
                          aria-label={`${p.name}: ${f.label}`}
                          disabled={p.linked.includes(f.kind)}
                          onChange={(e) =>
                            setProjectLinks({ ...projectLinks, [p.key]: { ...saved, [f.kind]: e.target.value } })
                          }
                        />
                        {p.linked.includes(f.kind) ? (
                          <span className="text-xs text-muted">Already linked in your resume.</span>
                        ) : bad ? (
                          <span className="text-xs text-bad">That doesn&apos;t look like a web address.</span>
                        ) : (
                          word &&
                          !value.trim() && (
                            <span className="text-xs text-muted">
                              Your resume says &quot;{word}&quot; here with no link behind it.
                            </span>
                          )
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </fieldset>
      )}
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </div>
  );
}
