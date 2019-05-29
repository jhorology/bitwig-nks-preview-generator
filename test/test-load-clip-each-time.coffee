log = (require '..').logger 'custom-mapper'

clips = [
  '../Bitwig Studio Files/NKS-Preview-C1-Single.bwclip'
  '../Bitwig Studio Files/NKS-Preview-C2-Single.bwclip'
  '../Bitwig Studio Files/NKS-Preview-C2-Single.bwclip'
  '../Bitwig Studio Files/NKS-Preview-Cmaj-Chord.bwclip'
]
count = 0;
module.exports = (soundInfo) ->
  count &= 0x03
  clips[count++]
