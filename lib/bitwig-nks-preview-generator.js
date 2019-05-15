const path = require('path');
const {src, dest } = require('gulp');

const launchBitwigStudio = require('./bitwig-studio-automation');
const nksf2fxb = require('./gulp-nksf2fxb');
const wav2ogg = require('./gulp-nks-wav2ogg');

const PLUGIN_ID = 'UVIW';
const PREVIEW_CHORD_CLIP = path.resolve(path.join(__dirname, '..', 'Bitwig Studio Files/NKS-Preview-Chord.bwclip'));

const generator = (dir, opts) => {
  opts = Object.assign({
    // diretory for .fxb intermediate files
    fxbDir: 'temp/fxb',
    // diretory for .wav intermediate files
    wavDir: 'temp/wav',
    // gulp plugin for .fxb to nks preview .wav
    fxb2wav: () => {}
  }, opts);
  return src(`${dir}/**/*.nksf`)
    .pipe(nksf2fxb())
    .pipe(dest('temp/fxb'))
    .pipe(opts.fxb2wav())
    .pipe(dest('temp/wav'))
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
        resolve();
      });
  }); 
};

const run = async (dir, opts) => {
  opts = opts || {};
  if (!opts.faxb2wav) {
    const bitwig = await startBitwigStudio();
    await bitwig.loadResources(PLUGIN_ID, PREVIEW_CHORD_CLIP);
    await bitwig.waitForFocusWindowAndClip();
    opts.fxb2wav = bitwig.gulpBounce;
  }
};

module.exports ={
  run: run,
  generator: generator
};
