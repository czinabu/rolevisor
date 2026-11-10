"use client";

import Link from "next/link";
import { useState } from "react";
import { BulletCheckCard } from "@/components/BulletCheckCard";
import { CoverLetterCard } from "@/components/CoverLetterCard";
import { FormatCard } from "@/components/FormatCard";
import { OriginalDownloadCard } from "@/components/OriginalDownloadCard";
import { Loading } from "@/components/Loading";
import { KeywordMatchCard } from "@/components/KeywordMatchCard";
import { JobPostingInput } from "@/components/JobPostingInput";
import { PageHeader } from "@/components/PageHeader";
import { SuggestionsCard } from "@/components/SuggestionsCard";
import { Tabs } from "@/components/Tabs";
import { ResumeInput } from "@/components/ResumeInput";
import { TailorResults } from "@/components/TailorResults";
import type { ResumeLayout } from "@/lib/layout";
import { runTask } from "@/lib/ai";
import { FREE_FEATURES, needsModel, PROVIDERS } from "@/lib/providers";
import { NoModel } from "@/components/FreeLabel";
import { friendlyMessage } from "@/lib/errors";
import {
  EDUCATION_STATUSES,
  EMPTY_EDUCATION,
  type Background,
  type Education,
  type EducationStatus,
  type TailorRequest,
  type TailorResult,
} from "@/lib/tailor";
import { useSettings } from "@/lib/useSettings";
import { useStoredState } from "@/lib/useStoredState";
import { addApplication, newApplication } from "@/lib/applications";

type Inputs = TailorRequest;

interface Tailored {
  result: TailorResult;
  /** The resume this result was made from, for the keyword check. */
  resume: string;
}

const EMPTY: Inputs = {
  resume: "",
  background: {
    targetRole: "",
    experience: "",
    skills: "",
    notes: "",
    education: [],
  },
  jobPosting: "",
};

const TABS = [
  { id: "tailor", label: "Tailored resume" },
  { id: "keywords", label: "Keyword match" },
  { id: "suggestions", label: "Suggestions" },
  { id: "format", label: "Formatting" },
  { id: "letter", label: "Cover letter" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Tabs whose results come from plain code in the browser, with no model. */
const FREE_TABS: readonly TabId[] = ["format"];

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line bg-card/50 p-8 text-center text-sm text-muted">
      {children}
    </p>
  );
}

