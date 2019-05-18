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

/**
 * Launch & connect a local Bitwig Studio application.
 * @static
 * @async
 * @method
 * @param {Object} bitwig - local & remote interface for Bitwig Studio
 * @param {Client} remote
 * @return {Promise}
 */
module.exports = fxb2wab = (options) => {
  return data(function(file) {
    return _fxb2wav(file, options);
  });
};

var local, remote;

fxb2wab.shutdown = () => {
  if (local && !local.closed &&
      remote && remote.connected) {
    remote.quit();
  }
};
let count = 0;
const _fxb2wav = async (file, options) => {
  try {
    // Bitwig Studio local interafce
    if (!local) {
      local = await Local.launch(options.project, {
        executeFile: options.bitwig,
        useTempDir: true
      });
    }
    // Bitwig Studio remote interafce
    if (!remote) {
      remote = await Client.connect(options);
    }
    // cleanup bounce wav files
    local.cleanBounceFolder();
    // load clip for bouncing.
    await remote.loadClip(file.data.soundInfo);
    // load VST
    await remote.loadVST2Device(file.data.pluginId);
    // load a .fxb preset
    await remote.loadFxbPreset(file.path);

    if (count === 0) {
      // await remote.checkFocusState();
    }
    // bounce in a place, convert clip MIDI to audio
    await remote.bounceClip(count);
    count++;
    await remote.undoBounceClip();
    
    file.contents = await local.readBounceWavFile();
    file.extname = '.wav';
    
  } catch (err) {
    log.error('fxb2wav()', err);
    throw err;
  }
};
