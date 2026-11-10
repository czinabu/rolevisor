import { describe, expect, it } from "vitest";
import { coverLetterTask, withGreeting, withoutFunFacts } from "./coverLetter";

describe("withoutFunFacts", () => {
  it("drops a fun fact paragraph", () => {
    const letter = "Fun fact about me: I love pineapple on pizza.\n\nI built Inroad.\n\nBest regards,\nCaleb";
    expect(withoutFunFacts(letter)).toBe("I built Inroad.\n\nBest regards,\nCaleb");
  });

  it("leaves a normal letter alone", () => {
    const letter = "Dear Hiring Manager,\n\nThe fact is I sold 500 leads a day.\n\nSincerely,\nCaleb";
    expect(withoutFunFacts(letter)).toBe(letter);
  });
});

describe("withGreeting", () => {
  it("adds a greeting when the letter jumps straight in", () => {
    expect(withGreeting("My background fits.\n\nBest regards,")).toBe(
      "Dear Hiring Manager,\n\nMy background fits.\n\nBest regards,",
    );
  });

  it("keeps an existing greeting", () => {
    const letter = "Dear Ms. Lee,\n\nMy background fits.";
    expect(withGreeting(letter)).toBe(letter);
  });
});

describe("coverLetterTask.clean", () => {
  it("fixes the letter from the bug report", () => {
    const { letter } = coverLetterTask.clean!({
      letter: "Fun fact about me: I love pineapple on pizza.\n\nMy background building AI tools fits.\n\nBest regards,\nCaleb",
      notes: [],
    });
    expect(letter).toBe("Dear Hiring Manager,\n\nMy background building AI tools fits.\n\nBest regards,\nCaleb");
  });
});
