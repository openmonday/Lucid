import { DEFAULT_THEME } from "./shared";

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
