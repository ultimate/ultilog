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
  return {
    "--background": theme.background,
    "--card": theme.surface,
    "--foreground": theme.text,
    "--muted": theme.text,
    "--primary": theme.accent,
    "--primary-dark": theme.accent,
    "--border": `color-mix(in srgb, ${theme.text} 20%, ${theme.surface})`,
  } as CSSProperties;
}

function isHexColor(value: string | undefined): value is string {
  return Boolean(value && /^#[0-9a-f]{6}$/i.test(value));
}
