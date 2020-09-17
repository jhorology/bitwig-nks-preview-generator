const path = require('path'),
  { BitwigClient } = require('bitwig-websocket-rpc'),
  Local = require('./bitwig-studio-local'),
  plugin = require('./gulp-plugin-wrapper'),
  { isWSL, winenv, winpath, wslpath, winipaddress } = require('./wsl-util'),
  log = require('../lib/logger')('gulp-bitwig-fxb2wav'),
  clientLog = require('../lib/logger')('websocket-rpc'),
  BITWIG_STUDIO_FILES = path.resolve(__dirname, '..', 'Bitwig Studio Files'),
  NKS_PREVIEW_PROJECT = path.join(
    BITWIG_STUDIO_FILES,
    'NKS-Preview-Generator.bwproject'
  )

const INTEREST_EVENTS = [
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

const RPC_CONFIG = {
  useTransport: true,
  useApplication: true,
  useCursorTrack: true,
  cursorTrackNumScenes: 2,
  useCursorDevice: true,
  useMixer: true
}

const state = {
  clipLoaded: false,
  presetName: undefined,
  pluginName: undefined,
  clipFile: undefined,
  gotFocus: false,
  pluginId: undefined
}

/**
 * default options
 * @type {Object}
 */
const defaultOptions = {
  bitwig: Local.defaultOptions.bitwig,
  url: `ws://${isWSL() === 2 ? winipaddress() : 'localhost'}:8887`,
  pass: undefined,
  timeout: 30000,
  waitPlugin: 7000,
  waitPreset: 5000,
  tempo: 120,
  showPlugin: false
}

/**
 * options descriptions
 * @type {Object}
 */
const optionsDescriptions = {
  bitwig: Local.optionsDescriptions.bitwig,
  url: 'Bitwig Studio WebSockets URL.',
  pass: 'The password to connect Bitwig Studio.',
  timeout: 'timeout msec for launch & connect Bitwig Studio',
  waitPlugin: 'wait msec for loading plugin',
  waitPreset: 'wait msec for loading .fxb preset',
  tempo: 'BPM for bouncing clip.',
  showPlugin: 'show plugin window'
}

// remote & local interface for Bitwig Studio .
let first = true,
  local,
  remote,
  shutdown

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
  return plugin('bitwig-fxb2wav', _fxb2wav, opts).on('end', () => {
    // TODO need to investigate duplicated 'end' event
    if (!shutdown) {
      shutdown = true
      shutdownBitwigStudio()
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
    remote = await connect(opts)
    registerEventHandlers(opts)
    const result = await remote.subscribe(INTEREST_EVENTS)
    log.debug('subscribe events. result:', result)
    setBpm(opts.tempo)
    await wait(1000)
  }

  if (state.clipFile !== file.data.bwclip) {
    await loadClip(file.data.bwclip)
    state.clipFile = file.data.bwclip
  }

  const pluginId = uintPluginId(file.data.pluginId)
  if (state.pluginId !== pluginId) {
    await loadVST2Device(pluginId)
    state.pluginId = pluginId
    await wait(opts.waitPlugin)
  }

  // load a .fxb preset
  await loadFxbPreset(file.path)
  await wait(opts.waitPreset)

  // bounce in a place, convert clip MIDI to audio
  const clipName = await bounceClip()

  file.contents = await local.readBounceWavFile(clipName)
  file.extname = '.wav'

  await undoBounceClip()
  return null
}

const wait = msec => new Promise(resolve => setTimeout(resolve, msec))

/**
 * Connect to Bitwig Studio
 * @async
 * @param {object} opts
 * @return {Promise}
 */
async function connect(opts) {
  let timer
  log.info('connecting Bitwig Studio.')
  const bws = new BitwigClient(opts.url, {
      debugLog: objs => clientLog.debug.apply(clientLog, objs),
      traceLog: objs => clientLog.debug.apply(clientLog, objs)
    }),
    timeout = msec =>
      new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          bws.close()
          reject(new Error(`Colud not connect to Bitwig Studio within ${opts.timeout} msec.`))
        }, msec)
      })
  try {
    await Promise.race([timeout(opts.timeout), bws.connect({
      retry: -1,
      password: opts.pass
    })])
    clearTimeout(timer)
    log.info('Bitwig Studio is connected.')
    await bws.config(RPC_CONFIG)
  } catch (err) {
    log.error(`Colud not connect to Bitwig Studio within ${opts.timeout}`)
    bws.close()
    throw err
  }
  return bws
}

