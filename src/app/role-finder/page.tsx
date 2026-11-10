"use client";

import { PageHeader } from "@/components/PageHeader";
import { Loading } from "@/components/Loading";
import Link from "next/link";
import { useState } from "react";
import { runTask } from "@/lib/ai";
import { addApplication, newApplication } from "@/lib/applications";
import { useRequest } from "@/lib/useRequest";
import { searchLinks, type RecommendResult } from "@/lib/recommend";
import { needsModel, PROVIDERS } from "@/lib/providers";
import { KeyBadge, NoModel } from "@/components/FreeLabel";
import type { TailorRequest } from "@/lib/tailor";
import { useSettings } from "@/lib/useSettings";
import { useStoredState } from "@/lib/useStoredState";

const EMPTY: TailorRequest = {
  resume: "",
  background: { targetRole: "", experience: "", skills: "", notes: "", education: [] },
  jobPosting: "",
};

export default function RoleFinderPage() {
  const { settings, loaded: settingsLoaded } = useSettings();
  const noModel = settingsLoaded && needsModel(settings);
  // The same saved resume and "About you" details the home page uses.
  const [inputs, , loaded] = useStoredState<TailorRequest>("job-helper:inputs", EMPTY);
  const [location, setLocation] = useStoredState("job-helper:location", { value: "" });
  const request = useRequest<RecommendResult>();
  const { busy, error, data: result } = request;
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const find = () =>
    request.run(() =>
      runTask<RecommendResult>(settings, "recommend", {
        resume: inputs.resume,
        background: inputs.background,
        location: location.value,
      }),
    );

  function saveToLog(title: string) {
    try {
      addApplication(newApplication({ role: title, status: "applied", notes: "Saved from Role finder." }));
      setSaved(new Set(saved).add(title));
    } catch {
      request.fail("Couldn't save to the log. Browser storage may be blocked.");
    }
  }

  const hasResume = !!inputs.resume.trim();

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <PageHeader title="Find roles that fit you">
          <p className="font-medium text-foreground">
            Suggests roles that fit your background and links to job searches. It doesn&apos;t list live openings.
          </p>
          <p>
          Rolevisor reads your resume and the &ldquo;About you&rdquo; details from the{" "}
          <Link href="/tailor" className="link">
            Tailor page
          </Link>{" "}
          and suggests roles to look for, what carries over, and what to work on. It doesn&apos;t
          see live listings, so each role comes with search links to the big job boards.
          </p>
        </PageHeader>
        <p className="text-xs text-muted">
          <KeyBadge className="mr-2" />
          Using: {PROVIDERS[settings.provider].label}
          {settings.model ? `, ${settings.model}` : ""} ·{" "}
          <Link href="/settings" className="link">
            change
          </Link>
        </p>
      </div>

      {loaded && !hasResume && (
        <p className="rounded-lg border bg-card p-3 text-sm">
          Add your resume on the{" "}
          <Link href="/tailor" className="link">
            Tailor page
          </Link>{" "}
          first.
        </p>
      )}

      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <input
          className="field flex-1"
          placeholder="Where? e.g. Columbus, OH or Remote (optional)"
          value={location.value}
          onChange={(e) => setLocation({ value: e.target.value })}
        />
        <button className="btn" disabled={!hasResume || busy || noModel} onClick={find}>
          {busy ? "Looking..." : "Suggest roles"}
        </button>
      </div>

      {noModel && <NoModel feature="Role finder" />}

      {busy && <Loading message="Finding roles that fit you..." hint="This usually takes under a minute." />}

      {error && (
        <p role="alert" className="whitespace-pre-line rounded-lg border border-bad/40 bg-bad-soft p-3 text-sm text-bad">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-6">
          <p className="text-sm">{result.summary}</p>
          {result.roles.map((role) => (
            <section key={role.title} className="space-y-3 card p-5">
              <div className="flex flex-wrap items-baseline gap-3">
                <h2 className="text-lg font-semibold tracking-tight">{role.title}</h2>
                <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">{role.fit}</span>
              </div>
              <p className="text-sm">{role.whyItFits}</p>
              {role.transferableSkills.length > 0 && (
                <div className="text-sm">
                  <h3 className="font-medium">Skills that carry over</h3>
                  <p className="text-muted">{role.transferableSkills.join(", ")}</p>
                </div>
              )}
              {role.gaps.length > 0 && (
                <div className="text-sm">
                  <h3 className="font-medium">To close the gap</h3>
                  <ul className="list-disc pl-5 text-muted">
                    {role.gaps.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="text-muted">Search on</span>
                {searchLinks(role.searchTerms || role.title, location.value).map((l) => (
                  <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer" className="link">
                    {l.name}
                  </a>
                ))}
                <span className="ml-auto">
                  {saved.has(role.title) ? (
                    <Link href="/applications" className="link">
                      Saved to log
                    </Link>
                  ) : (
                    <button className="btn-secondary" onClick={() => saveToLog(role.title)}>
                      Save to log
                    </button>
                  )}
                </span>
              </div>
            </section>
          ))}
          {result.careerPaths.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-lg font-medium">Where this could lead</h2>
              <ul className="list-disc pl-5 text-sm">
                {result.careerPaths.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
