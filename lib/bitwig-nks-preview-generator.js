const {src, dest} = require('gulp');
const data = require('gulp-data');
const plumber = require('gulp-plumber');
const log = require('fancy-log');
const map = require('map-stream');
const nksf2fxb = require('./gulp-nksf2fxb');
const fxb2wav = require('./gulp-bitwig-fxb2wav');
const wav2ogg = require('./gulp-nks-wav2ogg');
const Local = require('./bitwig-studio-local');

/**
 * default options
 * @type {Object}
 */
const defaultOptions = Object.assign(
  {
    fxb: 'temp/fxb',   // folder path for store intermediate .fxb files
    wav: 'temp/wav',   // folder path for store intermediate .wav files
    skipError: false,  // skip on error, continue processing
    skipExist: false,  // skip already exist preview
  },
  nksf2fxb.defaultOptions,
  fxb2wav.defaultOptions,
  wav2ogg.defaultOptions
);

/**
 * options descriptions
 * @type {Object}
 */
const optionsDescriptions = Object.assign(
  {
    fxb: 'directory for store intermediate .fxb files',
    wav: 'directory for store intermediate .wav files',
    skipError: 'skip on error, continue processing',
    skipExist: 'skip .nksf file that already has preview audio'
  },
  nksf2fxb.optionsDescriptions,
  fxb2wav.optionsDescriptions,
  wav2ogg.optionsDescriptions
);

/**
 * Source .nksf exclude filter function
 * @param {Vinyl} file - vinyl file
 * @param {Object} options
 * @return {boolean}
 */
const nksfExclude = (file, options) => {
  // does .nksf file has preview audio ?
  if (options.skipExist) {
    const previewFile = path.join(file.dirname, '.previews', file.basename + '.ogg');
    const exists = fs.existsSync(previewFile);
    if (exists) {
      log('skip already existing preview file:', previewFile);
    }
    return exists;
  }
  return false;
};

/**
 * Streaming processor for converting .nksf to NKSF preview .nksf.ogg files
 * @param {String} dir - target directory
 * @param {Object} options - target directory
 * @param {Number} numFiles - total number of .nksf files
 * @return {Promise}
 */
const nksf2ogg = (dir, options, numFiles = undefined) => {
  const opts = Object.assign({}, defaultOptions, options);
  return src(`${dir}/**/*.nksf`)
    .pipe(map(function(file, cb) {
      if (nksfExclude(file, options)) {
        cb();
      } else {
        cb(undefined, file);
      }
    }))
    .pipe(plumber({
      errorHandler: function(err) {
        // TODO options.skipError
        log.error('plumber()', err);
      }}))
    .pipe(nksf2fxb())
    .pipe(dest(opts.fxb))
    .pipe(fxb2wav(opts))
    .pipe(dest(opts.wav))
    .pipe(wav2ogg(opts))
    .pipe(dest(dir))
    .on('end', () => {
      // quit Bitwig Studio
      // disconnect websocket
      fxb2wav.shutdownBitwigStudio();
    });
};

nksf2ogg.nksf2fxb = nksf2fxb;
nksf2ogg.wav2ogg = wav2ogg;
nksf2ogg.defaultOptions = defaultOptions;
nksf2ogg.optionsDescriptions = optionsDescriptions;
module.exports = nksf2ogg;
