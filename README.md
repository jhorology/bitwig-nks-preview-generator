# bitwig-nks-preview-generator
Streaming convert NKSF files to preview audio with using Bitwig Studio.

Publishing NPM package soon.

## Requirements

- Bitwig Studio version 2.5.1 or above.
- ffmpeg version 4.1.3 or above.
- node.js v8 or above.


## Installation
```sh
# global install
npm install bitwig-nks-preview-generator -g
# install WebSocket RPC server Bitwig Studio Extension
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
      -d, --debug <level>       console verbosity level in testing,
                                0:none 1:ERROR 2:INFO 3:DEBUG 4:Bitwig Studio (default: 0)
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
      -a, --wait-plugin <msec>  wait msec for loading plugin (default: 7000)
      -i, --wait-preset <msec>  wait msec for loading .fxb preset (default: 5000)
      -e, --tempo <BPM>         BPM for bouncing clip. (default: 120)
      -f, --freq <Hz>           sampling rate for output .ogg audio (default: 44100)
      -d, --fadeout <samples>   number of samples for fadeout (default: 110250)
      -l, --silence <dB>        threshold level for removing silnce from end (default: "-90dB")
      -q, --quality <number>    quality of .ogg audio. 0-10 (default: 5)
      -h, --help                output usage information
  
    $ bin/bws-nksf2ogg install --help
    Usage: install [options]
    
    Install Bitwig Studio WebSockets RPC server extension.
    
     Options:
      -e, --extension-dir <path>  Bitwig Studio Extension directory
                                  (default: "<platform specific>")
      -h, --help                  output usage information
    
    $ bws-nksf2ogg list --help
    Usage: list [options] <dir>
    
    List .nksf or .nksf.ogg files.

    Options:
      -a, --absolute  list files as absolute path
      -r, --relative  list files as relative path from <dir>
      -m, --missing   list preset files that doesn't have preview
      -u, --useless   list preview files that doesn't have preset
      -f, --ffprobe   list files as result of ffprobe
      -h, --help      output usage information
    
    $ bws-nksf2ogg clean --help
    Usage: clean [options] <dir>
    
    Delete .previews folders.
    
    Options:
      -y, --yes   no comfirmation
      -h, --help  output usage information

## MIDI Clip Mapper
The mapper .js program allows for mapping NKS sound infomation to your custom MIDI clip.
```sh
bws-nksf2ogg exec --clip clip-mapper-example.js <targetDiretory>
```
An example:
```js
const log = require('bitwig-nks-preview-generator').logger('custom-mapper');
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
  } else if (soundInfo.types[0][1].includes('Piano')) {
    clip = 'Bitwig Studio Files/NKS-Preview-Cmaj-Chord.bwclip';
  } else {
    clip = 'Bitwig Studio Files/NKS-Preview-C2-Single.bwclip';
  }
  log.info('NKS Info:', soundInfo, 'CLip:', clip);
  return clip;
};
```

## Procedure for Generating Preview Audio
1. Check WebSocket RPC Server module is enabled in preferences panel of Bitwig Studio.
1. Close Bitwig studio application if already it's opened.
1. Execute `bws-nks2ogg exec [options] <dir>` command on terminal.
1. Bitwig Studio will automatically launch after command.
1. If you see popup message "Please click first clip" on Bitwig Studio, Click (not launch) the clip at Track 1, Slot 1. It's just needed to take focus of Bitwig Studio window for remote automation once at initial time. After processing is started, using other application is OK. But don't touch anything on Bitwig Studio.
1. When processing is done, Bitwig Studio will shutdown automatically.

## Adjust Timings
There is no way to know when the plugin or preset loading is finished so far. These timings are depends on plugin and your environment. The options `--wait-plugin <msec>, --wait-preset <msec>` must be set large enough value.

## Module Use
The following modules are available for general use.
### gulp-nksf2fxb
#### Usage
```js
const gulp = require('gulp');
const nksf2fxb = require('bitwig-nks-preview-generator').nksf2fxb;
 
gulp.task('nksf2fxb', function () {
  return gulp.src('./nksf/**/*.nksf')
    .pipe(nksf2fxb(options))
    .pipe(gulp.dest('./fxb'));
});
```
#### Options Default
```js
{
  skipError: false // skip on error, need gulp-plumber, default: false
}
```

### gulp-nks-wav2ogg
#### Usage
```js
const gulp = require('gulp');
const wav2ogg = require('bitwig-nks-preview-generator').wav2ogg;
 
gulp.task('wav2ogg', function () {
  return gulp.src('./wav/**/*.wav')
    .pipe(wav2ogg(options))
    .pipe(gulp.dest('./ogg'));
});
```
#### Options Default
```js
{
  dotPreviews: true,   // append '.prevews' to dirname
  nksfDotOgg: true,    // rename extension to '.nksf.ogg'
  freq: 44100,         // sampling rate for output .ogg audio
  silence: '-90dB',    // threshold level for removing silnce from end
  fadeout: 110250,     // number of samples for fadeout
  quality: 5,          // quality of .ogg audio. 0-10'
  skipError: false     // skip on error, need gulp-plumber, default: false
}
```

## Notes
- Support only the thirdparty VST2 plugins.
- Custom MIDI clip should contains only MIDI data.
- Will support macOS, Windows and WSL. (Currently tested only on macOS)

## License
[MIT](LICENSE)
