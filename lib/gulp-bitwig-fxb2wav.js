const path = require('path'),
      Local = require('./bitwig-studio-local'),
      Client = require('./bitwig-studio-remote-client'),
      plugin = require('./gulp-plugin-wrapper'),
      log = require('../lib/logger')('gulp-bitwig-fxb2wav'),
      BITWIG_STUDIO_FILES = path.resolve(__dirname, '..', 'Bitwig Studio Files'),
      NKS_PREVIEW_PROJECT = path.join(BITWIG_STUDIO_FILES, 'NKS-Preview-Generator.bwproject')

/**
 * default options
 * @type {Object}
 */
const defaultOptions = Object.assign({}, Client.defaultOptions, {
  bitwig: Local.defaultOptions.bitwig,
  skipError: false // skip on error, continue processing
})

/**
 * options descriptions
 * @type {Object}
 */
const optionsDescriptions = Object.assign({}, Client.optionsDescriptions, {
  bitwig: Local.optionsDescriptions.bitwig,
  skipError: 'skip on error, continue processing'
})

// remote & local interface for Bitwig Studio .
var first = true, local, remote, shutdown

/**
 * Gulp plugin for converting .fxb to .wav preview audio file
 * with using Bitwig Studio.
 *
 * This plugin require the following data of Vinyl file.
 *   - file.data.pluginId {Number}  VST2 plugin id.
 *   - file.data.bwclip   {String}  .bwclip absolute path.
 *
 * @function
 * @param {Object} options - options for this plugin
 * @param {Number} numFiles - number of files scheduled to be processed
 * @return {TransformStream} - through2.obj() object transform stream.
 */
const fxb2wav = (options, numFiles) => {
  const opts = Object.assign({}, defaultOptions, options)
  var count = 0
  return plugin('bitwig-fxb2wav', _fxb2wav, opts)
    .on('data', () => {
      if (remote) remote.progress(++count, numFiles)
    })
    .on('end', () => {
      // TODO need to investigate duplicated 'end' event
      if (!shutdown) {
        shutdown = true
        _shutdownBitwigStudio()
      }
    })
}

/**
 * convert .fxb to .2wav
 * @async
 * @function
 * @param {VinylFile} file
 * @return {String} - always return null
 */
async function _fxb2wav(file, opts) {
  // Bitwig Studio local interafce
  if (first) {
    first = false
    local = await Local.launch({
      bitwig: opts.bitwig,
      project: NKS_PREVIEW_PROJECT,
      createTemporaryProjectFolder: true,
      debug: opts.debug >= 4
    })
    remote = await Client.connect(opts)
  }
  // Bitwig Studio remote interafce
  // cleanup bounce wav files
  // local.cleanBounceFolder();
  // local.cleanBounceWavFiles()

  // load clip for bouncing.
  await remote.loadClip(file.data.bwclip)

  // load VST
  await remote.loadVST2Device(file.data.pluginId)

  // load a .fxb preset
  await remote.loadFxbPreset(file.path)

  // bounce in a place, convert clip MIDI to audio
  const clipName = await remote.bounceClip()

  file.contents = await local.readBounceWavFile(clipName)
  file.extname = '.wav'

  await remote.undoBounceClip()
  return null
};

/**
 * Shutdown Bitwig Studio.
 *
 * @async
 * @function
 */
async function _shutdownBitwigStudio() {
  try {
    if (local && !local.closed &&
        remote && remote.connected) {
      await remote.quit(5)
    } else if (remote) {
      remote.close()
    }
  } catch (err) {
    // ignore err
    log.debug('error on shutdown.', err)
  }
}

fxb2wav.defaultOptions = defaultOptions
fxb2wav.optionsDescriptions = optionsDescriptions
module.exports = fxb2wav
