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
const log = require('fancy-log');
const BitwigStudio = require('./bitwig-studio');
const BITWIG_STUDIO_FILES = path.resolve(path.join(__dirname, '..', 'Bitwig Studio Files'));
const BITWIG_STUDIO_PROJECT = path.join(BITWIG_STUDIO_FILES, 'NKS-Preview-Generator.bwproject');
const BITWIG_STUDIO_BOUNCE_FOLDER = path.join(BITWIG_STUDIO_FILES, 'bounce');

module.exports = (options) => {
  const opts = Object.assign({
    clip: path.join(BITWIG_STUDIO_FILES, 'NKS-Preview-Cmaj-Chord.bwclip'),
    waitUndo: 1500,
    waitPlugin: 5000,
    waitPreset: 3000,
    waitBounce: 2000,
    tempo: 120
  }, options);
  return data(function(file) {
    return fxb2wav(file, opts);
  });
};

let bitwig;

const fxb2wav = async (file, opts) => {
  try {
    const clip = typeof opts.clip === 'function' ?
          opts.clip(file.data.soundInfo) :
          opts.clip;
    // launch bitwig studio.
    if (!bitwig) {
      bitwig = await BitwigStudio.launch([BITWIG_STUDIO_PROJECT], {
        useTransport: true,
        useApplication: true,
        useCursorTrack: true,
        cursorTrackNumScenes: 2,
        useCursorDevice: true
      }, Client, opts);
      
      await bitwig.init();
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
      bitwig.setTempo(opts.tempo);
    }
    if (file.data.pluginId !== bitwig._pluginId) {
      await bitwig.loadVST2Device(file.data.pluginId);
      // TODO how to know a timing of completed loading.
      // there is no way for unloading plugin.
      await wait(opts.waitPlugin);
      bitwig._pluginId = file.data.pluginId;
    }
    // load a .fxb preset
    bitwig.msg(`Loading... ${file.relative}`);
    await bitwig.loadFXB(file.path);
    // just to be sure for first clip has focus
    await bitwig.action('focus_track_header_area');
    await bitwig.action('Focus widget below');
    await wait(opts.waitPreset);
    
    bitwig.msg("Please don't touch anything.");

    // bounce in a place, convert clip MIDI to audio
    await bitwig.action('bounce_in_place');
    await wait(opts.waitBounce);

    // undo 'bounce in a place', revert clip to MIDI. 
    bitwig.msg("Please don't touch anything.");
    file.contents = await readBounceWavFile();
    // .fxb -> .wav
    file.extname = '.wav';
    
    bitwig.action('Undo');
    await wait(opts.waitUndo);
    // cleanup bounce wav files
    rimraf.sync(BITWIG_STUDIO_BOUNCE_FOLDER);
  } catch (err) {
    log.error('fxb2wav()', err);
    throw err;
  }
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
    glob(`${BITWIG_STUDIO_BOUNCE_FOLDER}/*.wav`, {}, (err, files) => {
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
  async init() {
    try {
      this.subscribe([
        'cursorDevice.isWindowOpen',
        'cursorTrack.clipLauncherSlotBank.getItemAt.isSelected',
        'cursorTrack.clipLauncherSlotBank.getItemAt.hasContent'
      ]);
      this.hasFocus = false;

      this.on('error', (err) => {
        log.error('WebSocket communication error', err);
      });
      this.on('open', () => {
        log.error('WebSocket', 'connected');
      });
      this.on('close', () => {
        log.error('WebSocket', 'cloed');
      });
      // auto hide plugin window
      this.on('cursorDevice.isWindowOpen', async isOpen => {
        if (isOpen) {
          await bitwig.notify('cursorDevice.isWindowOpen.set', [false]).catch(log);
        };
      });
      this.on('cursorTrack.clipLauncherSlotBank.getItemAt.hasContent', (slot, hasContent) => {
        if (slot === 0) {
          log('Track 1, Slot 1 has content:', hasContent);
          this.clipLoaded = hasContent;
        };
      });
      this.on('cursorTrack.clipLauncherSlotBank.getItemAt.isSelected', (slot, isSelected) => {
        if (slot === 0) {
          log('Track 1, Slot 1 is selected:', isSelected);
        };
      });
      // wait for dummy clip exits at Track 1 slot 2
      await this.promise('cursorTrack.clipLauncherSlotBank.getItemAt.hasContent',[1, true]);
    } catch (err) {
      log.error('init()', err);
      throw err;
    }
  }
  
  async loadClip(clip) {
    try {
      if (this.clipLoaded) {
        await this.unloadClip();
      }
      await this.notify('cursorTrack.clipLauncherSlotBank.getItemAt.replaceInsertionPoint.insertFile', [0, clip]);
      await this.promise('cursorTrack.clipLauncherSlotBank.getItemAt.hasContent', [0, true], false);

      // "Bounce in place" action need focus state of window and clip.
      if (!this.hasFocus) {
        await this.waitForClickFirstClip();
        this.hasFocus = true;
      }
    } catch (err) {
      log.error('loadClip()', err);
      throw err;
    }
  };
  
  async unloadClip() {
    try {
      await this.notify('cursorTrack.clipLauncherSlotBank.deleteClip', [0]);
      await this.promise('cursorTrack.clipLauncherSlotBank.getItemAt.hasContent', [0, false], false);
    } catch (err) {
      log.error('unloadClip()', err);
      throw err;
    }
  };

  async waitForClickFirstClip() {
    let remainingSeconds = 40;
    let timer;
    try {
      log(`waiting for click clip at Track 1, Slot 1, ${remainingSeconds} seconds remaining`);
      await this.msg(`Click first clip to continue program. ${remainingSeconds} seconds remaining.`);
      timer = setInterval(() => {
        log(`waiting for click clip at Track 1, Slot 1, ${remainingSeconds} seconds remaining`);
        this.msg(`Click first clip to continue program. ${remainingSeconds} seconds remaining.`).catch(log);
        remainingSeconds--;
      }, 1000);
      await this.promise('cursorTrack.clipLauncherSlotBank.getItemAt.isSelected', [0, true], true, 40000);
      await this.msg("Please don't touch anything.");
    } catch (err) {
      log.error('waitForClickFirstClip()', err);
      throw err;
    } finally {
      clearInterval(timer);
    }
  }
  
  loadVST2Device(pluginId) {
    log('loadVST2Device() pluginId', pluginId);
    return this.notify('cursorTrack.startOfDeviceChainInsertionPoint.insertVST2Device',
                       [typeof pluginId === 'string' ? Buffer.from(pluginId).readUInt32BE(0) : pluginId]);
  }
  
  selectClip(slot) {
    return this.notify('cursorTrack.clipLauncherSlotBank.select', [slot]);
  }
  
  loadFXB(fxb) {
    log('loadFXB() file:', fxb);
    return this.notify('cursorDevice.replaceDeviceInsertionPoint.insertFile', [fxb]);
  }
  
  setTempo(bpm) {
    log('setTempo() BPM:', bpm);
    return this.notify('transport.tempo.value.setImmediately', [(bpm - 20) / (666 - 20)]);
  }
}
