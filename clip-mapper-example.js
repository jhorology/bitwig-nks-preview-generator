const path = require('path');
const log = require('fancy-log');

/**
 * Example NKS Preview MIDI clip mapper for UVI Key Suite Digital.
 * 
 * @param {Object} soundInfo - NKS Sound Info (metadata).
 * @return {String} - Bitwig Studio MIDI clip file path.
 */
module.exports = function(soundInfo) {
  // check soundInfo
  log.info('custom mapper', 'Sound Info:', soundInfo);
  let clip;
  if (soundInfo.types[0][0] === 'Bass') {
    // return absolute path
    clip = path.resolve(__dirname, 'Bitwig Studio Files/NKS-Preview-C1-Single.bwclip'); 
  } else {
    // or relative path from this .js file's directory.
    clip = 'Bitwig Studio Files/NKS-Preview-Cmaj-Chord.bwclip';
  }
  log.info('custom mapper', 'MIDI clip:', clip);
  return clip;
};