export default function TailorPage() {
  const { settings, loaded } = useSettings();
  // Wait for the saved settings before deciding, so a saved key doesn't flash the no-key view.
  const noModel = loaded && needsModel(settings);
  const [inputs, setInputs] = useStoredState<Inputs>(
    "job-helper:inputs",
    EMPTY,
  );
  const [tab, setTab] = useState<TabId>("tailor");
  const [tailoring, setTailoring] = useState(false);
  const [tailorError, setTailorError] = useState("");
  // Measured from the uploaded file. Kept in storage so it survives switching pages.
  const [stored, setStored] = useStoredState<{ layout: ResumeLayout | null }>("job-helper:layout", { layout: null });
  const layout = stored.layout;
  const setLayout = (layout: ResumeLayout | null) => setStored({ layout });
  const [tailored, setTailored] = useState<Tailored | null>(null);
  const [logForm, setLogForm] = useState<{
    company: string;
    role: string;
  } | null>(null);
  const [logged, setLogged] = useState(false);

  const setBackground = (patch: Partial<Background>) =>
    setInputs({ ...inputs, background: { ...inputs.background, ...patch } });

  // Always show at least one blank school so the fields are easy to find.
  const schools = inputs.background.education?.length
    ? inputs.background.education
    : [EMPTY_EDUCATION];
  const setSchool = (index: number, patch: Partial<Education>) =>
    setBackground({
      education: schools.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    });

  function showResults(next: TabId) {
    setTab(next);
    setTimeout(() =>
      document
        .getElementById("results")
        ?.scrollIntoView({ behavior: "smooth" }),
    );
  }

  async function tailor() {
    // With no model, the button shows the free results instead of failing.
    if (noModel) {
      setTailorError("");
      showResults("format");
      return;
    }
    setTailoring(true);
    setTailorError("");
    setTailored(null);
    setLogForm(null);
    setLogged(false);
    try {
      const result = await runTask<TailorResult>(settings, "tailor", inputs);
      setTailored({ result, resume: inputs.resume });
      showResults("tailor");
    } catch (error) {
      setTailorError(friendlyMessage(error));
    } finally {
      setTailoring(false);
    }
  }

  const hasEducation = schools.some((s) =>
    Object.values(s).some((v) => String(v).trim()),
  );
  const ready = inputs.resume.trim() && inputs.jobPosting.trim();
  // The free checks only need the resume.
  const canRun = noModel ? !!inputs.resume.trim() : !!ready;
  const tabs = TABS.map((t) => ({
    ...t,
    note: FREE_TABS.includes(t.id) ? "Free" : noModel ? "Needs a key" : undefined,
  }));

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <PageHeader title="Tailor your resume to a job">
          <p>
            Two steps: add your details, then see your results. Everything stays
            in this browser until you ask for help.
          </p>
        </PageHeader>
        {!noModel && (
          <div className="card flex flex-col gap-3 bg-card p-4 text-sm sm:flex-row sm:items-center">
            <span className="flex-1">
              Not sure what you&apos;ll get? See full results for a sample resume first. No API key
              needed.
            </span>
            <Link href="/example" className="btn-secondary">
              See an example
            </Link>
          </div>
        )}
        {noModel ? (
          <div className="card space-y-3 bg-card p-4 text-sm">
            <p className="font-medium">No AI model set up yet. You can still use the free parts.</p>
            <ul className="list-disc space-y-0.5 pl-5 text-muted">
              {FREE_FEATURES.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <p className="text-muted">
              For the tailored resume, suggestions, and cover letter,{" "}
              <Link href="/settings" className="link">
                add a Claude API key
              </Link>{" "}
              or connect LM Studio or Ollama in Model settings.
            </p>
            <Link href="/example" className="btn-secondary">
              See full results for a sample resume
            </Link>
          </div>
        ) : (
          <p className="text-xs text-muted">
            Using: {PROVIDERS[settings.provider].label}
            {settings.model ? `, ${settings.model}` : ""} ·{" "}
            <Link href="/settings" className="link">
              change
            </Link>
          </p>
        )}
      </div>

      <div className="space-y-5">
        <h2 className="flex items-center gap-3 text-xl font-semibold tracking-tight">
          <span className="step-dot">
            1
          </span>
          Add your details
        </h2>

        <section className="card space-y-3 p-5">
          <h3 className="font-semibold">Your resume</h3>
          <ResumeInput
            text={inputs.resume}
            onChange={(resume) => setInputs({ ...inputs, resume })}
            onLayout={setLayout}
          />
        </section>

        <section className="card space-y-3 p-5">
          <h3 className="font-semibold">About you (optional)</h3>
          <p className="text-sm text-muted">
            Anything that isn&apos;t on your resume but helps explain your
            story.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              className="field"
              placeholder="Kind of role you want, e.g. Data analyst"
              value={inputs.background.targetRole}
              onChange={(e) => setBackground({ targetRole: e.target.value })}
            />
            <input
              className="field"
              placeholder="Years of experience, e.g. 3"
              value={inputs.background.experience}
              onChange={(e) => setBackground({ experience: e.target.value })}
            />
          </div>
          <input
            className="field"
            placeholder="Skills you have that aren't on your resume"
            value={inputs.background.skills}
            onChange={(e) => setBackground({ skills: e.target.value })}
          />
          <textarea
            className="field h-24"
            placeholder="Anything else: career change, employment gap, side projects, what you're looking for..."
            value={inputs.background.notes}
            onChange={(e) => setBackground({ notes: e.target.value })}
          />

          <details
            className="space-y-3 rounded-lg border border-line bg-background/60 p-3"
            open={hasEducation}
          >
            <summary className="cursor-pointer text-sm font-medium">
              Education{hasEducation ? "" : " (optional)"}
            </summary>
            <p className="text-sm text-muted">
              Include school you didn&apos;t finish too. Rolevisor will suggest
              whether to list it, where it goes, and how to word it for each
              job.
            </p>
            {schools.map((school, i) => (
              <div
                key={i}
                className="space-y-3 rounded-lg border border-line bg-card p-3"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    className="field"
                    placeholder="School, e.g. Ohio State University"
                    value={school.school}
                    onChange={(e) => setSchool(i, { school: e.target.value })}
                  />
                  <input
                    className="field"
                    placeholder="Degree or program, e.g. B.S. Computer Science"
                    value={school.program}
                    onChange={(e) => setSchool(i, { program: e.target.value })}
                  />
                  <select
                    className="field"
                    aria-label="Status"
                    value={school.status}
                    onChange={(e) =>
                      setSchool(i, {
                        status: e.target.value as EducationStatus | "",
                      })
                    }
                  >
                    <option value="">Status...</option>
                    {Object.entries(EDUCATION_STATUSES).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                  <input
                    className="field"
                    placeholder="Dates, e.g. 2021–2023 or expected May 2027"
                    value={school.dates}
                    onChange={(e) => setSchool(i, { dates: e.target.value })}
                  />
                </div>
                <textarea
                  className="field h-20"
                  placeholder="Relevant coursework, credits earned, honors, or projects"
                  value={school.coursework}
                  onChange={(e) => setSchool(i, { coursework: e.target.value })}
                />
                {schools.length > 1 && (
                  <button
                    className="text-sm text-muted underline"
                    onClick={() =>
                      setBackground({
                        education: schools.filter((_, j) => j !== i),
                      })
                    }
                  >
                    Remove this school
                  </button>
                )}
              </div>
            ))}
            <button
              className="btn-secondary"
              onClick={() =>
                setBackground({ education: [...schools, EMPTY_EDUCATION] })
              }
            >
              Add another school
            </button>
          </details>
        </section>

        <section className="card space-y-3 p-5">
          <h3 className="font-semibold">The job posting</h3>
          <JobPostingInput
            text={inputs.jobPosting}
            onChange={(jobPosting) => setInputs({ ...inputs, jobPosting })}
          />
        </section>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            className="btn px-5 py-2.5 text-base"
            disabled={!canRun || tailoring}
            onClick={tailor}
          >
            {tailoring
              ? "Tailoring..."
              : noModel
                ? "Check my resume for free"
                : "Tailor my resume"}
          </button>
          {!canRun && !tailoring && (
            <span className="text-sm text-muted">
              {noModel
                ? "Add your resume to run the free checks."
                : "Add your resume and a job posting to continue."}
            </span>
          )}
          <button
            className="ml-auto text-sm text-muted underline"
            onClick={() => {
              setInputs(EMPTY);
              setTailored(null);
              setTailorError("");
            }}
          >
            Clear everything
          </button>
        </div>

        {tailoring && (
          <Loading
            message="Tailoring your resume..."
            hint={
              PROVIDERS[settings.provider].isLocal
                ? "This can take a few minutes on a local model."
                : "This usually takes under a minute."
            }
          />
        )}

        {tailorError && (
          <p
            role="alert"
            className="whitespace-pre-line rounded-lg border border-bad/40 bg-bad-soft p-3 text-sm text-bad"
          >
            {tailorError}
          </p>
        )}
      </div>

      <div id="results" className="space-y-4 border-t border-line pt-8">
        <h2 className="flex items-center gap-3 text-xl font-semibold tracking-tight">
          <span className="step-dot">
            2
          </span>
          See your results
        </h2>
        <Tabs tabs={tabs} value={tab} onChange={setTab} label="Results" />

        <div
          role="tabpanel"
          id="panel-tailor"
          aria-labelledby="tab-tailor"
          hidden={tab !== "tailor"}
        >
          {tailored ? (
            <>
              <TailorResults
                result={tailored.result}
                originalResume={tailored.resume}
                jobPosting={inputs.jobPosting}
              />
              <div className="mt-8 card p-4 text-sm">
                {logged ? (
                  <p>
                    Saved. See it in your{" "}
                    <Link
                      href="/applications"
                      className="link"
                    >
                      application log
                    </Link>
                    .
                  </p>
                ) : logForm ? (
                  <form
                    className="flex flex-wrap gap-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      try {
                        addApplication(
                          newApplication({
                            company: logForm.company.trim(),
                            role: logForm.role.trim(),
                          }),
                        );
                        setLogged(true);
                      } catch {
                        setTailorError(
                          "Couldn't save to the log. Browser storage may be blocked.",
                        );
                      }
                    }}
                  >
                    <input
                      className="field w-auto flex-1"
                      placeholder="Company"
                      value={logForm.company}
                      onChange={(e) =>
                        setLogForm({ ...logForm, company: e.target.value })
                      }
                    />
                    <input
                      className="field w-auto flex-1"
                      placeholder="Job title"
                      value={logForm.role}
                      onChange={(e) =>
                        setLogForm({ ...logForm, role: e.target.value })
                      }
                    />
                    <button
                      className="btn"
                      disabled={!logForm.company.trim() && !logForm.role.trim()}
                    >
                      Save
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-3">
                    <span>Applying for this job?</span>
                    <button
                      className="btn-secondary"
                      onClick={() =>
                        setLogForm({
                          company: "",
                          role: inputs.background.targetRole,
                        })
                      }
                    >
                      Save to log
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : noModel ? (
            <NoModel feature="The tailored resume" />
          ) : (
            <Empty>
              {tailoring
                ? "Your tailored resume will appear here in a moment."
                : 'Add your resume and a job posting above, then press "Tailor my resume" to see it here.'}
            </Empty>
          )}
        </div>

        <div
          role="tabpanel"
          id="panel-keywords"
          aria-labelledby="tab-keywords"
          hidden={tab !== "keywords"}
        >
          {ready ? (
            <KeywordMatchCard
              resume={inputs.resume}
              jobPosting={inputs.jobPosting}
              background={inputs.background}
            />
          ) : (
            <Empty>
              Add your resume and a job posting above to see which of the posting&apos;s keywords
              your resume has. No API key needed.
            </Empty>
          )}
        </div>

        <div
          role="tabpanel"
          id="panel-suggestions"
          aria-labelledby="tab-suggestions"
          hidden={tab !== "suggestions"}
        >
          {noModel ? (
            <NoModel feature="Written suggestions" />
          ) : ready ? (
            <SuggestionsCard
              resume={inputs.resume}
              background={inputs.background}
              jobPosting={inputs.jobPosting}
              settings={settings}
            />
          ) : (
            <Empty>
              Add your resume and a job posting above to get suggestions for
              this job.
            </Empty>
          )}
        </div>

        <div
          role="tabpanel"
          id="panel-format"
          aria-labelledby="tab-format"
          hidden={tab !== "format"}
        >
          {inputs.resume.trim() ? (
            <div className="space-y-6">
              <FormatCard
                resume={inputs.resume}
                layout={layout}
                settings={settings}
                jobPosting={inputs.jobPosting}
                targetRole={inputs.background.targetRole}
              />
              <BulletCheckCard
                resume={inputs.resume}
                jobPosting={inputs.jobPosting}
                background={inputs.background}
              />
              <OriginalDownloadCard resume={inputs.resume} jobPosting={inputs.jobPosting} />
            </div>
          ) : (
            <Empty>
              Add your resume above to check its formatting and spacing, or
              to download it in a clean template.
            </Empty>
          )}
        </div>

        <div
          role="tabpanel"
          id="panel-letter"
          aria-labelledby="tab-letter"
          hidden={tab !== "letter"}
        >
          {noModel ? (
            <NoModel feature="Writing a cover letter" />
          ) : ready ? (
            <CoverLetterCard
              resume={inputs.resume}
              background={inputs.background}
              jobPosting={inputs.jobPosting}
              settings={settings}
            />
          ) : (
            <Empty>
              Add your resume and a job posting above to write a cover letter.
            </Empty>
          )}
        </div>
      </div>
    </div>
  );
}
