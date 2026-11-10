import { z } from "zod";
import type { Task } from "./tasks";
import { WRITING_STYLE, cleanAnswer } from "./writingStyle";

export const EDUCATION_STATUSES = {
  completed: "Finished",
  "in-progress": "Still in school",
  "did-not-finish": "Attended, didn't finish",
} as const;
export type EducationStatus = keyof typeof EDUCATION_STATUSES;

export const EducationSchema = z.object({
  school: z.string(),
  program: z.string(),
  status: z.enum(["", ...(Object.keys(EDUCATION_STATUSES) as EducationStatus[])]),
  dates: z.string(),
  coursework: z.string(),
});
export type Education = z.infer<typeof EducationSchema>;

export const EMPTY_EDUCATION: Education = {
  school: "",
  program: "",
  status: "",
  dates: "",
  coursework: "",
};

export const BackgroundSchema = z.object({
  targetRole: z.string(),
  experience: z.string(),
  skills: z.string(),
  notes: z.string(),
  // Optional so inputs saved before education existed still load.
  education: z.array(EducationSchema).optional(),
});
export type Background = z.infer<typeof BackgroundSchema>;

export const TailorRequestSchema = z.object({
  resume: z.string().trim().min(1, "Add your resume first."),
  background: BackgroundSchema,
  jobPosting: z.string().trim().min(1, "Paste the job posting first."),
});
export type TailorRequest = z.infer<typeof TailorRequestSchema>;

export const LINK_ADVICE = ["Recommended", "Optional", "Not needed"] as const;
export type LinkAdvice = (typeof LINK_ADVICE)[number];

export const TailorResultSchema = z.object({
  // No .int() or min/max: Claude's structured outputs don't support number limits.
  matchScore: z
    .number()
    .describe("How well the ORIGINAL resume fits the job, from 0 to 100."),
  summary: z
    .string()
    .describe("Two or three plain-English sentences on how well the person fits this job."),
  matchedSkills: z
    .array(z.string())
    .describe("Skills and requirements from the job posting that the person clearly has."),
  missingSkills: z
    .array(z.string())
    .describe(
      "Skills and requirements from the job posting that the resume and background don't show.",
    ),
  keywords: z
    .array(z.string())
    .describe(
      "The 10 to 20 most important words or short phrases an applicant tracking system would scan for, copied exactly as the job posting writes them.",
    ),
  tailoredResume: z
    .string()
    .describe(
      "The full rewritten resume as plain text, using '## ' for section headings and '- ' for bullets.",
    ),
  changes: z
    .array(
      z.object({
        change: z.string().describe("What was changed, in one short sentence."),
        reason: z.string().describe("Why it helps for this job, in one short sentence."),
      }),
    )
    .describe("The most important edits made to the resume, most important first."),
  educationAdvice: z
    .object({
      recommendation: z
        .enum(["Include", "Include briefly", "Leave off"])
        .describe("Whether education should be on the resume for this job."),
      placement: z
        .string()
        .describe(
          "Where the education section goes for this job (for example near the top, or at the bottom after experience) and why, in one or two sentences.",
        ),
      howToList: z
        .string()
        .describe(
          "Exactly how each education entry should read on the resume, as plain text lines. Empty if leaving education off.",
        ),
      coursework: z
        .string()
        .describe(
          "Whether to list relevant coursework for this job, and if so which courses and where, in one or two sentences.",
        ),
      reasoning: z
        .string()
        .describe(
          "Why this approach fits this job and the person's situation, in two or three plain-English sentences.",
        ),
    })
    .describe("Tailored advice on whether and how to show the person's education."),
  linkAdvice: z
    .object({
      linkedin: z
        .enum(LINK_ADVICE)
        .describe("Whether a LinkedIn profile link would help the resume for this job."),
      github: z
        .enum(LINK_ADVICE)
        .describe("Whether a GitHub profile link would help the resume for this job."),
      reason: z
        .string()
        .describe(
          "Why, in one plain-English sentence the person will read next to a box asking for the link.",
        ),
    })
    .describe("Whether the resume's contact line should carry LinkedIn and GitHub links for this job."),
});
export type TailorResult = z.infer<typeof TailorResultSchema>;

