// Wire format shared by page extraction, rendering, and engine validation.
export const PLACEHOLDER = /\[ZT_KEEP_(\d+)\]/g;
export const placeholder = (index: number) => `[ZT_KEEP_${index}]`;
