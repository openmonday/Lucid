import { DEFAULT_TARGET, LANGUAGES } from "./shared";

const select = document.getElementById("target") as HTMLSelectElement;
for (const [code, name] of LANGUAGES) select.add(new Option(name, code));
chrome.storage.sync.get({ target: DEFAULT_TARGET }).then(({ target }) => { select.value = target as string; });
select.addEventListener("change", async () => {
  await chrome.storage.sync.set({ target: select.value });
  document.getElementById("status")!.textContent = "Saved. Toggle translation again to apply.";
});
