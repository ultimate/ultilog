import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Legal notice & contact · Ultilog",
  description: "Legal notice, contact details, privacy information, and nautical logbook disclaimer for Ultilog.",
};

export default function LegalPage() {
  return (
    <main className="legal-page">
      <article className="legal-page-card">
        <header>
          <Link className="legal-brand" href="/"><span aria-hidden="true">◢</span> ultilog</Link>
          <p className="eyebrow">Legal information</p>
          <h1>Legal notice &amp; contact</h1>
          <p>Information about the Ultilog service and how to reach the project.</p>
        </header>

        <section aria-labelledby="imprint-heading">
          <h2 id="imprint-heading">Impressum / Legal notice</h2>
          <p><strong>Service:</strong> Ultilog, a personal skipper logbook project.</p>
          <p>
            <strong>Contact:</strong>{" "}
            <a href="mailto:ultilog@verkin.de">ultilog@verkin.de</a>
          </p>
          <p>
            <strong>Source code and project:</strong>{" "}
            <a href="https://github.com/verkin/ultilog" target="_blank" rel="noopener noreferrer">GitHub project</a>
          </p>
        </section>

        <section aria-labelledby="liability-heading">
          <h2 id="liability-heading">Content and external links</h2>
          <p>
            The project takes reasonable care when preparing its content, but does not guarantee that
            information is complete, accurate, or current. Linked third-party websites are the
            responsibility of their respective operators. Please report concerns using the contact
            address above.
          </p>
        </section>

        <section aria-labelledby="logbook-heading">
          <h2 id="logbook-heading">Important logbook disclaimer</h2>
          <p>
            Ultilog is a personal record-keeping aid. It is not legal advice and does not replace an
            official, paper, manual, or otherwise prescribed logbook where applicable law, an
            authority, a flag state, a vessel operator, or a licensing body requires one. You remain
            responsible for checking and meeting the rules that apply to your vessel and voyage.
          </p>
          <p>
            When signed in, see the <Link href="/compliance#legal-information-title">compliance section</Link> for
            jurisdiction-specific reference information and official-source links.
          </p>
        </section>

        <section id="privacy" aria-labelledby="privacy-heading">
          <h2 id="privacy-heading">Cookies and local storage</h2>
          <p>
            Ultilog uses technically necessary cookies for authentication and browser storage for
            preferences, application operation, and remembering that you dismissed the cookie notice.
            The service does not use advertising cookies. Do not upload personal data unless you are
            authorised to store it.
          </p>
        </section>

        <footer><Link href="/">Back to Ultilog</Link></footer>
      </article>
    </main>
  );
}
