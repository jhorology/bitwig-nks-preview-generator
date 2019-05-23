const through = require('through2'),
      chalk = require('chalk'),
      PluginError = require('plugin-error'),
      log = require('../lib/logger')('gulp-bitwig-wrapper');

class PluginProcessingError extends PluginError {
  /**
   * Constructor.
   * @param {String} plugin - Plugin name
   * @param {Error} causedBy - Base error
   * @param {VnylFile} file -  VinylFile
   * @param {boolean} stop -  stop processing
   * @param {Object} options - options for PluginErro
   */
  constructor(pluginName = '(unnamed)', causedBy, file, stop, options) {
    super(pluginName, `Failed processing file: "${file.basename}"`, Object.assign({
      showStack: true,
      showProperties: true
    }, options));
    this.file = file.path;
    this.srcFile = file.history[0];
    this.causedBy = causedBy;
    this.stop = stop;
  }
};

class PluginDiscardFile extends PluginError {
  /**
   * Constructor.
   * @param {String} plugin - Plugin name
   * @param {String} reason - Base error
   * @param {VnylFile} file -  VinylFile
   * @param {Object} options - options for PluginErro
   */
  constructor(pluginName, reason, file, options) {
    super(pluginName, `Discard processing file: "${file.basename}" reason: ${reason}`, Object.assign({
      showStack: false,
      showProperties: false
    }, options));
    this.reason = reason;
    this.file = file.path;
    this.srcFile = file.history[0];
    this.name = 'Notice';
  }
};

/**
 * Gulp plugin wrapper.
 *  - processor._pluginName {String}
 * @param {function} processor - function to process file
 * @param {Object} options - options for processor
 * @param {Object} throughOpts - options for throught2.obj
 * @return {Stream} - through2.obj() stream
 */
function plugin(processor, options, throughOpts) {
  const stream =  through.obj(function(file, enc, cb) {
    const ctx = this;
    const onError = (err) => {
      const wrappedError = new PluginProcessingError(
        processor._pluginName, err, file,
        !(options && options.skipError)); // stop
      if (options && options.skipError) {
        // continue processing
        ctx.emit('error', wrappedError);
        cb();
      } else {
        // stop
        cb(wrappedError);
        ctx.emit('end');
      }
      log.error(chalk.redBright.bold(`[${processor._pluginName}]`), wrappedError);
    };
    const onComplete = (discardReason) => {
      if (discardReason) {
        const wrappedError = new PluginDiscardFile(processor._pluginName, discardReason, file);
        // discard file from stream.
        ctx.emit('error', wrappedError);
        cb();
        log.info(chalk.yellowBright.bold(`[${processor._pluginName}]`), wrappedError);
      } else {
        cb(undefined, file);
      }
    };
    let result;
    try {
      result = processor(file, options);
    } catch(err) {
      onError(err);
      return;
    }
    // Promise ?
    if (result && typeof result.then === 'function') {
      result.then(onComplete, onError);
    } else {
      onComplete(result);
    }
    return;
  }, throughOpts);
  // logger
  stream.on('data', (file)=>{
    log.info(chalk.greenBright.bold(`[${processor._pluginName}] processing complete.`), file.relative);
  });
  return stream;
}

plugin.PluginProcessingError = PluginProcessingError;
plugin.PluginDiscardFile = PluginDiscardFile;
module.exports = plugin;
