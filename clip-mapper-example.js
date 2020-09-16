const log = require('.').logger('custom-mapper')
/**
 * Example NKS Preview MIDI clip mapper for UVI Key Suite Digital.
 *
 * @param {Object} soundInfo - NKS Sound Info (metadata).
 * @return {String} - Bitwig Studio MIDI clip file path.
 */
module.exports = function (soundInfo) {
  var clip
  if (soundInfo.types[0][0] === 'Bass') {
    // return absolute path or relative path from this .js file's directory.
    clip = 'Bitwig Studio Files/NKS-Preview-C1-Single.bwclip'
  } else if (soundInfo.types[0][1].includes('Piano')) {
    clip = 'Bitwig Studio Files/NKS-Preview-Cmaj-Chord.bwclip'
  } else {
    clip = 'Bitwig Studio Files/NKS-Preview-C2-Single.bwclip'
  }
  log.info('NKS Info:', soundInfo, 'Clip:', clip)
  return clip
}
