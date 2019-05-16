const path = require('path');
const log = require('fancy-log');

/**
 * Example NKS Preview MIDI clip mapper for UVI Key Suite Digital.
 * 
 * @param {Object} soundInfo - NKS Sound Info (metadata).
 * @return {String} - absolute path of Bitwig Studio MIDI clip.
 */
module.exports = function(soundInfo) {
  // check soundInfo
  log.info('Sound Info', soundInfo);
  let clip;
  if (soundInfo.types[0][0] === 'Bass') {
    clip = path.resolve(__dirname, 'Bitwig Studio Files/NKS-Preview-C1-Single.bwclip'); 
  } else {
    clip = path.resolve(__dirname, 'Bitwig Studio Files/NKS-Preview-Cmaj-Chord.bwclip');
  }
  log.info('MIDI Clip', clip);
  // shuld return a absolute path, Bitwig Studio can not knows about relative path.
  return clip;
};
