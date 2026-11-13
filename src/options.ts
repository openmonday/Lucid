import {
  DEFAULT_TARGET,
  DEFAULT_THEME,
  DEFAULT_TRANSLATION_SCOPE,
  ENGINES,
  LANGUAGES,
  LLM_APIS,
  THEMES,
  TRANSLATION_SCOPES,
  type EngineId,
  type LlmApiStyle,
  type TranslateResponse,
} from "./shared.ts";
import { loadEngineSettings, saveEngineSettings } from "./translate/settings.ts";

const select = document.getElementById("target") as HTMLSelectElement;
const scope = document.getElementById("translationScope") as HTMLSelectElement;
for (const [code, name] of LANGUAGES) select.add(new Option(name, code));
for (const [code, name] of TRANSLATION_SCOPES) scope.add(new Option(name, code));

// ---- translation engine ----
const engine = document.getElementById("engine") as HTMLSelectElement;
const llmApi = document.getElementById("llmApi") as HTMLSelectElement;
const llmBaseUrl = document.getElementById("llmBaseUrl") as HTMLInputElement;
const llmModel = document.getElementById("llmModel") as HTMLInputElement;
const llmApiKey = document.getElementById("llmApiKey") as HTMLInputElement;
const llmFallback = document.getElementById("llmFallback") as HTMLInputElement;
const llmConfig = document.getElementById("llm-config") as HTMLFieldSetElement;
const testButton = document.getElementById("llm-test") as HTMLButtonElement;
const testResult = document.getElementById("llm-test-result") as HTMLParagraphElement;

for (const [code, name] of ENGINES) engine.add(new Option(name, code));
for (const [code, name] of LLM_APIS) llmApi.add(new Option(name, code));

function syncVisibility() {
  llmConfig.disabled = engine.value !== "llm";
}

async function saveEngineSettingsForm() {
  await saveEngineSettings({
    engine: engine.value as EngineId,
    llmBaseUrl: llmBaseUrl.value,
    llmModel: llmModel.value,
    llmApi: llmApi.value as LlmApiStyle,
    llmApiKey: llmApiKey.value,
    llmFallback: llmFallback.checked,
  });
}

engine.addEventListener("change", async () => {
  syncVisibility();
  await saveEngineSettingsForm();
  testResult.textContent = "";
});
for (const element of [llmBaseUrl, llmModel]) {
  element.addEventListener("change", () => void saveEngineSettingsForm());
}
for (const element of [llmApi, llmApiKey, llmFallback]) {
  element.addEventListener("change", () => void saveEngineSettingsForm());
}

testButton.addEventListener("click", async () => {
  testButton.disabled = true;
  testResult.textContent = "Translating…";
  try {
    await saveEngineSettingsForm();
    const response: TranslateResponse = await chrome.runtime.sendMessage({
      type: "translate",
      texts: ["Functional Core, Imperative Shell"],
    });
    testResult.textContent = response.ok
      ? response.translations[0]
      : `Failed: ${response.error}`;
  } catch (error) {
    testResult.textContent = `Failed: ${String((error as Error)?.message ?? error)}`;
  } finally {
    testButton.disabled = false;
  }
});

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

  const settings = await loadEngineSettings();
  engine.value = settings.engine;
  llmBaseUrl.value = settings.llmBaseUrl;
  llmModel.value = settings.llmModel;
  llmApi.value = settings.llmApi;
  llmApiKey.value = settings.llmApiKey;
  llmFallback.checked = settings.llmFallback;
  syncVisibility();
}

for (const id of ["translationTheme", "viewerTheme"] as const) {
  const element = document.getElementById(id) as HTMLSelectElement;
  for (const [code, name] of THEMES) element.add(new Option(name, code));
  element.addEventListener("change", () => chrome.storage.sync.set({ [id]: element.value }));
}
select.addEventListener("change", () => chrome.storage.sync.set({ target: select.value }));
scope.addEventListener("change", () => chrome.storage.sync.set({ translationScope: scope.value }));
void load();
