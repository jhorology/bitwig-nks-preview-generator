const fs = require('fs');
const os = require('os');
const path = require('path');
const child_process = require('child_process');
const log = require('fancy-log');
const glob = require('glob');
const rimraf = require('rimraf');
const {TmpDir} = require('temp-file');
const tmpDirPrefix = require('../package.json').name;

const tmpDir = new TmpDir();

module.exports = class BitwigStudio {

  /**
   * default launch() options.
   * @static
   * @type {Object}
   */
  static get defaultOptions() {
    return {
      bitwig: this.defaultExecuteFile(),
      project: undefined,
      args: undefined,
      createTemporaryProjectFolder: false,
      client: BitwigStudio
    };
  }
  
  /**
   * launch() options descriptions
   * @static
   * @type {Object}
   */
  static get optionsDescriptions() {
    return {
      bitwig: 'Bitwig Studio execution file path',
      project: 'Bitwig Studio Project file path',
      args: 'launch arguments',
      createTemporaryProjectFolder: 'create a temporary project folder',
      client: 'Inherited Client class.'
    };
  }
  
  /**
   * Return platform is WSL or not.
  * @static
   * @return {boolean}
   */
  static isWSL() {
    if (typeof this._isWSL === 'undefined') {
      this._isWSL = process.platform === 'linux' &&
        os.release().includes('Microsoft') &&
        fs.readFileSync('/proc/version', 'utf8').includes('Microsoft');
    }
    return this._isWSL;
  }

  /**
   * Return a environment value with consideration of WSL.
   * @static
   * @return {String} name - environment value name.
   * @return {String}
   */
  static wslenv(name) {
    if (this.isWSL()) {
      this._wslenv = this._wslenv || {}; 
      if (!this._wslenv[name]) {
        this._wslenv[name] =  child_process.execSync(`wslpath "$(cmd.exe /C "echo %${name}%")"`)
          .toString().replace(/[\r\n]+$/g, '');
      }
      return this._wslenv[name];
    }
    return process.env[name];
  }

  /**
   * Translate WSL path to Windows path.
   * @static
   * @return {String} wslPath - WSL path
   * @return {String} - Windows path
   */
  static wsl2winPath(wslPath) {
    return child_process.execSync(`wslpath "${wslPath}"`)
      .toString().replace(/[\r\n]+$/g, '');
  }

  /**
   * Translate Windows path to WSL path.
   * @static
   * @return {String} wslPath - WSL path
   * @return {String} - Windows path
   */
  static win2wslPath(winPath) {
    return child_process.execSync(`wslpath -w "${winPath}"`)
      .toString().replace(/[\r\n]+$/g, '');
  }
  
  /**
   * Return a platform specific default Bitwig Studio execute faile path.
   * @static
   * @return {String}
   */
  static defaultExecuteFile() {
    if (!this._defaultExecuteFile) {
      this._defaultExecuteFile = (() => {
        switch (process.platform) {
        case 'win32':
          return path.join(process.env('PROGRAMFILES'), 'Bitwig Studio', 'Bitwig Studio.exe');
        case 'darwin':
          return '/Applications/Bitwig Studio.app/Contents/MacOS/BitwigStudio';
        case 'linux':
          if (this.isWSL()) {
            return path.join(this.win2wslPath(wslenv('PROGRAMFILES')), 'Bitwig Studio', 'Bitwig Studio.exe');
          } else {
            return '/user/bin/bitwig-studio';
          }
        default:
          throw new Error(`Unsupported Platform:[${process.platform}].`);
        }
      })();
    }
    return this._defaultExecuteFile;
  }
  
  /**
   * Return a platform specific default Bitwig Studio Extension folder path.
   * @static
   * @return {String}
   */
  static defaultExtensionDir() {
    if (!this._defaultExtensionDir) {
      this._defaultExtensionDir = (() => {
        switch (process.platform) {
        case 'win32':
          return path.join(os.homedir(), 'Documents', 'Bitwig Studio', 'Extensions');
        case 'darwin':
          return path.join(os.homedir(), 'Documents', 'Bitwig Studio', 'Extensions');
        case 'linux':
          if (this.isWSL()) {
            return path.join(wslWinHomeDir(), 'Documents', 'Bitwig Studio', 'Extensions');
          } else {
            return path.join(os.homedir(), 'Bitwig Studio', 'Extensions');
          }
        default:
          throw new Error(`Unsupported Platform:[${process.platform}].`);
        }
      })();
    }
    return this._defaultExtensionDir;
  }

  /**
   * create Bitwig Sudio Temporary Project.
   * @static
   * @param {String} project - source project file path.
   * @return {Promise<String>} - resolve temporary project path
   */
  static async createTemporaryProject(project) {
    const tempDirPath = await tmpDir.createTempDir(tmpDirPrefix);
    const tempProject = path.join(tempDirPath, path.basename(project));
    fs.copyFileSync(project, tempProject);
    log('temporary project file was created. file:', tempProject);
    const dotBitwigProject = path.join(tempDirPath, '.bitwig-project');
    fs.closeSync(fs.openSync(dotBitwigProject, 'w'));
    log('temporary .bitwig-project file was created. file:', dotBitwigProject);
    return tempProject;
  }

  /**
   * Launch a Bitwig Studio application.
   * @static
   * @method
   * @param {Object} options
   * @return {Promise<BitwigStudio>} - local interface.
   */
  static async launch(options) {
    const opts = Object.assign({}, this.defaultOptions, options);
    let projectFile = opts.project;
    if (opts.project && opts.createTemporaryProjectFolder) {
      projectFile = await this.createTemporaryProject(opts.project);
    }
    let args = [];
    if (opts.project) {
      args.push(this.isWSL() ? this.wsl2winPath(projectFile) : projectFile);
    }
    if (opts.args) {
      args = args.concat(opts.args);
    }
    const childProcess = child_process.spawn(opts.bitwig, args, {
      detached: true,
      stdio: 'ignore'
    });
    return new opts.client(childProcess, projectFile, opts);
  }

  /**
   * Constructor.
   * @static
   * @async
   * @method
   * @param {child_process} bitwig
   * @param {String} project - project file path.
   * @return {BitwiogStudio}
   */
  constructor(bitwig, project, options) {
    this.process = bitwig;
    this.options = options;
    if (project) {
      this.bounceFolder = path.join(path.dirname(project), 'bounce');
    }
    this._closed = false;
    const ctx = this;
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
    if (!this.bounceFolder) {
      throw new Error('bounceFolder is undefined.');
    }
    rimraf.sync(this.bounceFolder);
    log('cleanup bounce folder:', this.bounceFolder);
  }
  
  /**
   * Read a .wav from bounce folder.
   * @return {Promise} - .wav file path.
   */
  readBounceWavFile() {
    return new Promise((resolve, reject) => {
      if (!this.bounceFolder) {
        reject(new Error('bounceFolder is undefined.'));
        return;
      }
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
