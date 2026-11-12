import Logger from './logger';
import { KeyboardSettings, KeyboardAction, DEFAULT_KEYBOARD_SETTINGS, keyBindingToString } from './types/keyboard';

const log = new Logger();

export interface PlayerCommands {
  playPause: () => void;
  prevTrack: () => void;
  nextTrack: () => void;
  seekBy: (seconds: number) => void;
  adjustVolumeBy: (delta: number) => void;
  prevAlbum?: () => void;
  nextAlbum?: () => void;
}

interface KeyHandlers {
  [combo: string]: () => void;
}

interface Registration {
  commands: PlayerCommands;
  isActive: () => boolean;
  controlsSelector?: string;
  handlers: KeyHandlers;
}

const registrations: Registration[] = [];
let currentSettings: KeyboardSettings = DEFAULT_KEYBOARD_SETTINGS;
let listening = false;

function commandForEachAction(
  commands: PlayerCommands,
  settings: KeyboardSettings
): Record<KeyboardAction, (() => void) | undefined> {
  return {
    [KeyboardAction.PLAY_PAUSE]: commands.playPause,
    [KeyboardAction.PLAY_PAUSE_ALT]: commands.playPause,
    [KeyboardAction.PREV_TRACK]: commands.prevTrack,
    [KeyboardAction.NEXT_TRACK]: commands.nextTrack,
    [KeyboardAction.PREV_ALBUM]: commands.prevAlbum,
    [KeyboardAction.NEXT_ALBUM]: commands.nextAlbum,
    [KeyboardAction.SEEK_FORWARD]: () => commands.seekBy(settings.seekStepSize),
    [KeyboardAction.SEEK_BACKWARD]: () => commands.seekBy(-settings.seekStepSize),
    [KeyboardAction.SEEK_FORWARD_LARGE]: () => commands.seekBy(settings.largeSeekStepSize),
    [KeyboardAction.SEEK_BACKWARD_LARGE]: () => commands.seekBy(-settings.largeSeekStepSize),
    [KeyboardAction.VOLUME_UP]: () => commands.adjustVolumeBy(settings.volumeStep),
    [KeyboardAction.VOLUME_DOWN]: () => commands.adjustVolumeBy(-settings.volumeStep)
  };
}

export function buildKeyHandlers(settings: KeyboardSettings, commands: PlayerCommands): KeyHandlers {
  const byAction = commandForEachAction(commands, settings);

  return settings.controls
    .filter(control => control.enabled && byAction[control.action])
    .reduce<KeyHandlers>((handlers, control) => {
      handlers[keyBindingToString(control.binding)] = byAction[control.action]!;
      return handlers;
    }, {});
}

function isBareModifier(event: KeyboardEvent): boolean {
  return event.key === 'Meta' && !event.altKey && !event.ctrlKey && !event.shiftKey;
}

const KEY_CAPTURE_SELECTOR =
  'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [data-bes-capture-keys]';

function ownsTarget(registration: Registration, target: EventTarget | null): boolean {
  if (target === document.body) return true;
  if (!registration.controlsSelector || !(target instanceof HTMLElement)) return false;

  return Boolean(target.closest(registration.controlsSelector)) && !target.closest(KEY_CAPTURE_SELECTOR);
}

function activeRegistration(target: EventTarget | null): Registration | undefined {
  return [...registrations]
    .reverse()
    .find(registration => registration.isActive() && ownsTarget(registration, target));
}

export function handleShortcutKeydown(event: KeyboardEvent): void {
  if (isBareModifier(event)) return;

  const registration = activeRegistration(event.target);
  if (!registration) return;

  const combo = keyBindingToString({
    key: event.key,
    alt: event.altKey,
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
    meta: event.metaKey
  });

  const handler = registration.handlers[combo] ?? registration.handlers[event.key];
  if (!handler) return;

  log.info(`Keyboard shortcut: ${combo}`);
  handler();
  event.preventDefault();
}

export function registerPlayerShortcuts(
  commands: PlayerCommands,
  isActive: () => boolean = () => true,
  controlsSelector?: string
): void {
  registrations.push({
    commands,
    isActive,
    controlsSelector,
    handlers: buildKeyHandlers(currentSettings, commands)
  });

  if (listening) return;

  document.addEventListener('keydown', handleShortcutKeydown);
  listening = true;
}

export function updateKeyboardSettings(settings: KeyboardSettings): void {
  log.info('Updating keyboard shortcuts');

  currentSettings = settings;
  registrations.forEach(registration => {
    registration.handlers = buildKeyHandlers(settings, registration.commands);
  });
}
