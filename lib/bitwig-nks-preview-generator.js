const fs = require('fs');
const path = require('path');
const {src, dest, task} = require('gulp');
const plumber = require('gulp-plumber');
const log = require('fancy-log');
const map = require('map-stream');
const nksfFilter = require('./gulp-nksf-filter');
const nksf2fxb = require('./gulp-nksf2fxb');
const fxb2wav = require('./gulp-bitwig-fxb2wav');
const wav2ogg = require('./gulp-nks-wav2ogg');
const Local = require('./bitwig-studio-local');
const plugin = require('./gulp-plugin-wrapper');

/**
 * default options
 * @type {Object}
 */
const defaultOptions = Object.assign(
  nksfFilter.defaultOptions,
  nksf2fxb.defaultOptions,
  fxb2wav.defaultOptions,
  wav2ogg.defaultOptions,
  {
    fxb: 'temp/fxb',   // folder path for store intermediate .fxb files
    wav: 'temp/wav',   // folder path for store intermediate .wav files
    skipError: false,  // skip on error, continue processing
    skipExist: false   // skip already exist preview
  },
);

/**
 * options descriptions
 * @type {Object}
 */
const optionsDescriptions = Object.assign(
  nksfFilter.optionsDescriptions,
  nksf2fxb.optionsDescriptions,
  fxb2wav.optionsDescriptions,
  wav2ogg.optionsDescriptions,
  {
    fxb: 'directory for store intermediate .fxb files',
    wav: 'directory for store intermediate .wav files',
    skipError: 'skip on error, continue processing'
  },
);

/**
 * Streaming processor for generating previe audio.nksf.ogg files from .nksf preset
 * @param {String} dir - target directory
 * @param {Object} options - target directory
 * @param {Number} numFiles - total number of .nksf files
 * @return {stream.Writable} - object writable stream
 */
function nksf2ogg(dir, options, numFiles = undefined, cb) {
  const opts = Object.assign({}, defaultOptions, options);
  const summary = {
    completed: [],
    failed: [],
  };
  let stopCausedBy;
  return src(`${dir}/**/*.nksf`)
    .pipe(plumber({errorHandler: function(err) {
      log(err);
      if (err instanceof plugin.PluginProcessingError) {
        log(err);
        if (err.stop) {
          stopCausedBy =  err.cauedBy;
        } else {
          summary.failed.push(err.srcFile);
        }
      }
    }}))
    .pipe(nksfFilter(opts))
    .pipe(nksf2fxb(opts))
    .pipe(dest(opts.fxb))
    .pipe(fxb2wav(opts))
    .pipe(dest(opts.wav))
    .pipe(wav2ogg(opts))
    .pipe(plugin(function(file) {
      summary.completed.push(file.history[0]);
    }))
    .pipe(dest(dir))
    .on('end', async () => {
      // quit Bitwig Studio
      // disconnect websocket
      await fxb2wav.shutdownBitwigStudio();;
      if (cb) cb(stopCausedBy, summary);
    });
}

nksf2ogg.nksf2fxb = nksf2fxb;
nksf2ogg.wav2ogg = wav2ogg;
nksf2ogg.defaultOptions = defaultOptions;
nksf2ogg.optionsDescriptions = optionsDescriptions;
module.exports = nksf2ogg;
