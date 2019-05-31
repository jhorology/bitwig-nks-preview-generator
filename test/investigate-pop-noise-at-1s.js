const fs = require('fs'),
      path = require('path'),
      spawn = require('child_process').spawn,
      streamBuffers = require('stream-buffers'),
      mkdirp = require('mkdirp')
/* eslint no-multi-spaces: 0 */
const tests = [
  {
    name: 'investigate-pop-noise',
    src: 'wav/01 Solo Trumpet - reverse.wav',
    conds: [
      { fadeout: 0, silence: '-90dB', freq: 44100, quality: 6 }
    ]
  }];

(async () => {
  try {
    for (let test of tests) {
      for (let opts of test.conds) {
        await wav2ogg(test.name, test.src, opts)
      }
    }
  } catch (err) {
    console.error(err)
  }
})()

async function wav2ogg(test, file, opts) {
  const basename = path.basename(file, '.wav'),
        buffer = await _ffmpeg(file, opts),
        outFile = `src[${basename}]-fadeout[${opts.fadeout}s]-silence[${opts.silence}]-freq[${opts.freq}]-quality[${opts.quality}].ogg`,
        dest = path.join('out', test)
  mkdirp.sync(dest)
  fs.writeFileSync(path.join(dest, outFile), buffer)
}
async function wav2wav(test, file, opts) {
  const basename = path.basename(file, '.wav'),
        buffer = await _ffmpeg_wav(file, opts),
        outFile = `src[${basename}]-fadeout[${opts.fadeout}s]-silence[${opts.silence}]-freq[${opts.freq}]-quality[${opts.quality}].wav`,
        dest = path.join('out', test)
  mkdirp.sync(dest)
  fs.writeFileSync(path.join(dest, outFile), buffer)
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
function _sox(file, opts) {
  return new Promise(async (resolve, reject) => {
    const outStream = new streamBuffers.WritableStreamBuffer()
  })
}
