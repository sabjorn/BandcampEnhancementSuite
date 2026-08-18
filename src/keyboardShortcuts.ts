import Logger from './logger';
import { KeyboardSettings, KeyboardAction, DEFAULT_KEYBOARD_SETTINGS, keyBindingToString } from './types/keyboard';

const log = new Logger();

export interface PlayerCommands {
  playPause: () => void;
  prevTrack: () => void;
  nextTrack: () => void;
  seekBy: (seconds: number) => void;
  adjustVolumeBy: (delta: number) => void;
}

interface KeyHandlers {
  [combo: string]: () => void;
}

interface Registration {
  commands: PlayerCommands;
  isActive: () => boolean;
  handlers: KeyHandlers;
}

const registrations: Registration[] = [];
let currentSettings: KeyboardSettings = DEFAULT_KEYBOARD_SETTINGS;
let listening = false;

function commandForEachAction(
  commands: PlayerCommands,
  settings: KeyboardSettings
): Record<KeyboardAction, () => void> {
  return {
    [KeyboardAction.PLAY_PAUSE]: commands.playPause,
    [KeyboardAction.PLAY_PAUSE_ALT]: commands.playPause,
    [KeyboardAction.PREV_TRACK]: commands.prevTrack,
    [KeyboardAction.NEXT_TRACK]: commands.nextTrack,
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
    .filter(control => control.enabled)
    .reduce<KeyHandlers>((handlers, control) => {
      handlers[keyBindingToString(control.binding)] = byAction[control.action];
      return handlers;
    }, {});
}

export function shouldHandleShortcut(target: EventTarget | null): boolean {
  return target === document.body;
}

function isBareModifier(event: KeyboardEvent): boolean {
  return event.key === 'Meta' && !event.altKey && !event.ctrlKey && !event.shiftKey;
}

function activeRegistration(): Registration | undefined {
  return [...registrations].reverse().find(registration => registration.isActive());
}

export function handleShortcutKeydown(event: KeyboardEvent): void {
  if (!shouldHandleShortcut(event.target) || isBareModifier(event)) return;

  const registration = activeRegistration();
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

export function registerPlayerShortcuts(commands: PlayerCommands, isActive: () => boolean = () => true): void {
  registrations.push({
    commands,
    isActive,
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
