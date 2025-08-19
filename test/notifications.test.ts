import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  showNotification,
  showSuccessMessage,
  showErrorMessage,
  showInfoMessage,
  showWarningMessage,
  showStatusMessage,
  updateStatusDisplay,
  hideStatusDisplay,
  removeStatusDisplay,
  showPersistentNotification,
  updatePersistentNotification,
  removePersistentNotification
} from '../src/components/notifications';

describe('notifications', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  describe('showNotification', () => {
    it('should create a notification element with correct classes and message', () => {
      showNotification({ message: 'Test message', type: 'success' });

      const notification = document.querySelector('.bes-notification');
      expect(notification).toBeTruthy();
      expect(notification?.classList.contains('bes-notification')).toBe(true);
      expect(notification?.classList.contains('bes-success')).toBe(true);
      expect(notification?.textContent).toBe('Test message');
    });

    it('should create error notification with correct classes', () => {
      showNotification({ message: 'Error message', type: 'error' });

      const notification = document.querySelector('.bes-notification');
      expect(notification).toBeTruthy();
      expect(notification?.classList.contains('bes-notification')).toBe(true);
      expect(notification?.classList.contains('bes-error')).toBe(true);
      expect(notification?.textContent).toBe('Error message');
    });

    it('should remove notification after default delay', () => {
      showNotification({ message: 'Test message', type: 'success' });

      const notification = document.querySelector('.bes-notification');
      expect(notification).toBeTruthy();

      vi.advanceTimersByTime(8000);

      const notificationAfterDelay = document.querySelector('.bes-notification');
      expect(notificationAfterDelay).toBeNull();
    });

    it('should remove notification after custom delay', () => {
      showNotification({ message: 'Test message', type: 'success', delay: 3000 });

      const notification = document.querySelector('.bes-notification');
      expect(notification).toBeTruthy();

      vi.advanceTimersByTime(2999);
      expect(document.querySelector('.bes-notification')).toBeTruthy();

      vi.advanceTimersByTime(1);
      expect(document.querySelector('.bes-notification')).toBeNull();
    });

    it('should remove notification when clicked (for non-persistent notifications)', () => {
      showNotification({ message: 'Test message', type: 'success', delay: 5000 });

      const notification = document.querySelector('.bes-notification') as HTMLElement;
      expect(notification).toBeTruthy();
      expect(notification.style.cursor).toBe('pointer');
      expect(notification.title).toBe('Click to dismiss');

      notification.click();

      expect(document.querySelector('.bes-notification')).toBeNull();
    });

    it('should not add click handler for persistent notifications', () => {
      showNotification({ message: 'Test message', type: 'status', delay: null });

      const notification = document.querySelector('.bes-notification') as HTMLElement;
      expect(notification).toBeTruthy();
      expect(notification.style.cursor).toBe('');
      expect(notification.title).toBe('');
    });

    it('should append notification to notification container', () => {
      showNotification({ message: 'Test message', type: 'success' });

      const notification = document.querySelector('.bes-notification');
      const container = document.getElementById('bes-notification-container');
      expect(notification?.parentElement).toBe(container);
      expect(container?.parentElement).toBe(document.body);
    });
  });

  describe('showSuccessMessage', () => {
    it('should create success notification with correct message', () => {
      showSuccessMessage('Success!');

      const notification = document.querySelector('.bes-notification');
      expect(notification?.classList.contains('bes-success')).toBe(true);
      expect(notification?.textContent).toBe('Success!');
    });

    it('should use custom delay when provided', () => {
      showSuccessMessage('Success!', 1000);

      const notification = document.querySelector('.bes-notification');
      expect(notification).toBeTruthy();

      vi.advanceTimersByTime(999);
      expect(document.querySelector('.bes-notification')).toBeTruthy();

      vi.advanceTimersByTime(1);
      expect(document.querySelector('.bes-notification')).toBeNull();
    });

    it('should use default delay when not provided', () => {
      showSuccessMessage('Success!');

      const notification = document.querySelector('.bes-notification');
      expect(notification).toBeTruthy();

      vi.advanceTimersByTime(7999);
      expect(document.querySelector('.bes-notification')).toBeTruthy();

      vi.advanceTimersByTime(1);
      expect(document.querySelector('.bes-notification')).toBeNull();
    });
  });

  describe('showErrorMessage', () => {
    it('should create error notification with correct message', () => {
      showErrorMessage('Error occurred!');

      const notification = document.querySelector('.bes-notification');
      expect(notification?.classList.contains('bes-error')).toBe(true);
      expect(notification?.textContent).toBe('Error occurred!');
    });

    it('should use custom delay when provided', () => {
      showErrorMessage('Error!', 2000);

      const notification = document.querySelector('.bes-notification');
      expect(notification).toBeTruthy();

      vi.advanceTimersByTime(1999);
      expect(document.querySelector('.bes-notification')).toBeTruthy();

      vi.advanceTimersByTime(1);
      expect(document.querySelector('.bes-notification')).toBeNull();
    });

    it('should use default delay when not provided', () => {
      showErrorMessage('Error!');

      const notification = document.querySelector('.bes-notification');
      expect(notification).toBeTruthy();

      vi.advanceTimersByTime(7999);
      expect(document.querySelector('.bes-notification')).toBeTruthy();

      vi.advanceTimersByTime(1);
      expect(document.querySelector('.bes-notification')).toBeNull();
    });
  });

  describe('multiple notifications', () => {
    it('should handle multiple notifications simultaneously', () => {
      showSuccessMessage('First success');
      showErrorMessage('First error');
      showSuccessMessage('Second success');

      const notifications = document.querySelectorAll('.bes-notification');
      expect(notifications.length).toBe(3);

      const successNotifications = document.querySelectorAll('.bes-success');
      const errorNotifications = document.querySelectorAll('.bes-error');
      expect(successNotifications.length).toBe(2);
      expect(errorNotifications.length).toBe(1);
    });

    it('should remove notifications independently based on their delays', () => {
      showSuccessMessage('Short delay', 1000);
      showErrorMessage('Long delay', 5000);

      expect(document.querySelectorAll('.bes-notification').length).toBe(2);

      vi.advanceTimersByTime(1000);
      expect(document.querySelectorAll('.bes-notification').length).toBe(1);
      expect(document.querySelector('.bes-error')).toBeTruthy();

      vi.advanceTimersByTime(4000);
      expect(document.querySelectorAll('.bes-notification').length).toBe(0);
    });
  });

  describe('showInfoMessage', () => {
    it('should create info notification with correct message', () => {
      showInfoMessage('Info message');

      const notification = document.querySelector('.bes-notification');
      expect(notification?.classList.contains('bes-info')).toBe(true);
      expect(notification?.textContent).toBe('Info message');
    });
  });

  describe('showWarningMessage', () => {
    it('should create warning notification with correct message', () => {
      showWarningMessage('Warning message');

      const notification = document.querySelector('.bes-notification');
      expect(notification?.classList.contains('bes-warning')).toBe(true);
      expect(notification?.textContent).toBe('Warning message');
    });
  });

  describe('showStatusMessage', () => {
    it('should create status notification with correct message', () => {
      showStatusMessage('Status message');

      const notification = document.querySelector('.bes-notification');
      expect(notification?.classList.contains('bes-status')).toBe(true);
      expect(notification?.textContent).toBe('Status message');
    });
  });

  describe('status display functions', () => {
    const testId = 'test-status';

    afterEach(() => {
      removeStatusDisplay(testId);
    });

    describe('updateStatusDisplay', () => {
      it('should create and show status display', () => {
        updateStatusDisplay({
          id: testId,
          content: '<div>Test content</div>',
          show: true
        });

        const statusElement = document.getElementById(testId);
        expect(statusElement).toBeTruthy();
        expect(statusElement?.classList.contains('bes-status-display')).toBe(true);
        expect(statusElement?.innerHTML).toBe('<div>Test content</div>');
        expect(statusElement?.style.display).toBe('block');
      });

      it('should update existing status display', () => {
        updateStatusDisplay({
          id: testId,
          content: 'Initial content',
          show: true
        });

        updateStatusDisplay({
          id: testId,
          content: 'Updated content',
          show: true
        });

        const statusElement = document.getElementById(testId);
        expect(statusElement?.innerHTML).toBe('Updated content');
        expect(document.querySelectorAll(`#${testId}`).length).toBe(1);
      });

      it('should hide status display when show is false', () => {
        updateStatusDisplay({
          id: testId,
          content: 'Test content',
          show: false
        });

        const statusElement = document.getElementById(testId);
        expect(statusElement?.style.display).toBe('none');
      });
    });

    describe('hideStatusDisplay', () => {
      it('should hide existing status display', () => {
        updateStatusDisplay({
          id: testId,
          content: 'Test content',
          show: true
        });

        hideStatusDisplay(testId);

        const statusElement = document.getElementById(testId);
        expect(statusElement?.style.display).toBe('none');
      });

      it('should not throw when hiding non-existent status display', () => {
        expect(() => hideStatusDisplay('non-existent')).not.toThrow();
      });
    });

    describe('removeStatusDisplay', () => {
      it('should remove status display from DOM', () => {
        updateStatusDisplay({
          id: testId,
          content: 'Test content',
          show: true
        });

        expect(document.getElementById(testId)).toBeTruthy();

        removeStatusDisplay(testId);

        expect(document.getElementById(testId)).toBeNull();
      });

      it('should not throw when removing non-existent status display', () => {
        expect(() => removeStatusDisplay('non-existent')).not.toThrow();
      });
    });
  });

  describe('persistent notification functions', () => {
    const testId = 'test-persistent';

    afterEach(() => {
      removePersistentNotification(testId);
    });

    describe('showPersistentNotification', () => {
      it('should create persistent notification with correct properties', () => {
        showPersistentNotification({
          id: testId,
          message: '<div>Test content</div>',
          type: 'status'
        });

        const notification = document.getElementById(testId);
        expect(notification).toBeTruthy();
        expect(notification?.classList.contains('bes-notification')).toBe(true);
        expect(notification?.classList.contains('bes-status')).toBe(true);
        expect(notification?.innerHTML).toBe('<div>Test content</div>');
      });

      it('should replace existing notification with same ID', () => {
        // Create initial notification
        showPersistentNotification({
          id: testId,
          message: 'Initial content',
          type: 'info'
        });

        showPersistentNotification({
          id: testId,
          message: 'Updated content',
          type: 'status'
        });

        const notifications = document.querySelectorAll(`#${testId}`);
        expect(notifications.length).toBe(1);
        expect(notifications[0].innerHTML).toBe('Updated content');
        expect(notifications[0].classList.contains('bes-status')).toBe(true);
      });
    });

    describe('updatePersistentNotification', () => {
      it('should update existing notification content', () => {
        showPersistentNotification({
          id: testId,
          message: 'Initial content',
          type: 'status'
        });

        updatePersistentNotification(testId, 'Updated content');

        const notification = document.getElementById(testId);
        expect(notification?.innerHTML).toBe('Updated content');
      });

      it('should not throw when updating non-existent notification', () => {
        expect(() => updatePersistentNotification('non-existent', 'content')).not.toThrow();
      });
    });

    describe('removePersistentNotification', () => {
      it('should remove notification from DOM', () => {
        showPersistentNotification({
          id: testId,
          message: 'Test content',
          type: 'status'
        });

        expect(document.getElementById(testId)).toBeTruthy();

        removePersistentNotification(testId);

        expect(document.getElementById(testId)).toBeNull();
      });

      it('should not throw when removing non-existent notification', () => {
        expect(() => removePersistentNotification('non-existent')).not.toThrow();
      });
    });
  });
});
