const path = require('path');
const {src, dest} = require('gulp');
const nksf2fxb = require('./gulp-nksf2fxb');
const fxb2wav = require('./gulp-bitwig-fxb2wav');
const wav2ogg = require('./gulp-nks-wav2ogg');
const BitwigStudio = require('./bitwig-studio');

const generator = (dir, opts) => {
  return src(`${dir}/**/*.nksf`)
    .pipe(nksf2fxb())
    .pipe(dest(opts.fxb))
    .pipe(fxb2wav(opts))
    .pipe(dest(opts.wav))
    .pipe(wav2ogg())
    .pipe(dest(`${dir}/.preview`));
};

generator.promised = (dir, opts) => {
  return new Promise((resolve, reject) => {
    generator(dir, opts)
      .on('error', (err)=> {
        reject(err);
      })
      .on('end', ()=> {
        BitwigStudio.quit();
        resolve();
      });
  }); 
};

module.exports = generator;
