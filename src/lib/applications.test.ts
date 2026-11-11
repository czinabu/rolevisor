import { describe, expect, it } from "vitest";
import { addDays, ago, followUpIcs, isDue, newApplication, parseImport, toCsv } from "./applications";

describe("addDays", () => {
  it("adds across month and year ends", () => {
    expect(addDays("2026-11-11", 7)).toBe("2026-11-18");
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
    expect(addDays("2028-02-27", 2)).toBe("2028-02-29");
  });

  it("leaves a missing date empty", () => {
    expect(addDays("", 7)).toBe("");
  });
});

describe("isDue", () => {
  const app = newApplication({ company: "Acme", dateApplied: "2026-11-01", followUp: "2026-11-08" });

  it("is due on and after the follow-up date while waiting to hear", () => {
    expect(isDue(app, "2026-11-07")).toBe(false);
    expect(isDue(app, "2026-11-08")).toBe(true);
    expect(isDue({ ...app, status: "heard_back" }, "2026-11-20")).toBe(true);
  });

  it("stops once there's an answer or no date", () => {
    expect(isDue({ ...app, status: "interview" }, "2026-11-20")).toBe(false);
    expect(isDue({ ...app, status: "rejected" }, "2026-11-20")).toBe(false);
    expect(isDue({ ...app, followUp: "" }, "2026-11-20")).toBe(false);
  });
});

describe("ago", () => {
  it("reads naturally", () => {
    expect(ago("2026-11-11", "2026-11-11")).toBe("today");
    expect(ago("2026-11-10", "2026-11-11")).toBe("yesterday");
    expect(ago("2026-11-01", "2026-11-11")).toBe("10 days ago");
  });
});

describe("followUpIcs", () => {
  it("makes an all-day event on the follow-up date", () => {
    const ics = followUpIcs(
      newApplication({ id: "x1", company: "Bean, Leaf; Co", role: "Barista", followUp: "2026-11-18" }),
      new Date("2026-11-11T12:00:00Z"),
    );
    expect(ics).toContain("DTSTART;VALUE=DATE:20261118\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20261119\r\n");
    expect(ics).toContain("SUMMARY:Follow up: Barista at Bean\\, Leaf\\; Co\r\n");
    expect(ics).toContain("DTSTAMP:20261111T120000Z");
  });
});

describe("export and import", () => {
  const saved = newApplication({
    company: "Acme",
    role: "Analyst",
    resume: "## Experience\n- Did things",
    coverLetter: "Dear team,",
    jobPosting: "Analyst at Acme",
  });

  it("keeps the saved resume, letter and posting in a JSON backup", () => {
    const [back] = parseImport(JSON.stringify([saved]), "job-applications.json");
    expect(back).toEqual(saved);
  });

  it("reads older backups that have no saved files", () => {
    const [back] = parseImport(JSON.stringify([{ company: "Old Co", status: "Interview" }]), "a.json");
    expect(back).toMatchObject({ company: "Old Co", status: "interview", resume: "", coverLetter: "" });
  });

  it("keeps the CSV to the summary columns", () => {
    expect(toCsv([saved]).split("\r\n")[0]).toBe("company,role,link,dateApplied,status,followUp,notes");
  });
});
