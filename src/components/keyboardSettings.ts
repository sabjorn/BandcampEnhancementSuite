import {
  KeyBinding,
  KeyboardSettings,
  KeyboardControlSetting,
  ACTION_DESCRIPTIONS,
  ACTION_CATEGORIES,
  ActionCategory,
  keyBindingToString,
  keyBindingsEqual,
  DEFAULT_KEYBOARD_SETTINGS
} from '../types/keyboard.js';

interface KeyBindingEditorCallbacks {
  onBindingChange: (newBinding: KeyBinding) => void;
  onCancel?: () => void;
}

export function createKeyBindingEditor(currentBinding: KeyBinding, callbacks: KeyBindingEditorCallbacks): HTMLElement {
  const container = document.createElement('div');
  container.className = 'bes-key-binding-editor-container';

  const display = document.createElement('button');
  display.className = 'bes-key-binding-display';
  display.textContent = keyBindingToString(currentBinding);
  display.title = 'Click to change key binding';

  let isRecording = false;
  const abortController = new AbortController();

  const startRecording = () => {
    isRecording = true;
    display.classList.add('recording');
    display.textContent = 'Press any key...';
  };

  const stopRecording = () => {
    isRecording = false;
    display.classList.remove('recording');
    display.textContent = keyBindingToString(currentBinding);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!isRecording) return;

    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      stopRecording();
      callbacks.onCancel?.();
      return;
    }

    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) {
      return;
    }

    const newBinding: KeyBinding = {
      key: e.key,
      shift: e.shiftKey,
      alt: e.altKey,
      ctrl: e.ctrlKey,
      meta: e.metaKey
    };

    Object.assign(currentBinding, newBinding);
    stopRecording();
    callbacks.onBindingChange(newBinding);
  };

  display.addEventListener('click', e => {
    e.preventDefault();
    if (!isRecording) {
      startRecording();
    }
  });

  document.addEventListener('keydown', handleKeyDown, { signal: abortController.signal });

  const observer = new MutationObserver(() => {
    if (!document.body.contains(container)) {
      abortController.abort();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  container.appendChild(display);

  return container;
}

function createStepSizeInput(
  label: string,
  currentValue: number,
  min: number,
  step: number,
  onChange: (value: number) => void
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'bes-keyboard-step-input-container';

  const labelElement = document.createElement('label');
  labelElement.textContent = label;
  labelElement.className = 'bes-keyboard-step-label';

  const input = document.createElement('input');
  input.type = 'number';
  input.className = 'bes-keyboard-step-input';
  input.min = min.toString();
  input.step = step.toString();
  input.value = currentValue.toString();

  input.addEventListener('change', () => {
    const value = parseFloat(input.value);
    if (isNaN(value) || value < min) {
      input.value = currentValue.toString();
      return;
    }
    onChange(value);
  });

  labelElement.appendChild(input);
  container.appendChild(labelElement);

  return container;
}

function createKeyboardControlRow(
  control: KeyboardControlSetting,
  settings: KeyboardSettings,
  onUpdate: (updatedSettings: KeyboardSettings) => void
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'bes-keyboard-control-row';

  const description = document.createElement('span');
  description.className = 'bes-keyboard-control-description';
  description.textContent = ACTION_DESCRIPTIONS[control.action];

  const enableCheckbox = document.createElement('input');
  enableCheckbox.type = 'checkbox';
  enableCheckbox.checked = control.enabled;
  enableCheckbox.className = 'bes-keyboard-control-enable';

  enableCheckbox.addEventListener('change', () => {
    control.enabled = enableCheckbox.checked;
    row.classList.toggle('disabled', !control.enabled);
    onUpdate({ ...settings });
  });

  const editor = createKeyBindingEditor(control.binding, {
    onBindingChange: newBinding => {
      control.binding = newBinding;

      const conflicts = settings.controls.filter(
        c => c.enabled && c.action !== control.action && keyBindingsEqual(c.binding, newBinding)
      );

      if (conflicts.length === 0) {
        row.classList.remove('conflict');
        row.title = '';
        onUpdate({ ...settings });
        return;
      }

      const conflictNames = conflicts.map(c => ACTION_DESCRIPTIONS[c.action]).join(', ');
      row.classList.add('conflict');
      row.title = `Conflicts with: ${conflictNames}`;
      onUpdate({ ...settings });
    }
  });

  if (!control.enabled) {
    row.classList.add('disabled');
  }

  const enableContainer = document.createElement('div');
  enableContainer.className = 'bes-keyboard-control-enable-container';
  enableContainer.appendChild(enableCheckbox);

  row.appendChild(enableContainer);
  row.appendChild(description);
  row.appendChild(editor);

  return row;
}

function createCategorySection(
  category: ActionCategory,
  controls: KeyboardControlSetting[],
  settings: KeyboardSettings,
  onUpdate: (updatedSettings: KeyboardSettings) => void
): HTMLElement {
  const section = document.createElement('div');
  section.className = 'bes-keyboard-category-section';

  const header = document.createElement('h4');
  header.className = 'bes-keyboard-category-header';
  header.textContent = category;

  section.appendChild(header);

  controls.forEach(control => {
    const row = createKeyboardControlRow(control, settings, onUpdate);
    section.appendChild(row);
  });

  return section;
}

let keyboardSectionCollapsed = true;

export function createKeyboardSettingsSection(
  settings: KeyboardSettings,
  onUpdate: (updatedSettings: KeyboardSettings) => void
): HTMLElement {
  const section = document.createElement('div');
  section.className = 'bes-drawer-section bes-keyboard-section';

  let updateResetVisibilityFn: (() => void) | null = null;

  const wrappedOnUpdate = (updatedSettings: KeyboardSettings) => {
    onUpdate(updatedSettings);
    if (updateResetVisibilityFn) {
      updateResetVisibilityFn();
    }
  };

  const header = document.createElement('div');
  header.className = 'bes-keyboard-section-header';

  const title = document.createElement('h3');
  title.className = 'bes-keyboard-section-title';

  const arrow = document.createElement('span');
  arrow.className = 'bes-keyboard-section-arrow';
  arrow.textContent = keyboardSectionCollapsed ? '▶' : '▼';

  const titleText = document.createElement('span');
  titleText.textContent = 'Keyboard Controls';

  title.appendChild(arrow);
  title.appendChild(titleText);

  header.appendChild(title);

  const content = document.createElement('div');
  content.className = 'bes-keyboard-section-content';

  const description = document.createElement('p');
  description.className = 'bes-keyboard-description';
  description.textContent = 'Customize keyboard shortcuts for player controls. Click a key binding to change it.';

  content.appendChild(description);

  if (keyboardSectionCollapsed) {
    content.classList.add('collapsed');
  }

  const toggleCollapse = () => {
    keyboardSectionCollapsed = !keyboardSectionCollapsed;
    content.classList.toggle('collapsed', keyboardSectionCollapsed);
    arrow.textContent = keyboardSectionCollapsed ? '▶' : '▼';
  };

  title.addEventListener('click', toggleCollapse);
  title.style.cursor = 'pointer';

  section.appendChild(header);

  const controlsByCategory = new Map<ActionCategory, KeyboardControlSetting[]>();

  settings.controls.forEach(control => {
    const category = ACTION_CATEGORIES[control.action];
    if (!controlsByCategory.has(category)) {
      controlsByCategory.set(category, []);
    }
    controlsByCategory.get(category)!.push(control);
  });

  const categoryOrder = [ActionCategory.PLAYBACK, ActionCategory.SEEKING, ActionCategory.VOLUME];

  categoryOrder.forEach(category => {
    const controls = controlsByCategory.get(category);
    if (controls && controls.length > 0) {
      const categorySection = createCategorySection(category, controls, settings, wrappedOnUpdate);
      content.appendChild(categorySection);
    }
  });

  const stepSizesSection = document.createElement('div');
  stepSizesSection.className = 'bes-keyboard-step-sizes';

  const stepSizesHeader = document.createElement('h4');
  stepSizesHeader.className = 'bes-keyboard-category-header';
  stepSizesHeader.textContent = 'Step Sizes';

  stepSizesSection.appendChild(stepSizesHeader);

  const seekStepInput = createStepSizeInput('Seek step (seconds):', settings.seekStepSize, 1, 1, value => {
    settings.seekStepSize = value;
    wrappedOnUpdate({ ...settings });
  });
  stepSizesSection.appendChild(seekStepInput);

  const largeSeekStepInput = createStepSizeInput(
    'Large seek step (seconds):',
    settings.largeSeekStepSize,
    1,
    1,
    value => {
      settings.largeSeekStepSize = value;
      wrappedOnUpdate({ ...settings });
    }
  );
  stepSizesSection.appendChild(largeSeekStepInput);

  const volumeStepInput = createStepSizeInput('Volume step:', settings.volumeStep, 0.01, 0.01, value => {
    settings.volumeStep = value;
    wrappedOnUpdate({ ...settings });
  });
  stepSizesSection.appendChild(volumeStepInput);

  content.appendChild(stepSizesSection);

  const areSettingsModified = (current: KeyboardSettings): boolean => {
    if (current.seekStepSize !== DEFAULT_KEYBOARD_SETTINGS.seekStepSize) return true;
    if (current.largeSeekStepSize !== DEFAULT_KEYBOARD_SETTINGS.largeSeekStepSize) return true;
    if (current.volumeStep !== DEFAULT_KEYBOARD_SETTINGS.volumeStep) return true;

    if (current.controls.length !== DEFAULT_KEYBOARD_SETTINGS.controls.length) return true;

    for (let i = 0; i < current.controls.length; i++) {
      const currentControl = current.controls[i];
      const defaultControl = DEFAULT_KEYBOARD_SETTINGS.controls[i];

      if (currentControl.action !== defaultControl.action) return true;
      if (currentControl.enabled !== defaultControl.enabled) return true;
      if (!keyBindingsEqual(currentControl.binding, defaultControl.binding)) return true;
    }

    return false;
  };

  const resetContainer = document.createElement('div');
  resetContainer.className = 'bes-keyboard-reset-container';

  const updateResetVisibility = () => {
    if (areSettingsModified(settings)) {
      resetContainer.style.display = 'block';
      return;
    }
    resetContainer.style.display = 'none';
  };

  updateResetVisibilityFn = updateResetVisibility;

  const resetButton = document.createElement('button');
  resetButton.className = 'bes-drawer-button bes-keyboard-reset-button';
  resetButton.textContent = 'Reset to Defaults';

  const confirmationUI = document.createElement('div');
  confirmationUI.className = 'bes-keyboard-reset-confirmation';
  confirmationUI.style.display = 'none';

  const confirmationText = document.createElement('p');
  confirmationText.className = 'bes-keyboard-reset-confirmation-text';
  confirmationText.textContent = 'Reset all keyboard settings to defaults?';

  const confirmationButtons = document.createElement('div');
  confirmationButtons.className = 'bes-keyboard-reset-confirmation-buttons';

  const confirmButton = document.createElement('button');
  confirmButton.className = 'bes-drawer-button bes-keyboard-confirm-button';
  confirmButton.textContent = 'Reset';

  const cancelButton = document.createElement('button');
  cancelButton.className = 'bes-drawer-button bes-keyboard-cancel-button';
  cancelButton.textContent = 'Cancel';

  confirmationButtons.appendChild(confirmButton);
  confirmationButtons.appendChild(cancelButton);
  confirmationUI.appendChild(confirmationText);
  confirmationUI.appendChild(confirmationButtons);

  resetButton.addEventListener('click', () => {
    resetButton.style.display = 'none';
    confirmationUI.style.display = 'block';
  });

  confirmButton.addEventListener('click', () => {
    const resetEvent = new CustomEvent('bes-reset-keyboard-settings');
    document.dispatchEvent(resetEvent);
    confirmationUI.style.display = 'none';
    resetButton.style.display = 'block';
  });

  cancelButton.addEventListener('click', () => {
    confirmationUI.style.display = 'none';
    resetButton.style.display = 'block';
  });

  resetContainer.appendChild(resetButton);
  resetContainer.appendChild(confirmationUI);
  content.appendChild(resetContainer);

  section.appendChild(content);

  updateResetVisibility();

  return section;
}
