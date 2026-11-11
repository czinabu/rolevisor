// Shared between the browser and the server, so keep this file free of
// Node-only imports.

export type ProviderId = "claude" | "lmstudio" | "ollama";

export interface ModelSettings {
  provider: ProviderId;
  /** Only used for Claude: the visitor's own Anthropic API key. */
  apiKey: string;
  /** Only used for local models, e.g. http://localhost:1234/v1 */
  baseUrl: string;
  /** The model for heavy work, like rewriting a whole resume. */
  model: string;
  /**
   * Claude only: a cheaper model for light work, like short suggestions.
   * Local providers always use `model`.
   */
  quickModel: string;
  /** Claude only: run every task on the cheapest model (Haiku). */
  budgetMode: boolean;
}

/** The model Budget mode runs everything on. */
export const BUDGET_MODEL = "claude-haiku-5-5";

/**
 * Rough cost of one typical run (about 3,000 words in, 2,000 out, plus some
 * thinking), from Anthropic's per-million-token prices:
 * Opus 5.5 $4 in / $20 out, Sonnet 5.5 $2 / $10, Haiku 5.5 $0.10 / $0.50.
 */
export const COST_ESTIMATE = {
  /** One resume tailoring on the default big-jobs model (Sonnet). */
  tailoring: "about 1 to 3 cents",
  /** One resume tailoring if the person switches big jobs to Opus. */
  opusTailoring: "about 3 to 6 cents",
  /** Tailoring plus cover letter, suggestions, and formatting review, on the defaults. */
  fullApplication: "about 2 to 5 cents",
  /** How many default tailorings $5 of credit covers. */
  perFiveDollars: "roughly 150 to 500",
  /** One tailoring in Budget mode (Haiku). */
  budgetTailoring: "a fifth of a cent or less",
};

export const BUDGET_COST_ESTIMATE = {
  normal: "about 1 to 3 cents for big jobs, under half a cent for quick ones",
  budget: "about a fifth of a cent or less",
};

/** How demanding a task is, which decides the Claude model it runs on. */
export type TaskWeight = "heavy" | "light";

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  description: string;
  defaultBaseUrl: string;
  defaultModel: string;
  defaultQuickModel: string;
  isLocal: boolean;
}

export const PROVIDERS: Record<ProviderId, ProviderInfo> = {
  claude: {
    id: "claude",
    label: "Claude (Anthropic API)",
    description:
      "Best quality. Needs an Anthropic API key, and each request costs a small amount.",
    defaultBaseUrl: "",
    defaultModel: "claude-sonnet-5-5",
    defaultQuickModel: "claude-haiku-5-5",
    isLocal: false,
  },
  lmstudio: {
    id: "lmstudio",
    label: "LM Studio (local, free)",
    description:
      "Runs a model on your own computer. Free and private, but you need to install LM Studio first.",
    defaultBaseUrl: "http://localhost:1234/v1",
    defaultModel: "",
    defaultQuickModel: "",
    isLocal: true,
  },
  ollama: {
    id: "ollama",
    label: "Ollama (local, free)",
    description:
      "Runs a model on your own computer. Free and private, but you need to install Ollama first.",
    defaultBaseUrl: "http://localhost:11434/v1",
    defaultModel: "",
    defaultQuickModel: "",
    isLocal: true,
  },
};

export function defaultSettings(provider: ProviderId = "claude"): ModelSettings {
  const info = PROVIDERS[provider];
  return {
    provider,
    apiKey: "",
    baseUrl: info.defaultBaseUrl,
    model: info.defaultModel,
    quickModel: info.defaultQuickModel,
    budgetMode: false,
  };
}

export interface TestConnectionResult {
  ok: boolean;
  message: string;
  models: string[];
}

/** localStorage key for the user's model settings. */
export const SETTINGS_KEY = "job-helper:settings";

/**
 * Whether the AI features are out of reach: Claude is picked but no API key
 * has been added. Local models need no key, so they count as set up (a wrong
 * server address still shows its own error when a task runs). Every card that
 * calls a model checks this the same way, so the free parts keep working and
 * the AI parts say what to set up instead of failing.
 */
export function needsModel(settings: ModelSettings): boolean {
  return !PROVIDERS[settings.provider].isLocal && !settings.apiKey.trim();
}

/** What works with no API key and no local model. Shown on Settings and Tailor. */
export const FREE_FEATURES = [
  "Reading resumes from PDF, Word, or text, and job postings from links or screenshots",
  "The keyword match score against a job posting",
  "The formatting and spacing score on the Tailor page",
  "The application log, with CSV and JSON import and export",
  "The example results page",
];

/** What needs a Claude API key or a local model. */
export const MODEL_FEATURES = [
  "The tailored resume, match score, and keyword check",
  "Suggestions and the expert-style formatting review",
  "Cover letters",
  "Role finder",
];
