import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (host: string) => [{ address: host === "intranet.example.com" ? "10.0.0.5" : "93.184.216.34", family: 4 }]),
}));

const { fetchJobPage, isPrivateAddress } = await import("./fetchJobPage");

afterEach(() => vi.unstubAllGlobals());

describe("isPrivateAddress", () => {
  it("knows private and public addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "::1", "fd00::1", "::ffff:127.0.0.1"]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    for (const ip of ["93.184.216.34", "8.8.8.8", "2606:4700::1111"]) expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe("fetchJobPage", () => {
  it("reads a Greenhouse posting through its API", async () => {
    const fetch = vi.fn(async () =>
      Response.json({ title: "Analyst", company_name: "Acme", location: { name: "Remote" }, content: `&lt;p&gt;${"SQL and Tableau. ".repeat(20)}&lt;/p&gt;` }),
    );
    vi.stubGlobal("fetch", fetch);
    const page = await fetchJobPage("https://boards.greenhouse.io/acme/jobs/123");
    expect(String((fetch.mock.calls[0] as unknown[])[0])).toBe("https://boards-api.greenhouse.io/v1/boards/acme/jobs/123");
    expect(page.text.startsWith("Analyst\nCompany: Acme\nLocation: Remote\n\nSQL and Tableau.")).toBe(true);
    expect(page.site).toBe("Greenhouse");
  });

  it("won't follow a redirect into a private network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://intranet.example.com/" } })));
    await expect(fetchJobPage("https://acme.com/job")).rejects.toThrow(/private address/);
  });

  it("explains sites that block reading", async () => {
    await expect(fetchJobPage("https://www.indeed.com/viewjob?jk=1")).rejects.toThrow(/Indeed doesn't let/);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 403 })));
    await expect(fetchJobPage("https://www.linkedin.com/jobs/view/4012345678")).rejects.toThrow(/LinkedIn didn't let/);
  });

  it("says when a page has no posting on it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html><body><div id=app></div></body></html>", { headers: { "content-type": "text/html" } })));
    await expect(fetchJobPage("https://careers.acme.com/1")).rejects.toThrow(/couldn't find a job posting/);
  });
});
