// Local `.md` files are opened by the browser as plain text. Keep the file URL
// in the address bar and mount the Markdown viewer in an extension iframe so
// links, themes, math, and syntax highlighting keep working.
const MARKDOWN_FILE = /\.(md|markdown|mdown|mkd)$/i;

if (location.protocol === "file:" && MARKDOWN_FILE.test(location.pathname)) {
  // Hide the raw text before the first paint. The iframe explicitly restores
  // visibility for itself, so the file content never flashes as source.
  document.documentElement.style.visibility = "hidden";

  const mount = () => {
    if (!document.body) return;
    const fileName = decodeURIComponent(location.pathname.split("/").pop() || "Markdown");
    // Firefox and Zen do not let extension pages access file:// URLs, so the
    // viewer cannot fetch the file itself. Read the text from this page before
    // replacing it, then hand it to the iframe once it has loaded.
    const text = document.body.textContent ?? "";
    const iframe = document.createElement("iframe");
    iframe.addEventListener("load", () => {
      iframe.contentWindow?.postMessage(
        { type: "lucid:local-markdown", src: location.href, text },
        "*",
      );
    });
    iframe.src = chrome.runtime.getURL(
      `viewer.html?src=${encodeURIComponent(location.href)}&handoff=1`,
    );
    iframe.title = fileName;
    document.title = fileName;
    iframe.dataset.lucidViewer = "";
    iframe.style.cssText = [
      "position:fixed",
      "inset:0",
      "width:100%",
      "height:100%",
      "border:0",
      "margin:0",
      "background:transparent",
      "visibility:visible",
      "color-scheme:light dark",
    ].join(";");
    document.body.replaceChildren(iframe);
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
    document.documentElement.style.removeProperty("visibility");
    document.documentElement.style.overflow = "hidden";
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
}
