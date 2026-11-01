export const DEFAULT_TARGET = "zh-Hans";
export const LANGUAGES: [string, string][] = [
  ["zh-Hans", "Chinese (Simplified)"],
  ["zh-Hant", "Chinese (Traditional)"],
  ["en", "English"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["fr", "French"],
  ["de", "German"],
  ["es", "Spanish"],
  ["ru", "Russian"],
];

export const DEFAULT_THEME = "default";
export const THEMES: [string, string][] = [
  ["default", "Plain"],
  ["claude", "Claude"],
];

export type Request =
  | { type: "translate"; texts: string[] }
  | { type: "toggle" }
  | { type: "toggle-active" };
export type TranslateResponse =
  | { ok: true; translations: string[] }
  | { ok: false; error: string };

export function needsTranslation(text: string, target: string): boolean {
  if (!/\p{L}/u.test(text)) return false;
  if (target.startsWith("zh") && /\p{Script=Han}/u.test(text) && !/[A-Za-z]{3}/.test(text)) return false;
  return true;
}
