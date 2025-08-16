import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { showNotification, showSuccessMessage, showErrorMessage } from '../src/components/notifications'

describe('notifications', () => {
  beforeEach(() => {
    // Setup DOM environment
    document.body.innerHTML = ''
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  describe('showNotification', () => {
    it('should create a notification element with correct classes and message', () => {
      showNotification({ message: 'Test message', type: 'success' })

      const notification = document.querySelector('.bes-notification')
      expect(notification).toBeTruthy()
      expect(notification?.classList.contains('bes-notification')).toBe(true)
      expect(notification?.classList.contains('bes-success')).toBe(true)
      expect(notification?.textContent).toBe('Test message')
    })

    it('should create error notification with correct classes', () => {
      showNotification({ message: 'Error message', type: 'error' })

      const notification = document.querySelector('.bes-notification')
      expect(notification).toBeTruthy()
      expect(notification?.classList.contains('bes-notification')).toBe(true)
      expect(notification?.classList.contains('bes-error')).toBe(true)
      expect(notification?.textContent).toBe('Error message')
    })

    it('should remove notification after default delay', () => {
      showNotification({ message: 'Test message', type: 'success' })

      const notification = document.querySelector('.bes-notification')
      expect(notification).toBeTruthy()

      // Fast forward default delay (8000ms)
      vi.advanceTimersByTime(8000)

      const notificationAfterDelay = document.querySelector('.bes-notification')
      expect(notificationAfterDelay).toBeNull()
    })

    it('should remove notification after custom delay', () => {
      showNotification({ message: 'Test message', type: 'success', delay: 3000 })

      const notification = document.querySelector('.bes-notification')
      expect(notification).toBeTruthy()

      // Fast forward less than custom delay
      vi.advanceTimersByTime(2999)
      expect(document.querySelector('.bes-notification')).toBeTruthy()

      // Fast forward past custom delay
      vi.advanceTimersByTime(1)
      expect(document.querySelector('.bes-notification')).toBeNull()
    })

    it('should append notification to document body', () => {
      showNotification({ message: 'Test message', type: 'success' })

      const notification = document.querySelector('.bes-notification')
      expect(notification?.parentElement).toBe(document.body)
    })
  })

  describe('showSuccessMessage', () => {
    it('should create success notification with correct message', () => {
      showSuccessMessage('Success!')

      const notification = document.querySelector('.bes-notification')
      expect(notification?.classList.contains('bes-success')).toBe(true)
      expect(notification?.textContent).toBe('Success!')
    })

    it('should use custom delay when provided', () => {
      showSuccessMessage('Success!', 1000)

      const notification = document.querySelector('.bes-notification')
      expect(notification).toBeTruthy()

      vi.advanceTimersByTime(999)
      expect(document.querySelector('.bes-notification')).toBeTruthy()

      vi.advanceTimersByTime(1)
      expect(document.querySelector('.bes-notification')).toBeNull()
    })

    it('should use default delay when not provided', () => {
      showSuccessMessage('Success!')

      const notification = document.querySelector('.bes-notification')
      expect(notification).toBeTruthy()

      vi.advanceTimersByTime(7999)
      expect(document.querySelector('.bes-notification')).toBeTruthy()

      vi.advanceTimersByTime(1)
      expect(document.querySelector('.bes-notification')).toBeNull()
    })
  })

  describe('showErrorMessage', () => {
    it('should create error notification with correct message', () => {
      showErrorMessage('Error occurred!')

      const notification = document.querySelector('.bes-notification')
      expect(notification?.classList.contains('bes-error')).toBe(true)
      expect(notification?.textContent).toBe('Error occurred!')
    })

    it('should use custom delay when provided', () => {
      showErrorMessage('Error!', 2000)

      const notification = document.querySelector('.bes-notification')
      expect(notification).toBeTruthy()

      vi.advanceTimersByTime(1999)
      expect(document.querySelector('.bes-notification')).toBeTruthy()

      vi.advanceTimersByTime(1)
      expect(document.querySelector('.bes-notification')).toBeNull()
    })

    it('should use default delay when not provided', () => {
      showErrorMessage('Error!')

      const notification = document.querySelector('.bes-notification')
      expect(notification).toBeTruthy()

      vi.advanceTimersByTime(7999)
      expect(document.querySelector('.bes-notification')).toBeTruthy()

      vi.advanceTimersByTime(1)
      expect(document.querySelector('.bes-notification')).toBeNull()
    })
  })

  describe('multiple notifications', () => {
    it('should handle multiple notifications simultaneously', () => {
      showSuccessMessage('First success')
      showErrorMessage('First error')
      showSuccessMessage('Second success')

      const notifications = document.querySelectorAll('.bes-notification')
      expect(notifications.length).toBe(3)

      const successNotifications = document.querySelectorAll('.bes-success')
      const errorNotifications = document.querySelectorAll('.bes-error')
      expect(successNotifications.length).toBe(2)
      expect(errorNotifications.length).toBe(1)
    })

    it('should remove notifications independently based on their delays', () => {
      showSuccessMessage('Short delay', 1000)
      showErrorMessage('Long delay', 5000)

      expect(document.querySelectorAll('.bes-notification').length).toBe(2)

      // After 1 second, first notification should be removed
      vi.advanceTimersByTime(1000)
      expect(document.querySelectorAll('.bes-notification').length).toBe(1)
      expect(document.querySelector('.bes-error')).toBeTruthy()

      // After 5 seconds total, second notification should be removed
      vi.advanceTimersByTime(4000)
      expect(document.querySelectorAll('.bes-notification').length).toBe(0)
    })
  })
})