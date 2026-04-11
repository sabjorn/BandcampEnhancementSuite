import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDomNodes, cleanupTestNodes } from './utils';
import { createKeyboardSettingsSection, createKeyBindingEditor } from '../src/components/keyboardSettings';
import { DEFAULT_KEYBOARD_SETTINGS } from '../src/types/keyboard';

describe('Keyboard Settings Components', () => {
  beforeEach(() => {
    createDomNodes('<div id="test-container"></div>');
  });

  afterEach(() => {
    cleanupTestNodes();
  });

  describe('createKeyboardSettingsSection', () => {
    it('should create keyboard settings section', () => {
      const onUpdate = vi.fn();
      const section = createKeyboardSettingsSection(DEFAULT_KEYBOARD_SETTINGS, onUpdate);

      expect(section).toBeDefined();
      expect(section.className).toContain('bes-keyboard-section');
    });

    it('should create collapsible section that starts collapsed', () => {
      const onUpdate = vi.fn();
      const section = createKeyboardSettingsSection(DEFAULT_KEYBOARD_SETTINGS, onUpdate);

      const content = section.querySelector('.bes-keyboard-section-content');
      expect(content).toBeDefined();
      expect(content?.classList.contains('collapsed')).toBe(true);
    });

    it('should have a clickable title for toggling', () => {
      const onUpdate = vi.fn();
      const section = createKeyboardSettingsSection(DEFAULT_KEYBOARD_SETTINGS, onUpdate);

      const title = section.querySelector('.bes-keyboard-section-title');
      expect(title).toBeDefined();
    });

    it('should show reset button only when settings are modified', () => {
      const onUpdate = vi.fn();
      const section = createKeyboardSettingsSection(DEFAULT_KEYBOARD_SETTINGS, onUpdate);

      const resetContainer = section.querySelector('.bes-keyboard-reset-container');
      expect(resetContainer).toBeDefined();
      expect((resetContainer as HTMLElement).style.display).toBe('none');
    });

    it('should show reset button when settings differ from defaults', () => {
      const onUpdate = vi.fn();
      const modifiedSettings = {
        ...DEFAULT_KEYBOARD_SETTINGS,
        seekStepSize: 15
      };
      const section = createKeyboardSettingsSection(modifiedSettings, onUpdate);

      const resetContainer = section.querySelector('.bes-keyboard-reset-container');
      expect(resetContainer).toBeDefined();
      expect((resetContainer as HTMLElement).style.display).toBe('block');
    });

    it('should create category sections for all control types', () => {
      const onUpdate = vi.fn();
      const section = createKeyboardSettingsSection(DEFAULT_KEYBOARD_SETTINGS, onUpdate);

      const categories = section.querySelectorAll('.bes-keyboard-category-section');
      expect(categories.length).toBeGreaterThan(0);
    });

    it('should create step size inputs', () => {
      const onUpdate = vi.fn();
      const section = createKeyboardSettingsSection(DEFAULT_KEYBOARD_SETTINGS, onUpdate);

      const stepSizesSection = section.querySelector('.bes-keyboard-step-sizes');
      expect(stepSizesSection).toBeDefined();

      const inputs = stepSizesSection?.querySelectorAll('.bes-keyboard-step-input');
      expect(inputs?.length).toBe(3);
    });

    it('should show reset confirmation UI when reset button is clicked', () => {
      const onUpdate = vi.fn();
      const modifiedSettings = {
        ...DEFAULT_KEYBOARD_SETTINGS,
        seekStepSize: 15
      };
      const section = createKeyboardSettingsSection(modifiedSettings, onUpdate);

      const resetButton = section.querySelector('.bes-keyboard-reset-button') as HTMLButtonElement;
      expect(resetButton).toBeDefined();

      resetButton.click();

      const confirmationUI = section.querySelector('.bes-keyboard-reset-confirmation') as HTMLElement;
      expect(confirmationUI.style.display).toBe('block');
    });
  });

  describe('createKeyBindingEditor', () => {
    it('should create key binding editor', () => {
      const onBindingChange = vi.fn();
      const binding = { key: 'p' };
      const editor = createKeyBindingEditor(binding, { onBindingChange });

      expect(editor).toBeDefined();
      expect(editor.className).toContain('bes-key-binding-editor-container');
    });

    it('should display current binding', () => {
      const onBindingChange = vi.fn();
      const binding = { key: 'p' };
      const editor = createKeyBindingEditor(binding, { onBindingChange });

      const display = editor.querySelector('.bes-key-binding-display');
      expect(display?.textContent).toBe('p');
    });

    it('should display space key as "Space"', () => {
      const onBindingChange = vi.fn();
      const binding = { key: ' ' };
      const editor = createKeyBindingEditor(binding, { onBindingChange });

      const display = editor.querySelector('.bes-key-binding-display');
      expect(display?.textContent).toBe('Space');
    });

    it('should enter recording mode when clicked', () => {
      const onBindingChange = vi.fn();
      const binding = { key: 'p' };
      const editor = createKeyBindingEditor(binding, { onBindingChange });

      const display = editor.querySelector('.bes-key-binding-display') as HTMLButtonElement;
      display.click();

      expect(display.classList.contains('recording')).toBe(true);
      expect(display.textContent).toBe('Press any key...');
    });

    it('should update binding on key press when recording', () => {
      const onBindingChange = vi.fn();
      const binding = { key: 'p' };
      const editor = createKeyBindingEditor(binding, { onBindingChange });

      const display = editor.querySelector('.bes-key-binding-display') as HTMLButtonElement;
      display.click();

      const keyEvent = new KeyboardEvent('keydown', {
        key: 'x',
        bubbles: true
      });
      document.dispatchEvent(keyEvent);

      expect(onBindingChange).toHaveBeenCalledWith(expect.objectContaining({ key: 'x' }));
    });

    it('should ignore modifier-only key presses', () => {
      const onBindingChange = vi.fn();
      const binding = { key: 'p' };
      const editor = createKeyBindingEditor(binding, { onBindingChange });

      const display = editor.querySelector('.bes-key-binding-display') as HTMLButtonElement;
      display.click();

      const keyEvent = new KeyboardEvent('keydown', {
        key: 'Shift',
        bubbles: true
      });
      document.dispatchEvent(keyEvent);

      expect(onBindingChange).not.toHaveBeenCalled();
    });

    it('should cancel recording on Escape', () => {
      const onCancel = vi.fn();
      const onBindingChange = vi.fn();
      const binding = { key: 'p' };
      const editor = createKeyBindingEditor(binding, { onBindingChange, onCancel });

      const display = editor.querySelector('.bes-key-binding-display') as HTMLButtonElement;
      display.click();

      const keyEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      });
      document.dispatchEvent(keyEvent);

      expect(onCancel).toHaveBeenCalled();
      expect(display.classList.contains('recording')).toBe(false);
    });

    it('should capture modifier keys', () => {
      const onBindingChange = vi.fn();
      const binding = { key: 'p' };
      const editor = createKeyBindingEditor(binding, { onBindingChange });

      const display = editor.querySelector('.bes-key-binding-display') as HTMLButtonElement;
      display.click();

      const keyEvent = new KeyboardEvent('keydown', {
        key: 'x',
        shiftKey: true,
        ctrlKey: true,
        bubbles: true
      });
      document.dispatchEvent(keyEvent);

      expect(onBindingChange).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'x',
          shift: true,
          ctrl: true
        })
      );
    });
  });
});
