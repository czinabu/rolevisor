"use client";

import { FriendlyError } from "./errors";

export interface ReadLink {
  /** What goes in the job posting box. */
  text: string;
  title: string;
  company: string;
  /** Where it was read from, like "Greenhouse" or "acme.com". */
  site: string;
}

/**
 * Asks the Rolevisor server to read a job posting link, since a browser can't read another site's
 * page. Only the link is sent. Works the same with Claude, a local model, or no model at all.
 */
export async function readJobLink(url: string): Promise<ReadLink> {
  let res: Response;
  try {
    res = await fetch("/api/job-posting", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  } catch {
    throw new FriendlyError(
      "Couldn't reach Rolevisor to read the link. Check your connection, or paste the posting's text instead.",
    );
  }
  const data = (await res.json().catch(() => null)) as (ReadLink & { error?: string }) | null;
  if (!res.ok || !data || data.error) {
    throw new FriendlyError(data?.error ?? "Couldn't read that link. Paste the posting's text instead.");
  }
  return data;
}
