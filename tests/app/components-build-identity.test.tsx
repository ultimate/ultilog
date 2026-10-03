import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BuildIdentity } from "../../app/components/BuildIdentity";
import type { BuildInfo } from "../../app/lib/build-info-types";

const fullSha = "0123456789abcdef0123456789abcdef01234567";

const render = (
  buildInfo: BuildInfo,
  locale: "en" | "de" | "fr" | "it" = "en",
) =>
  renderToStaticMarkup(<BuildIdentity buildInfo={buildInfo} locale={locale} />);

describe("BuildIdentity", () => {
  it("renders an explicit production label, short SHA, and localized UTC date", () => {
    const buildInfo: BuildInfo = {
      environment: "production",
      commitSha: fullSha,
      identity: fullSha.slice(0, 7),
      commitTimestamp: "2026-10-03T23:30:00.000Z",
    };
    const english = render(buildInfo);
    const german = render(buildInfo, "de");

    expect(english).toMatch(/PRODUCTION.*0123456.*\[Oct 3, 2026\]/);
    expect(german).toContain("[03.10.2026]");
    expect(english).not.toContain(
      "0123456789abcdef0123456789abcdef01234567</summary>",
    );
  });

  it.each([
    ["preview", "PREVIEW"],
    ["staging", "STAGING / QA"],
    ["development", "DEVELOPMENT"],
  ] as const)("renders a distinct %s label", (environment, label) => {
    expect(
      render({
        environment,
        ...(environment === "staging" ? { targetEnvironment: "qa" } : {}),
      }),
    ).toContain(label);
  });

  it("gracefully omits unavailable optional metadata", () => {
    const markup = render({ environment: "preview" });
    expect(markup).toContain("PREVIEW");
    expect(markup).not.toContain("<details");
    expect(markup).not.toContain("undefined");
  });

  it("keeps the full SHA in keyboard-accessible native diagnostics", () => {
    const markup = render({
      environment: "preview",
      branch: "fix-map",
      commitSha: fullSha,
    });
    expect(markup).toContain("<details");
    expect(markup).toContain("<summary");
    expect(markup).toContain('aria-label="Show build diagnostics"');
    expect(markup).toContain(`Commit: <code>${fullSha}</code>`);
  });

  it("visually truncates long branches while retaining the full accessible value", () => {
    const branch = `feature/${"very-long-branch-".repeat(8)}`;
    const markup = render({
      environment: "preview",
      branch,
      commitSha: "abcdef1",
    });
    expect(markup).toContain(`title="${branch}"`);
    expect(markup).toContain(`>${branch}</span>`);
  });

  it("uses wrapping, bounded elements suitable for narrow layouts", () => {
    const markup = render({
      environment: "development",
      branch: "local-development",
    });
    expect(markup).toContain('data-environment="development"');
    expect(markup).toContain("local-development");
  });

  it("links only validated HTTPS deployment hosts", () => {
    const valid = render({
      environment: "preview",
      commitSha: "abcdef1",
      deploymentUrl: "https://ultilog-git-topic-team.vercel.app",
    });
    expect(valid).toContain('href="https://ultilog-git-topic-team.vercel.app"');
    expect(valid).toContain('target="_blank" rel="noopener noreferrer"');

    for (const deploymentUrl of [
      "http://ultilog.vercel.app",
      "https://ultilog.vercel.app.evil.example",
      "https://example.com",
    ]) {
      expect(
        render({ environment: "preview", commitSha: "abcdef1", deploymentUrl }),
      ).not.toContain("href=");
    }
  });
});
