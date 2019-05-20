/*
 * Gulp plugin for converting .fxb to NKS preview .wav file.
 *
 * this plugin neede following data of Vinyl file.
 *   - file.data.pluginId  {Number} requierd  VST2 plugin id.
 *   - file.data.soundInfo {Object} optional  NKS Soundinfo
 */
const path = require('path');
const data = require('gulp-data');
const log = require('fancy-log');
const Local = require('./bitwig-studio-local');
const Client = require('./bitwig-studio-remote-client');

const BITWIG_STUDIO_FILES = path.resolve(__dirname, '..', 'Bitwig Studio Files');
const NKS_PREVIEW_PROJECT = path.join(BITWIG_STUDIO_FILES, 'NKS-Preview-Generator.bwproject');

/**
 * default options
 * @type {Object}
 */
const defaultOptions = Object.assign({}, Client.defaultOptions, {
  bitwig: Local.defaultOptions.bitwig,
  clip: path.join(BITWIG_STUDIO_FILES, 'NKS-Preview-Cmaj-Chord.bwclip')
});

/**
 * options descriptions
 * @type {Object}
 */
const optionsDescriptions = Object.assign({}, Client.optionsDescriptions, {
  bitwig: Local.optionsDescriptions.bitwig,
  clip: '.bwclip MIDP clip or .js mapper program'
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
    const mapperFn = requier(path.resolve(mapperOrClipPath));
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
 * Gulp plugin for converting .fxb to .wav preview audio file
 * with using Bitwig Studio.
 *
 * @function
 * @param {Object} options
 * @return {Object} - through2.obj() object transform stream.
 */
const fxb2wav = (options) => {
  const opts = Object.assign({}, defaultOptions, options);
  const mapper = createClipMapper(opts.clip);
  return data(function(file) {
    return _fxb2wav(file, opts, mapper);
  });
};

// remote & local interface for Bitwig Studio .
var local, remote;

/**
 * Shutdown Bitwig Studio.
 *
 * @function
 */
const shutdownBitwigStudio = () => {
  if (local && !local.closed &&
      remote && remote.connected) {
    remote.quit();
  }
};

const _fxb2wav = async (file, opts, mapper) => {
  try {
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
    const bwClip = mapper(file.data.soundInfo);
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
    
  } catch (err) {
    log.error('fxb2wav()', err);
    throw err;
  }
};

fxb2wav.defaultOptions = defaultOptions;
fxb2wav.optionsDescriptions = optionsDescriptions;
fxb2wav.shutdownBitwigStudio = shutdownBitwigStudio;
module.exports = fxb2wav;
