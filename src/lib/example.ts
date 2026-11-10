import type { CoverLetterResult } from "./coverLetter";
import type { FormatReview } from "./formatReview";
import type { ResumeLayout } from "./layout";
import type { SuggestionsResult } from "./suggestions";
import type { TailorRequest, TailorResult } from "./tailor";

/**
 * A worked example for people who haven't added an API key yet. The person, employer, and
 * job are made up. The AI output below was written ahead of time to the same rules and
 * shapes as the real tasks, so the example page shows real result screens without a call.
 */

export const EXAMPLE_INPUTS: TailorRequest = {
  resume: `SAM ORTEGA
Columbus, OH · sam.ortega@example.com · (555) 014-2290 · LinkedIn

EXPERIENCE
Fieldstone Market - Assistant Store Manager | 2021–Present
- Managed a team of 14 associates across two shifts
- Built a weekly Excel tracker for shrink and waste that the district now uses in 6 stores
- Cut produce waste 18% in one year by adjusting orders based on sales trends
- Ran weekly sales reports and presented results to the district manager
- Trained new hires on the point-of-sale system and inventory counts

Fieldstone Market - Sales Associate | 2019–2021
- Helped customers and handled cash and returns
- Did inventory counts and restocked shelves

SKILLS
Excel (pivot tables, VLOOKUP), Google Sheets, scheduling, inventory management, customer service

EDUCATION
Columbus State Community College - Business Administration coursework | 2018–2019`,
  background: {
    targetRole: "Data analyst",
    experience: "5",
    skills: "SQL (Google Data Analytics Certificate, 2025), Tableau Public",
    notes:
      "Moving from retail management into data. Built a Tableau Public dashboard of grocery prices across Ohio as a side project in 2025.",
    education: [
      {
        school: "Columbus State Community College",
        program: "A.A.S. Business Administration",
        status: "did-not-finish",
        dates: "2018–2019",
        coursework: "Intro to Statistics, Business Math, Microsoft Excel",
      },
    ],
  },
  jobPosting: `Junior Data Analyst
Brightline Grocers · Columbus, OH (hybrid)

About the role
Brightline Grocers runs 40 neighborhood grocery stores across Ohio. Our analytics team turns sales and inventory data into decisions for store operations. You'll help store and district leaders see what's selling, what's going to waste, and where to act.

What you'll do
- Build and maintain the weekly sales dashboard in Tableau or Power BI
- Write SQL queries to pull sales, inventory, and shrink data
- Spot sales trends and support forecasting for ordering and staffing
- Present findings to non-technical stakeholders in store operations
- Clean and check data for accuracy

What we're looking for
- 1–3 years of experience with data analysis (work, school, or projects)
- SQL and Excel, including pivot tables
- Experience with data visualization tools such as Tableau or Power BI
- Clear communication with non-technical audiences
- Retail or grocery experience is a big plus
- Python is a plus
- Bachelor's degree in a quantitative field, or equivalent experience`,
};

