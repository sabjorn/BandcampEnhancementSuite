export interface KeyBinding {
  key: string;
  shift?: boolean;
  alt?: boolean;
  ctrl?: boolean;
  meta?: boolean;
}

export enum KeyboardAction {
  PLAY_PAUSE = 'PLAY_PAUSE',
  PLAY_PAUSE_ALT = 'PLAY_PAUSE_ALT',
  PREV_TRACK = 'PREV_TRACK',
  NEXT_TRACK = 'NEXT_TRACK',
  PREV_ALBUM = 'PREV_ALBUM',
  NEXT_ALBUM = 'NEXT_ALBUM',
  SEEK_FORWARD = 'SEEK_FORWARD',
  SEEK_BACKWARD = 'SEEK_BACKWARD',
  SEEK_FORWARD_LARGE = 'SEEK_FORWARD_LARGE',
  SEEK_BACKWARD_LARGE = 'SEEK_BACKWARD_LARGE',
  VOLUME_UP = 'VOLUME_UP',
  VOLUME_DOWN = 'VOLUME_DOWN'
}

export const ACTION_DESCRIPTIONS: Record<KeyboardAction, string> = {
  [KeyboardAction.PLAY_PAUSE]: 'Play/Pause',
  [KeyboardAction.PLAY_PAUSE_ALT]: 'Play/Pause (Alternative)',
  [KeyboardAction.PREV_TRACK]: 'Previous Track',
  [KeyboardAction.NEXT_TRACK]: 'Next Track',
  [KeyboardAction.PREV_ALBUM]: 'Previous Album',
  [KeyboardAction.NEXT_ALBUM]: 'Next Album',
  [KeyboardAction.SEEK_FORWARD]: 'Seek Forward',
  [KeyboardAction.SEEK_BACKWARD]: 'Seek Backward',
  [KeyboardAction.SEEK_FORWARD_LARGE]: 'Seek Forward (Large)',
  [KeyboardAction.SEEK_BACKWARD_LARGE]: 'Seek Backward (Large)',
  [KeyboardAction.VOLUME_UP]: 'Volume Up',
  [KeyboardAction.VOLUME_DOWN]: 'Volume Down'
};

export enum ActionCategory {
  PLAYBACK = 'Playback',
  ALBUM = 'Album',
  SEEKING = 'Seeking',
  VOLUME = 'Volume'
}

export const ACTION_CATEGORIES: Record<KeyboardAction, ActionCategory> = {
  [KeyboardAction.PLAY_PAUSE]: ActionCategory.PLAYBACK,
  [KeyboardAction.PLAY_PAUSE_ALT]: ActionCategory.PLAYBACK,
  [KeyboardAction.PREV_TRACK]: ActionCategory.PLAYBACK,
  [KeyboardAction.NEXT_TRACK]: ActionCategory.PLAYBACK,
  [KeyboardAction.PREV_ALBUM]: ActionCategory.ALBUM,
  [KeyboardAction.NEXT_ALBUM]: ActionCategory.ALBUM,
  [KeyboardAction.SEEK_FORWARD]: ActionCategory.SEEKING,
  [KeyboardAction.SEEK_BACKWARD]: ActionCategory.SEEKING,
  [KeyboardAction.SEEK_FORWARD_LARGE]: ActionCategory.SEEKING,
  [KeyboardAction.SEEK_BACKWARD_LARGE]: ActionCategory.SEEKING,
  [KeyboardAction.VOLUME_UP]: ActionCategory.VOLUME,
  [KeyboardAction.VOLUME_DOWN]: ActionCategory.VOLUME
};

export interface KeyboardControlSetting {
  action: KeyboardAction;
  binding: KeyBinding;
  enabled: boolean;
}

export interface KeyboardSettings {
  controls: KeyboardControlSetting[];
  seekStepSize: number;
  largeSeekStepSize: number;
  volumeStep: number;
}

