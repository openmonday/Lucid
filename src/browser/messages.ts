// Messages crossing extension contexts (background, content scripts, and extension pages).
export type ExtensionRequest =
  | { type: "translate"; texts: string[] }
  | { type: "toggle" }
  | { type: "toggle-active" }
  | FetchStylesheetRequest;

export type TranslateResponse =
  | { ok: true; translations: string[] }
  | { ok: false; error: string };

export type FetchStylesheetRequest = {
  type: "fetch-stylesheet";
  url: string;
};
export type FetchStylesheetResponse =
  | { ok: true; text: string; contentType: string }
  | { ok: false; error: string };
