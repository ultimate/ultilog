import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BuildIdentity, isTrustedDeploymentUrl } from "../../app/components/BuildIdentity";
import { parseBuildInfo } from "../../app/lib/build-info-types";

const render = (value: Parameters<typeof parseBuildInfo>[0], placement?: "sidebar" | "profile") =>
  renderToStaticMarkup(<BuildIdentity buildInfo={parseBuildInfo(value)} placement={placement} />);

describe("BuildIdentity", () => {
  it("renders a production release with an accessible environment label", () => {
    const markup = render({ environment: "production", version: "260930.2" });
    expect(markup).toContain("PRODUCTION");
    expect(markup).toContain("v260930.2");
    expect(markup).toContain('aria-label="Production build v260930.2"');
  });

  it("renders preview branch and short SHA while retaining full diagnostics", () => {
    const markup = render({ environment: "preview", branch: "feature/logbook", commitSha: "abcdef1234567890", deploymentUrl: "https://ultilog-git-feature.vercel.app" });
    expect(markup).toContain("PREVIEW");
    expect(markup).toContain("feature/logbook");
    expect(markup).toContain("abcdef1");
    expect(markup).toContain("abcdef1234567890");
    expect(markup).toContain('<a href="https://ultilog-git-feature.vercel.app"');
  });

  it.each([
    [{ environment: "staging", targetEnvironment: "quality-assurance", branch: "staging", commitSha: "1234567890" }, "QUALITY-ASSURANCE", "quality-assurance build"],
    [{ environment: "development" }, "DEVELOPMENT", "Development build"],
  ] as const)("renders an explicit non-production environment", (buildInfo, visibleLabel, accessibleLabel) => {
    const markup = render(buildInfo);
    expect(markup).toContain(visibleLabel);
    expect(markup).toContain(`aria-label="${accessibleLabel}`);
  });

  it("gracefully renders missing optional metadata", () => {
    const markup = render({ environment: "preview" });
    expect(markup).toContain("PREVIEW");
    expect(markup).not.toContain("undefined");
    expect(markup).not.toContain("<details");
  });

  it("uses the keyboard-native details control for diagnostics", () => {
    const markup = render({ environment: "preview", commitSha: "abcdef1234567" });
    expect(markup).toContain("<details");
    expect(markup).toContain("<summary>");
    expect(markup).toContain("Details");
  });

  it("keeps a long branch as text and exposes its full value", () => {
    const branch = `feature/${"very-long-branch-".repeat(20)}<not-html>`;
    const markup = render({ environment: "preview", branch });
    expect(markup).toContain(`title="${branch.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}"`);
    expect(markup).toContain("&lt;not-html&gt;");
    expect(markup).not.toContain("<not-html>");
  });

  it("provides a dedicated profile layout hook for narrow mobile pages", () => {
    expect(render({ environment: "development" }, "profile")).toContain("build-identity--profile");
  });

  it("links only expected HTTPS deployment hosts", () => {
    expect(isTrustedDeploymentUrl("https://project.vercel.app/path")).toBe(true);
    expect(isTrustedDeploymentUrl("http://project.vercel.app")).toBe(false);
    expect(isTrustedDeploymentUrl("https://vercel.app.attacker.example")).toBe(false);
    const markup = render({ environment: "preview", deploymentUrl: "https://example.com/deploy" });
    expect(markup).toContain("https://example.com/deploy");
    expect(markup).not.toContain('<a href="https://example.com/deploy"');
  });
});
