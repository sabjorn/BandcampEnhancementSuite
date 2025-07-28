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

interface LoggerConfig {
  level: LogLevel;
  levelColors: LevelColors;
  defaultColor: string;
  levels: LogLevels;
}

// Standalone logging functions
function createLoggerConfig(level?: LogLevel): LoggerConfig {
  return {
    // When in production, only show errors.
    level: level || (process.env.NODE_ENV === "production" ? "error" : "debug"),
    
    // enumeration to assign color values to
    levelColors: {
      info: "darkturquoise",
      debug: "khaki", 
      error: "tomato",
      warn: "orange"
    },
    
    defaultColor: "color: inherit",
    
    // Define log levels in order of priority
    levels: {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    }
  };
}

function shouldLog(config: LoggerConfig, level: LogLevel): boolean {
  return config.levels[level] <= config.levels[config.level];
}

function formatMessage(config: LoggerConfig, level: LogLevel, message: any): (string | any)[] {
  return [
    `%c[%cBES ${level.toUpperCase()}%c]:`,
    config.defaultColor,
    `color: ${config.levelColors[level]};`,
    config.defaultColor,
    message
  ];
}

export function createLogger(level?: LogLevel) {
  const config = createLoggerConfig(level);
  
  return {
    debug: (message: any) => {
      if (shouldLog(config, 'debug')) {
        // eslint-disable-next-line no-console
        console.log(...formatMessage(config, 'debug', message));
      }
    },
    
    info: (message: any) => {
      if (shouldLog(config, 'info')) {
        // eslint-disable-next-line no-console
        console.log(...formatMessage(config, 'info', message));
      }
    },
    
    warn: (message: any) => {
      if (shouldLog(config, 'warn')) {
        // eslint-disable-next-line no-console
        console.warn(...formatMessage(config, 'warn', message));
      }
    },
    
    error: (message: any) => {
      if (shouldLog(config, 'error')) {
        // eslint-disable-next-line no-console
        console.error(...formatMessage(config, 'error', message));
      }
    }
  };
}

// Backward compatibility - maintain class-like interface
export default class Logger {
  private readonly config: LoggerConfig;

  constructor(level?: LogLevel) {
    this.config = createLoggerConfig(level);
  }
  
  private shouldLog(level: LogLevel): boolean {
    return shouldLog(this.config, level);
  }
  
  private formatMessage(level: LogLevel, message: any): (string | any)[] {
    return formatMessage(this.config, level, message);
  }
  
  debug(message: any): void {
    if (this.shouldLog('debug')) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('debug', message));
    }
  }
  
  info(message: any): void {
    if (this.shouldLog('info')) {
      // eslint-disable-next-line no-console
      console.log(...this.formatMessage('info', message));
    }
  }
  
  warn(message: any): void {
    if (this.shouldLog('warn')) {
      // eslint-disable-next-line no-console
      console.warn(...this.formatMessage('warn', message));
    }
  }
  
  error(message: any): void {
    if (this.shouldLog('error')) {
      // eslint-disable-next-line no-console
      console.error(...this.formatMessage('error', message));
    }
  }
}
