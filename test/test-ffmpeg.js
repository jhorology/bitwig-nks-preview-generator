const fs = require('fs'),
      path = require('path'),
      streamBuffers = require('stream-buffers'),
      mkdirp = require('mkdirp'),
      wavUtil = require('./../lib/wav-util'),
      _ffmpeg = require('./../lib/gulp-nks-wav2ogg')._ffmpeg;

const tests =  [
  {
    name: 'afade-src-44.1khz',
    src: 'wav/24bit-44.1kHz-1s.wav',
    conds: [
      {fadeout: 0,    silence: '-90dB', freq: 44100, quality: 5},
      {fadeout: 0.25, silence: '-90dB', freq: 44100, quality: 5},
      {fadeout: 0.5,  silence: '-90dB', freq: 44100, quality: 5},
      {fadeout: 1,    silence: '-90dB', freq: 44100, quality: 5}
    ]
  }, {
    name: 'afade-src-44.1khz',
    src: 'wav/24bit-44.1kHz-0.5s-fade-0.25s-silence-0.25s.wav',
    conds: [
      {fadeout: 0,    silence: '-90dB', freq: 44100, quality: 5},
      {fadeout: 0.25, silence: '-90dB', freq: 44100, quality: 5},
      {fadeout: 0.5,  silence: '-90dB', freq: 44100, quality: 5},
      {fadeout: 1,    silence: '-90dB', freq: 44100, quality: 5}
    ]
  }, {
    name: 'afade-src-44.1khz',
    src: 'wav/Acidity.wav',
    conds: [
      {fadeout: 0,    silence: '-90dB', freq: 44100, quality: 5},
      {fadeout: 0.25, silence: '-90dB', freq: 44100, quality: 5},
      {fadeout: 0.5,  silence: '-90dB', freq: 44100, quality: 5},
      {fadeout: 1,    silence: '-90dB', freq: 44100, quality: 5}
    ]
  }];

(async () => {
  try {
    for(let test of tests) {
      for(let opts of test.conds) {
        await wav2ogg(test.name, test.src, opts);
      }
    }
  } catch (err) {
    console.error(err);
  }
})();

async function wav2ogg(test, file, opts) {
  const basename = path.basename(file, '.wav'),
        fmt = await wavUtil.readFormat(file),
        duration = fmt.dataSize / fmt.byteRate,
        buffer = await _ffmpeg(file, duration, opts),
        outFile = `src[${basename}]-fadeout[${opts.fadeout}s]-freq[${opts.freq}]-quality[${opts.quality}].ogg`,
        dest = path.join('out', test);
  mkdirp.sync(dest);
  fs.writeFileSync(path.join(dest, outFile), buffer);
}
