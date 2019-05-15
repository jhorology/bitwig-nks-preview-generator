/*
 * Gulp plugin for converting .wav to .nksf.ogg file.
 *
 */
const ffmpeg = require('fluent-ffmpeg');
const tap = require('gulp-tap');

module.exports = () => {
  return tap(wav2ogg);
};

function wav2ogg(file) {
  // TODO
  // foe testing
  file.contents = Buffer.alloc(0);
  // .wav -> .nksf.ogg
  file.path = file.path.substr(0, file.path.lastIndexOf(".")) + '.nksf.ogg';
}
