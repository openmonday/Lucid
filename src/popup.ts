import { DEFAULT_TARGET, DEFAULT_THEME, LANGUAGES } from "./shared";

const target = document.getElementById("target") as HTMLSelectElement;
for (const [code, name] of LANGUAGES) target.add(new Option(name, code));
chrome.storage.sync.get({ target: DEFAULT_TARGET }).then(v => { target.value = v.target as string; });
target.addEventListener("change", () => chrome.storage.sync.set({ target: target.value }));

document.getElementById("toggle")!.addEventListener("click", () => {
  void chrome.runtime.sendMessage({ type: "toggle-active" });
  window.close();
});

const groups = document.querySelectorAll<HTMLDivElement>("[data-theme-group]");
const keys = ["translationTheme", "viewerTheme"];

async function load() {
  const values = await chrome.storage.sync.get({ translationTheme: DEFAULT_THEME, viewerTheme: DEFAULT_THEME });
  groups.forEach(group => {
    const key = group.dataset.themeGroup!;
    group.querySelectorAll<HTMLButtonElement>("[data-theme]").forEach(button => {
      button.classList.toggle("active", button.dataset.theme === values[key]);
    });
  });
}

groups.forEach(group => {
  group.querySelectorAll<HTMLButtonElement>("[data-theme]").forEach(button => {
    button.addEventListener("click", async () => {
      const key = group.dataset.themeGroup!;
      await chrome.storage.sync.set({ [key]: button.dataset.theme });
      group.querySelectorAll("[data-theme]").forEach(item => item.classList.toggle("active", item === button));
    });
  });
});

void load();

const dark = document.getElementById("dark")!;
async function loadDark() {
  const value = await chrome.storage.sync.get({ darkMode: true });
  dark.textContent = value.darkMode === false ? "Dark mode: Off" : "Dark mode: Auto";
}
dark.addEventListener("click", async () => {
  const value = await chrome.storage.sync.get({ darkMode: true });
  await chrome.storage.sync.set({ darkMode: value.darkMode === false });
  void loadDark();
});
void loadDark();
