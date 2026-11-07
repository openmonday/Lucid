import { renderMarkdown } from "./render";
import { installViewerTheme } from "./viewer-theme";

// Local `.md` files are opened by the browser as plain text. Render the
// Markdown in place so relative links and images keep resolving against the
// file's own URL. An extension-page iframe cannot be used: Firefox never lets
// an extension-origin document load file:// subresources, so figures such as
// `figures/hash-buckets.svg` would stay blank there.
const MARKDOWN_FILE = /\.(md|markdown|mdown|mkd)$/i;

if (location.protocol === "file:" && MARKDOWN_FILE.test(location.pathname)) {
  // Hide the raw text before the first paint. Rendering replaces it below.
  document.documentElement.style.visibility = "hidden";
  // The rendered article carries the viewer's own light/dark palette, so keep
  // Dark Reader from theming it a second time.
  document.documentElement.dataset.lucidMarkdown = "";

  const addStyles = async () => {
    const response = await fetch(chrome.runtime.getURL("viewer.css"));
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const style = document.createElement("style");
    style.dataset.lucidViewer = "";
    style.textContent = await response.text();
    document.head.append(style);
  };

  const mount = async () => {
    if (!document.body) return;
    const text = document.body.textContent ?? "";
    const fileName = decodeURIComponent(location.pathname.split("/").pop() || "Markdown");
    const article = document.createElement("article");
    article.id = "content";
    article.className = "markdown-body";

    try {
      await addStyles().catch(error => {
        console.error("Lucid: could not load the Markdown viewer styles", error);
      });
      renderMarkdown(article, text);
      document.title = fileName;
      document.body.replaceChildren(article);
      await installViewerTheme().catch(error => {
        console.error("Lucid: could not load the viewer theme", error);
      });
    } catch (error) {
      // Leave the raw file visible if rendering fails.
      console.error("Lucid: could not render Markdown", error);
    } finally {
      document.documentElement.style.removeProperty("visibility");
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void mount(), { once: true });
  } else {
    void mount();
  }
}