export const DEFAULT_KEYBOARD_SETTINGS: KeyboardSettings = {
  controls: [
    {
      action: KeyboardAction.PLAY_PAUSE,
      binding: { key: ' ' },
      enabled: true
    },
    {
      action: KeyboardAction.PLAY_PAUSE_ALT,
      binding: { key: 'p' },
      enabled: true
    },
    {
      action: KeyboardAction.PREV_TRACK,
      binding: { key: 'ArrowUp' },
      enabled: true
    },
    {
      action: KeyboardAction.NEXT_TRACK,
      binding: { key: 'ArrowDown' },
      enabled: true
    },
    {
      action: KeyboardAction.PREV_ALBUM,
      binding: { key: '[' },
      enabled: true
    },
    {
      action: KeyboardAction.NEXT_ALBUM,
      binding: { key: ']' },
      enabled: true
    },
    {
      action: KeyboardAction.SEEK_FORWARD,
      binding: { key: 'ArrowRight' },
      enabled: true
    },
    {
      action: KeyboardAction.SEEK_BACKWARD,
      binding: { key: 'ArrowLeft' },
      enabled: true
    },
    {
      action: KeyboardAction.SEEK_FORWARD_LARGE,
      binding: { key: 'ArrowRight', shift: true },
      enabled: true
    },
    {
      action: KeyboardAction.SEEK_BACKWARD_LARGE,
      binding: { key: 'ArrowLeft', shift: true },
      enabled: true
    },
    {
      action: KeyboardAction.VOLUME_UP,
      binding: { key: 'ArrowUp', shift: true },
      enabled: true
    },
    {
      action: KeyboardAction.VOLUME_DOWN,
      binding: { key: 'ArrowDown', shift: true },
      enabled: true
    }
  ],
  seekStepSize: 10,
  largeSeekStepSize: 30,
  volumeStep: 0.05
};

export function keyBindingToString(binding: KeyBinding): string {
  const { key, alt = false, ctrl = false, shift = false, meta = false } = binding;

  const keyDisplay = key === ' ' ? 'Space' : key;

  const modifiers: string[] = [];
  if (alt) modifiers.push('Alt');
  if (ctrl) modifiers.push('Ctrl');
  if (shift) modifiers.push('Shift');
  if (meta) modifiers.push('Meta');

  return modifiers.length > 0 ? `${modifiers.join('+')}+${keyDisplay}` : keyDisplay;
}

export function keyBindingsEqual(a: KeyBinding, b: KeyBinding): boolean {
  return (
    a.key === b.key &&
    (a.shift ?? false) === (b.shift ?? false) &&
    (a.alt ?? false) === (b.alt ?? false) &&
    (a.ctrl ?? false) === (b.ctrl ?? false) &&
    (a.meta ?? false) === (b.meta ?? false)
  );
}

export function backfillKeyboardControls(settings: KeyboardSettings): KeyboardSettings {
  const configured = new Set(settings.controls.map(control => control.action));
  const missing = DEFAULT_KEYBOARD_SETTINGS.controls.filter(control => !configured.has(control.action));

  if (missing.length === 0) return settings;

  const takenBindings = settings.controls.filter(control => control.enabled).map(control => control.binding);

  const added = missing.map(control => ({
    action: control.action,
    binding: { ...control.binding },
    enabled: control.enabled && !takenBindings.some(binding => keyBindingsEqual(binding, control.binding))
  }));

  return { ...settings, controls: [...settings.controls, ...added] };
}

export function validateKeyboardSettings(settings: KeyboardSettings): string[] {
  const errors: string[] = [];

  const bindingMap = new Map<string, KeyboardAction[]>();

  for (const control of settings.controls) {
    if (!control.enabled) continue;

    const bindingStr = keyBindingToString(control.binding);

    if (!bindingMap.has(bindingStr)) {
      bindingMap.set(bindingStr, []);
    }
    bindingMap.get(bindingStr)!.push(control.action);
  }

  for (const [binding, actions] of bindingMap.entries()) {
    if (actions.length > 1) {
      const actionNames = actions.map(a => ACTION_DESCRIPTIONS[a]).join(', ');
      errors.push(`Duplicate key binding "${binding}" used for: ${actionNames}`);
    }
  }

  if (settings.seekStepSize <= 0) {
    errors.push('Seek step size must be greater than 0');
  }

  if (settings.largeSeekStepSize <= 0) {
    errors.push('Large seek step size must be greater than 0');
  }

  if (settings.volumeStep <= 0 || settings.volumeStep > 1) {
    errors.push('Volume step must be between 0 and 1');
  }

  return errors;
}
