import { z } from "zod";
import { BackgroundSchema, EDUCATION_STATUSES } from "./tailor";
import type { Task } from "./tasks";
import { WRITING_STYLE, cleanAnswer } from "./writingStyle";

export const TONES = {
  professional: "Professional",
  warm: "Warm and personable",
  confident: "Confident and direct",
  enthusiastic: "Enthusiastic",
} as const;
export type Tone = keyof typeof TONES;

export const LENGTHS = {
  short: "Short (about 150 words)",
  standard: "Standard (about 250 words)",
  detailed: "Detailed (about 350 words)",
} as const;
export type Length = keyof typeof LENGTHS;

const LENGTH_WORDS: Record<Length, number> = { short: 150, standard: 250, detailed: 350 };

export const CoverLetterRequestSchema = z.object({
  resume: z.string().trim().min(1, "Add your resume first."),
  background: BackgroundSchema,
  jobPosting: z.string().trim().min(1, "Paste the job posting first."),
  tone: z.enum(Object.keys(TONES) as [Tone, ...Tone[]]),
  length: z.enum(Object.keys(LENGTHS) as [Length, ...Length[]]),
  /** Optional extra direction, e.g. "mention that I'm relocating". */
  instructions: z.string().optional(),
  /** Earlier versions to avoid repeating when the person regenerates. */
  previous: z.string().optional(),
});
export type CoverLetterRequest = z.infer<typeof CoverLetterRequestSchema>;

export const CoverLetterResultSchema = z.object({
  letter: z
    .string()
    .describe(
      "The complete cover letter as plain text, from greeting to sign-off, with a blank line between paragraphs.",
    ),
  notes: z
    .array(z.string())
    .describe(
      "Up to 3 short heads-ups for the person, such as a company name or detail to fill in, or a requirement they should address themselves.",
    ),
});
export type CoverLetterResult = z.infer<typeof CoverLetterResultSchema>;

const SYSTEM = `You are an experienced career coach who writes cover letters that hiring managers actually read.

Honesty comes first. Use only facts from the person's resume, background, and education details. Never invent employers, titles, dates, degrees, certifications, numbers, achievements, or skills, and never claim a degree the person hasn't finished. If the job asks for something the person doesn't show, don't pretend; lean on related strengths and eagerness to learn instead. If a company name, hiring manager, or contact detail isn't in the materials, don't guess: use "Dear Hiring Manager" and leave out the name, or put a clear [placeholder] and mention it in the notes.

Stay professional about what you include. The background notes can hold anything the person typed, including personal trivia, hobbies, food preferences, "fun facts", or icebreakers meant for other places. Leave all of that out unless it plainly helps for this specific job (for example, a hobby that is the product's domain). Never include a "fun fact", joke, or unrelated personal detail, and never open the letter with one, even if the notes or the earlier version contain one. Only add something like that if the person's extra instructions explicitly ask for it.

Follow mainstream expert guidance:
- One page, three to four short paragraphs, plain text, no headers or bullet lists.
- Start with a greeting line ("Dear Hiring Manager," unless a real name is in the materials), then an opening paragraph that properly introduces the person before any details: who they are professionally (their current or most recent role, or what they've been doing) and the specific role they're applying for, joined to a specific hook such as something they did that matches what the job is for. A reader should know who is writing and why after the first two sentences. Never open with "I am writing to apply for...", "I am excited to...", or a line about the person's passion.
- In the middle, pick the two or three most relevant things from the person's background and tie each to a need in the posting, showing results where the materials give them. Don't just restate the resume.
- Echo the posting's own wording where it truthfully describes the person.
- Show you understand what the employer cares about, then close with confidence and a clear next step.
- Avoid clichés, filler, flattery of the company, and apologizing for gaps.
- An "enthusiastic" tone comes from specific reasons this job appeals to the person, not from words like "thrilled" or "excited".
- Close plainly, for example by saying you'd welcome a conversation about the role. Sign off with "Sincerely," or "Best regards," and the person's name.
- Education: mention it only if it helps for this job (a required degree, a recent graduate, or a career changer), and be accurate about whether it's finished.

Match the requested tone and aim for the requested length. If the person gave extra instructions, follow them as long as they stay truthful. If earlier versions are given, write a clearly different take with a fresh opening.

${WRITING_STYLE}`;

export function aboutText(background: z.infer<typeof BackgroundSchema>): string {
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
  return `<background>
${about.length ? about.join("\n") : "(none given)"}
</background>

<education>
${education.length ? education.join("\n") : "(none given beyond the resume)"}
</education>`;
}

export const coverLetterTask: Task<CoverLetterRequest, CoverLetterResult> = {
  // A short letter from material we already have; the quick model is enough.
  weight: "light",
  system: SYSTEM,
  user: ({ resume, background, jobPosting, tone, length, instructions, previous }) => `<resume>
${resume.trim()}
</resume>

${aboutText(background)}

<job_posting>
${jobPosting.trim()}
</job_posting>
${instructions?.trim() ? `\n<extra_instructions>\n${instructions.trim()}\n</extra_instructions>\n` : ""}${previous?.trim() ? `\n<earlier_version>\n${previous.trim()}\n</earlier_version>\n` : ""}
Write a cover letter for this job. Tone: ${TONES[tone]}. Length: about ${LENGTH_WORDS[length]} words.`,
  input: CoverLetterRequestSchema,
  output: CoverLetterResultSchema,
  clean: (result) => {
    const cleaned = cleanAnswer(result);
    return { ...cleaned, letter: withGreeting(withoutFunFacts(cleaned.letter)) };
  },
};

/** A paragraph that is just personal trivia, like "Fun fact about me: ...". */
const FUN_FACT = /^\s*(?:a\s+)?(?:fun|random|quick)\s+fact\b/i;

/** Drops "fun fact" paragraphs, a safety net in case the model copies one from the notes. */
export function withoutFunFacts(letter: string): string {
  const paragraphs = letter.split(/\n\s*\n/);
  const kept = paragraphs.filter((p) => !FUN_FACT.test(p));
  return kept.length === paragraphs.length ? letter : kept.join("\n\n");
}

const GREETING = /^(dear|hello|hi|to whom|greetings)\b/i;

/** Makes sure the letter opens with a greeting line, as the prompt asks. */
export function withGreeting(letter: string): string {
  const trimmed = letter.trimStart();
  if (!trimmed || GREETING.test(trimmed)) return letter;
  return `Dear Hiring Manager,\n\n${trimmed}`;
}
