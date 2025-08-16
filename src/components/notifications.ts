export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface NotificationOptions {
  message: string;
  type: NotificationType;
  delay?: number;
}

export interface StatusDisplayOptions {
  id: string;
  content: string;
  show: boolean;
}

export function showNotification(options: NotificationOptions): void {
  const { message, type, delay = 8000 } = options;
  
  const notification = document.createElement("div");
  notification.className = `bes-notification bes-${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
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

export function updateStatusDisplay(options: StatusDisplayOptions): void {
  const { id, content, show } = options;
  
  let statusElement = document.getElementById(id) as HTMLDivElement;
  
  if (!statusElement) {
    statusElement = document.createElement('div');
    statusElement.id = id;
    statusElement.className = 'bes-status-display';
    document.body.appendChild(statusElement);
  }
  
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