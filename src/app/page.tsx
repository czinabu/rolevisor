import Image from "next/image";
import Link from "next/link";
import { COST_ESTIMATE } from "@/lib/providers";

/** Where the "See an example" button goes. Set to null to hide the button. */
const EXAMPLE_HREF: string | null = "/example";

const LOCAL_GUIDE =
  "https://github.com/czinabu/rolevisor/blob/main/docs/local-models.md";

const FEATURES = [
  {
    free: false,
    title: "A resume tailored to the posting",
    body: "Paste a job posting and get your resume rewritten for it, with a match score, the skills you have and are missing, and a list of what changed and why.",
  },
  {
    free: true,
    title: "Keyword check",
    body: "A score for how many of the posting's keywords your resume contains, and which ones are missing, so applicant tracking systems don't filter you out.",
  },
  {
    free: false,
    title: "Cover letters",
    body: "Get a cover letter written for the specific job, based on your real experience, ready to edit and download.",
  },
  {
    free: false,
    title: "Advice for this application",
    body: "Suggestions on what to strengthen, how to list your education, and an expert-style read of your formatting.",
  },
  {
    free: true,
    title: "Formatting score",
    body: "A score out of 100 for margins, fonts, spacing, sections, and contact details, measured in your browser from your PDF or Word file.",
  },
  {
    free: false,
    title: "Role finder",
    body: "Not sure what to apply for? Get roles that fit your background, what carries over, and links to search for them on the big job boards.",
  },
  {
    free: true,
    title: "Application log",
    body: "Keep track of where you applied, the resume and cover letter you sent, and when to follow up, all saved in your own browser.",
  },
];

const SCREENSHOTS = [
  {
    src: "/screenshots/results.png",
    alt: "Tailored resume results with a match score, matched and missing skills, and a keyword check",
    caption: "Your match score, skills, and keyword check for one job.",
  },
  {
    src: "/screenshots/inputs.png",
    alt: "The Tailor page with a resume, background details, and a job posting filled in",
    caption: "Add your resume (PDF, Word, or text) and paste the job posting.",
  },
];

/**
 * Sam's made-up resume from the example page, before and after tailoring, with the posting's
 * keywords each version contains. The scores are what Rolevisor's free keyword check gives
 * the two versions against the example posting (see matchKeywords in lib/keywordMatch.ts).
 */
const PREVIEW = {
  role: "Junior Data Analyst",
  before: {
    score: 24,
    blocks: [
      {
        label: "Skills",
        text: "Excel (pivot tables, VLOOKUP), Google Sheets, scheduling, inventory management, customer service",
      },
      {
        label: "Experience",
        text: "Ran weekly sales reports and presented results to the district manager",
      },
    ],
    keywords: ["Excel", "pivot tables", "inventory"],
  },
  after: {
    score: 78,
    blocks: [
      {
        label: "Summary",
        text: "Retail manager moving into data analysis, with five years in grocery store operations turning sales and inventory numbers into decisions. Builds Excel trackers and a Tableau dashboard, writes SQL, and presents results to non-technical stakeholders.",
      },
      {
        label: "Skills",
        text: "Data analysis: SQL, Excel (pivot tables, VLOOKUP), Google Sheets. Data visualization: Tableau Public",
      },
    ],
    keywords: [
      "Retail",
      "data analysis",
      "Data analysis",
      "grocery",
      "store operations",
      "inventory",
      "Excel",
      "pivot tables",
      "Tableau",
      "dashboard",
      "SQL",
      "stakeholders",
      "Data visualization",
    ],
  },
};

