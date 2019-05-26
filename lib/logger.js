const chalk = require('chalk'),
      timestamp = require('time-stamp'),
      eol = require('os').EOL;

const defaultStyle = {
  timestamp: chalk.gray,
  level: chalk.black.bgWhite,
  category: chalk.gray
};

const defaultStyles = {
  debug: Object.assign({}, defaultStyle, {
    level: chalk.black.bgCyan
  }),
  info: Object.assign({}, defaultStyle, {
    level: chalk.black.bgGreenBright
  }),
  error: Object.assign({}, defaultStyle, {
    level: chalk.white.bgRedBright
  })
};

class Logger {
  constructor(categories) {
    this.categories = Array.isArray(categories) ?
      categories : typeof categories === 'undefined' ?
      [] : [categories];
  }

  /**
   * Configure logger
   * @function
   * @param {Number} level - log verbose level
   *  - 0 no output
   *  - 1 ERROR
   *  - 2 ERROR, INFO
   *  - 3 ERROR, INFO, DEBUG
   * @param {WriteStream} out - output stream, default: process.stdout
   * @param {Object} style
   */
  static configure(level, out = process.stdout, styles = defaultStyles) {
    this.level = level;
    this.out = out;
    this.styles = styles;
  }
  
  debug() {
    if (!Logger.out || Logger.level < 3) return;
    this._header('DEBUG', Logger.styles.debug);
    if (Logger.out === process.stdout) {
      console.log.apply(console, arguments);
    } else if (Logger.out === process.stderr) {
      console.error.apply(console, arguments);
    } else {
      arguments.forEach(Logger.out.write);
      Logger.out.write(eol);
    }
  }
  
  info() {
    if (!Logger.out || Logger.level < 2) return;
    this._header('INFO ', Logger.styles.info);
    if (Logger.out === process.stdout) {
      console.log.apply(console, arguments);
    } else if (Logger.out === process.stderr) {
      console.error.apply(console, arguments);
    } else {
      arguments.forEach(Logger.out.write);
      Logger.out.write(eol);
    }
  }

  error() {
    if (!Logger.out || Logger.level < 1) return;
    this._header('ERROR', Logger.styles.error);
    if (Logger.out === process.stdout) {
      console.log.apply(console, arguments);
    } else if (Logger.out === process.stderr) {
      console.error.apply(console, arguments);
    } else {
      arguments.forEach(Logger.out.write);
      Logger.out.write(eol);
    }
  }

  _header(level, style) {
    Logger.out.write(style.timestamp(getTimestamp()) + ' ');
    Logger.out.write(style.level(level) + ' ');
    this.categories.map(e => {
      return style.category(`[${e}]`) + ' ';
    }).forEach(e => Logger.out.write(e));
  }
}

function getTimestamp() {
  return timestamp('HH:mm:ss.ms');
}

function logger() {
  return new Logger(Array.prototype.slice.call(arguments));
};

logger.configure = function(level, out, styles) {
  Logger.configure(level, out, styles);
};

module.exports = logger;
