import { describe, expect, it } from "vitest";
import { entryAt, parseEntryLine, parseResumeText, resumeForTemplate } from "./resumeDoc";

// A tailored resume whose headings came back without '## ', as in a real download that lost its styling.
const NO_MARKERS = `Caleb Zinabu
Wichita, KS • (316) 765-5041 • caleb@example.com • LinkedIn • GitHub • Portfolio
Professional Summary
Outbound sales professional with experience in high-volume prospecting, lead generation, and consultative customer conversations. Technical background in computer engineering.
Experience
Sunrun - Sales Development Representative (Remote) | June 2026 - Present
- Executed high-volume B2C calling in a predictive dialing environment (Five9).
- Achieved KPIs for October: 169 appointments set and 16 customer signatures.
Fidelity Bank - Senior Contact Center Banker | September 2024 - September 2025
- Mentored new hires on communication best practices and compliance protocols.
**Selected Technical Projects**
Rolevisor | AI-Powered Job Search Platform - GitHub | Live Demo
- Developed an AI application that tailors resumes to job postings.`;

describe("resumeForTemplate", () => {
  it("restores section headings the model wrote as plain or bold lines", () => {
    const blocks = parseResumeText(resumeForTemplate(NO_MARKERS));
    expect(blocks.filter((b) => b.kind === "heading").map((b) => b.text)).toEqual([
      "Professional Summary",
      "Experience",
      "Selected Technical Projects",
    ]);
    expect(blocks.filter((b) => b.kind === "contact")).toHaveLength(1);
    const entries = blocks.filter((b) => b.kind === "text" && parseEntryLine(b.text));
    expect(entries.map((b) => parseEntryLine(b.text)!.company)).toEqual(["Sunrun", "Fidelity Bank"]);
    expect(blocks.filter((b) => b.kind === "bullet")).toHaveLength(4);
  });

  it("leaves a resume that already has '## ' headings alone", () => {
    const text = "Sam Ortega\nsam@example.com\n\n## Experience\nAcme - Analyst | 2021 - 2023\n- Built reports";
    expect(resumeForTemplate(text)).toBe(text);
  });
});

describe("entryAt", () => {
  it("gives a project line above bullets a bold name, even with no dates", () => {
    const blocks = parseResumeText(resumeForTemplate(NO_MARKERS));
    const i = blocks.findIndex((b) => b.text.startsWith("Rolevisor"));
    expect(entryAt(blocks, i)).toEqual({ company: "Rolevisor", role: "AI-Powered Job Search Platform - GitHub | Live Demo", dates: "" });
  });

  it("leaves a sentence or a line with no bullets under it as plain text", () => {
    const blocks = parseResumeText("Sam\n## Summary\nAnalyst who builds reports - fast.\n## Skills\nExcel | SQL");
    expect(entryAt(blocks, 2)).toBeNull();
    expect(entryAt(blocks, 4)).toBeNull();
  });
});
