import { createLogger } from './logger';
import { DEFAULT_THEME_NAME } from './types/theme';

const log = createLogger();

export const THEME_STORAGE_KEY = 'besThemeName';

/**
 * The theme name is mirrored out of the IndexedDB config into `chrome.storage.local` so that
 * `document_start` can theme the page without waiting on the service worker to wake up. The
 * config database remains the source of truth; this is only ever a cache of one field.
 *
 * Lives apart from `theme.ts` because the background worker writes the mirror and must not pull
 * in DOM-dependent code.
 */
export async function readMirroredThemeName(): Promise<string> {
  try {
    const stored = await chrome.storage.local.get(THEME_STORAGE_KEY);

    return stored?.[THEME_STORAGE_KEY] ?? DEFAULT_THEME_NAME;
  } catch (error: unknown) {
    log.error(`Failed to read the mirrored theme name: ${error}`);

    return DEFAULT_THEME_NAME;
  }
}

export async function writeMirroredThemeName(themeName: string): Promise<void> {
  try {
    await chrome.storage.local.set({ [THEME_STORAGE_KEY]: themeName });
  } catch (error: unknown) {
    log.error(`Failed to mirror the theme name: ${error}`);
  }
}