/**
 * register event handlers
 * @async
 * @param {object} opts
 */
function registerEventHandlers(opts) {
  // monitor interest RPC events
  INTEREST_EVENTS.forEach(event => {
    remote.on(event, function () {
      log.debug(
        `on event:'${event}' params:[${Array.prototype.slice.call(arguments)}]`
      )
    })
  })

  // force change layout to 'MIX'
  remote.on('application.panelLayout', async params => {
    if (params[0] !== 'MIX' && !shutdown) {
      // safety margin
      await wait(500)
      remote.notify('application.nextPanelLayout')
    }
  })
  remote.on('mixer.isClipLauncherSectionVisible', async params => {
    if (!params[0] && !shutdown) {
      await wait(500)
      remote.notify('mixer.isClipLauncherSectionVisible.set', [true])
    }
  })
  if (!opts.showPlugin) {
    remote.on('cursorDevice.isWindowOpen', async params => {
      if (params[0] && !shutdown) {
        await wait(500)
        remote.notify('cursorDevice.isWindowOpen.set', [false])
      }
    })
  }
  remote.on('cursorTrack.clipLauncherSlotBank.getItemAt.hasContent', params => {
    if (params[0] === 0) state.clipLoaded = params[1]
  })
  remote.on('cursorDevice.presetName', params => {
    state.presetName = params[0]
  })
  remote.on('cursorDevice.name', params => {
    state.pluginName = params[0]
  })
}

/**
 * Load a MIDI clip to Track 1, Slot 1
 * @async
 * @param {String} clipFile - absolute path of .bwclip file.
 * @return {Promise}
 */
async function loadClip(clipFile) {
  log.debug(`loadClip()`, clipFile)
  remote.msg(`Loading Clip... ${path.basename(clipFile)}`)
  if (state.clipLoaded) {
    // unload already exist clip.
    remote.notify('cursorTrack.clipLauncherSlotBank.getItemAt.deleteObject', [
      0
    ])
    await remote
      .event('cursorTrack.clipLauncherSlotBank.getItemAt.hasContent')
      .atSlot(0)
      .become([false])
      .within(3)
      .sec()
      .asPromised()
    // safty margin
    await wait(300)
  }
  remote.notify(
    'cursorTrack.clipLauncherSlotBank.getItemAt.replaceInsertionPoint.insertFile',
    [0, isWSL() ? winpath(clipFile) : clipFile]
  )
  await remote
    .event('cursorTrack.clipLauncherSlotBank.getItemAt.hasContent')
    .atSlot(0)
    .become([true])
    .within(3)
    .sec()
    .asPromised()

  if (state.gotFocus) {
    remote.notify('cursorTrack.clipLauncherSlotBank.select', [0])
  } else {
    remote.notify('cursorTrack.clipLauncherSlotBank.select', [1])
    // await this.promise('cursorTrack.clipLauncherSlotBank.getItemAt.isSelected', [1, true])
    await waitForClickFirstClip()
    state.gotFocus = true
  }
}

/**
 * load VST2 device.
 * @async
 * @method
 * @param {Number|String} pluginId
 */
async function loadVST2Device(pluginId) {
  remote.msg(`Loading Plugin... id:${pluginId.toString(16)}`)
  if (state.pluginId) {
    // replace plugin
    remote.notify('cursorDevice.replaceDeviceInsertionPoint.insertVST2Device', [
      pluginId
    ])
  } else {
    // initial load
    remote.notify(
      'cursorTrack.startOfDeviceChainInsertionPoint.insertVST2Device',
      [pluginId]
    )
  }
  const result = await remote
    .event('cursorDevice.name')
    .occur()
    .within(3)
    .sec()
    .asPromised()
  remote.msg(`Loading Plugin... id:${result.params[0]}`)
}

