const fs = require('fs'),
      path = require('path'),
      ffmpeg = require('fluent-ffmpeg'),
      streamBuffers = require('stream-buffers'),
      mkdirp = require('mkdirp');
      wavUtil = require('./../lib/wav-util');

const tests =  [
  {
    name: 'afade-src-44.1khz',
    src: 'wav/24bit-44.1kHz-1s.wav',
    conds: [
      {freq: 44100, fadeout: 0,    silence: '-90dB', quality: 5},
      {freq: 44100, fadeout: 0.25, silence: '-90dB', quality: 5},
      {freq: 44100, fadeout: 0.5,  silence: '-90dB', quality: 5},
      {freq: 44100, fadeout: 1,    silence: '-90dB', quality: 5}
    ]
  },
  {
    name: 'afade-src-96khz',
    src: 'wav/24bit-96kHz-1s.wav',
    conds: [
      {freq: 44100, fadeout: 0,    silence: '-90dB', quality: 5},
      {freq: 44100, fadeout: 0.25, silence: '-90dB', quality: 5},
      {freq: 44100, fadeout: 0.5,  silence: '-90dB', quality: 5},
      {freq: 44100, fadeout: 1,    silence: '-90dB', quality: 5}
    ]
  },
  {
    name: 'silenceremove-src-44.1khz',
    src: 'wav/24bit-44.1kHz-0.5s-fade-0.25s-silence-0.25s.wav',
    conds: [
      {freq: 44100, fadeout: 0, silence: '0', quality: 5},
      {freq: 44100, fadeout: 0.250, silence: '0', quality: 5},
      {freq: 44100, fadeout: 0.5, silence: '0', quality: 5},
      {freq: 44100, fadeout: 1, silence: '0', quality: 5}
    ]
  },
  {
    name: 'silenceremove-src-96khz',
    src: 'wav/24bit-44.1kHz-0.5s-fade-0.25s-silence-0.25s.wav',
    conds: [
      {freq: 44100, fadeout: 0, silence: '0',      quality: 5},
      {freq: 44100, fadeout: 0, silence: '-100dB', quality: 5},
      {freq: 44100, fadeout: 0, silence: '-90dB',  quality: 5},
      {freq: 44100, fadeout: 0, silence: '-50dB',  quality: 5}
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
  const basename = path.basename(file, '.wav');
  const buffer = await _wav2ogg(file, opts);
  const outFile = `src[${basename}]-freq[${opts.freq}]-silence[${opts.silence}]-fadeout[${opts.fadeout}s]-quality[${opts.quality}].ogg`;
  const dest = path.join('out', test);
  mkdirp.sync(dest);
  fs.writeFileSync(path.join(dest, outFile), buffer);
}
function _wav2ogg(file, opts) {
  return new Promise(async (resolve, reject) => {
    const outStream = new streamBuffers.WritableStreamBuffer(),
          fmt = await wavUtil.readFormat(file),
          duration = fmt.dataSize / fmt.byteRate,
          fadeStart = duration - opts.fadeout;
    ffmpeg(file)
    // type st=start, d=fade duration
      .audioFilter(`afade=t=out:st=${fadeStart}:d=${opts.fadeout}`)
    // remove silce from end
      // .audioFilter(`silenceremove=stop_periods=1:stop_duration=0.0001:stop_threshold=${opts.silence}`)
      .audioCodec('libvorbis')
      .format('ogg')
      .audioFrequency(opts.freq)
    // quality 0 - 10 = 64kbps - 500kbps
      .audioQuality(opts.quality)
      .on('error', function(err) {
        reject(err);
      })
      .on('end', function() {
        resolve(outStream.getContents());
      })
      .pipe(outStream, {end: true});
  });
}
