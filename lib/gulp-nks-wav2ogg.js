/*
 * Gulp plugin for converting .wav to .nksf.ogg file.
 */
const path = require('path'),
      ffmpeg = require('fluent-ffmpeg'),
      streamBuffers = require('stream-buffers'),
      plugin = require('./gulp-plugin-wrapper'),
      wavUtil = require('./wav-util');

/**
 * default options
 * @type {Object}
 */
const defaultOptions = {
  dotPreviews: true,   // append '.prevews' to dirname
  nksfDotOgg: true,
  freq: 44100,
  fadeout: 0.25,
  silence: '-90dB',
  quality: 6,
  skipError: false  // skip on error, continue processing
};

/**
 * options descriptions
 * @type {Object}
 */
const optionsDescriptions = {
  dotPreviews: "append '.prevews' to dirname",
  nksfDotOgg: "rename extension to '.nksf.ogg'",
  freq: "sampling rate for output .ogg audio",
  fadeout: 'fadeout duration seconds from end',
  silence: 'threshold level for removing silence from end, 0-1 or negative dB',
  quality: 'quality of .ogg audio. 0-10',
  skipError: 'skip on error, continue processing'
};

/**
 * Gulo plugin for converting WAV to NKS-aware .ogg files.
 *
 * @function
 * @param {Object} options
 * @return {TransformStream} - through2.obj() object transform stream.
 */
const wav2ogg = (options) => {
  const opts = Object.assign({}, defaultOptions, options);
  return plugin('nks-wav2ogg', _wav2ogg, opts);
};

async function _wav2ogg(file, opts) {
  file.contents = await _ffmpeg(file.path, opts);
  // .wav -> .nksf.ogg
  if (opts.dotPreviews) {
    file.dirname = path.join(file.dirname, '.previews');
  }
  if (opts.nksfDotOgg) {
    file.extname = '.nksf.ogg';
  } else {
    file.extname = '.ogg';
  }
}

/**
 * apply ffmpeg.
 *
 * @function
 * @param {String} file - src file path
 * @param {String} duration - entier duration of src wav file
 * @param {Object} opts - options
 * @return {Promise} - resolve Buffer
 */
function _ffmpeg(file, opts) {
  return new Promise(async (resolve, reject) => {
    const outStream = new streamBuffers.WritableStreamBuffer();
    ffmpeg(file)
    // Remove silence from the beginning, middle or end of the audio.
    //
    // The filter accepts the following options:
    //
    // start_periods
    // This value is used to indicate if audio should be trimmed at beginning of the audio. A value of zero
    // indicates no silence should be trimmed from the beginning. When specifying a non-zero value, it trims
    // audio up until it finds non-silence. Normally, when trimming silence from beginning of audio the
    // start_periods will be 1 but it can be increased to higher values to trim all audio up to specific
    // count of non-silence periods. Default value is 0.
    //
    // start_duration
    // Specify the amount of time that non-silence must be detected before it stops trimming audio. By
    // increasing the duration, bursts of noises can be treated as silence and trimmed off. Default value is
    // 0.
    //
    // start_threshold
    // This indicates what sample value should be treated as silence. For digital audio, a value of 0 may be
    // fine but for audio recorded from analog, you may wish to increase the value to account for background
    // noise. Can be specified in dB (in case "dB" is appended to the specified value) or amplitude ratio.
    // Default value is 0.
    //
    // start_silence
    // Specify max duration of silence at beginning that will be kept after trimming. Default is 0, which is
    // equal to trimming all samples detected as silence.
    //
    // start_mode
    // Specify mode of detection of silence end in start of multi-channel audio. Can be any or all. Default
    // is any. With any, any sample that is detected as non-silence will cause stopped trimming of silence.
    // With all, only if all channels are detected as non-silence will cause stopped trimming of silence.
    //
    // stop_periods
    // Set the count for trimming silence from the end of audio. To remove silence from the middle of a file,
    // specify a stop_periods that is negative. This value is then treated as a positive value and is used to
    // indicate the effect should restart processing as specified by start_periods, making it suitable for
    // removing periods of silence in the middle of the audio. Default value is 0.
    //
    // stop_duration
    // Specify a duration of silence that must exist before audio is not copied any more. By specifying a
    // higher duration, silence that is wanted can be left in the audio. Default value is 0.
    //
    // stop_threshold
    // This is the same as start_threshold but for trimming silence from the end of audio. Can be specified
    // in dB (in case "dB" is appended to the specified value) or amplitude ratio. Default value is 0.
    //
    // stop_silence
    // Specify max duration of silence at end that will be kept after trimming. Default is 0, which is equal
    // to trimming all samples detected as silence.
    //
    // stop_mode
    // Specify mode of detection of silence start in end of multi-channel audio. Can be any or all. Default
    // is any. With any, any sample that is detected as non-silence will cause stopped trimming of silence.
    // With all, only if all channels are detected as non-silence will cause stopped trimming of silence.
    //
    // detection
    // Set how is silence detected. Can be rms or peak. Second is faster and works better with digital
    // silence which is exactly 0. Default value is rms.
    //
    // window
    // Set duration in number of seconds used to calculate size of window in number of samples for detecting
    // silence. Default value is 0.02. Allowed range is from 0 to 10.
    // to perfect and safe triming end, reverse make it easy.

    // After so many error and trial to perfect & safe triming end,
    // [revserse -> fade -> trim silence ->  reverse] make it easy
    // but bad performcance.
      .audioFilter('[in] areverse [rev]')
      .audioFilter(`[rev] afade=t=in:st=0:d=${opts.fadeout} [f1]`)
      .audioFilter(`[f1] silenceremove=start_periods=1:start_threshold=${opts.silence} [f2]`)
      .audioFilter('[f2] areverse [out]')
      .audioCodec('libvorbis')
      .format('ogg')
      .audioFrequency(opts.freq)
    // quality 0 - 10 = 64kbps - 500kbps
      .audioQuality(opts.quality)
      .on('error', function(err) {
        reject(err);
      })
      .on('end', function() {
        resolve(outStream.getContents());
      })
      .pipe(outStream, {end: true});
  });
}

wav2ogg.defaultOptions = defaultOptions;
wav2ogg.optionsDescriptions = optionsDescriptions;
wav2ogg._ffmpeg = _ffmpeg;   // for test
module.exports = wav2ogg; 
