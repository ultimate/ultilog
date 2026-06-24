const features = [
  {
    title: "Mobile-first capture",
    description: "Large touch targets, concise forms, and responsive layouts make it comfortable on phones and tablets.",
  },
  {
    title: "Desktop-friendly review",
    description: "A wider dashboard layout is ready for future analytics, exports, and deeper inspection sessions.",
  },
  {
    title: "Easy hosting path",
    description: "Next.js keeps deployment simple on services like Vercel, Netlify, or any Node-capable host.",
  },
];

const stackChoices = ["Next.js", "TypeScript", "React", "CSS Modules-ready", "Responsive UI"];

export default function Home() {
  return (
    <main className="page-shell">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <p className="eyebrow">Recommended foundation</p>
          <h1 id="hero-title">A modern, responsive Next.js app starter for Ultilog.</h1>
          <p className="hero-text">
            I recommend building this as a Next.js + TypeScript web application: it matches the languages you know,
            is straightforward to host, and gives us a strong base for mobile, tablet, and desktop workflows.
          </p>
          <div className="actions" aria-label="Primary actions">
            <a className="button primary" href="#plan">View the build plan</a>
            <a className="button secondary" href="#stack">See the stack</a>
          </div>
        </div>
        <aside className="device-card" aria-label="Application preview summary">
          <div className="device-header">
            <span />
            <span />
            <span />
          </div>
          <div className="metric-card">
            <p>Today&apos;s entries</p>
            <strong>24</strong>
          </div>
          <div className="mini-grid">
            <div><strong>Fast</strong><span>Capture</span></div>
            <div><strong>Clear</strong><span>Review</span></div>
          </div>
          <div className="progress" aria-hidden="true"><span /></div>
        </aside>
      </section>

      <section className="section" id="stack" aria-labelledby="stack-title">
        <div>
          <p className="eyebrow">Tech stack</p>
          <h2 id="stack-title">Pragmatic, familiar, and hostable.</h2>
        </div>
        <div className="pill-list">
          {stackChoices.map((choice) => <span className="pill" key={choice}>{choice}</span>)}
        </div>
      </section>

      <section className="feature-grid" id="plan" aria-label="Project priorities">
        {features.map((feature) => (
          <article className="feature-card" key={feature.title}>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
