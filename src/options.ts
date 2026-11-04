import {
  DEFAULT_TARGET,
  DEFAULT_THEME,
  DEFAULT_TRANSLATION_SCOPE,
  LANGUAGES,
  THEMES,
  TRANSLATION_SCOPES,
} from "./shared";

const select = document.getElementById("target") as HTMLSelectElement;
const scope = document.getElementById("translationScope") as HTMLSelectElement;
for (const [code, name] of LANGUAGES) select.add(new Option(name, code));
for (const [code, name] of TRANSLATION_SCOPES) scope.add(new Option(name, code));

async function load() {
  const values = await chrome.storage.sync.get({
    target: DEFAULT_TARGET,
    translationScope: DEFAULT_TRANSLATION_SCOPE,
    translationTheme: DEFAULT_THEME,
    viewerTheme: DEFAULT_THEME,
  });
  select.value = values.target as string;
  scope.value = values.translationScope as string;
  (document.getElementById("translationTheme") as HTMLSelectElement).value = values.translationTheme as string;
  (document.getElementById("viewerTheme") as HTMLSelectElement).value = values.viewerTheme as string;
}
for (const id of ["translationTheme", "viewerTheme"] as const) {
  const element = document.getElementById(id) as HTMLSelectElement;
  for (const [code, name] of THEMES) element.add(new Option(name, code));
  element.addEventListener("change", () => chrome.storage.sync.set({ [id]: element.value }));
}
select.addEventListener("change", () => chrome.storage.sync.set({ target: select.value }));
scope.addEventListener("change", () => chrome.storage.sync.set({ translationScope: scope.value }));
void load();
