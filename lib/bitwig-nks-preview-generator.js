const fs = require('fs'),
      path = require('path'),
      { src, dest } = require('gulp'),
      glob = require('glob'),
      plumber = require('gulp-plumber'),
      nksfFilter = require('./gulp-nksf-filter'),
      bwclipMapper = require('./gulp-bwclip-mapper'),
      nksf2fxb = require('./gulp-nksf2fxb'),
      fxb2wav = require('./gulp-bitwig-fxb2wav'),
      wav2ogg = require('./gulp-nks-wav2ogg'),
      logger = require('./logger')

/**
 * default options
 * @type {Object}
 */
const defaultOptions = Object.assign(
  nksfFilter.defaultOptions,
  nksf2fxb.defaultOptions,
  bwclipMapper.defaultOptions,
  fxb2wav.defaultOptions,
  wav2ogg.defaultOptions,
  {
    fxb: 'temp/fxb', // folder path for store intermediate .fxb files
    wav: 'temp/wav', // folder path for store intermediate .wav files
    skipError: false, // skip on error, continue processing
    skipExist: false // skip already exist preview
  }
)

/**
 * options descriptions
 * @type {Object}
 */
const optionsDescriptions = Object.assign(
  nksfFilter.optionsDescriptions,
  nksf2fxb.optionsDescriptions,
  bwclipMapper.optionsDescriptions,
  fxb2wav.optionsDescriptions,
  wav2ogg.optionsDescriptions,
  {
    fxb: 'directory for store intermediate .fxb files',
    wav: 'directory for store intermediate .wav files',
    skipError: 'skip on error, continue processing'
  }
)

/**
 * Streaming processor for generating previe audio.nksf.ogg files from .nksf preset
 * @param {String} dir - target directory, absolute or relative from cwd
 * @param {Object} options - options
 * @param {function} callback - callback function for notce progress
 * @return {stream.Writable} - writable object stream
 */
function nksf2ogg(dir, options, callback = function() {}) {
  const opts = Object.assign({}, defaultOptions, options),
        globPattern = `${dir}/**/*.nksf`
  const files = glob.sync(globPattern),
        fileCount = !opts.skipExist ? files.length
          : files.map(f => fs.existsSync(path.join(path.dirname(f), '.previews', path.basename(f) + '.ogg')) ? 0 : 1).reduce((sum, v) => sum + v)

  if (!fileCount) throw new Error('Target .nksf files are not found.')

  return src(globPattern)
    .pipe(plumber({ errorHandler: callback }))
    .pipe(nksfFilter(opts))
    .pipe(nksf2fxb(opts))
    .pipe(bwclipMapper(opts))
    .pipe(dest(opts.fxb))
    .pipe(fxb2wav(opts, fileCount))
    .pipe(dest(opts.wav))
    .pipe(wav2ogg(opts))
    .pipe(dest(dir))
    .on('data', (file) => callback(undefined, file))
}

nksf2ogg.nksf2fxb = nksf2fxb
nksf2ogg.wav2ogg = wav2ogg
nksf2ogg.logger = logger
nksf2ogg.defaultOptions = defaultOptions
nksf2ogg.optionsDescriptions = optionsDescriptions
module.exports = nksf2ogg
