export type NotificationType = 'success' | 'error' | 'info' | 'warning' | 'status';

export interface NotificationOptions {
  message: string;
  type: NotificationType;
  delay?: number | null;
}

export interface StatusDisplayOptions {
  id: string;
  content: string;
  show: boolean;
}

function getOrCreateNotificationContainer(): HTMLElement {
  const container = (() => {
    const existing = document.getElementById('bes-notification-container');

    if (existing) {
      return existing;
    }

    const newContainer = document.createElement('div');
    newContainer.id = 'bes-notification-container';
    newContainer.className = 'bes-notification-container';
    document.body.appendChild(newContainer);
    return newContainer;
  })();

  return container;
}

export function showNotification(options: NotificationOptions): void {
  const { message, type, delay = 8000 } = options;

  const container = getOrCreateNotificationContainer();

  const notification = document.createElement('div');
  notification.className = `bes-notification bes-${type}`;
  notification.innerHTML = message;

  container.appendChild(notification);

  if (delay === null) {
    return;
  }

  notification.style.cursor = 'pointer';
  notification.title = 'Click to dismiss';
  notification.addEventListener('click', () => {
    notification.remove();
  });

  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, delay);
}

export function showSuccessMessage(message: string, delay?: number): void {
  showNotification({ message, type: 'success', delay });
}

export function showErrorMessage(message: string, delay?: number): void {
  showNotification({ message, type: 'error', delay });
}

export function showInfoMessage(message: string, delay?: number): void {
  showNotification({ message, type: 'info', delay });
}

export function showWarningMessage(message: string, delay?: number): void {
  showNotification({ message, type: 'warning', delay });
}

export function showStatusMessage(message: string, delay?: number | null): void {
  showNotification({ message, type: 'status', delay });
}

export interface PersistentNotificationOptions {
  id: string;
  message: string;
  type: NotificationType;
}

export function showPersistentNotification(options: PersistentNotificationOptions): void {
  const { id, message, type } = options;

  removePersistentNotification(id);

  const container = getOrCreateNotificationContainer();

  const notification = document.createElement('div');
  notification.id = id;
  notification.className = `bes-notification bes-${type}`;
  notification.innerHTML = message;

  container.appendChild(notification);
}

export function updatePersistentNotification(id: string, message: string): void {
  const notification = document.getElementById(id);
  if (notification) {
    notification.innerHTML = message;
  }
}

export function removePersistentNotification(id: string): void {
  const notification = document.getElementById(id);
  if (notification) {
    notification.remove();
  }
}

export function updateStatusDisplay(options: StatusDisplayOptions): void {
  const { id, content, show } = options;

  const statusElement = (() => {
    const existing = document.getElementById(id) as HTMLDivElement;

    if (existing) {
      return existing;
    }

    const newElement = document.createElement('div');
    newElement.id = id;
    newElement.className = 'bes-status-display';
    document.body.appendChild(newElement);
    return newElement;
  })();

  statusElement.innerHTML = content;
  statusElement.style.display = show ? 'block' : 'none';
}

export function hideStatusDisplay(id: string): void {
  const statusElement = document.getElementById(id);
  if (statusElement) {
    statusElement.style.display = 'none';
  }
}

export function removeStatusDisplay(id: string): void {
  const statusElement = document.getElementById(id);
  if (statusElement) {
    statusElement.remove();
  }
}
