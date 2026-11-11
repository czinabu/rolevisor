import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy policy", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="November 4, 2026">
      <p>
        Rolevisor is built so your resume stays under your control. This page explains what
        happens to your information in plain terms.
      </p>

      <h2>What Rolevisor stores</h2>
      <ul>
        <li>
          Your resume, background details, job postings, saved applications, and settings are
          saved only in your own browser (local storage). Rolevisor has no accounts and no
          database.
        </li>
        <li>Resume files (PDF, Word, text) are read inside your browser and never uploaded.</li>
        <li>
          Your Claude API key is kept for the current tab only, unless you tick &ldquo;Remember
          my key on this device&rdquo;. &ldquo;Clear my key&rdquo; removes it.
        </li>
        <li>
          You can erase everything at any time by clearing this site&rsquo;s data in your browser
          settings.
        </li>
      </ul>

      <h2>Where your resume is sent</h2>
      <ul>
        <li>
          <strong>Claude:</strong> when you run a task, your browser sends your resume, the job
          posting, and your API key directly to Anthropic&rsquo;s API. This does not pass through
          the Rolevisor server, which stores and logs nothing. Anthropic&rsquo;s handling of that
          data is covered by{" "}
          <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noreferrer">
            Anthropic&rsquo;s privacy policy
          </a>{" "}
          and your own account terms with them.
        </li>
        <li>
          <strong>LM Studio or Ollama:</strong> your browser talks directly to the model on your
          own computer. Your resume is not sent over the internet.
        </li>
      </ul>

      <h2>Job posting links</h2>
      <p>
        When you paste a link to a job posting, your browser sends just that link to the Rolevisor
        server, which opens the page, pulls out the posting&rsquo;s text, and sends it back. Your
        resume, your API key, and your other details are never sent with it, and the server
        doesn&rsquo;t save the link or the page. This works the same whether you use Claude, a local
        model, or no model.
      </p>

      {/* Update this section if analytics or other third-party services are added. */}
      <h2>Analytics and cookies</h2>
      <p>
        Rolevisor uses Vercel Web Analytics to count page views. It is cookie-free and does not
        track you across sites. Only page views are recorded; no custom events are sent, so your
        resume, job postings, and API key are never included. Rolevisor does not use advertising
        or tracking cookies.
      </p>

      <h2>Feedback</h2>
      <p>
        The footer&rsquo;s feedback link opens a new issue on Rolevisor&rsquo;s public GitHub
        repository. Anything you post there is public and handled under GitHub&rsquo;s terms, so
        don&rsquo;t include your resume or other personal details.
      </p>

      <h2>Hosting</h2>
      <p>
        The site is hosted on Vercel, which, like any web host, may keep standard server logs
        (such as IP address and requested pages) for operating and securing the service. These
        logs do not contain your resume or API key.
      </p>

      <h2>Sharing and selling</h2>
      <p>
        Rolevisor does not sell your information or share it with anyone, because it does not
        receive it in the first place.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes, the date above will be updated. Questions? Open an issue at{" "}
        <a href="https://github.com/czinabu/rolevisor/issues" target="_blank" rel="noreferrer">
          github.com/czinabu/rolevisor
        </a>
        .
      </p>
    </LegalPage>
  );
}
