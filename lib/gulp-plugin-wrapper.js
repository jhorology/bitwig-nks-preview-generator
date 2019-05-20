const through = require('through2');
const PluginError = require('plugin-error');

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
    super(pluginName, `Failed processing file: [${file.path}]`, options);
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
    super(pluginName, `Discard file: [${file.path}]`, options);
    this.reason = reason;
    this.file = file.path;
    this.srcFile = file.history[0];
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
  return through.obj(function(file, enc, cb) {
    const ctx = this;
    const onError = (err) => {
      if (options && options.skipError) {
        // continue processing
        ctx.emit('error', new PluginProcessingError(processor._pluginName, err, file, false));
        cb();
      } else {
        cb(new PluginProcessingError(processor._pluginName, err, file, true));
        ctx.emit('end');
      }
    };
    const onComplete = (discardReason) => {
      if (discardReason) {
        // discard file from stream.
        ctx.emit('error', new PluginDiscardFile(processor._pluginName, err, file));
        cb();
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
}

plugin.PluginProcessingError = PluginProcessingError;
plugin.PluginDiscardFile = PluginDiscardFile;
module.exports = plugin;
