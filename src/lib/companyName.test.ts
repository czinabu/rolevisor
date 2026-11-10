import { describe, expect, it } from "vitest";
import { downloadStem, guessCompany, slug } from "./companyName";
import { EXAMPLE_INPUTS } from "./example";

describe("guessCompany", () => {
  it("reads the LinkedIn-style line under the title", () => {
    expect(guessCompany(EXAMPLE_INPUTS.jobPosting)).toBe("Brightline Grocers");
  });

  it("reads a labeled company line", () => {
    expect(guessCompany("Data Analyst\nCompany: Acme Corp\nLocation: Remote")).toBe("Acme Corp");
  });

  it("reads 'Title at Company'", () => {
    expect(guessCompany("Software Engineer at Bank of America\n\nWhat you'll do")).toBe("Bank of America");
  });

  it("reads 'About Company' headings and skips 'About the role'", () => {
    expect(guessCompany("Barista\n\nAbout the role\nMake coffee.\n\nAbout Bean & Leaf\nWe roast.")).toBe(
      "Bean & Leaf",
    );
  });

  it("reads 'Company is hiring' and 'Join Company'", () => {
    expect(guessCompany("Nurse\n\nRiverside Health is hiring nurses.")).toBe("Riverside Health");
    expect(guessCompany("Cashier\n\nCome join Tasty Foods and grow with us.")).toBe("Tasty Foods");
  });

  it("returns empty when no company is named", () => {
    expect(guessCompany("Data Analyst\n\nWhat you'll do\n- Write SQL\n- Build dashboards")).toBe("");
  });
});

describe("downloadStem", () => {
  const resume = "Caleb Zinabu\ncaleb@example.com | Columbus, OH\n## Experience";

  it("names a resume after the person and company", () => {
    expect(downloadStem("resume", resume, "Brightline Grocers, Inc.")).toBe("caleb-zinabu-brightline-grocers");
  });

  it("names a cover letter after the company", () => {
    expect(downloadStem("letter", "Dear Hiring Manager,", "AT&T")).toBe("cover-letter-atandt");
  });

  it("falls back when no company is known", () => {
    expect(downloadStem("resume", resume, "")).toBe("caleb-zinabu-resume");
    expect(downloadStem("letter", "Dear Hiring Manager,", "  ")).toBe("cover-letter");
    expect(downloadStem("resume", "", "Acme")).toBe("my-acme");
  });

  it("slugs odd characters", () => {
    expect(slug("O’Neil & Sons LLC")).toBe("oneil-and-sons");
  });
});
