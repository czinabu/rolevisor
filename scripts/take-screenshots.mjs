// Retakes the README screenshots in docs/screenshots.
//
//   npm run build && npm start              # in one terminal
//   npm i --no-save playwright && npx playwright install chromium
//   node scripts/take-screenshots.mjs       # in another
//
// Uses the built-in example page and a made-up application log, so no API key is needed.
// The desktop viewport is 800px wide, just wider than the page's content column, so the
// images have no empty margins and stay readable at the README's width.
// Set BASE_URL to shoot a different server (for example a Vercel preview).
import { chromium } from 'playwright';
const B = process.env.BASE_URL || 'http://localhost:3000';
const OUT = process.argv[2] || 'docs/screenshots';
const apps = [
 {id:'1',company:'Northwind Health',role:'Data Analyst',link:'',dateApplied:'2026-11-02',status:'applied',followUp:'2026-11-09',notes:'Referred by Sam',resume:'x',coverLetter:'x',jobPosting:'x'},
 {id:'2',company:'Brightline Logistics',role:'Operations Analyst',link:'',dateApplied:'2026-10-28',status:'interview',followUp:'',notes:'Phone screen Thu',resume:'x',coverLetter:'',jobPosting:'x'},
 {id:'3',company:'Cedar & Pine Co.',role:'Business Analyst',link:'',dateApplied:'2026-10-20',status:'heard_back',followUp:'2026-11-14',notes:'',resume:'x',coverLetter:'x',jobPosting:''},
 {id:'4',company:'Lumen Retail',role:'Reporting Analyst',link:'',dateApplied:'2026-10-12',status:'rejected',followUp:'',notes:'',resume:'',coverLetter:'',jobPosting:''},
];
(async () => {
  const br = await chromium.launch();
  async function page(opts, theme) {
    const ctx = await br.newContext({ ...opts, colorScheme: theme });
    await ctx.addInitScript(([a, t]) => { localStorage.setItem('job-helper:applications', a); localStorage.setItem('job-helper:theme', t); }, [JSON.stringify(apps), theme]);
    return ctx.newPage();
  }
  const desk = { viewport: { width: 800, height: 900 }, deviceScaleFactor: 2 };
  const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
  const shot = async (p, name, full=false) => { await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); };
  let p = await page(desk, 'light');
  await p.goto(B + '/'); await shot(p, 'home-light');
  await p.goto(B + '/example');
  for (const [label, name] of [['Tailored resume','example-tailored'],['Keyword match','example-keywords'],['Suggestions','example-suggestions'],['Formatting','example-formatting'],['Cover letter','example-cover-letter']]) {
    await p.getByRole('tab', { name: label }).or(p.getByRole('button', { name: label, exact: true })).first().click();
    await p.waitForTimeout(400);
    const tl = p.getByRole('tab', { name: label }).or(p.getByRole('button', { name: label, exact: true })).first();
    const b = await tl.boundingBox(); const sy = await p.evaluate(() => window.scrollY);
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: true, clip: { x: 0, y: b.y + sy - 24, width: 800, height: 900 } });
  }
  await p.goto(B + '/tailor'); await shot(p, 'tailor');
  await p.goto(B + '/applications'); await shot(p, 'application-log');
  await p.goto(B + '/settings'); await shot(p, 'model-settings');
  p = await page(desk, 'dark'); await p.goto(B + '/'); await shot(p, 'home-dark');
  p = await page(phone, 'light'); await p.goto(B + '/example'); await shot(p, 'phone-example');
  p = await page(phone, 'dark'); await p.goto(B + '/tailor'); await shot(p, 'phone-tailor-dark');
  await br.close();
})().catch(e => { console.error(e); process.exit(1); });