export const EXAMPLE_TAILORED: TailorResult = {
  matchScore: 64,
  summary:
    "Sam has the grocery and inventory background Brightline cares about, and has already used sales data to cut waste, which is the heart of this role. SQL and Tableau are newer skills shown through a certificate and a side project rather than on the job, and there's no Python or forecasting experience yet.",
  matchedSkills: [
    "Retail and grocery experience",
    "Excel and pivot tables",
    "Inventory and shrink tracking",
    "Spotting sales trends",
    "Presenting results to leadership",
    "SQL",
    "Tableau",
  ],
  missingSkills: [
    "Python",
    "Forecasting",
    "Power BI",
    "SQL used on the job",
    "Bachelor's degree (equivalent experience accepted)",
  ],
  tailoredResume: `Sam Ortega
Columbus, OH · sam.ortega@example.com · (555) 014-2290 · LinkedIn

## Summary
Retail manager moving into data analysis, with five years in grocery store operations turning sales and inventory numbers into decisions. Builds Excel trackers and a Tableau dashboard, writes SQL, and presents results to non-technical stakeholders.

## Skills
- Data analysis: SQL, Excel (pivot tables, VLOOKUP), Google Sheets
- Data visualization: Tableau Public
- Retail operations: inventory management, shrink and waste tracking, sales trends, scheduling

## Experience
Fieldstone Market - Assistant Store Manager | 2021–Present
- Cut produce waste 18% in one year by tracking sales trends and adjusting orders to match
- Built a weekly Excel tracker for shrink and waste that the district now uses in 6 stores
- Prepared weekly sales reports and presented the results to the district manager
- Managed a team of 14 associates across two shifts
- Trained new hires on the point-of-sale system and inventory counts

Fieldstone Market - Sales Associate | 2019–2021
- Ran inventory counts, restocked shelves, and handled cash, returns, and customer questions

## Projects
Ohio Grocery Prices Dashboard - Tableau Public | 2025
- Built a public Tableau dashboard comparing grocery prices across Ohio as a self-directed data visualization project

## Certifications
Google Data Analytics Certificate | 2025

## Education
Columbus State Community College - Coursework toward A.A.S. Business Administration | 2018–2019
- Relevant coursework: Intro to Statistics, Business Math`,
  changes: [
    {
      change: "Added a summary that frames five years of store operations as data work.",
      reason: "It tells the hiring manager in two lines why a store manager fits an analyst role.",
    },
    {
      change: "Brought in SQL, Tableau, and the Google Data Analytics Certificate from your background.",
      reason: "They weren't on the resume, and they're core requirements in the posting.",
    },
    {
      change: "Moved Skills above Experience and grouped them into data analysis, visualization, and retail operations.",
      reason: "The posting leads with SQL, Excel, and Tableau, so those should be seen first.",
    },
    {
      change: "Put the 18% produce waste result first and worded it around tracking sales trends.",
      reason: "It's your strongest proof that you already use data to make decisions.",
    },
    {
      change: "Added a Projects section for the Ohio grocery prices dashboard.",
      reason: "It shows the hands-on Tableau work the job asks for.",
    },
    {
      change: "Combined the two Sales Associate bullets into one line.",
      reason: "The older role matters less here, and it frees space for relevant work.",
    },
    {
      change: "Reworded education as coursework toward the degree.",
      reason: "It's honest about the unfinished degree while showing statistics coursework.",
    },
  ],
  educationAdvice: {
    recommendation: "Include briefly",
    placement:
      "At the bottom, after Certifications. Your work experience and certificate are stronger evidence for this job, so they come first.",
    howToList:
      "Columbus State Community College - Coursework toward A.A.S. Business Administration | 2018–2019\nRelevant coursework: Intro to Statistics, Business Math",
    coursework:
      "List Intro to Statistics and Business Math, since the role is analytical. Leave off Microsoft Excel, because your work already proves it.",
    reasoning:
      "The posting accepts equivalent experience instead of a bachelor's degree, so your work and certificate carry more weight than school. Listing the coursework honestly fills in your timeline and shows some statistics background without implying a finished degree.",
  },
  linkAdvice: {
    linkedin: "Recommended",
    github: "Not needed",
    reason:
      "Recruiters for analyst roles usually check LinkedIn, and this job doesn't ask for code samples, so GitHub can stay off.",
  },
};

export const EXAMPLE_SUGGESTIONS: SuggestionsResult = {
  bullets: [
    {
      priority: "High",
      original: "Ran weekly sales reports and presented results to the district manager",
      rewrite:
        "Built weekly sales reports in [Excel or Google Sheets] and presented trends and results to the district manager",
      why: "Naming the tool and the trends echoes the posting's ask to present findings to non-technical stakeholders. Fill in the tool you actually used.",
    },
    {
      priority: "High",
      original: "Built a weekly Excel tracker for shrink and waste that the district now uses in 6 stores",
      rewrite:
        "Built a weekly Excel shrink and waste tracker, now used across 6 stores in the district, that helped managers [what it helped them catch or cut]",
      why: "Adoption is already strong; adding the outcome, only if you know it, turns a tool into a result.",
    },
    {
      priority: "Medium",
      original: "Did inventory counts and restocked shelves",
      rewrite: "Completed [weekly] inventory counts and restocked shelves to keep stock levels current",
      why: "It starts with a stronger verb and connects to the inventory data this team works with.",
    },
  ],
  gaps: [
    {
      priority: "High",
      gap: "SQL used on the job",
      howToAddress:
        "Your certificate covers the basics. Add a small SQL project, such as querying a public retail dataset, and link it next to your Tableau dashboard.",
    },
    {
      priority: "Medium",
      gap: "Forecasting",
      howToAddress:
        "Ordering produce from sales trends is close to demand forecasting. Say that in your cover letter, and consider a short course on forecasting in Excel.",
    },
    {
      priority: "Medium",
      gap: "Bachelor's degree",
      howToAddress:
        "The posting accepts equivalent experience. Lead with your five years and the certificate, and list your coursework honestly.",
    },
    {
      priority: "Low",
      gap: "Python",
      howToAddress:
        "It's listed as a plus, so it shouldn't stop you applying. Mention you're learning it only if you are.",
    },
  ],
  emphasize: [
    {
      priority: "High",
      point: "Cutting produce waste 18% using sales data",
      how: "Make it the first bullet under your current job and open your cover letter with it.",
    },
    {
      priority: "High",
      point: "A tracker the district adopted in 6 stores",
      how: "Shows you build tools other people rely on, which is most of maintaining a weekly dashboard.",
    },
    {
      priority: "Medium",
      point: "Five years in grocery store operations",
      how: "Name it in your summary; you already know the data and the people this team serves.",
    },
    {
      priority: "Medium",
      point: "The Ohio grocery prices dashboard",
      how: "Link it in your contact line or Projects section so the reader can click through.",
    },
  ],
};

