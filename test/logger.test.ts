import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Logger from '../src/logger'

describe('Logger', () => {
  let consoleSpy: any
  
  beforeEach(() => {
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
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    
    const log = new Logger()
    
    log.debug('test message')
    expect(consoleSpy.log).toHaveBeenCalled()
    
    process.env.NODE_ENV = originalEnv
  })

  it('should default to error level in production', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    
    const log = new Logger()
    
    log.debug('test message')
    expect(consoleSpy.log).not.toHaveBeenCalled()
    
    log.error('error message')
    expect(consoleSpy.error).toHaveBeenCalled()
    
    process.env.NODE_ENV = originalEnv
  })

  it('should respect custom log level', () => {
    const log = new Logger('warn')
    
    log.debug('debug message')
    log.info('info message')
    expect(consoleSpy.log).not.toHaveBeenCalled()
    
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
