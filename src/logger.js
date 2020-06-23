// Custom browser logger.
// Only prints when NODE_ENV is not 'production'.
// Inspiration: https://github.com/winstonjs/winston/issues/287#issuecomment-647196496
//
// Usage: https://github.com/winstonjs/winston#using-logging-levels
//
//   import logger from './logger';
//   const log = new Logger();
//   logger.debug('got here');
//   logger.info({some: 'object'});
//   logger.error('Production problem!');

import * as winston from "winston";
import { TransformableInfo } from "logform";
import * as Transport from "winston-transport";

// Customizing the Winston console transporter
class Console extends Transport {
  constructor(options = {}) {
    super(options);

    this.setMaxListeners(30);

    // enumeration to assign color values to
    this.levelColors = {
      INFO: "darkturquoise",
      DEBUG: "khaki",
      ERROR: "tomato"
    };

    this.defaultColor = "color: inherit";
  }

  log(info, next) {
    // styles a console log statement accordingly to the log level
    // log level colors are taken from levelcolors enum
    // eslint-disable-next-line no-console
    console.log(
      `%c[%cBES ${info.level.toUpperCase()}%c]:`,
      this.defaultColor,
      `color: ${this.levelColors[info.level.toUpperCase()]};`,
      this.defaultColor,
      // message will be included after stylings
      // through this objects and arrays will be expandable
      info.message
    );

    // This is a stream, be sure to flow onward
    next();
  }
}

export default class Logger extends winston.createLogger {
  constructor() {
    // When in production, only show errors.
    const transportLevel =
      process.env.NODE_ENV == "production" ? "error" : "debug";

    // Provide `winston.createLogger()` args as usual...
    super({
      transports: [new Console({ level: transportLevel })]
    });
  }
}
