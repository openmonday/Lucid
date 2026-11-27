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
export const DEFAULT_DARK_MODE = true;
export const THEMES: [string, string][] = [
  ["default", "Plain"],
  ["claude", "Claude"],
];

export type TranslationScope = "main" | "all";
export const DEFAULT_TRANSLATION_SCOPE: TranslationScope = "main";
export const TRANSLATION_SCOPES: [TranslationScope, string][] = [
  ["main", "Main content"],
  ["all", "Whole page"],
];
