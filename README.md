# bitwig-nks-preview-generator
Streaming convert NKSF files to preview audio with using Bitwig Studio.

Publishing NPM package soon.

## Requirements

- Bitwig Studio version 2.5.1 or above.
- ffmpeg version 4.1.3 or above.
- node.js v8 or above.


## Installation
```sh
# or global install
npm install bitwig-nks-preview-generator -g
# install Bitwig Studio Extension
bws-nksf2ogg install
```
## Command Options
    $ bws-nksf2ogg --help
    Usage: bws-nksf2ogg [options] [command]

    Streaming convert NKSF files to preview audio with using Bitwig Studio.

    Options:
      -V, --version          output the version number
      -h, --help             output usage information

    Commands:
      exec [options] <dir>   Generate preview audio from .nksf preset files.
      install [options]      Install Bitwig Studio WebSockets RPC server extension.
      list [options] <dir>   List .nksf or .nksf.ogg files.
      clean [options] <dir>  Delete .previews folders.
    
    $ bws-nksf2ogg exec --help
    Usage: exec [options] <dir>
    
    Generate preview audio from .nksf preset files.

    Options:
      -b, --bitwig <path>       Bitwig Studio execution file path (default: "<platform specific>")
      -u, --url <URL>           Bitwig Studio WebSockets URL (default: "ws://localhost:8887")
      -s, --skip-error          skip on error, continue processing
      -k, --skip-exist          skip .nksf file that already has preview audio
      -h, --show-plugin         show plugin window
      -c, --clip <path>         .bwclip MIDP clip or .js mapper program
                                (default: "<package>/Bitwig Studio Files/NKS-Preview-Cmaj-Chord.bwclip")
      -f, --fxb <path>          directory for store intermediate .fxb files (default: "temp/fxb")
      -w, --wav <path>          directory for store intermediate .wav files (default: "temp/wav")
      -t, --timeout <msec>      timeout msec for launch & connect Bitwig Studio (default: 30000)
      -w, --wait-plugin <msec>  wait msec for loading plugin (default: 5000)
      -a, --wait-preset <msec>  wait msec for loading .fxb preset (default: 3000)
      -i, --wait-bounce <msec>  wait msec for bouncing clip. (default: 500)
      -u, --wait-undo <msec>    wait msec for undo bouncing clip (default: 500)
      -e, --tempo <BPM>         BPM for bouncing clip. (default: 120)
      -f, --freq <Hz>           sampling rate for output .ogg audio (default: 44100)
      -d, --fadeout <samples>   number of samples for fadeout (default: 110250)
      -l, --silence <dB>        threshold level for removing silnce from end (default: "-90dB")
      -q, --quality <number>    quality of .ogg audio. 0-10 (default: 5)
      -h, --help                output usage information

    $ bws-nksf2ogg list --help
    Usage: list [options] <dir>
    
    List .nksf or .nksf.ogg files.

    Options:
      -a, --absolute  list files as absolute path
      -r, --relative  list files as relative path from <dir>
      -m, --missing   list preset files that doesn't have preview
      -u, --useless   list preview files that doesn't have preset
      -h, --help      output usage information
    
    $ bws-nksf2ogg clean --help
    Usage: clean [options] <dir>
    
    Delete .previews folders.
    
    Options:
      -y, --yes   no comfirmation
      -h, --help  output usage information

## MIDI clip mapper
Mapper .js program allows for mapping NKS sound infomation to your custom MIDI clip.
```sh
bws-nksf2ogg exec --clip clip-mapper-example.js <targetDiretory>
```
An example:
```js
/**
 * Example NKS Preview MIDI clip mapper for UVI Key Suite Digital.
 * 
 * @param {Object} soundInfo - NKS Sound Info (metadata).
 * @return {String} - Bitwig Studio MIDI clip file path.
 */
module.exports = function(soundInfo) {
  let clip;
  if (soundInfo.types[0][0] === 'Bass') {
    // return absolute path or relative path from this .js file's directory.
    clip = 'Bitwig Studio Files/NKS-Preview-C1-Single.bwclip'; 
  } else if (soundInfo.types[0][0].includes('Piano')) {
    clip = 'Bitwig Studio Files/NKS-Preview-Cmaj-Chord.bwclip';
  } else {
    clip = 'Bitwig Studio Files/NKS-Preview-C2-Single.bwclip';
  }
  console.log('[custom mapper]', 'NKS Info:', soundInfo, 'CLip:', clip);
  return clip;
};

```

## Generating Preview Audio
1. Close Bitwig studio application if already it's opened.
1. Execute `bws-nks2ogg exec [options] <dir>` command on terminal.
1. Bitwig Studio will automatically launch after command.
1. If you see popup message "Please click first clip", Click (not launch) the clip at Track 1, Slot 1.
1. Don't touch anything on Bitwig Studio window while program is processing.

## Adjust Timings
hogehoge...

## Notes
- Will support macOS, Windows and WSL. (Currently tested only macOS)

## License
[MIT](LICENSE)
