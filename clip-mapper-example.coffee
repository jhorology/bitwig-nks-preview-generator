log = require('.').logger('custom-mapper');
###
  Example NKS Preview MIDI clip mapper for UVI Key Suite Digital.
  
  @param {Object} soundInfo - NKS Sound Info (metadata).
  @return {String} - Bitwig Studio MIDI clip file path.
###
module.exports = (soundInfo) ->
  clip = switch
    when soundInfo.types[0][0] is 'Bass'
      #return absolute path or relative path from this .js file's directory.
      'Bitwig Studio Files/NKS-Preview-C1-Single.bwclip'
    when soundInfo.types[0][1].includes 'Piano'
      'Bitwig Studio Files/NKS-Preview-Cmaj-Chord.bwclip';
    else
      'Bitwig Studio Files/NKS-Preview-C2-Single.bwclip';

  log.info 'NKS Info:', soundInfo, 'Clip:', clip
  clip;
