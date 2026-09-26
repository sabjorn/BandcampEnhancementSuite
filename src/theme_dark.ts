/*
 * Registered by the config backend at document_start, and only while dark mode is on.
 *
 * There is nothing to look up here: the script's presence is the setting. That is what lets the
 * theme land before first paint without document_start reading config, which the two-phase split
 * in 660f680 deliberately keeps it clear of.
 *
 * The attribute this sets is also what document_end toggles at runtime, so flipping the drawer
 * switch re-themes an open tab without a reload.
 */
import { DARK_THEME } from './types/theme';
import { THEME_ATTRIBUTE } from './theme';

document.documentElement.setAttribute(THEME_ATTRIBUTE, DARK_THEME.name);
