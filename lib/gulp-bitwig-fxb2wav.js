/*
 * Gulp plugin for converting .fxb to NKS preview .wav file.
 *
 * this plugin neede following data of Vinyl file.
 *   - file.data.pluginId  {Number} requierd  VST2 plugin id.
 *   - file.data.soundInfo {Object} optional  NKS Soundinfo
 */
const fs = require('fs');
const path = require('path');
const glob = require('glob');
const data = require('gulp-data');
const rimraf = require('rimraf');
const BitwigStudio = require('./bitwig-studio');
const BITWIG_STUDIO_FILES = path.resolve(path.join(__dirname, '..', 'Bitwig Studio Files'));
const BITWIG_STUDIO_PROJECT = path.join(BITWIG_STUDIO_FILES, 'NKS-Preview-Generator.bwproject');
const BITWIG_STUDIO_BOUNCE_FOLDER = path.join(BITWIG_STUDIO_FILES, 'bounce');


module.exports = (options) => {
  const opts = Object.assign(defaultOpts(), options);
  return data((file, cb) => {
    return fxb2wav(file, opts, cb);
  });
};

const defaultOpts = () => {
  return {
    waitMillisLoadingPlugin: 5000,
    waitMillisLoadingPreset: 3000,
    waitMillisBounceingClip: 2000,
    waitMillisUndoBouncing: 1500,
    clip: path.join(BITWIG_STUDIO_FILES, 'NKS-Preview-Chord.bwclip')
  };
};

let bitwig;

const fxb2wav = async (file, opts, cb) => {
  const clip = typeof opts.clip === 'function' ?
        opts.clip(file.data.soundInfo) :
        opts.clip;
  // launch bitwig studio.
  if (!bitwig) {
    bitwig = await BitwigStudio.launch([BITWIG_STUDIO_PROJECT], {
      useTransport: true,
      useApplication: true,
      useCursorTrack: true,
      useCursorDevice: true
    }, Client);
    // initial select clip at Track 1, Slot 2
    // beacuse need user interacetion.
    bitwig.selectClip(1);
    // cleanup bounce wav files
    rimraf.sync(BITWIG_STUDIO_BOUNCE_FOLDER);
  }
  // load clip for bouncing.
  if (clip !== bitwig._clip) {
    await bitwig.loadClip(clip);
    bitwig._clip = clip;
  }
  if (file.data.pluginId !== bitwig._pluginId) {
    bitwig.loadVST2Device(pluginId);
    // TODO how to know a timing of completed loading.
    // there is no way for unloading plugin.
    await wait(opts.waitMillisLoadingPlugin);
    bitwig._pluginId = file.data.pluginId;
  }
  // load a .fxb preset
  bitwig.loadFXB(file.path);
  bitwig.focusClip();
  await wait(opts.waitMillisLoadingPreset);
  
  bitwig.msg("Please don't touch anything.");

  // bounce in a place, convert clip MIDI to audio
  bitwig.action('bounce_in_place');
  await wait(opts.waitMillisBouncingClip);

  // undo 'bounce in a place', revert clip to MIDI. 
  bitwig.msg("Please don't touch anything.");
  file.contents = await readWavFile();
  // .fxb -> .wav
  file.path = file.path.substr(0, file.path.lastIndexOf(".")) + '.wav';
  
  bitwig.action('Undo');
  await wait(opts.waitMillisUndoBouncing);
  // cleanup bounce wav files
  rimraf.sync(BITWIG_STUDIO_BOUNCE_FOLDER);

};

/**
 * Wait specific milliseconds
 * @param {Number} millis
 * @return {Promise}
 */
const wait = millis => {
  return new Promise(resolve => setTimeout(resolve, millis));
};

/**
 * Read a .wav from bounce folder.
 * @return {Promise} - resolve value is Buffer.
 */
const readBounceWavFile = ()=>  {
  return new Promise((resolve, reject) => {
    glob(`${this.bounceFolder}/*.wav`, {}, (err, files) => {
      if (err) {
        reject(err);
      } else if (files && files.length === 1) {
        resolve(fs.readFileSync(files[0]));
      } else {
        reject(new Error('Could not find a bounce .wav file.'));
      }
    });
  });
};

/**
 * Helper class for automate Bitwig Studio.
 */
class Client extends BitwigStudio {
  constructor() {
    super();
    this.subscribe([
      'cursorDevice.isWindowOpen',
      'cursorTrack.clipLauncherSlotBank.getItemAt.isSelected',
      'cursorTrack.clipLauncherSlotBank.getItemAt.hasContent'
    ]);

    // auto hide plugin window
    bitwig.on('cursorDevice.isWindowOpen', isOpen => {
      if (isOpen) {
        bitwig.notify('cursorDevice.isWindowOpen.set', [false]);
      };
    });
    bitwig.on('cursorTrack.clipLauncherSlotBank.getItemAt.hasContent', (slot, hasContent) => {
      if (slot === 0) {
        this.clipLoaded = hasContent;
      };
    });
    this.hasFocus = false;
  }
  
  async loadClip(clip) {
    if (this.clipLoaded) {
      await unloadClip();
    }
    this.notify('cursorTrack.clipLauncherSlotBank.getItemAt.replaceInsertionPoint.insertFile', [0, clip]);
    await this.promise('cursorTrack.clipLauncherSlotBank.getItemAt.hasContent', [0, true], true);

    // "Bounce in place" action need focus state of window and clip.
    if (!this.hasFocus) {
      let remainingSec = 40;
      bitwig.msg(`Click orange clip to continue program. time remaining: ${remainingSec} sec`);
      const timerId = setInterval(() => {
        if (remainingSec <= 0) {
          clearInterval(timerId);
        } else {
          bitwig.msg(`Click orange clip to continue program. time remaining: ${remainingSec} sec`);
        }
        remainingSec--;
      }, 1000);
      await this.promise('cursorTrack.clipLauncherSlotBank.getItemAt.isSelected', [0, true], true, 40000);
      clearInterval(timerId);
      this.hasFocus = true;
    }
  };
  
  async unloadClip(clip) {
    this.notify('cursorTrack.clipLauncherSlotBank.deleteClip', [0, clip]);
    await this.promise('cursorTrack.clipLauncherSlotBank.hasContent', [0, false], true);
  };

  
  loadVST2Device(pluginId) {
    return this.notify('cursorTrack.startOfDeviceChainInsertionPoint.insertVST2Device',
                       [typeof pluginId === 'string' ? Buffer.from(pluginId).readUInt32BE(0) : pluginId]);
  }
  
  async focusClip() {
    await this.action('focus_track_header_area');
    await this.action('Focus widget below');
  };
  
  selectClip(slot) {
    return this.notify('cursorTrack.clipLauncherSlotBank.select', [slot]);
  }
  
  loadFXB(fxb) {
    this.msg(`Loading... ${path.basename(fxb)}`);
    this.notify('cursorDevice.replaceDeviceInsertionPoint.insertFile', [fxb]);
  }
}
