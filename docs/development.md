# Development and hosting

Notes for whoever runs or works on Rolevisor. If you just want to use it, open [rolevisor.vercel.app](https://rolevisor.vercel.app).

## Hosting the site on Vercel

Rolevisor runs as one public site on Vercel, deployed from this repository. Regular users just open that site. These steps are for whoever runs it (or anyone who wants a private copy).

1. Sign in to [vercel.com](https://vercel.com) with GitHub and click **Add New → Project**.
2. Import this repository. Vercel detects Next.js, so keep the default settings.
3. Click **Deploy**. No environment variables are needed: visitors paste their own Claude API key in Model settings, so the site owner never pays for their usage.
4. Optional: under **Settings → Domains**, add a custom domain.

After that, every merge to `main` redeploys the site automatically, and each pull request gets its own preview link.

## Running it locally

Next.js (App Router) + TypeScript + Tailwind.

```
npm install
npm run dev     # http://localhost:3000
npm run lint
npm test
npm run build
```

No environment variables are needed. Claude requests always use the API key entered in Model settings.

## How the code fits together

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

## Retaking the README screenshots

The screenshots in `docs/screenshots` come from the built-in example page and a made-up application log, so no API key is needed.

```
npm run build && npm start                        # terminal 1
npm i --no-save playwright && npx playwright install chromium
node scripts/take-screenshots.mjs                 # terminal 2
```

Set `BASE_URL` to shoot another server, such as a Vercel preview. Retake them after a visible UI change so the README stays current.