/** Wraps each keyword in the text in a highlighter mark. */
function Marked({ text, keywords }: { text: string; keywords: string[] }) {
  const pattern = new RegExp(`(${[...keywords].sort((a, b) => b.length - a.length).join("|")})`, "g");
  return (
    <>
      {text.split(pattern).map((part, i) =>
        keywords.includes(part) ? (
          <mark key={i} className="mark">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function ResumeSide({
  title,
  side,
  muted = false,
}: {
  title: string;
  side: (typeof PREVIEW)["before"];
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5 p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-display text-lg italic">{title}</p>
        <p className="text-sm text-muted">
          Keyword match{" "}
          <span
            className={`font-display text-2xl tabular-nums ${muted ? "text-muted" : "text-accent"}`}
          >
            {side.score}
          </span>
        </p>
      </div>
      {side.blocks.map((b) => (
        <div key={b.label} className="space-y-1">
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted uppercase">{b.label}</p>
          <p className={`text-sm leading-relaxed ${muted ? "text-muted" : ""}`}>
            <Marked text={b.text} keywords={side.keywords} />
          </p>
        </div>
      ))}
    </div>
  );
}

function ResumePreview() {
  return (
    <figure className="space-y-3">
      <div className="card grid divide-y divide-line overflow-hidden sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="bg-card">
          <ResumeSide title="Before" side={PREVIEW.before} muted />
        </div>
        <ResumeSide title="After Rolevisor" side={PREVIEW.after} />
      </div>
      <figcaption className="flex flex-col gap-1 text-sm text-muted sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
        <span>
          A made-up resume, tailored for a {PREVIEW.role} posting.{" "}
          <span className="mark">Highlighted</span> words are ones the posting asks for.
        </span>
        {EXAMPLE_HREF && (
          <Link href={EXAMPLE_HREF} className="link shrink-0">
            See the full example
          </Link>
        )}
      </figcaption>
    </figure>
  );
}

function SectionTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="font-display text-3xl font-medium tracking-tight">{title}</h2>
      {children && <p className="max-w-2xl text-[15px] leading-relaxed text-muted">{children}</p>}
    </div>
  );
}

const STEPS = [
  <>
    <Link href="/guide/api-key" className="link">
      Get a Claude API key
    </Link>{" "}
    or{" "}
    <a className="link" href={LOCAL_GUIDE} target="_blank" rel="noreferrer">
      set up a local model
    </a>
    .
  </>,
  <>
    Add it in{" "}
    <Link href="/settings" className="link">
      Model settings
    </Link>{" "}
    and click Test connection.
  </>,
  <>
    Open{" "}
    <Link href="/tailor" className="link">
      Tailor
    </Link>
    , add your resume and a job posting, and click Tailor my resume.
  </>,
];

export default function Landing() {
  return (
    <div className="space-y-24">
      <section className="space-y-10 pt-4 sm:pt-8">
        <div className="space-y-6">
          <h1 className="font-display text-[2.75rem] leading-[1.05] font-medium tracking-tight text-balance sm:text-6xl">
            Tailor your resume to <em className="text-accent">every</em> job you apply for.
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-muted">
            Rolevisor reads your resume and a job posting, then rewrites your resume for that job,
            writes a cover letter, and tells you what to fix. No account, no subscription, and your
            resume stays between you and the AI.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link href="/tailor" className="btn px-5 py-2.5 text-base">
              Start tailoring
            </Link>
            {EXAMPLE_HREF && (
              <Link href={EXAMPLE_HREF} className="btn-secondary px-5 py-2.5 text-base">
                See an example
              </Link>
            )}
            <Link href="/guide/api-key" className="link px-1 py-1 text-center text-sm sm:ml-2 sm:text-left">
              How to get a Claude API key
            </Link>
          </div>
        </div>
        <ResumePreview />
      </section>

      <section className="space-y-8">
        <SectionTitle title="What it does">
          Parts marked free work right away, with no API key or local model. Rolevisor also reads
          PDF and Word resumes and job posting screenshots for free, in your browser.
        </SectionTitle>
        <ol className="border-b border-line">
          {FEATURES.map((f, i) => (
            <li
              key={f.title}
              className="grid grid-cols-[2.25rem_1fr] gap-x-3 border-t border-line py-5 sm:grid-cols-[3rem_1fr_auto] sm:gap-x-6"
            >
              <span className="font-display text-xl text-muted tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="font-medium">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
              <p
                className={`col-start-2 mt-2 text-sm sm:col-start-3 sm:mt-0.5 sm:text-right sm:whitespace-nowrap ${f.free ? "font-medium text-good" : "text-muted"}`}
              >
                {f.free ? "Free, no key needed" : "Needs a key or local model"}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-8">
        <SectionTitle title="See it in action" />
        <div className="grid gap-6 sm:grid-cols-2">
          {SCREENSHOTS.map((s) => (
            <figure key={s.src} className="space-y-3">
              <Image
                src={s.src}
                alt={s.alt}
                width={1800}
                height={2200}
                className="h-auto w-full rounded-lg border border-line"
              />
              <figcaption className="text-sm text-muted">{s.caption}</figcaption>
            </figure>
          ))}
        </div>
        <p className="text-xs text-muted">Screenshots use a made-up resume and job posting.</p>
      </section>

      <section className="space-y-8">
        <SectionTitle title="Why you bring your own key">
          Rolevisor uses Claude, Anthropic&apos;s AI, with an API key from your own Anthropic
          account. That sounds technical, but it&apos;s what keeps the tool private and cheap.
        </SectionTitle>
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-3">
          <div className="border-t border-foreground/80 pt-4">
            <h3 className="font-medium">Private</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Your resume and key go straight from your browser to Anthropic. They never pass
              through Rolevisor&apos;s server, which stores and logs nothing.
            </p>
          </div>
          <div className="border-t border-foreground/80 pt-4">
            <h3 className="font-medium">No subscription</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              You pay Anthropic only for what you use. Tailoring one resume costs {COST_ESTIMATE.tailoring}.
            </p>
          </div>
          <div className="border-t border-foreground/80 pt-4">
            <h3 className="font-medium">You stay in control</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Set a spending limit on your Anthropic account, and delete the key any time.
            </p>
          </div>
        </div>
        <p className="text-sm">
          <Link href="/guide/api-key" className="link">
            Step-by-step guide to getting a key
          </Link>{" "}
          <span className="text-muted">(about 5 minutes)</span>
        </p>
        <div className="space-y-2 border-l-2 border-line pl-5">
          <h3 className="font-display text-xl font-medium italic">
            Or use a free model on your own computer
          </h3>
          <p className="max-w-2xl text-sm leading-relaxed text-muted">
            Don&apos;t want an API key? Install LM Studio or Ollama and Rolevisor runs on a model on
            your own computer instead. It&apos;s free, and your resume never leaves your machine.
            Results are less polished than Claude&apos;s, and you need a reasonably recent computer.
          </p>
          <p className="pt-1 text-sm">
            <a className="link" href={LOCAL_GUIDE} target="_blank" rel="noreferrer">
              Local model setup guide
            </a>
          </p>
        </div>
      </section>

      <section className="space-y-8 pb-4">
        <SectionTitle title="Get started in three steps" />
        <ol className="grid gap-x-10 gap-y-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={i} className="space-y-2 border-t border-line pt-4">
              <span className="block font-display text-4xl leading-none text-accent tabular-nums">
                {i + 1}
              </span>
              <p className="text-[15px] leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
        <Link href="/tailor" className="btn px-5 py-2.5 text-base">
          Start tailoring
        </Link>
      </section>
    </div>
  );
}
