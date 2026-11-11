"use client";

import { Loading } from "@/components/Loading";
import { runTask } from "@/lib/ai";
import { useRequest } from "@/lib/useRequest";
import { NoModel } from "@/components/FreeLabel";
import { needsModel, type ModelSettings } from "@/lib/providers";
import type { SuggestionsResult } from "@/lib/suggestions";
import type { Background } from "@/lib/tailor";

const BADGE: Record<string, string> = {
  High: "text-bad bg-bad-soft",
  Medium: "text-accent bg-accent-soft",
  Low: "text-muted bg-background",
};

function Priority({ level }: { level: string }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[level] ?? BADGE.Low}`}>
      {level}
    </span>
  );
}

/** Prioritized advice for this job: bullets to strengthen, gaps to address, what to emphasize. */
export function SuggestionsCard({
  resume,
  background,
  jobPosting,
  settings,
  initial,
}: {
  resume: string;
  background: Background;
  jobPosting: string;
  settings: ModelSettings;
  /** Suggestions already made, e.g. by "Get everything". */
  initial?: SuggestionsResult;
}) {
  const request = useRequest<SuggestionsResult>();
  const { busy, error } = request;
  const result = request.data ?? initial ?? null;

  // A refresh keeps the current suggestions on screen until the new ones arrive.
  const run = () =>
    request.run(() => runTask<SuggestionsResult>(settings, "suggestions", { resume, background, jobPosting }), {
      keep: true,
    });

  return (
    <section className="space-y-4 card p-5">
      <h2 className="text-lg font-medium">Suggestions for this job</h2>
      <p className="text-sm text-muted">
        The changes most worth making first: bullets to strengthen, gaps to address, and what to
        emphasize. Rewrites only use what you&apos;ve told Rolevisor.
      </p>
      {needsModel(settings) ? (
        <NoModel feature="Written suggestions" compact />
      ) : (
        <button className="btn" disabled={busy} onClick={run}>
          {busy ? "Thinking..." : result ? "Refresh suggestions" : "Get suggestions"}
        </button>
      )}
      {busy && <Loading message="Looking for the changes worth making..." hint="This usually takes under a minute." />}
      {error && <p role="alert" className="whitespace-pre-line text-sm text-bad">{error}</p>}

      {result && <SuggestionsList result={result} />}
    </section>
  );
}

/** The suggestions themselves, also used by the example page. */
export function SuggestionsList({ result }: { result: SuggestionsResult }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="font-medium">Bullets to strengthen</h3>
        {result.bullets.length === 0 && <p className="text-sm text-muted">Nothing needs changing here.</p>}
        {result.bullets.map((b, i) => (
          <div key={i} className="space-y-1 rounded-md border border-line p-3 text-sm">
            <Priority level={b.priority} />
            <p className="text-muted line-through">{b.original}</p>
            <p>{b.rewrite}</p>
            <p className="text-xs text-muted">{b.why}</p>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <h3 className="font-medium">Gaps to address</h3>
        {result.gaps.length === 0 && <p className="text-sm text-muted">No clear gaps found.</p>}
        {result.gaps.map((g, i) => (
          <div key={i} className="space-y-1 rounded-md border border-line p-3 text-sm">
            <Priority level={g.priority} />
            <p className="font-medium">{g.gap}</p>
            <p className="text-muted">{g.howToAddress}</p>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <h3 className="font-medium">What to emphasize</h3>
        {result.emphasize.length === 0 && <p className="text-sm text-muted">Nothing specific.</p>}
        {result.emphasize.map((p, i) => (
          <div key={i} className="space-y-1 rounded-md border border-line p-3 text-sm">
            <Priority level={p.priority} />
            <p className="font-medium">{p.point}</p>
            <p className="text-muted">{p.how}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
