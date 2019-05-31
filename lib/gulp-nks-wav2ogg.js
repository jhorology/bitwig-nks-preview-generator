const path = require('path'),
      { spawn } = require('child_process'),
      log = require('../lib/logger')('gulp-nks-wav2ogg'),
      plugin = require('./gulp-plugin-wrapper')

/**
 * default options
 * @type {Object}
 */
const defaultOptions = {
  dotPreviews: true, // append '.prevews' to dirname
  nksfDotOgg: true,
  freq: 44100,
  fadeout: 0.25, // 0.25s = 8 note length (BPM=120)
  silence: '-90dB',
  quality: 6,
  skipError: false
}

/**
 * options descriptions
 * @type {Object}
 */
const optionsDescriptions = {
  dotPreviews: "append '.prevews' to dirname",
  nksfDotOgg: 'rename extension to \'.nksf.ogg\'',
  freq: 'sampling rate for output .ogg audio',
  fadeout: 'fadeout duration seconds from end',
  silence: 'threshold level for removing silence from end, dB or 0-100%',
  quality: 'quality of .ogg audio. 0-10',
  skipError: 'skip on error, continue processing'
}

/**
 * Gulo plugin for converting WAV to NKS-aware .ogg files.
 *
 * @function
 * @param {Object} options
 * @return {TransformStream} - through2.obj() object transform stream.
 */
const wav2ogg = (options) => {
  const opts = Object.assign({}, defaultOptions, options)
  return plugin('nks-wav2ogg', _wav2ogg, opts)
}

async function _wav2ogg(file, opts) {
  file.contents = await _sox(file.path, opts)
  // .wav -> .nksf.ogg
  if (opts.dotPreviews) {
    file.dirname = path.join(file.dirname, '.previews')
  }
  if (opts.nksfDotOgg) {
    file.extname = '.nksf.ogg'
  } else {
    file.extname = '.ogg'
  }
}

/**
 * apply sox
 *
 * @function
 * @param {String} file - src file path
 * @param {String} duration - entier duration of src wav file
 * @param {Object} opts - options
 * @return {Promise} - resolve Buffer
 */
function _sox(file, opts) {
  const args = [
    file, '-t', 'vorbis', '-C', `${opts.quality}`, '-',
    'reverse',
    'fade', 't', `${opts.fadeout}`,
    'silence', '-l', '1', '0', `${opts.silence}`,
    'reverse',
    'rate', `${opts.freq}`
  ]
  return new Promise(async (resolve, reject) => {
    var buffer = Buffer.alloc(0),
        error = Buffer.alloc(0),
        sox
    try {
      // sox input.wav -t vorbis -C [qiality] - reverse fade t [fadeout] silence -l 1 0 [silence] reverse
      sox = spawn('sox', args, {
        stdio: 'pipe'
      })
      log.debug(`_sox() args: [${args}]`)
      sox.stdout.on('data', data => {
        buffer = Buffer.concat([buffer, data])
      })
      sox.stderr.on('data', data => {
        error = Buffer.concat([error, data])
      })
      sox.on('close', code => {
        if (code === 0) {
          resolve(buffer)
        } else {
          reject(new Error(`Sox Execution Error code:${code} stderr:${error.toString()}`))
        }
      })
    } catch (err) {
      reject(err)
    }
  })
}

wav2ogg.defaultOptions = defaultOptions
wav2ogg.optionsDescriptions = optionsDescriptions
wav2ogg._sox = _sox // for test
module.exports = wav2ogg
