const riff = require('riff-reader'),
      msgpack = require('msgpack-lite'),
      plugin = require('./gulp-plugin-wrapper')

/**
 * default options
 * @type {Object}
 */
const defaultOptions = {
  skipError: false // skip on error, continue processing
}

/**
 * options descriptions
 * @type {Object}
 */
const optionsDescriptions = {
  skipError: 'skip on error, continue processing'
}

/**
 * Gulp plugin for converting NKSF to .fxb file.
 *
 * this plugin append the following data to Vinyl file.
 *   - file.data.pluginId  {Number}  VST2 plugin id.
 *   - file.data.soundInfo {Object}  NKS Soundinfo
 *
 * @function
 * @param {Object} options
 * @return {TransformStream} - through2.obj() object transform stream.
 */
const nksf2fxb = (options) => {
  return plugin('nksf2fxb', _nksf2fxb, options)
}

function _nksf2fxb(file, options) {
  var pluginStates, pluginId, soundInfo
  riff(file.contents, 'NIKS').readSync((id, chunk) => {
    switch (id) {
    case 'NISI':
      soundInfo = msgpack.decode(chunk.slice(4))
      break
    case 'PLID':
      pluginId = msgpack.decode(chunk.slice(4))['VST.magic']
      break
    case 'PCHK':
      pluginStates = chunk.slice(4)
      break
    }
  }, ['NISI', 'PLID', 'PCHK'])

  const fxb = Buffer.alloc(160, 0)
  let offset = 0
  // fxMagic
  fxb.write('CcnK', offset)
  offset += 4 // total 4 bytes

  // byteSize
  fxb.writeUInt32BE(152 + pluginStates.length, offset)
  offset += 4 // total 8 bytes

  // fxMagic
  fxb.write('FBCh', offset)
  offset += 4 // total 12(0x0a) bytes

  // version
  fxb.writeUInt32BE(2, offset)
  offset += 4 // total 16(0x10) bytes

  // fxID
  fxb.writeUInt32BE(pluginId, offset)
  offset += 4 // total 20(0x14) bytes

  // fxVersion
  fxb.writeUInt32BE(1, offset)
  offset += 4 // total 24(0x18) bytes

  // numPrograms
  fxb.writeUInt32BE(1, offset)
  offset += 4 // total 28(0x1C) bytes
  // future
  offset += 128
  // chunkSize

  fxb.writeUInt32BE(pluginStates.length, offset)
  file.contents = Buffer.concat([fxb, pluginStates])
  // .nksf -> .fxb
  file.extname = '.fxb'

  // append data to Vinyl file
  file.data = Object.assign({}, file.data, {
    pluginId: pluginId,
    soundInfo: soundInfo
  })
  // return message if want to discard file.
  return null
}

nksf2fxb.defaultOptions = defaultOptions
nksf2fxb.optionsDescriptions = optionsDescriptions
module.exports = nksf2fxb
