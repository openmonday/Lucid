const STYLE_ID = "bt-dark-style";
const DEFAULT_ENABLED = true;
let enabled = DEFAULT_ENABLED;
const media = matchMedia("(prefers-color-scheme: dark)");

const css = `
html[data-bt-dark="true"]{background:#181a1b!important;color:#d8dadd!important}
html[data-bt-dark="true"] body,html[data-bt-dark="true"] main,html[data-bt-dark="true"] article,html[data-bt-dark="true"] section,html[data-bt-dark="true"] nav,html[data-bt-dark="true"] header,html[data-bt-dark="true"] footer,html[data-bt-dark="true"] aside,html[data-bt-dark="true"] div{background-color:#202223!important;color:#d8dadd!important;border-color:#45484b!important}
html[data-bt-dark="true"] a{color:#8ab4f8!important}html[data-bt-dark="true"] h1,html[data-bt-dark="true"] h2,html[data-bt-dark="true"] h3,html[data-bt-dark="true"] h4,html[data-bt-dark="true"] h5,html[data-bt-dark="true"] h6,html[data-bt-dark="true"] strong,html[data-bt-dark="true"] b{color:#f0f1f2!important}
html[data-bt-dark="true"] input,html[data-bt-dark="true"] textarea,html[data-bt-dark="true"] select,html[data-bt-dark="true"] button{background-color:#2b2e30!important;color:#e4e6e8!important;border-color:#505459!important}
html[data-bt-dark="true"] img,html[data-bt-dark="true"] video,html[data-bt-dark="true"] canvas{filter:brightness(.82)!important}
html[data-bt-dark="true"] pre,html[data-bt-dark="true"] code{background:#151718!important;color:#d8dadd!important}
`;

function setDark() {
  const active = enabled && media.matches;
  let style = document.getElementById(STYLE_ID);
  if (active) {
    if (!style) { style = document.createElement("style"); style.id = STYLE_ID; style.textContent = css; document.documentElement.append(style); }
    document.documentElement.dataset.btDark = "true";
  } else {
    style?.remove();
    delete document.documentElement.dataset.btDark;
  }
}

chrome.storage.sync.get({ darkMode: DEFAULT_ENABLED }).then(v => { enabled = v.darkMode !== false; setDark(); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.darkMode) { enabled = changes.darkMode.newValue !== false; setDark(); }
});
media.addEventListener("change", setDark);
