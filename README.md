# bitwig-nks-preview-generator
Streaming convert NKSF files to preview audio with using Bitwig Studio.

## Requirements
- macOS/Windows
- Bitwig Studio version 2.5.1, 3.0 beta4 or above
- [SoX](http://sox.sourceforge.net) version 14.4.1 or above, compiled with --with-libvorbis
  - It's easy to install through [homebrew](https://brew.sh) or [chocolatey](https://chocolatey.org).
- node.js v10 or above.
  - I recommend to use [nvm](https://github.com/nvm-sh/nvm) or [nvm-windows](https://github.com/coreybutler/nvm-windows).

## Installation
Global Install
```sh
npm install bitwig-nks-preview-generator -g
# install WebSocket RPC server Bitwig Studio Extension
bws-nksf2ogg install
```
Local Install
```sh
mkdir my-nks-preview-project
cd my-nks-preview-project
npm init
npm install bitwig-nks-preview-generator --save-dev
# install WebSocket RPC server Bitwig Studio Extension
npx bws-nksf2ogg install
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
      clean [options] <dir>  Delete .previews folders recursively.
    
    $ bws-nksf2ogg exec --help
    Usage: exec [options] <dir>
    
    Generate preview audio from .nksf preset files recursively.

    Options:
      -d, --debug <level>       console verbosity level in testing,
                                0:none 1:ERROR 2:INFO 3:DEBUG 4:Bitwig Studio (default: 0)
      -r, --dry-run             just check mapper function, generating process is not executed
      -b, --bitwig <path>       Bitwig Studio execution file path (default: "<platform specific>")
      -u, --url <URL>           Bitwig Studio WebSockets URL (default: "ws://localhost:8887")
      -s, --skip-error          skip on error, continue processing
      -k, --skip-exist          skip .nksf file that already has preview audio
      -h, --show-plugin         show plugin window
      -c, --clip <path>         .bwclip MIDI clip or [.js | .coffee] mapper program
                                (default: "<package>/Bitwig Studio Files/NKS-Preview-C2-Single.bwclip")
      -f, --fxb <path>          directory for store intermediate .fxb files (default: "temp/fxb")
      -w, --wav <path>          directory for store intermediate .wav files (default: "temp/wav")
      -t, --timeout <msec>      timeout msec for launch & connect Bitwig Studio (default: 30000)
      -a, --wait-plugin <msec>  wait msec for loading plugin (default: 7000)
      -i, --wait-preset <msec>  wait msec for loading .fxb preset (default: 5000)
      -e, --tempo <BPM>         BPM for bouncing clip. (default: 120)
      -f, --freq <Hz>           sampling rate for output .ogg audio (default: 44100)
      -d, --fadeout <sec>       fadeout duration seconds from end (default: 0.25)
      -l, --silence <dB>        threshold level for removing silence from end, dB or 0-100% (default: "-90dB")
      -q, --quality <number>    quality of .ogg audio. 0-10 (default: 6)
      -h, --help                output usage information
  
    $ bws-nksf2ogg install --help
    Usage: install [options]

    Install Bitwig Studio WebSockets RPC server extension.

    Options:
      -e, --extension-dir <path>  Bitwig Studio Extension directory (default: "<platform specific>")
      -h, --help                  output usage information
  
    $ bws-nksf2ogg list --help
    Usage: list [options] <dir>
    
    List .nksf or .nksf.ogg files recursively.

    Options:
      -a, --absolute  list files as absolute path
      -r, --relative  list files as relative path from <dir>
      -m, --missing   list preset files that doesn't have preview
      -u, --useless   list preview files that doesn't have preset
      -f, --sox       list files as result of sox --i
      -h, --help      output usage information
    
    $ bws-nksf2ogg clean --help
    Usage: clean [options] <dir>
    
    Delete .previews folders recursively.
    
    Options:
      -y, --yes        no comfirmation
      -c, --corrupted  find corrupted .nksf.ogg files and clean them
      -h, --help       output usage information


## Procedure for Generating Preview Audio
1. Check WebSocket RPC Server module is enabled in controller preferences panel of Bitwig Studio.
1. Close Bitwig studio application if already it's opened.
1. Execute `bws-nksf2ogg exec [options] <dir>` command on terminal.
1. Bitwig Studio will automatically launch after command.
1. If you see popup message "Please click first clip" on Bitwig Studio, Click (not launch) the clip at Track 1, Slot 1. It's just needed to take focus of Bitwig Studio window for remote automation once at initial time. If note editor is not shown in window, double click might be better because 
progress of bouncing can be visually observed.
1. After processing is started, using other application is OK. But don't touch anything on Bitwig Studio.
1. When processing is done, Bitwig Studio will shutdown automatically.

### Execution Example
```
$ tree -a

<current working directory>
└── nksf
    ├── Repro-1
    │   ├── 01\ Solo\ Trumpet.nksf
    │   └── 02\ Frequency\ Modulation\ Bells.nksf
    └── Serum
        ├── PL\ Beepy\ ting\ [GI].nksf
        └── PL\ Big\ Bells\ [AS].nksf

$ bws-nksf2ogg exec nksf

progress [========================================] 100% | ETA: 0s | 4/4 | PL Big Bells [AS].nksf.ogg
Execution completed with result: 4 files succeeded.

$ tree -a

<current working directory>
├── nksf
│   ├── Repro-1
│   │   ├── .previews
│   │   │   ├── 01\ Solo\ Trumpet.nksf.ogg
│   │   │   └── 02\ Frequency\ Modulation\ Bells.nksf.ogg
│   │   ├── 01\ Solo\ Trumpet.nksf
│   │   └── 02\ Frequency\ Modulation\ Bells.nksf
│   └── Serum
│       ├── .previews
│       │   ├── PL\ Beepy\ ting\ [GI].nksf.ogg
│       │   └── PL\ Big\ Bells\ [AS].nksf.ogg
│       ├── PL\ Beepy\ ting\ [GI].nksf
│       └── PL\ Big\ Bells\ [AS].nksf
└── temp
    ├── fxb
    │   ├── Repro-1
    │   │   ├── 01\ Solo\ Trumpet.fxb
    │   │   └── 02\ Frequency\ Modulation\ Bells.fxb
    │   └── Serum
    │       ├── PL\ Beepy\ ting\ [GI].fxb
    │       └── PL\ Big\ Bells\ [AS].fxb
    └── wav
        ├── Repro-1
        │   ├── 01\ Solo\ Trumpet.wav
        │   └── 02\ Frequency\ Modulation\ Bells.wav
        └── Serum
            ├── PL\ Beepy\ ting\ [GI].wav
            └── PL\ Big\ Bells\ [AS].wav
```
## Adjust Timings
There is no way to know via remote automaition when the plugin or preset loading is finished so far. These timings are depends on plugin and your environment. The options `--wait-plugin <msec>, --wait-preset <msec>` must be set large enough value. Approximate setting time on my environment:
  - Hive                                      `--wait-preset 1000`
  - Serum                                     `--wait-preset 1500`
  - Spire                                     `--wait-preset 1500`
  - UVIWorkstation(Key Suite Digital)         `--wait-preset 5000`

## MIDI Clip Mapper
The mapper .js program allows for mapping NKS sound infomation to your custom MIDI clip.
```sh
bws-nksf2ogg exec --clip clip-mapper-example.js <targetDiretory>
```
[An example](clip-mapper-example.js)
```js
// use logger to follow --debug option
const log = require('bitwig-nks-preview-generator').logger('custom-mapper')
/**
 * Example NKS Preview MIDI clip mapper for UVI Key Suite Digital.
 * 
 * @param {Object} soundInfo - NKS Sound Info (metadata).
 * @return {String} - Bitwig Studio MIDI clip file path.
 */
module.exports = function(soundInfo) {
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
```
- Custom MIDI clip should contains only MIDI data. When edit and save it on Bitwig Studio, don't forget to delete device.
- Support [async function](test/test-async-mapper.js).
- Support [CoffeeScript](clip-mapper-example.coffee).

## Fadeout `--fadeout <duration>`
In most case, fadeout doesn't function, beacause note length(1bar) is enough smaller than clip length(2bar). This option is designed to fade out a very slow-release tone or sequence pattern. so I added 8 or 4 note length to clip length for fade margine.
Just for reference, SoX audio filter graph is as follows:
```
[reverse] -> [fade] -> [silence] -> [reverse] -> [rate]
```


## Module Use
The following modules are available for general use.
### gulp-nksf2fxb
#### Usage
```js
const gulp = require('gulp');
const nksf2fxb = require('bitwig-nks-preview-generator').nksf2fxb;
 
gulp.task('nksf2fxb', function() {
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
 
gulp.task('wav2ogg', function() {
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
  fadeout: 0.25,       // fadeout duration seconds from end
  silence: '-90dB',    // threshold level for removing silnce from end
  quality: 6,          // quality of .ogg audio. 0-10'
  skipError: false     // skip on error, need gulp-plumber, default: false
}
```

## Notes
- Only support for the third party VST2 plugins. Currently confirmed plugins:
  - UVIWorkStation
  - Serum
  - Spire
  - Repro-1     (even work if it's vendor's official .nksf)
- Will support WSL in the future.
## License
[MIT](LICENSE)
