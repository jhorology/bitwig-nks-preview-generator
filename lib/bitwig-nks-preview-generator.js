const path = require('path');
const {src, dest} = require('gulp');
const tap = require('gulp-tap');
const log = require('fancy-log');
const nksf2fxb = require('./gulp-nksf2fxb');
const fxb2wav = require('./gulp-bitwig-fxb2wav');
const wav2ogg = require('./gulp-nks-wav2ogg');
const BitwigStudio = require('./bitwig-studio');

const generator = (dir, options) => {
  const opts = Object.assign({}, options, {
    fxb: 'temp/fxb',   // append '.prevews' to dirname
    wav: 'temp/wav'    // replace extname to '.nksf.ogg'
  });
  return src(`${dir}/**/*.nksf`)
    .pipe(nksf2fxb())
    .pipe(dest(opts.fxb))
    .pipe(fxb2wav(options))
    .pipe(dest(opts.wav))
    .pipe(wav2ogg(Object.assign({}, options, { 
      dotPreviews: true,   // append '.prevews' to dirname
      nksfDotOgg: true     // replace extname to '.nksf.ogg'
    })))
    .pipe(dest(dir))
    .on('end', () => {
      BitwigStudio.quit();
    })
    .on('error', (err) => {
      log.error(err);
    });
};

generator.promised = (dir, options) => {
  return new Promise((resolve, reject) => {
    generator(dir, options)
      .on('error', (err)=> {
        log.error(err);
        reject(err);
      })
      .on('end', ()=> {
        resolve();
      });
  }); 
};

module.exports = generator;
