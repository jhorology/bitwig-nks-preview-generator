/*
 * Gulp plugin for converting .wav to .nksf.ogg file.
 */
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const data = require('gulp-data');
const log = require('fancy-log');
const streamBuffers = require('stream-buffers');

/**
 * default options
 * @type {Object}
 */
const defaultOptions = {
  dotPreviews: true,   // append '.prevews' to dirname
  nksfDotOgg: true,
  freq: 44100,
  silence: '-90dB',
  fadeout: 110250,
  quality: 5
};

/**
 * options descriptions
 * @type {Object}
 */
const optionsDescriptions = {
  dotPreviews: "append '.prevews' to dirname",
  nksfDotOgg: "rename extension to '.nksf.ogg'",
  freq: "sampling rate for output .ogg audio",
  silence: 'threshold level for removing silnce from end',
  fadeout: 'number of samples for fadeout',
  quality: 'quality of .ogg audio. 0-10'
};

/**
 * Gulo plugin for converting WAV to NKS-aware .ogg files.
 *
 * @function
 * @param {Object} options
 * @return {Object} - through2.obj() object transform stream.
 */
const wav2ogg = (options) => {
  const opts = Object.assign({}, defaultOptions, options);
  return data(function(file, done) {
    _wav2ogg(file, done, opts);
  });
};

function _wav2ogg(file, done, opts) {
  var outStream = new streamBuffers.WritableStreamBuffer();
  // sample rate = 441000
  // clip length = 2.0.2 (0.0.2 for use fade)
  // BPM = 120
  // quarter note length: 60/120 = 0.5sec = 500msec
  //                      441000/2 = 220500 samples
  // fade length 0.0.2 : 0.25sec 250msec 110250samples
  ffmpeg(file.path)
  // type fade-out, nb_samples= 110250samples
    .audioFilter(`afade=t=out:ns=${opts.fadeout}`)
  // remove silce from end
    .audioFilter(`silenceremove=stop_periods=1:stop_duration=1:stop_threshold=${opts.silence}`)
    .audioCodec('libvorbis')
    .format('ogg')
  // TODO audioFrequencey cuase error
  // Error while opening encoder for output stream #0:0 - maybe incorrect parameters such as bit_rate, rate, width or height
  //  .audioFrequency(opts.freq)
  // quality 0 - 10 = 64kbps - 500kbps
    .audioQuality(opts.quality)
    .on('error', function(err) {
      log.error('wav2ogg', err);
      done(err);
    })
    .on('end', function() {
      file.contents = outStream.getContents();
      // .wav -> .nksf.ogg
      if (opts.dotPreviews) {
        file.dirname = path.join(file.dirname, '.previews');
      }
      if (opts.nksfDotOgg) {
        file.extname = '.nksf.ogg';
      } else {
        file.extname = '.ogg';
      }
      done();
    })
    .pipe(outStream, {end: true});
}

wav2ogg.defaultOptions = defaultOptions;
wav2ogg.optionsDescriptions = optionsDescriptions;
module.exports = wav2ogg; 