/**
 * Load fxb preset.
 * @async
 * @param {String} fxb - .fxb file absolute path.
 */
async function loadFxbPreset(fxb) {
  remote.msg(`Loading Preset... ${path.basename(fxb)}`)
  remote.notify('cursorDevice.replaceDeviceInsertionPoint.insertFile', [
    isWSL() ? winpath(fxb) : fxb
  ])
}

/**
 * Bounce a clip.
 * @async
 * @return {String} - clip name
 */
async function bounceClip() {
  // await this.msg(`Bouncing Clip...`);
  remote.action('bounce_in_place')
  //  wait for clip name at slot 1
  // 'hogehoge' --> 'hogehoge-bounce-n'
  const result = await remote
    .event('cursorTrack.clipLauncherSlotBank.getItemAt.name')
    .atSlot(0)
    .occur()
    .within(3)
    .sec()
    .asPromised()
  log.debug('bounceClip() clip name:', result.params[1])
  return result.params[1]
}

/**
 * Undo bounceing a clip.
 * @async
 * @method
 */
async function undoBounceClip() {
  // safety margin
  // await wait(200);
  // await this.msg(`Undo bouncing Clip...`)
  remote.action('Undo')
  // 'Hybrid' -> 'Instrument'
  await remote
    .event('cursorTrack.trackType')
    .become(['Instrument'])
    .within(3)
    .sec()
    .asPromised()
  // safety margin
  // await wait(500);
}

/**
 * plugin id as UInt32
 * @param {string|number} id
 * @return {number} pluginId as UInt32
 */
function uintPluginId(id) {
  if (typeof id === 'string') {
    return Buffer.from(id).readUInt32BE(0)
  }
  return id
}

/**
 * Shutdown Bitwig Studio.
 * @async
 * @param {number} [sec=5]
 */
async function shutdownBitwigStudio(sec = 5) {
  try {
    if (local && !local.closed && remote && remote.isOpen) {
      if (sec > 0) {
        let remains = sec
        while (remains) {
          remote.msg(
            `Automatically shutdown Bitwig Studio after ${remains} seconds.`
          )
          await wait(1000)
          remains--
        }
      }
      remote.action('Quit')
      await wait(1000)
      remote.action('Dialog: No')
      await wait(200)
    }
  } catch (err) {
    // ignore err
    log.debug('error on shutdown.', err)
  } finally {
    if (remote) {
      remote.close()
    }
  }
}

/**
 * Set a tempo.
 * @async
 * @method
 * @param {Number} bpm - BPM beat per minute.
 */
function setBpm(bpm) {
  log.debug('setBpm() BPM:', bpm)
  remote.notify('transport.tempo.value.setImmediately', [
    (bpm - 20) / (666 - 20)
  ])
}

/**
 * wait for user click first clip.
 * @method
 * @param {Promise} timeout - timeout secconds;
 * @return {Promise} - resolve undefined
 */
async function waitForClickFirstClip(sec = 30) {
  let done = false
  const intervalMessage = async sec => {
    var remains = sec
    while (!done) {
      remote.msg(
        `Click first clip to continue program. ${remains} seconds remaining.`
      )
      await wait(1000)
      if (remains) remains--
    }
  }
  const waitClick = async sec => {
    try {
      await remote
        .event('cursorTrack.clipLauncherSlotBank.getItemAt.isSelected')
        .atSlot(0)
        .become([true])
        .within(sec)
        .sec()
        .asPromised()
      remote.notify('cursorTrack.clipLauncherSlotBank.showInEditor', [0])
    } finally {
      done = true
    }
  }
  return Promise.race([intervalMessage(sec), waitClick(sec)])
}

fxb2wav.defaultOptions = defaultOptions
fxb2wav.optionsDescriptions = optionsDescriptions
module.exports = fxb2wav
