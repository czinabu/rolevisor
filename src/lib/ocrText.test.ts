import { describe, expect, it } from "vitest";
import { cleanOcrText } from "./ocrText";

describe("cleanOcrText", () => {
  it("turns misread bullet dots back into bullets", () => {
    const raw = "What you'll do\n\n« Own dashboards\n\n+ Design A/B tests\n\n* Write SQL\n\ne Present findings\n. Ship reports";
    expect(cleanOcrText(raw)).toBe(
      "What you'll do\n\n• Own dashboards\n• Design A/B tests\n• Write SQL\n• Present findings\n• Ship reports",
    );
  });

  it("leaves real words at the start of a line alone", () => {
    expect(cleanOcrText("a team player\no ring")).toBe("a team player\no ring");
  });

  it("rejoins a paragraph the screenshot wrapped", () => {
    const raw =
      "We're looking for a Senior Product Analyst to join our Care Navigation team. You'll partner\n" +
      "with product managers, engineers, and clinicians to turn messy data into clear decisions that\n" +
      "help patients get the right care faster.\n\nAbout you";
    expect(cleanOcrText(raw)).toBe(
      "We're looking for a Senior Product Analyst to join our Care Navigation team. You'll partner " +
        "with product managers, engineers, and clinicians to turn messy data into clear decisions that " +
        "help patients get the right care faster.\n\nAbout you",
    );
  });

  it("joins a bullet's second line but not the paragraph after it", () => {
    const raw =
      "• Strong SQL and Python (pandas, NumPy); experience with Tableau or Looker is\n" +
      "a plus for this role\n" +
      "• A bachelor's degree in Statistics, Economics, Computer Science, or equivalent\n" +
      "Benefits include 401(k) matching, 20 days of PTO, and a $1,500 learning stipend.";
    expect(cleanOcrText(raw)).toBe(
      "• Strong SQL and Python (pandas, NumPy); experience with Tableau or Looker is a plus for this role\n" +
        "• A bachelor's degree in Statistics, Economics, Computer Science, or equivalent\n" +
        "Benefits include 401(k) matching, 20 days of PTO, and a $1,500 learning stipend.",
    );
  });

  it("keeps short lines like headings on their own", () => {
    expect(cleanOcrText("Senior Product Analyst\nBrightline Health · Chicago")).toBe(
      "Senior Product Analyst\nBrightline Health · Chicago",
    );
  });
});