const SYSTEM = `You are an experienced career coach and resume writer. You help job seekers tailor their resume to a specific job posting so it gets past applicant tracking systems and convinces a hiring manager.

Honesty comes first. Everything in the tailored resume must be supported by the person's original resume or the background they gave you. Never invent employers, job titles, dates, degrees, certifications, numbers, or skills. You may:
- reorder sections and bullets so the most relevant experience comes first,
- rewrite bullets to lead with impact and use the job posting's wording where it truthfully describes what the person did,
- add a short summary at the top aimed at this role,
- bring in skills or experience from the background notes,
- trim or drop content that isn't relevant to this job.

If a metric would help but isn't given, don't make one up. Keep the person's contact details and keep the resume about the same length or shorter.

When you list missing skills, only include requirements the job actually asks for that the person's materials don't show. The match score rates the original resume, not your rewrite. List keywords whether or not the person has them; Rolevisor checks which ones each resume contains.

Education advice: decide whether and how the person should show their education for this specific job, using the education details they gave and what's on their resume. Follow the same choice in the tailored resume. Guidelines:
- If the job requires or strongly prefers a degree the person hasn't finished, be honest: never list an unfinished degree as earned. Show the time spent and what was learned instead, for example "Coursework toward B.S. Computer Science, State University, 2021–2023" or "Completed 90 credits toward B.A. Economics".
- If the job doesn't ask for a degree and the person has solid work experience, education usually goes at the bottom, briefly, or can be left off when it's unfinished and unrelated.
- For people early in their career, career changers into a field they studied, or students, education and relevant coursework can go near the top.
- Suggest relevant coursework only when it matches the job's requirements and the person lacks work experience that already proves those skills. Pick only courses the person gave you or that are on their resume.
- For people still in school, list the expected graduation date, for example "B.S. Nursing, expected May 2027".
- If the person gave no education details and the resume has none, recommend leaving it off unless the job requires it, and say what they could add.

Profile links: say whether LinkedIn and GitHub links would help for this job. LinkedIn is "Recommended" for most professional and office jobs, and "Optional" for hourly, trade, or in-person roles where recruiters rarely look. GitHub is "Recommended" for software, data, machine learning, DevOps, and other roles where hiring managers look at code, "Optional" for roles that only touch code (technical support, product, design, IT), and "Not needed" otherwise. Rolevisor asks the person for any link that's missing and adds it to the contact line itself, so in the tailored resume:
- never write, guess, or shorten a profile URL; copy one only if it's in the original resume exactly,
- keep the words "LinkedIn" or "GitHub" in the contact line if the original has them,
- don't add those words when the original doesn't have them.
Project links work the same way: Rolevisor asks for each project's live demo and code addresses and links them when the resume is downloaded. Keep words like "Live demo" or "GitHub repo" next to a project if the original has them, keep each project's name as the original writes it, and never write or guess a project URL.

The tailored resume follows the writing style below too: start bullets with plain, specific action verbs (led, built, cut, trained, ran) instead of buzzwords, and keep the summary to concrete facts about the person rather than adjectives like "dynamic" or "results-driven". Keep the original resume's own wording where it's already good. For dates, use the same style as the original resume.

${WRITING_STYLE}`;

function userPrompt({ resume, background, jobPosting }: TailorRequest): string {
  const about = [
    background.targetRole && `Target role: ${background.targetRole}`,
    background.experience && `Years of experience: ${background.experience}`,
    background.skills && `Other skills: ${background.skills}`,
    background.notes && `Other notes: ${background.notes}`,
  ].filter(Boolean);

  const education = (background.education ?? [])
    .filter((e) => e.school.trim() || e.program.trim() || e.coursework.trim())
    .map((e) =>
      [
        `- School: ${e.school.trim() || "(not given)"}`,
        e.program.trim() && `  Degree or program: ${e.program.trim()}`,
        e.status && `  Status: ${EDUCATION_STATUSES[e.status]}`,
        e.dates.trim() && `  Dates: ${e.dates.trim()}`,
        e.coursework.trim() && `  Relevant coursework: ${e.coursework.trim()}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );

  return `<resume>
${resume.trim()}
</resume>

<background>
${about.length ? about.join("\n") : "(none given)"}
</background>

<education>
${education.length ? education.join("\n") : "(none given beyond the resume)"}
</education>

<job_posting>
${jobPosting.trim()}
</job_posting>

Tailor this resume for the job posting above.`;
}

// Type-only import of Task keeps tasks.ts -> tailor.ts free of an import cycle.
export const tailorTask: Task<TailorRequest, TailorResult> = {
  // Rewriting a whole resume is the app's most demanding task, so it gets the main (big-job) model.
  weight: "heavy",
  system: SYSTEM,
  user: userPrompt,
  input: TailorRequestSchema,
  output: TailorResultSchema,
  // Keywords are copied from the posting and must match it exactly.
  clean: (result) => cleanAnswer(result, { keep: ["keywords"], resume: ["tailoredResume"] }),
};

// The keyword check lives with the rest of the keyword matching; kept here for existing imports.
export { hasKeyword } from "./keywordMatch";
