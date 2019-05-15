const ffmpeg = require('fluent-ffmpeg');
const tap = require('gulp-tap');

module.exports = () => {
  return tap(_wav2ogg);
};

function _wav2ogg(file) {
}
