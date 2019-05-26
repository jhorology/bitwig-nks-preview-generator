const fs = require('fs'),
      path = require('path'),
      {isAsyncFunction} = require('util').types,
      plugin = require('./gulp-plugin-wrapper'),
      BITWIG_STUDIO_FILES = path.resolve(__dirname, '..', 'Bitwig Studio Files'),
      NKS_PREVIEW_PROJECT = path.join(BITWIG_STUDIO_FILES, 'NKS-Preview-C2-Single.bwclip');

/**
 * default options
 * @type {Object}
 */
const defaultOptions = {
  clip: path.join(BITWIG_STUDIO_FILES, 'NKS-Preview-C2-Single.bwclip'),  // skip already exist preview
};

/**
 * options descriptions
 * @type {Object}
 */
const optionsDescriptions = {
  clip: '.bwclip MIDP clip or .js mapper program',
};

/**
 * Gulp plugin for appending .bwclip absolute path to file.data 
 *
 * This plugin requier the following data of vinyl-file.
 *   - file.data.soundInfo {Object}  NKS Soundinfo
 *
 * This plugin append the following data to vinyl-file.
 *   - file.data.bwclip  {String}  .bwclip absolute path.
 *
 * @function
 * @param {Object} options
 * @return {Object} - through2.obj() stream.
 */
const bwclipMapper = (options) => {
  const opts = Object.assign({}, defaultOptions, options),
        processor = _createProcessor(opts.clip);
  return plugin('bwclip-mapper', processor, opts);
};

/**
 * create clip mapper function
 * @function
 * @param {String} clipOption - .js or .bwclip path (absolute or relative from cwd)
 * @return {function} - mapper function.
 */
function _createProcessor(optClip) {
  const extname = path.extname(optClip),
        dirname = path.dirname(optClip),
        absolute = path.resolve(optClip);
  var mapperFn;
  if (extname === '.js') {
    mapperFn = require(absolute);
    if (isAsyncFunction(mapperFn)) {
      return async (file) => {
        const bwclip = await mapperFn(file.data.soundInfo);
        _relative_or_absolute_bwclip(file, dirname, bwclip);
        return null;
      };
    } else {
      return (file) => {
        const bwclip = mapperFn(file.data.soundInfo);
        _relative_or_absolute_bwclip(file, dirname, bwclip);
        return null;
      };
    }
  } else if (extname === '.bwclip') {
    return (file) => {
      _absolute_bwclip(file, absolute);
      return null;
    };
  }
  return () => null;
}

// apennd absolute or relative .bwclip path to file.data
function _relative_or_absolute_bwclip(file, dirname, bwclip) {
  if (bwclip && !path.isAbsolute(bwclip)) {
    bwclip = path.resolve(dirname, bwclip);
  }
  _absolute_bwclip(file, bwclip);
}
// apennd absolute .bwclip path to file.data
function _absolute_bwclip(file, bwclip) {
  file.data = Object.assign({}, file.data, {
    bwclip: bwclip
  });
}

bwclipMapper.defaultOptions = defaultOptions;
bwclipMapper.optionsDescriptions = optionsDescriptions;
module.exports = bwclipMapper;
