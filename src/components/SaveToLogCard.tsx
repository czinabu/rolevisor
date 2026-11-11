"use client";

import Link from "next/link";
import { useState } from "react";
import {
  FOLLOW_UP_DAYS,
  addApplication,
  addDays,
  newApplication,
  today,
  updateApplication,
  type Application,
} from "@/lib/applications";
import { guessCompany } from "@/lib/companyName";

type Step =
  | { step: "offer" }
  | { step: "form"; company: string; role: string; remind: boolean }
  | { step: "saved"; app: Application };

/**
 * "Applying for this job?" Saves the job to the application log with the tailored resume, the
 * cover letter and the posting, and a follow-up reminder a week out.
 */
export function SaveToLogCard({
  resume,
  coverLetter,
  jobPosting,
  targetRole,
}: {
  resume: string;
  coverLetter: string;
  jobPosting: string;
  targetRole: string;
}) {
  const [state, setState] = useState<Step>({ step: "offer" });
  const [error, setError] = useState("");

  const write = (save: () => void) => {
    try {
      save();
      setError("");
      return true;
    } catch {
      setError("Couldn't save to the log. Browser storage may be blocked.");
      return false;
    }
  };

  const what = [resume.trim() && "tailored resume", coverLetter.trim() && "cover letter"].filter(Boolean);

  if (state.step === "saved") {
    const { app } = state;
    const stale = app.resume !== resume || app.coverLetter !== coverLetter;
    return (
      <div className="card space-y-2 p-4 text-sm">
        <p>
          Saved to your{" "}
          <Link href="/applications" className="link">
            application log
          </Link>
          {app.followUp && <>. We&apos;ll remind you to follow up on {app.followUp}</>}.
        </p>
        {stale && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-muted">
              Your {what.length ? what.join(" or ") : "files"} changed since you saved.
            </span>
            <button
              className="btn-secondary"
              onClick={() => {
                const next = { ...app, resume, coverLetter };
                if (write(() => updateApplication(next))) setState({ step: "saved", app: next });
              }}
            >
              Update the saved copy
            </button>
          </div>
        )}
        {error && <p role="alert" className="text-bad">{error}</p>}
      </div>
    );
  }

  if (state.step === "form") {
    return (
      <form
        className="card space-y-3 p-4 text-sm"
        onSubmit={(e) => {
          e.preventDefault();
          const app = newApplication({
            company: state.company.trim(),
            role: state.role.trim(),
            followUp: state.remind ? addDays(today(), FOLLOW_UP_DAYS) : "",
            resume,
            coverLetter,
            jobPosting,
          });
          if (write(() => addApplication(app))) setState({ step: "saved", app });
        }}
      >
        <div className="flex flex-wrap gap-3">
          <input
            className="field w-auto flex-1"
            placeholder="Company"
            aria-label="Company"
            value={state.company}
            onChange={(e) => setState({ ...state, company: e.target.value })}
          />
          <input
            className="field w-auto flex-1"
            placeholder="Job title"
            aria-label="Job title"
            value={state.role}
            onChange={(e) => setState({ ...state, role: e.target.value })}
          />
          <button className="btn" disabled={!state.company.trim() && !state.role.trim()}>
            Save
          </button>
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={state.remind}
            onChange={(e) => setState({ ...state, remind: e.target.checked })}
          />
          Remind me to follow up in a week if I haven&apos;t heard back
        </label>
        <p className="text-xs text-muted">
          {what.length
            ? `Saves the ${what.join(" and ")} you see here and the job posting, so you can download them again later.`
            : "Saves the job posting with it."}{" "}
          Kept in this browser only.
        </p>
        {error && <p role="alert" className="text-bad">{error}</p>}
      </form>
    );
  }

  return (
    <div className="card flex flex-wrap items-center gap-3 p-4 text-sm">
      <span>Applying for this job?</span>
      <button
        className="btn-secondary"
        onClick={() =>
          setState({ step: "form", company: guessCompany(jobPosting), role: targetRole, remind: true })
        }
      >
        Save to log
      </button>
      <span className="text-xs text-muted">
        Keeps this resume{coverLetter.trim() ? " and cover letter" : ""} with the job and reminds you to follow up.
      </span>
    </div>
  );
}
