const map = require('map-stream');
const PluginError = require('map-stream');

class FileProcessingError extends PluginError {
  constructor(pluginName, message[, options]) {
  }

};

module.exports = (processor, options) => {
  return mapper(async function(file, cb) {
    try {
      await processor(file, options);
      cb(undefined, file);
    } catch (err) {
      cb();
    }
  });
};
