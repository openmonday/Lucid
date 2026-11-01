import { DEFAULT_TARGET, DEFAULT_THEME, LANGUAGES, THEMES } from "./shared";

const select = document.getElementById("target") as HTMLSelectElement;
const themeSelect = document.getElementById("theme") as HTMLSelectElement;
for (const [code, name] of LANGUAGES) select.add(new Option(name, code));
for (const [code, name] of THEMES) themeSelect.add(new Option(name, code));
chrome.storage.sync.get({ target: DEFAULT_TARGET, theme: DEFAULT_THEME }).then(({ target, theme }) => { 
  select.value = target as string;
  themeSelect.value = theme as string;
});
select.addEventListener("change", async () => {
  await chrome.storage.sync.set({ target: select.value });
  document.getElementById("status")!.textContent = "Saved. Toggle translation again to apply.";
});
themeSelect.addEventListener("change", async () => {
  await chrome.storage.sync.set({ theme: themeSelect.value });
  document.getElementById("status")!.textContent = "Theme saved.";
});
