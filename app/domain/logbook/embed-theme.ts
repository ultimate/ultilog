import type { CSSProperties } from "react";

export const embedThemeDefaults = {
  background: "#eef4f8",
  surface: "#ffffff",
  text: "#102033",
  accent: "#0f6b8f",
} as const;

export type EmbedTheme = Record<keyof typeof embedThemeDefaults, string>;

const colorParameterNames = {
  background: "bg",
  surface: "surface",
  text: "text",
  accent: "accent",
} as const;

export function parseEmbedTheme(searchParams: Record<string, string | string[] | undefined>): EmbedTheme {
  return Object.fromEntries(Object.entries(colorParameterNames).map(([key, parameter]) => {
    const candidate = searchParams[parameter];
    const value = Array.isArray(candidate) ? candidate[0] : candidate;
    return [key, isHexColor(value) ? value : embedThemeDefaults[key as keyof EmbedTheme]];
  })) as EmbedTheme;
}

export function embedThemeStyle(theme: EmbedTheme): CSSProperties {
  // The shared sheet still contains components from both the original and the
  // refreshed design systems. Feed both token sets from the same four public
  // colors, and derive secondary tokens rather than exposing more controls.
  const border = `color-mix(in srgb, ${theme.text} 20%, ${theme.surface})`;
  const subtleText = `color-mix(in srgb, ${theme.text} 72%, ${theme.background})`;
  const softAccent = `color-mix(in srgb, ${theme.accent} 12%, ${theme.surface})`;
  return {
    "--app-bg": theme.background,
    "--bg": theme.background,
    "--background": theme.background,
    "--surface": theme.surface,
    "--surface-strong": theme.surface,
    "--card": theme.surface,
    "--text": theme.text,
    "--foreground": theme.text,
    "--subtle": subtleText,
    "--muted": subtleText,
    "--blue": theme.accent,
    "--blue-soft": softAccent,
    "--primary": theme.accent,
    "--primary-dark": theme.accent,
    "--line": border,
    "--border": border,
  } as CSSProperties;
}

function isHexColor(value: string | undefined): value is string {
  return Boolean(value && /^#[0-9a-f]{6}$/i.test(value));
}
