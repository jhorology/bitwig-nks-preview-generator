const path = require('path');
const {src, dest} = require('gulp');
const data = require('gulp-data');
const log = require('fancy-log');
const nksf2fxb = require('./gulp-nksf2fxb');
const fxb2wav = require('./gulp-bitwig-fxb2wav');
const wav2ogg = require('./gulp-nks-wav2ogg');
const Local = require('./bitwig-studio-local');

const BITWIG_STUDIO_FILES = path.resolve(path.join(__dirname, '..', 'Bitwig Studio Files'));
const BITWIG_STUDIO_PROJECT = path.join(BITWIG_STUDIO_FILES, 'NKS-Preview-Generator.bwproject');
const DEFAULT_MIDI_CLIP =  path.join(BITWIG_STUDIO_FILES, 'NKS-Preview-Cmaj-Chord.bwclip');

/**
 * Streaming processor for converting .nksf to NKSF preview .nksf.ogg files
 * @param {String} dir - target directory
 * @param {Object} options - target directory
 * @return {Promise}
 */
const nksf2ogg = (dir, options) => {
  const opts = Object.assign({
    bitwig: Local.defaultExecuteFile(), // execution path of Bitwig Studio.
    project: BITWIG_STUDIO_PROJECT,
    url: 'ws://localhost:8887',         // WebSockets server URL.
    clip: DEFAULT_MIDI_CLIP,            // file path of .bwclip or .js mapper program.
    fxb: 'temp/fxb',                    // folder path for store intermediate .fxb files.
    wav: 'temp/wav',                    // folder path for store intermediate .wav files.
    timeout: 30000,                     // timeout millis for launching Bitwig Studio.
    waitPlugin: 5000,                   // wait time for loading plugin.
    waitPpreset: 3000,                  // wait time for loading .fxb preset.
    waitBbounce: 2000,                  // wait time for bouncing clip.
    waitUndo: 1500,                     // wait time for undo bouncing clip.
    tempo: 120,                         // BPM for bouncing clip.
    freq: 441000,                       //.ogg audio sampling rate.
    fadeout: 110250,                    // number of samples for fadeout.
    silence: '-90dB',                   // threshold level for removing silnce from end.
    quality: 5                          // quality of ogg compression. 0-10.
  }, options);


  return src(`${dir}/**/*.nksf`)
    .pipe(nksf2fxb())
    .pipe(dest(opts.fxb))
    .pipe(fxb2wav(opts))
    .pipe(dest(opts.wav))
    .pipe(wav2ogg(opts))
    .pipe(dest(dir))
    .on('end', () => {
      // quit Bitwig Studio
      // disconnect websocket
      fxb2wav.shutdown();
    });
};

nksf2ogg.nksf2fxb = nksf2fxb;
wav2ogg.wav2ogg = wav2ogg;
module.exports = nksf2ogg;
