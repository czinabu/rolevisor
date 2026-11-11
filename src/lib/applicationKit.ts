"use client";

import { runTask } from "./ai";
import type { CoverLetterResult } from "./coverLetter";
import { friendlyMessage } from "./errors";
import { PROVIDERS, type ModelSettings } from "./providers";
import type { SuggestionsResult } from "./suggestions";
import type { TailorRequest, TailorResult } from "./tailor";

/** Everything for one job from one click: the tailored resume, a cover letter, and advice. */
export interface ApplicationKit {
  result: TailorResult;
  letter?: CoverLetterResult;
  suggestions?: SuggestionsResult;
  /** What couldn't be made, to show beside the rest. Each can be retried from its own tab. */
  problems: string[];
}

export type KitStep = "tailor" | "letter" | "suggestions";

export const KIT_STEPS: Record<KitStep, string> = {
  tailor: "Tailoring your resume",
  letter: "Writing your cover letter",
  suggestions: "Finding what to improve",
};

/**
 * Runs the three model tasks for one job. With Claude they run side by side. A local model
 * answers one request at a time anyway (and running them together can run it out of memory), so
 * they run in turn and `onStep` says which one is going. The resume is the one that matters: if
 * it fails, the whole thing fails; if the letter or advice fails, the rest is still shown.
 */
export async function makeApplicationKit(
  settings: ModelSettings,
  inputs: TailorRequest,
  onStep?: (step: KitStep, index: number) => void,
): Promise<ApplicationKit> {
  const tailor = () => runTask<TailorResult>(settings, "tailor", inputs);
  const letter = () =>
    runTask<CoverLetterResult>(settings, "coverLetter", { ...inputs, tone: "professional", length: "standard" });
  const suggestions = () => runTask<SuggestionsResult>(settings, "suggestions", inputs);

  const problems: string[] = [];
  const settle = async <T>(what: string, work: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await work();
    } catch (error) {
      problems.push(`${what}: ${friendlyMessage(error)} Try again from its tab.`);
      return undefined;
    }
  };

  if (PROVIDERS[settings.provider].isLocal) {
    onStep?.("tailor", 0);
    const result = await tailor();
    onStep?.("letter", 1);
    const letterResult = await settle("The cover letter wasn't written", letter);
    onStep?.("suggestions", 2);
    const suggestionsResult = await settle("The suggestions weren't made", suggestions);
    return { result, letter: letterResult, suggestions: suggestionsResult, problems };
  }

  onStep?.("tailor", 0);
  const [result, letterResult, suggestionsResult] = await Promise.all([
    tailor(),
    settle("The cover letter wasn't written", letter),
    settle("The suggestions weren't made", suggestions),
  ]);
  return { result, letter: letterResult, suggestions: suggestionsResult, problems };
}
