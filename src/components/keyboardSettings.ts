/**
 * UI components for keyboard settings configuration
 */

import {
  KeyBinding,
  KeyboardAction,
  KeyboardSettings,
  KeyboardControlSetting,
  ACTION_DESCRIPTIONS,
  ACTION_CATEGORIES,
  ActionCategory,
  keyBindingToString,
  keyBindingsEqual
} from '../types/keyboard.js';

interface KeyBindingEditorCallbacks {
  onBindingChange: (newBinding: KeyBinding) => void;
  onCancel?: () => void;
}

/**
 * Creates an interactive key binding editor that captures key presses
 */
export function createKeyBindingEditor(currentBinding: KeyBinding, callbacks: KeyBindingEditorCallbacks): HTMLElement {
  const container = document.createElement('div');
  container.className = 'bes-key-binding-editor-container';

  const display = document.createElement('button');
  display.className = 'bes-key-binding-display';
  display.textContent = keyBindingToString(currentBinding);
  display.title = 'Click to change key binding';

  let isRecording = false;

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

    // Cancel on Escape
    if (e.key === 'Escape') {
      stopRecording();
      callbacks.onCancel?.();
      return;
    }

    // Ignore modifier-only presses
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

    // Update current binding
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

  // Add global keydown listener when recording
  document.addEventListener('keydown', handleKeyDown);

  container.appendChild(display);

  return container;
}

/**
 * Creates a number input for step size settings
 */
function createStepSizeInput(
  label: string,
  currentValue: number,
  min: number,
  max: number,
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
  input.max = max.toString();
  input.step = step.toString();
  input.value = currentValue.toString();

  input.addEventListener('change', () => {
    const value = parseFloat(input.value);
    if (!isNaN(value) && value >= min && value <= max) {
      onChange(value);
    } else {
      input.value = currentValue.toString();
    }
  });

  labelElement.appendChild(input);
  container.appendChild(labelElement);

  return container;
}

/**
 * Creates a row for a single keyboard control setting
 */
function createKeyboardControlRow(
  control: KeyboardControlSetting,
  settings: KeyboardSettings,
  onUpdate: (updatedSettings: KeyboardSettings) => void
): HTMLElement {
  const row = document.createElement('div');
  row.className = 'bes-keyboard-control-row';

  // Description
  const description = document.createElement('span');
  description.className = 'bes-keyboard-control-description';
  description.textContent = ACTION_DESCRIPTIONS[control.action];

  // Enable/disable checkbox
  const enableCheckbox = document.createElement('input');
  enableCheckbox.type = 'checkbox';
  enableCheckbox.checked = control.enabled;
  enableCheckbox.className = 'bes-keyboard-control-enable';

  enableCheckbox.addEventListener('change', () => {
    control.enabled = enableCheckbox.checked;
    row.classList.toggle('disabled', !control.enabled);
    onUpdate({ ...settings });
  });

  // Key binding editor
  const editor = createKeyBindingEditor(control.binding, {
    onBindingChange: newBinding => {
      control.binding = newBinding;

      // Check for conflicts
      const conflicts = settings.controls.filter(
        c => c.enabled && c.action !== control.action && keyBindingsEqual(c.binding, newBinding)
      );

      if (conflicts.length > 0) {
        const conflictNames = conflicts.map(c => ACTION_DESCRIPTIONS[c.action]).join(', ');
        row.classList.add('conflict');
        row.title = `Conflicts with: ${conflictNames}`;
      } else {
        row.classList.remove('conflict');
        row.title = '';
      }

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

/**
 * Creates a category section with grouped controls
 */
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

// Track collapsed state across section recreations
let keyboardSectionCollapsed = true;

/**
 * Creates the complete keyboard settings section for the drawer
 */
export function createKeyboardSettingsSection(
  settings: KeyboardSettings,
  onUpdate: (updatedSettings: KeyboardSettings) => void
): HTMLElement {
  const section = document.createElement('div');
  section.className = 'bes-drawer-section bes-keyboard-section';

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

  // Restore previous collapsed state
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

  // Group controls by category
  const controlsByCategory = new Map<ActionCategory, KeyboardControlSetting[]>();

  settings.controls.forEach(control => {
    const category = ACTION_CATEGORIES[control.action];
    if (!controlsByCategory.has(category)) {
      controlsByCategory.set(category, []);
    }
    controlsByCategory.get(category)!.push(control);
  });

  // Create sections for each category
  const categoryOrder = [ActionCategory.PLAYBACK, ActionCategory.SEEKING, ActionCategory.VOLUME];

  categoryOrder.forEach(category => {
    const controls = controlsByCategory.get(category);
    if (controls && controls.length > 0) {
      const categorySection = createCategorySection(category, controls, settings, onUpdate);
      content.appendChild(categorySection);
    }
  });

  // Step size settings
  const stepSizesSection = document.createElement('div');
  stepSizesSection.className = 'bes-keyboard-step-sizes';

  const stepSizesHeader = document.createElement('h4');
  stepSizesHeader.className = 'bes-keyboard-category-header';
  stepSizesHeader.textContent = 'Step Sizes';

  stepSizesSection.appendChild(stepSizesHeader);

  // Seek step size
  const seekStepInput = createStepSizeInput('Seek step (seconds):', settings.seekStepSize, 1, 60, 1, value => {
    settings.seekStepSize = value;
    onUpdate({ ...settings });
  });
  stepSizesSection.appendChild(seekStepInput);

  // Large seek step size
  const largeSeekStepInput = createStepSizeInput(
    'Large seek step (seconds):',
    settings.largeSeekStepSize,
    1,
    120,
    1,
    value => {
      settings.largeSeekStepSize = value;
      onUpdate({ ...settings });
    }
  );
  stepSizesSection.appendChild(largeSeekStepInput);

  // Volume step
  const volumeStepInput = createStepSizeInput('Volume step:', settings.volumeStep, 0.01, 0.5, 0.01, value => {
    settings.volumeStep = value;
    onUpdate({ ...settings });
  });
  stepSizesSection.appendChild(volumeStepInput);

  content.appendChild(stepSizesSection);

  // Reset button
  const resetButton = document.createElement('button');
  resetButton.className = 'bes-drawer-button bes-keyboard-reset-button';
  resetButton.textContent = 'Reset to Defaults';

  resetButton.addEventListener('click', () => {
    if (confirm('Reset all keyboard settings to defaults?')) {
      // This will be handled by sending a message to the backend
      const resetEvent = new CustomEvent('bes-reset-keyboard-settings');
      document.dispatchEvent(resetEvent);
    }
  });

  content.appendChild(resetButton);

  section.appendChild(content);

  return section;
}
