const fs = require('fs');
const os = require('os');
const path = require('path');
const child_process = require('child_process');
const log = require('fancy-log');
const glob = require('glob');
const rimraf = require('rimraf');
const tmp = require('tmp');

module.exports = class BitwigStudio {

  /**
   * Return platform is WSL or not.
   * @return {boolean}
   */
  static isWSL() {
    return process.platform === 'linux' &&
      os.release().includes('Microsoft') &&
      fs.readFileSync('/proc/version', 'utf8').includes('Microsoft');
  }

  /**
   * Return a 'Program Files' path on WSL.
   * @return {boolean}
   */
  static wslWinProgramFiles() {
    return child_process.execSync('wslpath $(cmd.exe /C "echo %PROGRAMFILES%")')
      .toString().replace(/[\r\n]+$/g, '');
  }

  /**
   * Return a platform specific default Bitwig Studio execute faile path.
   * @return {String}
   */
  static defaultExecuteFile() {
    if (BitwigStudio._defaultExecuteFile) {
      return BitwigStudio._defaultExecuteFile;
    }
    BitwigStudio._defaultExecuteFile = (() => {
      switch (process.platform) {
      case 'win32':
        return path.join(process.env('PROGRAMFILES'), 'Bitwig Studio', 'Bitwig Studio.exe');
      case 'darwin':
        return '/Applications/Bitwig Studio.app/Contents/MacOS/BitwigStudio';
      case 'linux':
        if (this.isWSL()) {
          return path.join(this.wslWinProgramFiles(), 'Bitwig Studio', 'Bitwig Studio.exe');
        } else {
          return '/user/bin/bitwig-studio';
        }
      default:
        throw new Error(`Unsupported Platform:[${process.platform}].`);
      }
    })();
    return BitwigStudio._defaultExecuteFile;
  }

  /**
   * Append timeout aspect to specfied promise.
   * @param {Promise} promise
   * @return {Number} millis
   * @return {String} error message
   */
  static timeoutify(promise, millis = 3000, errorMessage = 'opration timeout.') {
    const timeout = new Promise((resolve, reject) => {
      setTimeout(() => {
        reject(new Error(errorMessage));
      }, millis);
    });
    return Promice.race([promise, timeout]);
  }
  
  /**
   * create Bitwig Sudio Temporary Project.
   * @param {String} src - source project file path.
   * @return {Promise} - {project: project, cleanup: fn}.
   */
  static async createTemporaryProject(src) {
    return new Promise((resolve, reject) => {
      tmp.dir((err, tempDir, cleanup) => {
        if (err) {
          reject(err);
          return;
        }
        process.on('exit', () => {
          if (!(fs.existsSync(tempDir) &&
                fs.statSync(tempDir).isDirectory())) {
            cleanup();
            log('cleanup temporary directory:', tempDir);
          }
        });
        const project = path.join(tempDir, path.basename(src));
        fs.copyFile(src, project, (err) => {
          if (err) {
            reject(err);
            return;
          }
          log('temporary project file was created. file:', project);
          // create .bitwig-project file
          try {
            const dotBitwigProject = path.join(tempDir, '.bitwig-project');
            fs.closeSync(fs.openSync(dotBitwigProject, 'w'));
            log('temporary .bitwig-project file was created. file:', dotBitwigProject);
            resolve({
              tempDir: tempDir,
              project: project,
              cleanup: cleanup
            });
          } catch (err) {
            reject(err);
          }
        });
      });
    });
  }

  /**
   * Launch & connect a local Bitwig Studio application.
   * @static
   * @async
   * @method
   * @param {String|Array} project - project file path.
   * @param {Object} config - configuration of rpc modules
   * @param {Object} options
   * @param {class} client - Inherit class of BitwigStudio
   * @return {Promise}
   */
  static async launch(project, options = {}) {
    const opts = Object.assign({
      executeFile: BitwigStudio.defaultExecuteFile(),
      useTempDir: false
    }, options);
    try {
      var tempDir;
      if (opts.useTempDir) {
        tempDir = await BitwigStudio.createTemporaryProject(project);
        project = tempDir.project;
      }
      const childProcess = child_process.spawn(
        opts.executeFile,
        [project], {
          stdio: 'ignore'
        });
      childProcess.on('close', () => {
          if (!(fs.existsSync(tempDir) &&
                fs.statSync(tempDir).isDirectory())) {
            tempDir.cleanup();
            log('cleanup temporary directory:', tempDir.tempDir);
          }
      });
      return new BitwigStudio(project, childProcess);
    } catch (err) {
      log.error('Bitwig Studio launch error:', err);
      throw err;
    }
  }

  /**
   * Constructor.
   * @static
   * @async
   * @method
   * @param {String} project - project file path.
   * @param {child_process} bitwig
   * @return {BitwiogStudio}
   */
  constructor(project, bitwig) {
    this.project = project;
    this.process = bitwig;
    this.bounceFolder = path.join(path.dirname(project), 'bounce');
    const ctx = this;
    this._closed = false;
    this.process.on('close', () => {
      log('Bitwig Studio process:', 'closed');
      ctx._closed = true;
    });
  }

  /**
   * Return a process is closed or not.
   * @return {boolean}
   */
  get closed() {
    return this._closed;
  }
  
  /**
   * remove bounce folder
   */
  cleanBounceFolder() {
    rimraf.sync(this.bounceFolder);
    log('cleanup bounce folder:', this.bounceFolder);
  }
  
  /**
   * Read a .wav from bounce folder.
   * @param {String} project - project file path.
   * @return {Promise} - .wav file path.
   */
  readBounceWavFile() {
    return new Promise((resolve, reject) => {
      glob(`${this.bounceFolder}/*.wav`, {}, (err, files) => {
        if (err) {
          reject(err);
          return;
        }
        if (!files || files.length !== 1) {
          reject(Error(`Could not find a bounce .wav file. files:${files}`));
          return;
        }
        try {
          const file = files[0];
          const buffer = fs.readFileSync(file);
          log('read complete bounce .wav file:', file);
          resolve(buffer);
        } catch (err) {
          log('read error bounce .wav file:', err);
          reject(err);
        }
      });
    });
  }
};
