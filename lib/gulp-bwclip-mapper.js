const fs = require('fs'),
  path = require('path'),
  { isAsyncFunction } = require('util').types,
  plugin = require('./gulp-plugin-wrapper'),
  log = require('../lib/logger')('gulp-bwclip-mapper'),
  BITWIG_STUDIO_FILES = path.resolve(__dirname, '..', 'Bitwig Studio Files')

/**
 * default options
 * @type {Object}
 */
const defaultOptions = {
  clip: path.join(BITWIG_STUDIO_FILES, 'NKS-Preview-C2-Single.bwclip'), // skip already exist preview
  dryRun: false // skip already exist preview
}

/**
 * options descriptions
 * @type {Object}
 */
const optionsDescriptions = {
  clip: '.bwclip MIDI clip or [.js | .coffee] mapper program',
  dryRun: 'just check mapper function, generating process is not executed'
}

/**
 * Gulp plugin for appending .bwclip absolute path to file.data
 *
 * This plugin require the following data of vinyl-file.
 *   - file.data.soundInfo {Object}  NKS Soundinfo
 *
 * This plugin append the following data to vinyl-file.
 *   - file.data.bwclip  {String}  .bwclip absolute path.
 *
 * @function
 * @param {Object} options
 * @return {TransformStream} - through2.obj() object transform stream.
 */
const bwclipMapper = options => {
  const opts = Object.assign({}, defaultOptions, options),
    processor = _createProcessor(opts)
  return plugin('bwclip-mapper', processor, opts)
}

/**
 * create clip mapper function
< * @function
 * @param {String} opts - options
 * @return {function} - mapper function.
 */
function _createProcessor(opts) {
  const extname = path.extname(opts.clip),
    dirname = path.dirname(opts.clip),
    absolute = path.resolve(opts.clip)
  var mapperFn
  if (extname === '.js' || extname === '.coffee') {
    mapperFn = require(absolute)
    if (isAsyncFunction(mapperFn)) {
      log.debug('mapper is an async function.')
      return async file => {
        const bwclip = await mapperFn(file.data.soundInfo)
        _relativeOrAbsoluteBwclip(file, dirname, bwclip)
        return _ret(opts)
      }
    } else {
      log.debug('mapper is a function.')
      return file => {
        const bwclip = mapperFn(file.data.soundInfo)
        _relativeOrAbsoluteBwclip(file, dirname, bwclip)
        return _ret(opts)
      }
    }
  } else if (extname === '.bwclip') {
    return file => {
      _absoluteBwclip(file, absolute)
      return _ret(opts)
    }
  }
  return () => _ret(opts)
}

// apennd absolute or relative .bwclip path to file.data
function _relativeOrAbsoluteBwclip(file, dirname, bwclip) {
  if (bwclip && !path.isAbsolute(bwclip)) {
    bwclip = path.resolve(dirname, bwclip)
  }
  _absoluteBwclip(file, bwclip)
}
// apennd absolute .bwclip path to file.data
function _absoluteBwclip(file, bwclip) {
  const extname = path.extname(bwclip)
  if (extname !== '.bwclip') {
    throw new Error(`unsupported file type: ${extname}`)
  }

  if (!fs.existsSync(bwclip) || !fs.statSync(bwclip).isFile()) {
    throw new Error(`no such .bwclip file. path: ${bwclip}`)
  }

  file.data = Object.assign({}, file.data, {
    bwclip: bwclip
  })
}

function _ret(opts) {
  if (opts.dryRun) {
    return 'dry run'
  }
  return null
}

bwclipMapper.defaultOptions = defaultOptions
bwclipMapper.optionsDescriptions = optionsDescriptions
module.exports = bwclipMapper
