const path = require('path');
const log = require('fancy-log');
const Remote = require('./bitwig-studio-remote');

/**
 * Wait specified milliseconds
 * @param {Number} millis
 * @return {Promise}
 */
const wait = millis => {
  return new Promise(resolve => setTimeout(resolve, millis));
};

/**
 * options
 */
let opts;

/**
 * Application specfic remote clientr class
 */
module.exports = class Client extends Remote {
  /**
   * Connect a Bitwig Studio application.
   * @static
   * @method
   * @param {Object} options
   * @param {class}  client - Inherit class of BitwigStudio
   * @return {Promisee} resolve {Client}
   */
  static async connect(options = {}) {
    // static
    opts = Object.assign({
      url: 'ws://localhost:8887',
      timeout: 30000,
      waitPlugin: 5000,
      waitPreset: 3000,
      waitBounce: 500,
      waitUndo: 500,
      tempo: 120
    }, options);
    
    const client = await Remote.connect({
      useTransport: true,
      useApplication: true,
      useCursorTrack: true,
      cursorTrackNumScenes: 2,
      useCursorDevice: true
    }, Client, {
      url: opts.url,
      timeout: opts.timeout
    });

    await client.init();
    return client;
  }
  
  /**
   * initialize
   * @return {Promise}
   */
  async init() {
    try {
      this.bwHasFocus = false;
      this.subscribe([
        'cursorDevice.isWindowOpen',
        'cursorDevice.presetName',
        'cursorTrack.trackType',
        'cursorTrack.canHoldAudioData',
        'cursorTrack.clipLauncherSlotBank.getItemAt.isSelected',
        'cursorTrack.clipLauncherSlotBank.getItemAt.hasContent'
      ]);

      this.on('error', (err) => {
        log.error('WebSocket communication error', err);
      });
      this.bwConnected = true;
      this.on('open', () => {
        log('Client websocket', 'connected');
      });
      this.on('close', () => {
        this.bwConnected = false;
        log('Client webSocket', 'cloed');
      });
      // auto hide plugin window
      this.on('cursorDevice.isWindowOpen', isOpen => {
        if (isOpen) {
          this.notify('cursorDevice.isWindowOpen.set', [false]);
        };
      });
      this.on('cursorTrack.clipLauncherSlotBank.getItemAt.hasContent', (slot, hasContent) => {
        if (slot === 0) {
          log('Track 1, Slot 1 has content:', hasContent);
          this.bwClipLoaded = hasContent;
        };
      });
      this.on('cursorTrack.clipLauncherSlotBank.getItemAt.isSelected', (slot, isSelected) => {
        if (slot === 0) {
          log('Track 1, Slot 1 is selected:', isSelected);
        };
      });
      this.on('cursorDevice.presetName', (name) => {
          log('cursorDevice.presetName:', name);
      });
      // wait for dummy clip exits at Track 1 slot 2
      await this.promise('cursorTrack.clipLauncherSlotBank.getItemAt.hasContent',[1, true]);
      // select dummy clip.
      await this.notify('cursorTrack.clipLauncherSlotBank.select', [1]);

    } catch (err) {
      log.error('Client.init()', err);
      throw err;
    }
  }
  
  /**
   * Return websocket is connected or not.
   * @return {boolean}
   */
  get connected() {
    return this.bwConnected;
  }
  
  /**
   * Load a MIDI clip to Track 1, Slot 1
   * @param {String} nisi - Native Instruments Sound Info
   * @return {Promise}
   */
  async loadClip(nisi) {
    const bwClipFile = typeof opts.clip === 'function' ?
          opts.clip(nisi) :
          opts.clip;
    
    if (bwClipFile === this.bwClipFile) {
      return;
    }
    
    try {
      await this.msg(`Loading Clip... ${path.basename(bwClipFile)}`);
      if (this.bwClipLoaded) {
        // unload already exist clip.
        await this.notify('cursorTrack.clipLauncherSlotBank.deleteClip', [0]);
        await this.promise('cursorTrack.clipLauncherSlotBank.getItemAt.hasContent', [0, false], false);
      }
      await this.notify('cursorTrack.clipLauncherSlotBank.getItemAt.replaceInsertionPoint.insertFile', [0, bwClipFile]);
      await this.promise('cursorTrack.clipLauncherSlotBank.getItemAt.hasContent', [0, true], false);
      // TODO
      // At first time, need user interaction.
      // "Bounce in place" action need focus state of window and clip.
      if (!this.bwHasFocus) {
        await this.waitForClickFirstClip();
        this.bwHasFocus = true;
      }
      this.bwClipFile = bwClipFile;
      await this.setTempo(opts.tempo);
    } catch (err) {
      log.error('loadClip()', err);
      throw err;
    }
  };

  /**
   * wait for user click first clip.
   * @return {Promise}
   */
  async waitForClickFirstClip() {
    let seconds = 40;
    let timer;
    try {
      await this.msg(`Click first clip to continue program. ${seconds} seconds remaining.`);
      timer = setInterval(async () => {
        await this.msg(`Click first clip to continue program. ${seconds} seconds remaining.`);
        seconds--;
      }, 1000);
      await this.promise('cursorTrack.clipLauncherSlotBank.getItemAt.isSelected', [0, true], false, 40000);
    } catch (err) {
      log.error('waitForClickFirstClip()', err);
      throw err;
    } finally {
      clearInterval(timer);
    }
  }
  
  /**
   * load VST2 device.
   * @param {Number|String} pluginId
   * @return {Promise}
   */
  async loadVST2Device(pluginId) {
    if (typeof pluginId === 'string') {
      pluginId = Buffer.from(pluginId).readUInt32BE(0);
    }
    if (pluginId !== this.vst2PluginId) {
      await this.msg(`Loading Plugin... id:${pluginId.toString(16)}`);
      await this.notify('cursorTrack.startOfDeviceChainInsertionPoint.insertVST2Device',[pluginId]);
      this.vst2PluginId = pluginId;
      // TODO how to know a timing of completed loading.
      // there is no way for unloading plugin.
      await this.promise('cursorDevice.presetName');
      await wait(opts.waitPlugin);
    }
  }
  
  /**
   * Load fxb preset.
   * @param {String} fxb - .fxb file path.
   * @return {Promise}
   */
  async loadFxbPreset(fxb) {
    await this.msg(`Loading Preset... ${path.basename(fxb)}`);
    await this.notify('cursorDevice.replaceDeviceInsertionPoint.insertFile', [fxb]);
    // just to be sure for first clip has focus
    await this.action('focus_track_header_area');
    await this.action('Focus widget below');
    await wait(opts.waitPreset);
  }
  
  /**
   * Set a tempo.
   * @param {Number} bpm - BPM beat per minute.
   * @return {Promise}
   */
  async setTempo(bpm) {
    log('setTempo() BPM:', bpm);
    await this.notify('transport.tempo.value.setImmediately', [(bpm - 20) / (666 - 20)]);
  }

  /**
   * Bounce a clip.
   * @return {Promise} 
   */
  async bounceClip() {
    await this.msg(`Bouncing Clip...`);
    await this.action('bounce_in_place');

    // 'Instrument' -> 'Hybrid'
    await this.promise('cursorTrack.trackType', 'Hybrid', false, 6000);
    // TODO
    await wait(opts.waitBounce);
  }

  /**
   * Undo bounceing a clip.
   * @return {Promise}
   */
  async undoBounceClip() {
    await this.msg(`Undo bouncing Clip...`);
    await this.action('Undo');
    // 'Hybrid' -> 'Instrument'
    await this.promise('cursorTrack.trackType', 'Instrument', false, 6000);
    // TODO
    await wait(opts.waitUndo);
  }
}
