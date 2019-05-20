const path = require('path');
const log = require('fancy-log');
const Local = require('./bitwig-studio-local');
const Remote = require('./bitwig-studio-remote');

/**
 * Wait specified milliseconds
 * @function
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
   * default connect() options.
   * @static
   * @type {Object}
   */
  static get defaultOptions() {
    return {
      url: 'ws://localhost:8887',
      timeout: 30000,
      waitPlugin: 5000,
      waitPreset: 3000,
      waitBounce: 500,
      waitUndo: 500,
      tempo: 120,
      showPlugin: false
    };
  }

  /**
   * connect() options descriptions
   * @static
   * @type {Object}
   */
  static get optionsDescriptions() {
    return {
      url: 'Bitwig Studio WebSockets URL',
      timeout: 'timeout msec for launch & connect Bitwig Studio',
      waitPlugin: 'wait msec for loading plugin',
      waitPreset: 'wait msec for loading .fxb preset',
      waitBounce: 'wait msec for bouncing clip.',
      waitUndo: 'wait msec for undo bouncing clip',
      tempo: 'BPM for bouncing clip.',
      showPlugin: 'show plugin window'
    };
  }

  /**
   * requierments RPC configuration
   * @static
   * @type {Object}
   */
  static get rpcConfig() {
    return {
      useTransport: true,
      useApplication: true,
      useCursorTrack: true,
      cursorTrackNumScenes: 2,
      useCursorDevice: true
    };
  }
  
  /**
   * Connect a Bitwig Studio application.
   * @static
   * @method
   * @param {Object} options
   * @param {class}  client - Inherit class of BitwigStudio
   * @return {Promisee} resolve {Client}
   */
  static async connect(options = {}) {
    // static, only use as singleton
    opts = Object.assign({}, this.defaultOptions, options);

    const client = await Remote.connect(this.rpcConfig, {
      url: opts.url,
      timeout: opts.timeout,
      client: this
    });
    await client._init();
    return client;
  }

  /**
   * initialize
   * @return {Promise}
   */
  async _init() {
    this.bwHasFocus = false;
    this.subscribe([
      'cursorDevice.isWindowOpen',
      'cursorDevice.name',
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
      log('Client webSocket', 'closed');
    });
    // auto hide plugin window
    if (!opts.showPlugin) {
      this.on('cursorDevice.isWindowOpen', isOpen => {
        if (isOpen) {
          this.notify('cursorDevice.isWindowOpen.set', [false]);
        };
      });
    }
    this.on('cursorTrack.clipLauncherSlotBank.getItemAt.hasContent', (slot, hasContent) => {
      if (slot === 0) {
        log('Track 1, Slot 1 has content:', hasContent);
        this.bwClipLoaded = hasContent;
      };
    });
    this.on('cursorTrack.clipLauncherSlotBank.getItemAt.isSelected', (slot, isSelected) => {
      if (slot === 0) {
        log('Track 1, Slot 1 is selected:', isSelected);
        this.bwClipSelected = isSelected;
      };
    });
    this.on('cursorDevice.presetName', (name) => {
      log('cursorDevice.presetName:', name);
    });
    this.on('cursorDevice.name', (name) => {
      this.pluginName = name;
      log('cursorDevice.name:', name);
    });
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
   * @param {String} bwClipFile - .bwclip file absolute path
   * @return {Promise}
   */
  async loadClip(bwClipFile) {
    if (bwClipFile === this.bwClipFile) {
      return;
    }

    await this.msg(`Loading Clip... ${path.basename(bwClipFile)}`);
    if (this.bwClipLoaded) {
      // unload already exist clip.
      await this.notify('cursorTrack.clipLauncherSlotBank.deleteClip', [0]);
      await this.promise('cursorTrack.clipLauncherSlotBank.getItemAt.hasContent', [0, false], false);
    }
    await this.notify(
      'cursorTrack.clipLauncherSlotBank.getItemAt.replaceInsertionPoint.insertFile',
      [0, Local.isWSL() ? Local.wsl2winPath(bwClipFile) : bwClipFile]
    );
    await this.promise('cursorTrack.clipLauncherSlotBank.getItemAt.hasContent', [0, true], false);
    await this._setTempo(opts.tempo);

    if(this.gotFocus) {
      await this.notify('cursorTrack.clipLauncherSlotBank.select', [0]);
    } else {
      await this._waitForClickFirstClip();
      this.gotFocus = true;
    }
    this.bwClipFile = bwClipFile;
  };

  /**
   * Set a tempo.
   * @param {Number} bpm - BPM beat per minute.
   * @return {Promise}
   */
  async _setTempo(bpm) {
    log('setTempo() BPM:', bpm);
    await this.notify('transport.tempo.value.setImmediately', [(bpm - 20) / (666 - 20)]);
  }

  /**
   * wait for user click first clip.
   * @param {Promise} timeout - timeout secconds;
   * @return {Promise}
   */
  _waitForClickFirstClip(sec = 30) {
    var done = false;
    const intervalMessage = async sec => {
      var remains = sec;
      while (!done) {
        await this.msg(`Click first clip to continue program. ${remains} seconds remaining.`);
        await wait(1000);
        if (remains) remains--;
      }
    };
    const waitClick = async sec => {
      try {
        await this.notify('cursorTrack.clipLauncherSlotBank.select', [1]);
        await this.promise('cursorTrack.clipLauncherSlotBank.getItemAt.isSelected', [1, true]);
        await this.promise('cursorTrack.clipLauncherSlotBank.getItemAt.isSelected', [0, true], false, sec * 1000);
      } finally {
        done = true;
      }
    };
    return Promise.race([intervalMessage(sec), waitClick(sec)]);
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
      if (this.vst2PluginId) {
        // replace plugin
        await this.notify('cursorDevice.replaceDeviceInsertionPoint.insertVST2Device',[pluginId]);
      } else {
        // initial load
        await this.notify('cursorTrack.startOfDeviceChainInsertionPoint.insertVST2Device',[pluginId]);
      }
      // TODO how to know a timing of completed loading.
      // there is no way for unloading plugin.
      const params = await this.promise('cursorDevice.name');
      await this.msg(`Loading Plugin... id:${params[0]}`);
      await wait(opts.waitPlugin);
      this.vst2PluginId = pluginId;
    }
  }

  /**
   * Load fxb preset.
   * @param {String} fxb - .fxb file absolute path.
   * @return {Promise}
   */
  async loadFxbPreset(fxb) {
    await this.msg(`Loading Preset... ${path.basename(fxb)}`);
    await this.notify(
      'cursorDevice.replaceDeviceInsertionPoint.insertFile',
      [Local.isWSL() ? Local.wsl2winPath(fxb) : fxb]
    );
    await wait(opts.waitPreset);
  }

  /**
   * Bounce a clip.
   * @return {Promise}
   */
  async bounceClip() {
    await this.msg(`Bouncing Clip...`);
    await this.action('bounce_in_place');
    // 'Instrument' -> 'Hybrid'
    await this.promise('cursorTrack.trackType', 'Hybrid');
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
    await this.promise('cursorTrack.trackType', 'Instrument');
    // TODO
    await wait(opts.waitUndo);
  }

};
