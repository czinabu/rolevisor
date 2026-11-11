# Rolevisor

Rolevisor reads your resume and a job posting, then helps you tailor your resume for that specific job. It's built for anyone in the middle of a job search, technical or not.

You can use it with:

- **Claude** (Anthropic's AI): best results, nothing to install.
- **A free local model** through **LM Studio** or **Ollama**: runs on your own computer, so your resume never leaves it.

> **Status:** early. You can add your resume (PDF, Word, or text), your background, and a job posting, then get a tailored resume with a match summary. Suggestions are next.

## Using Rolevisor

1. Open the hosted Rolevisor website at [rolevisor.vercel.app](https://rolevisor.vercel.app) in your browser. There's nothing to install or deploy, and you don't need a Vercel account. The home page explains what Rolevisor does; click **Start tailoring** to open the tool (it lives at `/tailor`).
2. Click **Model settings** at the top right and pick where the AI runs:
   - **Claude:** paste an API key from [console.anthropic.com](https://console.anthropic.com) (everyone uses their own key, billed to their own Anthropic account), then click **Test connection**. New to API keys? The site has a step-by-step guide at [/guide/api-key](https://rolevisor.vercel.app/guide/api-key), with rough costs (tailoring one resume is about 1 to 3 cents on the default models).
   - **LM Studio or Ollama:** follow the [local model setup guide](docs/local-models.md) first, then click **Test connection**.
3. Open **Tailor**, add your resume and the job posting, and click **Tailor my resume**. You get a rewritten resume, an AI fit score, the skills you have and are missing, which of the posting's keywords each version contains, and a list of what changed and why.
   The **Keyword match** tab works without any API key or model. It pulls the skills, tools, and credentials the posting names, weighs them by section (requirements count most, nice-to-haves less, the company blurb and benefits not at all), and shows which ones your resume has, like an applicant tracking system would.
   The **Formatting** tab works without a key or model: it checks length, sections, bullets, contact details, and whether your dates use one style, and with a job posting it says whether LinkedIn and GitHub links would help.
4. Want your own resume in a cleaner layout? On the **Formatting** tab, **Download your resume in a clean template** turns the resume you added into the Classic or Modern PDF or Word file, word for word. It runs entirely in your browser and needs no API key or model.
5. Not sure what to apply for? Open **Role finder**. It suggests roles that fit your background and links to job searches on the big job boards. It doesn't list live openings.
6. Applying? After tailoring, click **Save to log**. The **Application log** keeps the company, date, status, the tailored resume and cover letter you sent, and the posting, so you can download them again later. It reminds you to follow up a week later if you haven't heard back: a count appears on the Application log link, and **Add to calendar** puts the reminder in your own calendar. Everything stays in your browser, so download a backup now and then.

If something isn't set up right, Test connection tells you what to fix in plain English.

## Privacy

- Your resume, background, and settings are saved only in your own browser.
- Resume files are read inside your browser. They're never uploaded.
- With LM Studio or Ollama, your browser talks straight to the model on your computer. Your resume is never sent over the internet.
- With Claude, your browser sends your resume and API key straight to Anthropic's API. They never pass through the Rolevisor server, which stores and logs nothing. The key is kept for the current tab only unless you tick "Remember my key on this device", and "Clear my key" removes it. A Content-Security-Policy (in `next.config.ts`) limits where the page can send data.

## How Claude models are used

Claude has two model settings so the expensive model is only used when it's worth it:

- **Model for big jobs** (default: Claude Sonnet): demanding work like rewriting your whole resume. Switch to Opus in Model settings for the most capable (and priciest) results.
- **Model for quick jobs** (default: Claude Haiku): lighter work like short suggestions.

Local models use the one model you pick for everything.

## For maintainers: hosting the site on Vercel

Rolevisor runs as one public site on Vercel, deployed from this repository. Regular users just open that site. These steps are for whoever runs it (or anyone who wants a private copy).

1. Sign in to [vercel.com](https://vercel.com) with GitHub and click **Add New → Project**.
2. Import this repository. Vercel detects Next.js, so keep the default settings.
3. Click **Deploy**. No environment variables are needed: visitors paste their own Claude API key in Model settings, so the site owner never pays for their usage.
4. Optional: under **Settings → Domains**, add a custom domain.

After that, every merge to `main` redeploys the site automatically, and each pull request gets its own preview link.

## For developers

Next.js (App Router) + TypeScript + Tailwind.

```
npm install
npm run dev     # http://localhost:3000
npm run lint
npm test
npm run build
```

No environment variables are needed. Claude requests always use the API key entered in Model settings.

How it fits together:

- `src/lib/tasks.ts`: every AI request is a *task* with a prompt, input and output schemas, and a weight (`heavy` or `light`). Features register their task in `TASKS`.
- `src/lib/request.ts` and `src/lib/useRequest.ts`: every "ask and wait" action (tailoring, reviews, cover letters, file reading, downloads, the connection test) is one state machine: `idle`, `running`, `done`, or `failed`. Use `useRequest()` instead of separate busy, error, and result flags.
- `src/lib/ai.ts`: what the UI calls. Runs a task on the picked model.
- `src/lib/local.ts`: runs tasks on LM Studio or Ollama **from the browser**, so the hosted site can use a visitor's local model.
- `src/lib/claude.ts`: runs tasks on Claude **from the browser** (there are no server API routes). `src/lib/apiKey.ts` and `src/lib/useSettings.ts` keep the key out of the saved settings. Heavy tasks use the main model, light ones the quick model.
- `src/lib/tailor.ts`: the `tailor` task (heavy, so it runs on the main model) and the keyword check. `src/components/TailorResults.tsx` shows the results.
- `src/lib/keywordMatch.ts`: the keyword match score, plain code with no model. `src/lib/skillTerms.ts` is the bundled skills list it looks for; add terms there. `src/components/KeywordMatchCard.tsx` shows it. Tests run with `npm test`.
- `src/lib/parseResume.ts`: reads PDF and Word files in the browser.
- `src/lib/structureResume.ts`: sorts an uploaded or pasted resume into headings, entries, and bullets with plain rules (no model), so `src/components/OriginalDownloadCard.tsx` can download it in the templates from `src/lib/resumeDoc.ts`.
- `src/lib/bulletCheck.ts`: the free, rule-based bullet check (weak openers, no numbers, passive voice, length, repeated verbs). No model; `src/components/BulletCheckCard.tsx` shows it on the Formatting tab, with missing keywords from `keywordMatch.ts` as gaps.
