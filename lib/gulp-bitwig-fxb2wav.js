const path = require('path'),
      Local = require('./bitwig-studio-local'),
      Client = require('./bitwig-studio-remote-client'),
      plugin = require('./gulp-plugin-wrapper'),
      log = require('../lib/logger')('gulp-bitwig-fxb2wav'),
      BITWIG_STUDIO_FILES = path.resolve(__dirname, '..', 'Bitwig Studio Files'),
      NKS_PREVIEW_PROJECT = path.join(BITWIG_STUDIO_FILES, 'NKS-Preview-Generator.bwproject');

/**
 * default options
 * @type {Object}
 */
const defaultOptions = Object.assign({}, Client.defaultOptions, {
  bitwig: Local.defaultOptions.bitwig,
  clip: path.join(BITWIG_STUDIO_FILES, 'NKS-Preview-Cmaj-Chord.bwclip'),
  skipError: false  // skip on error, continue processing
});

/**
 * options descriptions
 * @type {Object}
 */
const optionsDescriptions = Object.assign({}, Client.optionsDescriptions, {
  bitwig: Local.optionsDescriptions.bitwig,
  clip: '.bwclip MIDP clip or .js mapper program',
  skipError: 'skip on error, continue processing'
});

// remote & local interface for Bitwig Studio .
var first = true, local,  remote;

/**
 * Gulp plugin for converting .fxb to .wav preview audio file
 * with using Bitwig Studio.
 *
 * @function
 * @param {Object} options - options for this plugin
 * @param {Number} numFiles - number of files scheduled to be processed
 * @return {TransformStream} - through2.obj() stream.
 */
const fxb2wav = (options, numFiles) => {
  const opts = Object.assign({}, defaultOptions, options);
  var count = 0;
  
  opts._clipMapper = _createClipMapper(opts.clip);
  _fxb2wav._pluginName = 'bitwig-fxb2wav';
  return plugin(_fxb2wav, opts)
    .on('data', () => {
      if (remote) remote.progress(++count, numFiles);
    })
    .on('end', () => {
      _shutdownBitwigStudio();
    });
};

/**
 * convert .fxb to .2wav
 * @function
 * @param {VinylFile} file - 
 * @return {options} - mapper function.
 */
async function _fxb2wav(file, opts) {
  // Bitwig Studio local interafce
  if (first) {
    first = false;
    local = await Local.launch({
      bitwig: opts.bitwig,
      project: NKS_PREVIEW_PROJECT,
      createTemporaryProjectFolder: true,
      debug: opts.debug >= 4
    });
    remote = await Client.connect(opts);
  }
  // Bitwig Studio remote interafce
  // cleanup bounce wav files
  // local.cleanBounceFolder();
  local.cleanBounceWavFiles();

  // load clip for bouncing.
  const bwClip = opts._clipMapper(file.data.soundInfo);
  await remote.loadClip(bwClip);

  // load VST
  await remote.loadVST2Device(file.data.pluginId);

  // load a .fxb preset
  await remote.loadFxbPreset(file.path);

  // bounce in a place, convert clip MIDI to audio
  await remote.bounceClip();

  file.contents = await local.readBounceWavFile();
  file.extname = '.wav';

  await remote.undoBounceClip();
  return null;
};

/**
 * create clip mapper function
 * @function
 * @param {String} clipOption - .js or .bwclip path (absolute or relative from cwd)
 * @return {function} - mapper function.
 */
function _createClipMapper(clipOption) {
  const mapperOrClipPath = path.isAbsolute(clipOption) ?
        clipOption :
        path.join(process.cwd(), clipOption);
  if (path.extname(mapperOrClipPath) === '.js') {
    const mapperFn = require(path.resolve(mapperOrClipPath)),
          mapperDirname = path.dirname(mapperOrClipPath);
    return (soundInfo) => {
      const clip = mapperFn(soundInfo);
      return path.isAbsolute(clip) ? clip :
        path.join(mapperDirname, clip);
    };
  } else {
    return (soundInfo) => {
      return mapperOrClipPath;
    };
  }
};

/**
 * Shutdown Bitwig Studio.
 *
 * @function
 * @return {Promise}
 */
async function _shutdownBitwigStudio() {
  try {
    if (local && !local.closed &&
        remote && remote.connected) {
      await remote.quit(5);
    } else if (remote) {
      remote.close();
    }
  } catch (err) {
    // ignore
    log.error('error on shutdown.', err);
  }
}

fxb2wav.defaultOptions = defaultOptions;
fxb2wav.optionsDescriptions = optionsDescriptions;
module.exports = fxb2wav;
