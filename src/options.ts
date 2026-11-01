import { DEFAULT_TARGET, DEFAULT_THEME, LANGUAGES, THEMES } from "./shared";

const select = document.getElementById("target") as HTMLSelectElement;
for (const [code, name] of LANGUAGES) select.add(new Option(name, code));

async function load() {
  const values = await chrome.storage.sync.get({ target: DEFAULT_TARGET, translationTheme: DEFAULT_THEME, viewerTheme: DEFAULT_THEME });
  select.value = values.target as string;
  (document.getElementById("translationTheme") as HTMLSelectElement).value = values.translationTheme as string;
  (document.getElementById("viewerTheme") as HTMLSelectElement).value = values.viewerTheme as string;
}
for (const id of ["translationTheme", "viewerTheme"] as const) {
  const element = document.getElementById(id) as HTMLSelectElement;
  for (const [code, name] of THEMES) element.add(new Option(name, code));
  element.addEventListener("change", () => chrome.storage.sync.set({ [id]: element.value }));
}
select.addEventListener("change", () => chrome.storage.sync.set({ target: select.value }));
void load();
