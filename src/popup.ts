import { DEFAULT_TARGET, DEFAULT_THEME, LANGUAGES } from "./shared";

const CHECK = '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>';

// ---- language dropdown ----
const dd = document.getElementById("dd")!;
const ddBtn = document.getElementById("dd-btn")!;
const ddLabel = document.getElementById("dd-label")!;
const menu = document.getElementById("menu")!;
let target = DEFAULT_TARGET;

function renderTarget() {
  ddLabel.textContent = LANGUAGES.find(([code]) => code === target)?.[1] ?? target;
  menu.querySelectorAll<HTMLButtonElement>("button").forEach(b => b.classList.toggle("sel", b.dataset.code === target));
}

for (const [code, name] of LANGUAGES) {
  const item = document.createElement("button");
  item.type = "button";
  item.dataset.code = code;
  item.setAttribute("role", "option");
  item.innerHTML = `<span></span>${CHECK}`;
  item.firstElementChild!.textContent = name;
  item.addEventListener("click", async () => {
    target = code;
    renderTarget();
    dd.classList.remove("open");
    await chrome.storage.sync.set({ target });
  });
  menu.append(item);
}

ddBtn.addEventListener("click", e => {
  e.stopPropagation();
  dd.classList.toggle("open");
  menu.querySelector(".sel")?.scrollIntoView({ block: "nearest" });
});
document.addEventListener("click", () => dd.classList.remove("open"));
document.addEventListener("keydown", e => { if (e.key === "Escape") dd.classList.remove("open"); });

chrome.storage.sync.get({ target: DEFAULT_TARGET }).then(v => { target = v.target as string; renderTarget(); });
renderTarget();

// ---- load keyboard shortcut ----
chrome.commands.getAll().then(commands => {
  const toggleCmd = commands.find(c => c.name === "toggle-translate");
  const shortcut = toggleCmd?.shortcut || "Not set";
  const kbd = document.getElementById("shortcut-key");
  if (kbd) kbd.textContent = shortcut;
});

// ---- translate ----
document.getElementById("toggle")!.addEventListener("click", () => {
  void chrome.runtime.sendMessage({ type: "toggle-active" });
  window.close();
});

// ---- open full settings ----
document.getElementById("open-settings")!.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
  window.close();
});

// ---- dark mode switch ----
const darkSwitch = document.getElementById("dark-switch")!;
async function loadDark() {
  const value = await chrome.storage.sync.get({ darkMode: true });
  darkSwitch.classList.toggle("on", value.darkMode !== false);
}
darkSwitch.addEventListener("click", async () => {
  const value = await chrome.storage.sync.get({ darkMode: true });
  await chrome.storage.sync.set({ darkMode: value.darkMode === false });
  void loadDark();
});

// ---- theme segments ----
const groups = document.querySelectorAll<HTMLDivElement>("[data-theme-group]");

async function loadThemes() {
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
      await chrome.storage.sync.set({ [group.dataset.themeGroup!]: button.dataset.theme });
      group.querySelectorAll("[data-theme]").forEach(item => item.classList.toggle("active", item === button));
    });
  });
});

void loadDark();
void loadThemes();
