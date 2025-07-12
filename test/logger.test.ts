import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Logger from '../src/logger'

describe('Logger', () => {
  let consoleSpy: any
  
  beforeEach(() => {
    // Mock console methods
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    }
  })
  
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should instantiate a logger', () => {
    const log = new Logger()
    expect(log).toBeInstanceOf(Logger)
  })

  it('should default to debug level in development', () => {
    // Mock NODE_ENV as development
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    
    const log = new Logger()
    
    // Debug should be logged in development
    log.debug('test message')
    expect(consoleSpy.log).toHaveBeenCalled()
    
    process.env.NODE_ENV = originalEnv
  })

  it('should default to error level in production', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    
    const log = new Logger()
    
    // Debug should NOT be logged in production
    log.debug('test message')
    expect(consoleSpy.log).not.toHaveBeenCalled()
    
    // Error should be logged in production
    log.error('error message')
    expect(consoleSpy.error).toHaveBeenCalled()
    
    process.env.NODE_ENV = originalEnv
  })

  it('should respect custom log level', () => {
    const log = new Logger('warn')
    
    // Debug and info should not be logged
    log.debug('debug message')
    log.info('info message')
    expect(consoleSpy.log).not.toHaveBeenCalled()
    
    // Warn and error should be logged
    log.warn('warn message')
    expect(consoleSpy.warn).toHaveBeenCalled()
    
    log.error('error message')
    expect(consoleSpy.error).toHaveBeenCalled()
  })

  it('should format messages with BES prefix', () => {
    const log = new Logger('debug')
    log.info('test message')
    
    const callArgs = consoleSpy.log.mock.calls[0]
    expect(callArgs[0]).toContain('[')
    expect(callArgs[0]).toContain('BES INFO')
    expect(callArgs[4]).toBe('test message')
  })
})