"use client";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { FriendlyError } from "./errors";
import { BUDGET_MODEL, type ModelSettings, type TaskWeight } from "./providers";
import type { Task } from "./tasks";

// Claude is called straight from the visitor's browser with their own API
// key, so the key and the resume never pass through our server. There is no
// shared key. Local models never come through here.

function claudeClient(settings: ModelSettings) {
  const apiKey = settings.apiKey.trim();
  if (!apiKey) {
    throw new FriendlyError(
      "No Claude API key found. Paste your key from console.anthropic.com into the API key box.",
    );
  }
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

function claudeError(error: unknown): FriendlyError {
  if (error instanceof FriendlyError) return error;
  if (error instanceof Anthropic.AuthenticationError) {
    return new FriendlyError(
      "Claude rejected the API key. Check that you copied the whole key from console.anthropic.com.",
    );
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return new FriendlyError(
      "This API key isn't allowed to use that model. Check your Anthropic account's plan and billing.",
    );
  }
  if (error instanceof Anthropic.NotFoundError) {
    return new FriendlyError(
      "Claude doesn't recognize that model name. Pick one from the list after testing the connection.",
    );
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new FriendlyError(
      "Claude is rate limiting this key right now. Wait a minute and try again.",
    );
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new FriendlyError("Couldn't reach Claude's servers. Check your internet connection.");
  }
  if (error instanceof Anthropic.APIError) {
    return new FriendlyError(`Claude returned an error (${error.status}). Try again in a moment.`);
  }
  return new FriendlyError("Something went wrong talking to Claude. Try again in a moment.");
}

export async function listClaudeModels(settings: ModelSettings): Promise<string[]> {
  try {
    const client = claudeClient(settings);
    const ids: string[] = [];
    for await (const model of client.models.list()) ids.push(model.id);
    return ids;
  } catch (error) {
    throw claudeError(error);
  }
}

/**
 * Budget mode runs everything on Haiku. Otherwise only heavy tasks use the
 * main model; light ones use the cheaper quick model.
 */
function modelFor(settings: ModelSettings, weight: TaskWeight): string {
  if (settings.budgetMode) return BUDGET_MODEL;
  if (weight === "light") return settings.quickModel.trim() || settings.model.trim();
  return settings.model.trim();
}

export async function runClaudeTask<Input, Output>(
  settings: ModelSettings,
  task: Task<Input, Output>,
  input: Input,
): Promise<Output> {
  const model = modelFor(settings, task.weight);
  if (!model) throw new FriendlyError("Pick a model in Model settings first.");

  try {
    const client = claudeClient(settings);
    const message = await client.messages.parse({
      model,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: zodOutputFormat(task.output) },
      system: task.system,
      messages: [{ role: "user", content: task.user(input) }],
    });
    if (message.stop_reason === "refusal") {
      throw new FriendlyError("Claude declined this request. Try rewording it.");
    }
    if (message.stop_reason === "max_tokens" || !message.parsed_output) {
      throw new FriendlyError("Claude's answer was cut off. Try a shorter resume or job posting.");
    }
    return message.parsed_output;
  } catch (error) {
    throw claudeError(error);
  }
}

const READ_SCREENSHOT_SYSTEM = `You copy the text of job postings out of screenshots, word for word.
Copy only the job posting itself: the job title, company, location, pay, and the full description with every section and bullet.
Leave out everything else on the screen, such as menus, buttons, ads, other job listings, cookie banners, and the phone's status bar.
Keep the posting's order, headings, and paragraphs. Write each bullet point on its own line starting with "• ".
Do not fix, summarize, reword, or add anything. If a word is cut off or unreadable, copy what is visible.
Reply with the posting's text only, with no introduction or comments. If the images contain no job posting text, reply with exactly: NO_TEXT`;

/**
 * Reads a job posting screenshot with Claude, which is far more accurate than
 * the free in-browser reader. Copying text is light work, so it runs on the
 * quick model.
 */
export async function readScreenshotWithClaude(
  settings: ModelSettings,
  pieces: { mediaType: "image/png" | "image/jpeg"; data: string }[],
): Promise<string> {
  const model = modelFor(settings, "light");
  if (!model) throw new FriendlyError("Pick a model in Model settings first.");

  try {
    const client = claudeClient(settings);
    const intro =
      pieces.length > 1
        ? `These ${pieces.length} images are one tall screenshot cut into pieces, top to bottom. Copy the job posting from them as one text.`
        : "Copy the job posting from this screenshot.";
    const message = await client.messages.create({
      model,
      max_tokens: 16000,
      output_config: { effort: "low" },
      system: READ_SCREENSHOT_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            ...pieces.map((piece) => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: piece.mediaType, data: piece.data },
            })),
            { type: "text" as const, text: intro },
          ],
        },
      ],
    });
    if (message.stop_reason === "refusal") {
      throw new FriendlyError("Claude declined to read that screenshot.");
    }
    const text = message.content
      .flatMap((block) => (block.type === "text" ? [block.text] : []))
      .join("")
      .trim();
    return text === "NO_TEXT" ? "" : text;
  } catch (error) {
    throw claudeError(error);
  }
}
