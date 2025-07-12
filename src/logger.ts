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

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

interface LevelColors {
  readonly info: string;
  readonly debug: string;
  readonly error: string;
  readonly warn: string;
}

interface LogLevels {
  readonly error: number;
  readonly warn: number;
  readonly info: number;
  readonly debug: number;
}

export default class Logger {
  private readonly level: LogLevel;
  private readonly levelColors: LevelColors;
  private readonly defaultColor: string;
  private readonly levels: LogLevels;

  constructor(level?: LogLevel) {
    // When in production, only show errors.
    this.level = level || (process.env.NODE_ENV === "production" ? "error" : "debug");
    
    // enumeration to assign color values to
    this.levelColors = {
      info: "darkturquoise",
      debug: "khaki", 
      error: "tomato",
      warn: "orange"
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
  
  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] <= this.levels[this.level];
  }
  
  private formatMessage(level: LogLevel, message: any): (string | any)[] {
    return [
      `%c[%cBES ${level.toUpperCase()}%c]:`,
      this.defaultColor,
      `color: ${this.levelColors[level]};`,
      this.defaultColor,
      message
    ];
  }
  
  debug(message: any): void {
    if (this.shouldLog('debug')) {
      console.log(...this.formatMessage('debug', message));
    }
  }
  
  info(message: any): void {
    if (this.shouldLog('info')) {
      console.log(...this.formatMessage('info', message));
    }
  }
  
  warn(message: any): void {
    if (this.shouldLog('warn')) {
      console.warn(...this.formatMessage('warn', message));
    }
  }
  
  error(message: any): void {
    if (this.shouldLog('error')) {
      console.error(...this.formatMessage('error', message));
    }
  }
}
