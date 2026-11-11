import { describe, expect, it } from "vitest";
import { fromJsonLd, htmlToText, isJustALink, parseJobUrl, planFetch, postingText, readHtml } from "./jobLink";
import { guessCompany } from "./companyName";

const LONG = "You will build dashboards in SQL and Tableau for our operations team. ".repeat(5);

describe("parseJobUrl", () => {
  it("accepts links with or without https", () => {
    expect(parseJobUrl("jobs.lever.co/acme/123")?.href).toBe("https://jobs.lever.co/acme/123");
    expect(parseJobUrl(" https://acme.com/careers/1 ")?.hostname).toBe("acme.com");
  });
  it("rejects things that aren't public web links", () => {
    for (const bad of ["", "hello world", "file:///etc/passwd", "javascript:alert(1)", "http://localhost:3000", "https://user:pw@acme.com"]) {
      expect(parseJobUrl(bad)).toBeNull();
    }
  });
  it("spots a pasted link", () => {
    expect(isJustALink("https://boards.greenhouse.io/acme/jobs/1")).toBe(true);
    expect(isJustALink("Data Analyst at Acme\nhttps://acme.com")).toBe(false);
  });
});

describe("planFetch", () => {
  it("uses the Greenhouse API", () => {
    const plan = planFetch(new URL("https://job-boards.greenhouse.io/acme/jobs/4567?gh_src=x"));
    expect(plan.url).toBe("https://boards-api.greenhouse.io/v1/boards/acme/jobs/4567");
    const page = plan.read!({
      title: "Data Analyst",
      company_name: "Acme Corp",
      location: { name: "Columbus, OH" },
      content: "&lt;p&gt;We need SQL.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Tableau&lt;/li&gt;&lt;li&gt;Excel&lt;/li&gt;&lt;/ul&gt;",
    });
    expect(page).toEqual({
      title: "Data Analyst",
      company: "Acme Corp",
      location: "Columbus, OH",
      description: "We need SQL.\n\n- Tableau\n- Excel",
    });
  });
  it("uses the Lever API", () => {
    const plan = planFetch(new URL("https://jobs.lever.co/bright-line/abc-123/apply"));
    expect(plan.url).toBe("https://api.lever.co/v0/postings/bright-line/abc-123");
    const page = plan.read!({
      text: "Analyst",
      categories: { location: "Remote", commitment: "Full-time" },
      descriptionPlain: "About the role.",
      lists: [{ text: "Requirements", content: "<li>SQL</li><li>Python</li>" }],
      additionalPlain: "Benefits too.",
    });
    expect(page?.company).toBe("Bright Line");
    expect(page?.description).toBe("About the role.\n\nRequirements\n- SQL\n- Python\n\nBenefits too.");
  });
  it("uses the Ashby API and finds the job", () => {
    const plan = planFetch(new URL("https://jobs.ashbyhq.com/acme/j-2"));
    expect(plan.url).toBe("https://api.ashbyhq.com/posting-api/job-board/acme");
    const page = plan.read!({ jobs: [{ id: "j-1", title: "Other" }, { id: "j-2", title: "Analyst", location: "NYC", descriptionPlain: "SQL" }] });
    expect(page?.title).toBe("Analyst");
  });
  it("uses LinkedIn's guest page for a job id", () => {
    expect(planFetch(new URL("https://www.linkedin.com/jobs/view/data-analyst-at-acme-4012345678/")).url).toBe(
      "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4012345678",
    );
    expect(planFetch(new URL("https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4012345678")).url).toBe(
      "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4012345678",
    );
  });
  it("reads any other page as it is", () => {
    expect(planFetch(new URL("https://careers.acme.com/jobs/1")).kind).toBe("html");
  });
});

describe("reading pages", () => {
  it("prefers the schema.org JobPosting", () => {
    const html = `<html><head><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Organization", name: "x" },
        {
          "@type": "JobPosting",
          title: "Data Analyst",
          hiringOrganization: { "@type": "Organization", name: "Brightline Grocers" },
          jobLocation: { address: { addressLocality: "Columbus", addressRegion: "OH" } },
          description: `<p>${LONG}</p><ul><li>SQL</li></ul>`,
        },
      ],
    })}</script></head><body><nav>Menu</nav></body></html>`;
    const page = fromJsonLd(html)!;
    expect(page.company).toBe("Brightline Grocers");
    expect(page.location).toBe("Columbus, OH");
    expect(page.description).toContain("- SQL");
  });
  it("falls back to the main text, without menus or scripts", () => {
    const html = `<html><head><meta property="og:title" content="Analyst &amp; Planner"><script>var x = 1;</script></head>
      <body><nav>Home Jobs</nav><main><h1>Analyst</h1><p>${LONG}</p></main><footer>© Acme</footer></body></html>`;
    const page = readHtml(html, "acme.com")!;
    expect(page.title).toBe("Analyst & Planner");
    expect(page.description.startsWith("Analyst\n\nYou will build")).toBe(true);
    expect(page.description).not.toMatch(/Home Jobs|var x|© Acme/);
  });
  it("reads LinkedIn's guest page", () => {
    const html = `<section><h2 class="top-card-layout__title topcard__title">Data Analyst</h2>
      <a class="topcard__org-name-link topcard__flavor--black-link" href="#">Acme</a>
      <div class="show-more-less-html__markup"><p>${LONG}</p><div>nested</div></div><div>Similar jobs</div></section>`;
    const page = readHtml(html, "LinkedIn")!;
    expect(page.title).toBe("Data Analyst");
    expect(page.company).toBe("Acme");
    expect(page.description).toContain("nested");
    expect(page.description).not.toContain("Similar jobs");
  });
  it("turns HTML into readable text", () => {
    expect(htmlToText("<p>One&nbsp;two</p><p>Three &#8211; four</p><ul><li>a</li>\n<li>b</li></ul>")).toBe(
      "One two\n\nThree – four\n\n- a\n- b",
    );
  });
  it("puts the company where the download names look for it", () => {
    const text = postingText({ title: "Data Analyst", company: "Brightline Grocers", location: "Remote", description: LONG });
    expect(text.split("\n").slice(0, 3)).toEqual(["Data Analyst", "Company: Brightline Grocers", "Location: Remote"]);
    expect(guessCompany(text)).toBe("Brightline Grocers");
  });
});