/** Made-up measurements, as if the sample resume had been uploaded as a one-page PDF. */
export const EXAMPLE_LAYOUT: ResumeLayout = {
  source: "pdf",
  pages: 1,
  lastPageFill: 0.7,
  margins: { top: 0.75, bottom: 0.75, left: 0.75, right: 0.75 },
  bodySize: 10.5,
  largestSize: 16,
  distinctSizes: 3,
  fonts: ["Calibri"],
  lineSpacing: 1.05,
  headingGap: 1.1,
  bulletSymbols: ["•"],
  columns: false,
  tables: false,
  images: false,
  headerFooterText: false,
};

export const EXAMPLE_FORMAT_REVIEW: FormatReview = {
  summary:
    "Sam's resume is clean, fits on one page, and is easy for an applicant tracking system to read. The main issues are order and wording: the strongest data work is in the middle of the first job, and the older role reads as a list of duties.",
  strengths: [
    "A single column with standard section names, so it parses cleanly.",
    "The same date format on every role.",
    "Email and phone are at the top, in the main body of the page.",
  ],
  improvements: [
    {
      issue: "The most impressive bullet isn't first.",
      fix: "Move \"Cut produce waste 18%...\" to the top of the Assistant Store Manager role. Recruiters often read only the first bullet or two.",
    },
    {
      issue: "Skills sit at the bottom.",
      fix: "For analyst roles, move Skills above Experience so tools like Excel and Google Sheets are seen in the first few seconds.",
    },
    {
      issue: "Some bullets start with weak verbs.",
      fix: "\"Did\" and \"Helped\" say little. Start with a specific verb such as \"Counted\", \"Resolved\", or \"Built\".",
    },
    {
      issue: "The Sales Associate role lists duties, not results.",
      fix: "Combine its two bullets into one line, or add a result if you have one.",
    },
  ],
};

export const EXAMPLE_LETTER: CoverLetterResult = {
  letter: `Dear Hiring Manager,

Last year I cut produce waste at my store by 18% by reading our sales trends and changing how we ordered. Turning store data into a decision someone can act on is what your Junior Data Analyst role is about, and it's the work I want to do full time.

For five years I've worked in grocery store operations at Fieldstone Market, most recently as Assistant Store Manager. I built a weekly Excel tracker for shrink and waste that our district now uses in six stores, and each week I prepare sales reports and walk the district manager through the results. I know what store and district leaders need from the numbers, because I've been the one using them.

I've been building the technical side to match. In 2025 I completed the Google Data Analytics Certificate, where I learned SQL, and I built a Tableau Public dashboard comparing grocery prices across Ohio. I haven't used Power BI or Python yet, and I'd welcome the chance to learn them on your team.

I'd like to talk about how I could help Brightline's store operations team see what's selling, what's going to waste, and where to act. Thank you for your time.

Sincerely,
Sam Ortega`,
  notes: [
    "Add the hiring manager's name if you can find it on the posting or LinkedIn.",
    "If you know what the tracker helped stores catch or save, add that number to the second paragraph.",
  ],
};
