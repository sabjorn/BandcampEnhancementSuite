export type NotificationType = 'success' | 'error';

export interface NotificationOptions {
  message: string;
  type: NotificationType;
  delay?: number;
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