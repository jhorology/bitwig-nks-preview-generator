const path = require('path');
const log = require('fancy-log');
const Local = require('./bitwig-studio-local');
const Client = require('./bitwig-studio-remote-client');
const plugin = require('./gulp-plugin-wrapper');

const BITWIG_STUDIO_FILES = path.resolve(__dirname, '..', 'Bitwig Studio Files');
const NKS_PREVIEW_PROJECT = path.join(BITWIG_STUDIO_FILES, 'NKS-Preview-Generator.bwproject');

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

/**
 * create clip mapper function
 * @function
 * @param {String} clipOption - .js or .bwclip path (absolute or relative from cwd)
 * @return {function} - mapper function.
 */
const createClipMapper = (clipOption) => {
  const mapperOrClipPath = path.isAbsolute(clipOption) ?
        clipOption :
        path.join(process.cwd(), clipOption);
  if (path.extname(mapperOrClipPath) === '.js') {
    const mapperFn = require(path.resolve(mapperOrClipPath));
    const mapperDirname = path.dirname(mapperOrClipPath);
    return (soundInfo) => {
      const clip = mapperFn(soundInfo);
      return path.join(mapperDirname, clip);
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
 */
async function shutdownBitwigStudio() {
  if (local && !local.closed &&
      remote && remote.connected) {
    await remote.quit(10);
  } else if (remote) {
    remote.close();
  }
}

/**
 * notify progress status
 * @function
 */
function progress(numerator, denominator) {
  if (remote) {
    remote.progressBar(numerator, denominator);
  }
}

/**
 * Gulp plugin for converting .fxb to .wav preview audio file
 * with using Bitwig Studio.
 *
 * @function
 * @param {Object} options
 * @return {Object} - through2.obj() stream.
 */
const fxb2wav = (options) => {
  const opts = Object.assign({}, defaultOptions, options);
  opts._clipMapper = createClipMapper(opts.clip);
  
  _fxb2wav._pluginName = 'bitwig-fxb2wav';
  return plugin(_fxb2wav, opts);
};

// remote & local interface for Bitwig Studio .
var local, remote;


async function _fxb2wav(file, opts) {
  // Bitwig Studio local interafce
  if (!local) {
    local = await Local.launch({
      bitwig: opts.bitwig,
      project: NKS_PREVIEW_PROJECT,
      createTemporaryProjectFolder: true
    });
  }
  // Bitwig Studio remote interafce
  if (!remote) {
    remote = await Client.connect(opts);
  }
  // cleanup bounce wav files
  local.cleanBounceFolder();
  // load clip for bouncing.
  const bwClip = opts._clipMapper(file.data.soundInfo);
  await remote.loadClip(bwClip);
  // load VST
  await remote.loadVST2Device(file.data.pluginId);
  // load a .fxb preset
  await remote.loadFxbPreset(file.path);

  // bounce in a place, convert clip MIDI to audio
  await remote.bounceClip();
  //
  await remote.undoBounceClip();
  
  file.contents = await local.readBounceWavFile();
  file.extname = '.wav';
  return null;
};

fxb2wav.defaultOptions = defaultOptions;
fxb2wav.optionsDescriptions = optionsDescriptions;
fxb2wav.shutdownBitwigStudio = shutdownBitwigStudio;
fxb2wav.progress = progress;
module.exports = fxb2wav;
