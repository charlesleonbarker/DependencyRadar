export type ColorSchemeId = "light" | "dark";

export interface ColorSchemeOption {
  id: ColorSchemeId;
  label: string;
  note: string;
}

export const COLOR_SCHEMES: ColorSchemeOption[] = [
  { id: "light", label: "Light", note: "Neutral workbench palette for bright rooms." },
  { id: "dark", label: "Dark", note: "Colour-vision-friendly dark palette using the Okabe-Ito categorical colours." },
];

const COOKIE_NAME = "dependency-radar-color-scheme";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isColorSchemeId(value: string): value is ColorSchemeId {
  return COLOR_SCHEMES.some((scheme) => scheme.id === value);
}

export function readColorSchemeCookie(): ColorSchemeId {
  if (typeof document === "undefined") return "dark";

  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  const value = cookie ? decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1)) : "";
  if (value === "rg-color-blind" || value === "okabe-ito") return "dark";
  return isColorSchemeId(value) ? value : "dark";
}

export function writeColorSchemeCookie(scheme: ColorSchemeId): void {
  if (typeof document === "undefined") return;

  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(scheme)}; Max-Age=${COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}
