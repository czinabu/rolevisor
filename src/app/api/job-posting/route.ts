import { FriendlyError } from "@/lib/errors";
import { fetchJobPage } from "@/lib/fetchJobPage";

// Reads a job posting link for the browser, which can't read other sites' pages itself. Only the
// link comes here: never the resume, the API key, or anything else. Nothing is saved.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let url = "";
  try {
    const body = (await request.json()) as { url?: unknown };
    url = typeof body.url === "string" ? body.url.slice(0, 2000) : "";
  } catch {
    // Falls through to the "doesn't look like a web address" answer.
  }
  try {
    const page = await fetchJobPage(url);
    return Response.json(page, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message =
      error instanceof FriendlyError
        ? error.message
        : "Something went wrong reading that link. Paste the posting's text instead.";
    return Response.json({ error: message }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
