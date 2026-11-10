import { describe, expect, it } from "vitest";
import { addProjectLinks, findProjects } from "./projectLinks";

const RESUME = `Caleb Example
caleb@example.com | GitHub

## Skills
- Git, GitHub, TypeScript

## Projects
Rolevisor | Live demo | GitHub repo
- Built a resume tailoring tool with Next.js
Budget Buddy - Claude Code plugin | 2025
- Tracks spending

## Education
State University | 2024`;

describe("findProjects", () => {
  it("finds project lines and the link words on them", () => {
    const projects = findProjects(RESUME);
    expect(projects.map((p) => p.name)).toEqual(["Rolevisor", "Budget Buddy"]);
    expect(projects[0].words).toEqual({ demo: "Live demo", code: "GitHub repo" });
    // "Code" inside "Claude Code plugin" isn't a link word.
    expect(projects[1].words).toEqual({});
  });

  it("uses bullets with a short name when the section has no title lines", () => {
    const projects = findProjects("Name\n\n## Projects\n- Rolevisor: built a resume tool (Live demo, GitHub)\n- Wrote lots of tests for things");
    expect(projects.map((p) => p.name)).toEqual(["Rolevisor"]);
    expect(projects[0].words).toEqual({ demo: "Live demo", code: "GitHub" });
  });

  it("notes links already written out", () => {
    const [p] = findProjects("Name\n\n## Projects\nRolevisor | rolevisor.com | github.com/me/rolevisor");
    expect(p.linked.sort()).toEqual(["code", "demo"]);
  });
});

describe("addProjectLinks", () => {
  it("links the words next to each project", () => {
    const out = addProjectLinks(RESUME, {
      rolevisor: { demo: "rolevisor.app", code: "github.com/me/rolevisor" },
    });
    expect(out).toContain("Rolevisor | [Live demo](https://rolevisor.app) | [GitHub repo](https://github.com/me/rolevisor)");
    // The skills line and contact line are left alone.
    expect(out).toContain("- Git, GitHub, TypeScript");
    expect(out).toContain("caleb@example.com | GitHub");
  });

  it("adds missing links before the dates", () => {
    const out = addProjectLinks(RESUME, { "budget buddy": { demo: "", code: "https://github.com/me/budget" } });
    expect(out).toContain("Budget Buddy - Claude Code plugin | [GitHub](https://github.com/me/budget) | 2025");
  });

  it("adds missing links after a bullet project's name", () => {
    const out = addProjectLinks("Name\n\n## Projects\n- Rolevisor: built a resume tool", {
      rolevisor: { demo: "rolevisor.app", code: "" },
    });
    expect(out).toContain("- Rolevisor ([Live demo](https://rolevisor.app)): built a resume tool");
  });

  it("matches a project whose name changed a little", () => {
    const out = addProjectLinks("Name\n\n## Projects\nRolevisor App | Demo", { rolevisor: { demo: "rolevisor.app", code: "" } });
    expect(out).toContain("Rolevisor App | [Demo](https://rolevisor.app)");
  });

  it("skips invalid addresses and leaves text alone with no links saved", () => {
    expect(addProjectLinks(RESUME, { rolevisor: { demo: "not a url", code: "" } })).toBe(RESUME);
    expect(addProjectLinks(RESUME, {})).toBe(RESUME);
  });
});
