export const DEFAULT_TARGET = "zh-Hans";
export const LANGUAGES: [string, string][] = [
  ["zh-Hans", "简体中文"],
  ["zh-Hant", "繁體中文"],
  ["en", "English"],
  ["ja", "日本語"],
  ["ko", "한국어"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["es", "Español"],
  ["ru", "Русский"],
];

export type Request =
  | { type: "translate"; texts: string[] }
  | { type: "toggle" };
export type TranslateResponse =
  | { ok: true; translations: string[] }
  | { ok: false; error: string };

export function needsTranslation(text: string, target: string): boolean {
  if (!/\p{L}/u.test(text)) return false;
  if (target.startsWith("zh") && /\p{Script=Han}/u.test(text) && !/[A-Za-z]{3}/.test(text)) return false;
  return true;
}
