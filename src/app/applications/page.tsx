"use client";

import { DownloadPanel } from "@/components/DownloadPanel";
import { PageHeader } from "@/components/PageHeader";
import { useRef, useState } from "react";
import {
  FOLLOW_UP_DAYS,
  STATUSES,
  addDays,
  ago,
  download,
  followUpIcs,
  isDue,
  newApplication,
  parseImport,
  toCsv,
  today,
  useApplications,
  type Application,
  type ApplicationStatus,
} from "@/lib/applications";

export default function ApplicationsPage() {
  const [apps, setApps, loaded] = useApplications();
  const [filter, setFilter] = useState<ApplicationStatus | "all">("all");
  const [editing, setEditing] = useState<Application | null>(null);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const shown = apps.filter((a) => filter === "all" || a.status === filter);
  const due = apps.filter((a) => isDue(a));

  function save(app: Application) {
    const exists = apps.some((a) => a.id === app.id);
    setApps(exists ? apps.map((a) => (a.id === app.id ? app : a)) : [app, ...apps]);
    setEditing(null);
  }

  async function importFile(file: File) {
    try {
      const incoming = parseImport(await file.text(), file.name);
      const known = new Set(apps.map((a) => a.id));
      const fresh = incoming.filter((a) => !known.has(a.id));
      setApps([...fresh, ...apps]);
      setMessage(`Added ${fresh.length} application${fresh.length === 1 ? "" : "s"}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't read that file.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Application log">
        <p>
          Keep track of where you applied and what you heard back. This list is saved only in this
          browser, so download a backup now and then.
        </p>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" onClick={() => setEditing(newApplication())}>
          Add application
        </button>
        <select
          className="field w-auto"
          aria-label="Show"
          value={filter}
          onChange={(e) => setFilter(e.target.value as ApplicationStatus | "all")}
        >
          <option value="all">All statuses</option>
          {Object.entries(STATUSES).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          <button
            className="btn-secondary"
            disabled={apps.length === 0}
            onClick={() => download("job-applications.csv", toCsv(apps), "text/csv")}
          >
            Download CSV
          </button>
          <button
            className="btn-secondary"
            disabled={apps.length === 0}
            onClick={() =>
              download("job-applications.json", JSON.stringify(apps, null, 2), "application/json")
            }
          >
            Download JSON
          </button>
          <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {message && (
        <p role="status" className="text-sm text-muted">
          {message}
        </p>
      )}
      {due.length > 0 && (
        <section className="card space-y-3 border-accent p-4 text-sm" aria-labelledby="due-heading">
          <h2 id="due-heading" className="font-medium">
            Time to follow up ({due.length})
          </h2>
          <p className="text-muted">
            You haven&apos;t heard back from {due.length === 1 ? "this one" : "these"} yet. A short,
            polite email asking about the timeline is enough.
          </p>
          <ul className="space-y-2">
            {due.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-2">
                <span>
                  <span className="font-medium">{a.role || "Untitled role"}</span>
                  {a.company && <span className="text-muted"> at {a.company}</span>}
                  {a.dateApplied && <span className="text-muted">, applied {ago(a.dateApplied)}</span>}
                </span>
                <span className="flex flex-wrap gap-2 sm:ml-auto">
                  <button
                    className="btn-secondary"
                    onClick={() =>
                      save({
                        ...a,
                        followUp: addDays(today(), FOLLOW_UP_DAYS),
                        notes: [a.notes.trim(), `Followed up ${today()}.`].filter(Boolean).join("\n"),
                      })
                    }
                  >
                    I followed up
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => save({ ...a, followUp: addDays(today(), FOLLOW_UP_DAYS) })}
                  >
                    Remind me next week
                  </button>
                  <button className="btn-secondary" onClick={() => save({ ...a, status: "ghosted", followUp: "" })}>
                    No response
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">
            &ldquo;I followed up&rdquo; adds a note and checks again in a week.
          </p>
        </section>
      )}

      {editing && <Editor app={editing} onSave={save} onCancel={() => setEditing(null)} />}

      {loaded && apps.length === 0 && !editing && (
        <p className="card p-5 text-sm text-muted">
          Nothing here yet. Add an application, or tailor your resume to a job and choose
          &ldquo;Save to log&rdquo;.
        </p>
      )}

      <ul className="space-y-3">
        {shown.map((a) => {
          const late = isDue(a);
          return (
            <li key={a.id} className="card p-4 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-medium">{a.role || "Untitled role"}</span>
                <span className="text-muted">{a.company}</span>
                <select
                  className="field ml-auto w-auto"
                  aria-label={`Status for ${a.role} at ${a.company}`}
                  value={a.status}
                  onChange={(e) => save({ ...a, status: e.target.value as ApplicationStatus })}
                >
                  {Object.entries(STATUSES).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1 text-xs text-muted">
                {a.dateApplied && `Applied ${a.dateApplied} (${ago(a.dateApplied)})`}
                {a.followUp && (
                  <>
                    <span className={late ? "text-bad" : ""}> · Follow up {a.followUp}</span>{" "}
                    {a.followUp >= today() && (
                      <button
                        className="link"
                        title="Download a calendar reminder for the follow-up date"
                        onClick={() =>
                          download(
                            `follow-up-${(a.company || a.role || "job").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`,
                            followUpIcs(a),
                            "text/calendar",
                          )
                        }
                      >
                        Add to calendar
                      </button>
                    )}
                  </>
                )}
                {a.link && (
                  <>
                    {" · "}
                    <a className="link" href={safeUrl(a.link)} target="_blank" rel="noreferrer">
                      Job posting
                    </a>
                  </>
                )}
              </p>
              {a.notes && <p className="mt-2 whitespace-pre-wrap">{a.notes}</p>}
              <SavedFiles app={a} />
              <div className="mt-2 flex gap-4 text-xs">
                <button className="link" onClick={() => setEditing(a)}>
                  Edit
                </button>
                <button
                  className="text-muted underline"
                  onClick={() => {
                    if (confirm(`Delete ${a.role || "this"} at ${a.company}?`))
                      setApps(apps.filter((x) => x.id !== a.id));
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Only http(s) links are clickable, so an imported file can't plant a javascript: link. */
function safeUrl(link: string) {
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(link) ? link : `https://${link}`;
  return /^https?:\/\//i.test(withScheme) ? withScheme : "#";
}

/** The resume, cover letter and posting saved with an application, to read or download again. */
function SavedFiles({ app }: { app: Application }) {
  const files = [
    { key: "resume", label: "Tailored resume", text: app.resume, kind: "resume" as const },
    { key: "letter", label: "Cover letter", text: app.coverLetter, kind: "letter" as const },
    { key: "posting", label: "Job posting", text: app.jobPosting, kind: null },
  ].filter((f) => f.text.trim());
  if (files.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      {files.map((f) => (
        <details key={f.key} className="rounded-md border border-line px-3 py-2">
          <summary className="cursor-pointer font-medium">{f.label}</summary>
          <div className="mt-2 space-y-3">
            <textarea className="field h-60 text-xs" readOnly value={f.text} aria-label={`${f.label} for ${app.company}`} />
            {f.kind && <DownloadPanel text={f.text} kind={f.kind} jobPosting={app.jobPosting} />}
          </div>
        </details>
      ))}
    </div>
  );
}

function Editor({
  app,
  onSave,
  onCancel,
}: {
  app: Application;
  onSave: (a: Application) => void;
  onCancel: () => void;
}) {
  // A new entry starts with a follow-up a week out.
  const [draft, setDraft] = useState(() =>
    !app.company && !app.role && !app.followUp ? { ...app, followUp: addDays(app.dateApplied, FOLLOW_UP_DAYS) } : app,
  );
  const set = (patch: Partial<Application>) => {
    // Moving the applied date moves a follow-up that was still the default week after it.
    const auto = draft.followUp === addDays(draft.dateApplied, FOLLOW_UP_DAYS);
    const followUp = patch.dateApplied !== undefined && auto ? addDays(patch.dateApplied, FOLLOW_UP_DAYS) : undefined;
    setDraft({ ...draft, ...patch, ...(followUp !== undefined ? { followUp } : {}) });
  };
  const ok = draft.company.trim() || draft.role.trim();

  return (
    <form
      className="space-y-3 card border-accent p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) onSave(draft);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="field" placeholder="Company" value={draft.company} onChange={(e) => set({ company: e.target.value })} />
        <input className="field" placeholder="Job title" value={draft.role} onChange={(e) => set({ role: e.target.value })} />
        <input className="field sm:col-span-2" placeholder="Link to the job posting" value={draft.link} onChange={(e) => set({ link: e.target.value })} />
        <label className="text-xs text-muted">
          Date applied
          <input type="date" className="field mt-1" value={draft.dateApplied} onChange={(e) => set({ dateApplied: e.target.value })} />
        </label>
        <label className="text-xs text-muted">
          Follow up on
          <input type="date" className="field mt-1" value={draft.followUp} onChange={(e) => set({ followUp: e.target.value })} />
        </label>
        <label className="text-xs text-muted">
          Status
          <select className="field mt-1" value={draft.status} onChange={(e) => set({ status: e.target.value as ApplicationStatus })}>
            {Object.entries(STATUSES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <textarea className="field h-20" placeholder="Notes: contacts, interview dates, salary, anything useful" value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
      <div className="flex gap-3">
        <button className="btn" type="submit" disabled={!ok}>
          Save
        </button>
        <button className="btn-secondary" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
