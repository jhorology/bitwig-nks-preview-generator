const path = require('path'),
      Local = require('./bitwig-studio-local'),
      Remote = require('./bitwig-studio-remote'),
      progress = require('progress-string'),
      log = require('./logger')('bitwig-studio-remote-client')

const wait = msec => {
  return new Promise(resolve => setTimeout(resolve, msec))
}

/**
 * options
 */
let opts

/**
 * Application specfic remote clientr class
 */
module.exports = class Client extends Remote {
  /**
   * default connect() options.
   * @static
   * @property
   * @type {Object}
   */
  static get defaultOptions() {
    return {
      url: 'ws://localhost:8887',
      timeout: 30000,
      waitPlugin: 7000,
      waitPreset: 5000,
      tempo: 120,
      showPlugin: false
    }
  }

  /**
   * connect() options descriptions
   * @static
   * @property
   * @type {Object}
   */
  static get optionsDescriptions() {
    return {
      url: 'Bitwig Studio WebSockets URL',
      timeout: 'timeout msec for launch & connect Bitwig Studio',
      waitPlugin: 'wait msec for loading plugin',
      waitPreset: 'wait msec for loading .fxb preset',
      tempo: 'BPM for bouncing clip.',
      showPlugin: 'show plugin window'
    }
  }

  /**
   * requierments RPC configuration
   * @static
   * @property
   * @type {Object}
   */
  static get rpcConfig() {
    return {
      useTransport: true,
      useApplication: true,
      useCursorTrack: true,
      cursorTrackNumScenes: 2,
      useCursorDevice: true,
      useMixer: true
    }
  }

  /**
   * interest RPC events
   * @static
   * @property
   * @type {Array<String>}
   */
  static get interestEvents() {
    return [
      'application.panelLayout',
      'cursorDevice.isWindowOpen',
      'cursorDevice.name',
      'cursorDevice.presetName',
      'cursorTrack.trackType',
      'cursorTrack.canHoldAudioData',
      'cursorTrack.clipLauncherSlotBank.getItemAt.isSelected',
      'cursorTrack.clipLauncherSlotBank.getItemAt.hasContent',
      'cursorTrack.clipLauncherSlotBank.getItemAt.name',
      'mixer.isClipLauncherSectionVisible'
    ]
  }

  /**
   * Connect a Bitwig Studio application.
   * @static
   * @async
   * @method
   * @param {Object} options
   * @param {class}  client - Inherit class of BitwigStudio
   * @return {Client} - instance of Client
   */
  static async connect(options = {}) {
    // static, only use as singleton
    opts = Object.assign({}, this.defaultOptions, options)

    const client = await Remote.connect(this.rpcConfig, {
      url: opts.url,
      timeout: opts.timeout,
      Client: this
    })
    await client._init()
    return client
  }

  /**
   * initialize
   * @async
   * @method
   * @return {Client} - this instance.
   */
  async _init() {
    this.bwHasFocus = false
    this.bwConnected = true
    this.on('error', (err) => {
      log.error('WebSocket communication error', err)
    })
    this.on('open', () => {
      log.info('Client websocket', 'connected')
    })
    this.on('close', () => {
      this.bwConnected = false
      log.info('Client webSocket', 'closed')
    })
    this.subscribe(Client.interestEvents)
    // monitor interest RPC events
    Client.interestEvents.forEach(event => {
      this.on(event, function() {
        log.debug(`on event:'${event}' params:[${Array.prototype.slice.call(arguments)}]`)
      })
    })
    // force change layout to 'MIX'
    this.on('application.panelLayout', async layout => {
      if (layout !== 'MIX') {
        // safety margin
        await wait(500)
        await this.notify('application.nextPanelLayout')
      }
    })
    this.on('mixer.isClipLauncherSectionVisible', async visible => {
      if (!visible) {
        // safety margin
        await wait(500)
        await this.notify('mixer.isClipLauncherSectionVisible.set', [true])
      }
    })
    if (!opts.showPlugin) {
      this.on('cursorDevice.isWindowOpen', async isOpen => {
        // safety margin
        await wait(500)
        if (isOpen) {
          await this.notify('cursorDevice.isWindowOpen.set', [false])
        }
      })
    }
    this.on('cursorTrack.clipLauncherSlotBank.getItemAt.hasContent', (slot, hasContent) => {
      if (slot === 0) this.bwClipLoaded = hasContent
    })
    this.on('cursorTrack.clipLauncherSlotBank.getItemAt.isSelected', (slot, isSelected) => {
      if (slot === 0) this.bwClipSelected = isSelected
    })
    this.on('cursorDevice.presetName', name => {
      this.presetName = name
    })
    this.on('cursorDevice.name', name => {
      this.pluginName = name
    })
    return this
  }

  /**
   * Return websocket is connected or not.
   * @property
   * @typpe {boolean}
   */
  get connected() {
    return this.bwConnected
  }

  /**
   * Load a MIDI clip to Track 1, Slot 1
   * @async
   * @method
   * @param {String} bwClipFile - .bwclip file absolute path
   */
  async loadClip(bwClipFile) {
    if (bwClipFile === this.bwClipFile) {
      return
    }

    await this.msg(`Loading Clip... ${path.basename(bwClipFile)}`)
    if (this.bwClipLoaded) {
      // unload already exist clip.
      await this.notify('cursorTrack.clipLauncherSlotBank.deleteClip', [0])
      await this.promise('cursorTrack.clipLauncherSlotBank.getItemAt.hasContent', [0, false], false)
      // safty margin
      await wait(300)
    }
    await this.notify(
      'cursorTrack.clipLauncherSlotBank.getItemAt.replaceInsertionPoint.insertFile',
      [0, Local.isWSL() ? Local.wsl2winPath(bwClipFile) : bwClipFile]
    )
    await this.promise('cursorTrack.clipLauncherSlotBank.getItemAt.hasContent', [0, true], false)
    // safty margin
    await wait(300)
    await this._setTempo(opts.tempo)
    // safty margin
    await wait(300)
    if (this.gotFocus) {
      await this.notify('cursorTrack.clipLauncherSlotBank.select', [0])
    } else {
      await this._waitForClickFirstClip()
      this.gotFocus = true
    }
    this.bwClipFile = bwClipFile
  };

  /**
   * Set a tempo.
   * @async
   * @method
   * @param {Number} bpm - BPM beat per minute.
   */
  async _setTempo(bpm) {
    log.debug('setTempo() BPM:', bpm)
    await this.notify('transport.tempo.value.setImmediately', [(bpm - 20) / (666 - 20)])
  }

  /**
   * wait for user click first clip.
   * @method
   * @param {Promise} timeout - timeout secconds;
   * @return {Promise} - resolve undefined
   */
  _waitForClickFirstClip(sec = 30) {
    var done = false
    const intervalMessage = async sec => {
      var remains = sec
      while (!done) {
        await this.msg(`Click first clip to continue program. ${remains} seconds remaining.`)
        await wait(1000)
        if (remains) remains--
      }
    }
    const waitClick = async sec => {
      try {
        await this.notify('cursorTrack.clipLauncherSlotBank.select', [1])
        await this.promise('cursorTrack.clipLauncherSlotBank.getItemAt.isSelected', [1, true])
        await this.promise('cursorTrack.clipLauncherSlotBank.getItemAt.isSelected', [0, true], false, sec * 1000)
        await this.notify('cursorTrack.clipLauncherSlotBank.showInEditor', [0])
      } finally {
        done = true
      }
    }
    return Promise.race([intervalMessage(sec), waitClick(sec)])
  }

  /**
   * load VST2 device.
   * @async
   * @method
   * @param {Number|String} pluginId
   */
  async loadVST2Device(pluginId) {
    if (typeof pluginId === 'string') {
      pluginId = Buffer.from(pluginId).readUInt32BE(0)
    }
    if (pluginId !== this.vst2PluginId) {
      await this.msg(`Loading Plugin... id:${pluginId.toString(16)}`)
      if (this.vst2PluginId) {
        // replace plugin
        await this.notify('cursorDevice.replaceDeviceInsertionPoint.insertVST2Device', [pluginId])
      } else {
        // initial load
        await this.notify('cursorTrack.startOfDeviceChainInsertionPoint.insertVST2Device', [pluginId])
      }
      // TODO how to know a timing of completed loading.
      // there is no way for unloading plugin.
      const params = await this.promise('cursorDevice.name')
      await this.msg(`Loading Plugin... id:${params[0]}`)
      await wait(opts.waitPlugin)
      this.vst2PluginId = pluginId
    }
  }

  /**
   * Load fxb preset.
   * @async
   * @method
   * @param {String} fxb - .fxb file absolute path.
   */
  async loadFxbPreset(fxb) {
    await this.msg(`Loading Preset... ${path.basename(fxb)}`)
    await this.notify(
      'cursorDevice.replaceDeviceInsertionPoint.insertFile',
      [Local.isWSL() ? Local.wsl2winPath(fxb) : fxb]
    )
    await wait(opts.waitPreset)
  }

  /**
   * Bounce a clip.
   * @async
   * @method
   * @return {String} - clip name
   */
  async bounceClip() {
    // await this.msg(`Bouncing Clip...`);
    await this.action('bounce_in_place')
    //  wait for clip name at slot 1
    // 'hogehoge' --> 'hogehoge-bounce-n'
    const params = await this.promise('cursorTrack.clipLauncherSlotBank.getItemAt.name', [0])
    log.debug('bounceClip() clip name:', params[1])
    return params[1]
  }

  /**
   * Undo bounceing a clip.
   * @async
   * @method
   */
  async undoBounceClip() {
    // safety margin
    // await wait(200);
    // await this.msg(`Undo bouncing Clip...`)
    await this.action('Undo')
    // 'Hybrid' -> 'Instrument'
    await this.promise('cursorTrack.trackType', 'Instrument')
    // safety margin
    // await wait(500);
  }

  /**
   * Show popup message.
   * @override
   * @method
   * @param {String} msg - message.
   * @return {Promise}
   */
  msg(msg) {
    if (this.connected && !this.shutdown && this._progress) {
      if (this._progress.tm) {
        clearTimeout(this._progress.tm)
      }
      this._progress.tm = setTimeout(async () => {
        if (this.connected && !this.shutdown) {
          try {
            const bar = progress({
              width: 50,
              total: this._progress.d
            })(this._progress.n)
            await this.msg(`progress [${bar}] (${this._progress.n}/${this._progress.d}) [${this.presetName}]`)
          } catch (err) {
            // ignore
          }
        }
      }, 2000)
    }
    return super.msg(msg)
  }

  /**
   * set progress status.
   * @method
   * @param {Number} numerator
   * @param {Number} denominator
   */
  progress(numerator, denominator) {
    if (denominator <= 0) {
      return
    }
    if (!this._progress) this._progress = {}
    this._progress.n = numerator
    this._progress.d = denominator
  }
}
