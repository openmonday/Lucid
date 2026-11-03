// Dark Reader's embeddable API replaces chrome.runtime.sendMessage with a shim
// that forwards messages but does not return the native promise. That would
// break the translator's `await chrome.runtime.sendMessage(...)`, so keep a
// reference to the native function and route only Dark Reader's internal
// stylesheet-fetch messages through its shim.
type SendMessage = (...args: any[]) => any;

export const nativeSendMessage = chrome.runtime.sendMessage.bind(
  chrome.runtime,
) as SendMessage;

const DARK_READER_FETCH = "cs-bg-fetch";

export function installSendMessageRouter(): void {
  const patched = chrome.runtime.sendMessage as SendMessage;
  if (patched === nativeSendMessage) return;

  chrome.runtime.sendMessage = ((...args: any[]) => {
    const message = args[0] as { type?: string } | undefined;
    if (message?.type === DARK_READER_FETCH) {
      return patched(...args);
    }
    return nativeSendMessage(...args);
  }) as typeof chrome.runtime.sendMessage;
}
