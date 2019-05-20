const fs = require('fs');
const path = require('path');
const plugin = require('./gulp-plugin-wrapper');

/**
 * default options
 * @type {Object}
 */
const defaultOptions = {
  skipExist: false,  // skip already exist preview
};

/**
 * options descriptions
 * @type {Object}
 */
const optionsDescriptions = {
  skipExist: 'skip .nksf file that already has preview audio'
};

/**
 * Gulp plugin for filter NKSF file.
 *
 * @function
 * @param {Object} options
 * @return {Object} - through2.obj() stream.
 */
const nksfFilter = (options) => {
  const opts = Object.assign({}, defaultOptions, options);
  _nksfFilter._pluginName = 'nksf-filter';
  return plugin(_nksfFilter, opts);
};

function _nksfFilter(file, opts) {
  // does .nksf file has preview audio ?
  if (opts.skipExist) {
    const previewFile = path.join(file.dirname, '.previews', file.basename + '.ogg');
    const exists = fs.existsSync(previewFile);
    if (exists) {
      // reason for discard file.
      return 'already existing preview audio';
    }
  }
  // return message if want to discard file.
  return null;
};

nksfFilter.defaultOptions = defaultOptions;
nksfFilter.optionsDescriptions = optionsDescriptions;
module.exports = nksfFilter;
