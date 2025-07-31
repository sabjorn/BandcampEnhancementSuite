
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

function createLoggerConfig(level?: LogLevel): LoggerConfig {
  return {
    level: level || (process.env.NODE_ENV === "production" ? "error" : "debug"),
    levelColors: {
      info: "darkturquoise",
      debug: "khaki", 
      error: "tomato",
      warn: "orange"
    },
    defaultColor: "color: inherit",
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
  
  const logger = {
    debug: shouldLog(config, 'debug') 
      ? (message: any) => {
          // eslint-disable-next-line no-console
          console.log(...formatMessage(config, 'debug', message));
        }
      : () => {},
    
    info: shouldLog(config, 'info') 
      ? (message: any) => {
          // eslint-disable-next-line no-console
          console.log(...formatMessage(config, 'info', message));
        }
      : () => {},
    
    warn: shouldLog(config, 'warn') 
      ? (message: any) => {
          // eslint-disable-next-line no-console
          console.warn(...formatMessage(config, 'warn', message));
        }
      : () => {},
    
    error: shouldLog(config, 'error') 
      ? (message: any) => {
          // eslint-disable-next-line no-console
          console.error(...formatMessage(config, 'error', message));
        }
      : () => {}
  };
  
  return logger;
}

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
