// Custom browser logger.
// Only prints errors when NODE_ENV is 'production'.
// Browser-compatible logger without Winston dependencies
//
// Usage:
//   import Logger from './logger';
//   const log = new Logger();
//   log.debug('got here');
//   log.info({some: 'object'});
//   log.error('Production problem!');

export default class Logger {
  constructor(level) {
    // When in production, only show errors.
    this.level = level || (process.env.NODE_ENV === "production" ? "error" : "debug");
    
    // enumeration to assign color values to
    this.levelColors = {
      info: "darkturquoise",
      debug: "khaki", 
      error: "tomato"
    };
    
    this.defaultColor = "color: inherit";
    
    // Define log levels in order of priority
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }
  
  shouldLog(level) {
    return this.levels[level] <= this.levels[this.level];
  }
  
  formatMessage(level, message) {
    return [
      `%c[%cBES ${level.toUpperCase()}%c]:`,
      this.defaultColor,
      `color: ${this.levelColors[level]};`,
      this.defaultColor,
      message
    ];
  }
  
  debug(message) {
    if (this.shouldLog('debug')) {
      console.log(...this.formatMessage('debug', message));
    }
  }
  
  info(message) {
    if (this.shouldLog('info')) {
      console.log(...this.formatMessage('info', message));
    }
  }
  
  warn(message) {
    if (this.shouldLog('warn')) {
      console.warn(...this.formatMessage('warn', message));
    }
  }
  
  error(message) {
    if (this.shouldLog('error')) {
      console.error(...this.formatMessage('error', message));
    }
  }
}
