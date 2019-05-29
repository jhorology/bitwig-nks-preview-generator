const fs = require('fs'),
      os = require('os'),
      path = require('path'),
      { execSync, spawn } = require('child_process'),
      glob = require('glob'),
      rimraf = require('rimraf'),
      { TmpDir } = require('temp-file'),
      chalk = require('chalk'),
      wavUtil = require('./wav-util'),
      tmpDirPrefix = require('../package.json').name,
      log = require('./logger')('bitwig-studio-local'),
      stdioStyle = chalk.keyword('orange'),
      tmpDir = new TmpDir()

const wait = msec => {
  return new Promise(resolve => setTimeout(resolve, msec))
}

/**
 * application specific local interface for Bitwig Studio
 * @class
 */
module.exports = class BitwigStudio {
  /**
   * default launch() options.
   * @static
   * @property
   * @type {Object}
   */
  static get defaultOptions() {
    return {
      bitwig: this.defaultExecuteFile(),
      project: undefined,
      args: undefined,
      createTemporaryProjectFolder: false,
      Client: BitwigStudio
    }
  }

  /**
   * launch() options descriptions
   * @static
   * @property
   * @type {Object}
   */
  static get optionsDescriptions() {
    return {
      bitwig: 'Bitwig Studio execution file path',
      project: 'Bitwig Studio Project file path',
      args: 'launch arguments',
      createTemporaryProjectFolder: 'create a temporary project folder',
      Client: 'Inherited Client class.'
    }
  }

  /**
   * Return platform is WSL or not.
   * @static
   * @property
   * @return {boolean}
   */
  static isWSL() {
    if (typeof this._isWSL === 'undefined') {
      this._isWSL = process.platform === 'linux' &&
        os.release().includes('Microsoft') &&
        fs.readFileSync('/proc/version', 'utf8').includes('Microsoft')
    }
    return this._isWSL
  }

  /**
   * Return a environment value with consideration of WSL.
   * @static
   * @method
   * @param {String} name - environment value name.
   * @return {String}
   */
  static wslenv(name) {
    if (this.isWSL()) {
      this._wslenv = this._wslenv || {}
      if (!this._wslenv[name]) {
        this._wslenv[name] = execSync(`cmd.exe /C "echo %${name}%"`)
          .toString().replace(/[\r\n]+$/g, '')
      }
      return this._wslenv[name]
    }
    return process.env[name]
  }

  /**
   * Translate WSL path to Windows path.
   * @static
   * @method
   * @param {String} wslPath - WSL path
   * @return {String} - Windows path
   */
  static wsl2winPath(wslPath) {
    return execSync(`wslpath -w "${wslPath}"`)
      .toString().replace(/[\r\n]+$/g, '')
  }

  /**
   * Translate Windows path to WSL path.
   * @static
   * @method
   * @param {String} wslPath - WSL path
   * @return {String} - Windows path
   */
  static win2wslPath(winPath) {
    return execSync(`wslpath "${winPath}"`)
      .toString().replace(/[\r\n]+$/g, '')
  }

  /**
   * Return a platform specific default Bitwig Studio execute faile path.
   * @static
   * @method
   * @return {String}
   */
  static defaultExecuteFile() {
    if (!this._defaultExecuteFile) {
      this._defaultExecuteFile = (() => {
        switch (process.platform) {
        case 'win32':
          return path.join(process.env.PROGRAMFILES, 'Bitwig Studio', 'Bitwig Studio.exe')
        case 'darwin':
          return '/Applications/Bitwig Studio.app/Contents/MacOS/BitwigStudio'
        case 'linux':
          if (this.isWSL()) {
            return path.join(this.win2wslPath(this.wslenv('PROGRAMFILES')), 'Bitwig Studio', 'Bitwig Studio.exe')
          } else {
            return '/user/bin/bitwig-studio'
          }
        default:
          throw new Error(`Unsupported Platform:[${process.platform}].`)
        }
      })()
    }
    return this._defaultExecuteFile
  }

  /**
   * Return a platform specific default Bitwig Studio Extension folder path.
   * @static
   * @method
   * @return {String}
   */
  static defaultExtensionDir() {
    if (!this._defaultExtensionDir) {
      this._defaultExtensionDir = (() => {
        switch (process.platform) {
        case 'win32':
          return path.join(os.homedir(), 'Documents', 'Bitwig Studio', 'Extensions')
        case 'darwin':
          return path.join(os.homedir(), 'Documents', 'Bitwig Studio', 'Extensions')
        case 'linux':
          if (this.isWSL()) {
            return path.join(this.win2wslPath(this.wslenv('USERPROFILE')), 'Documents', 'Bitwig Studio', 'Extensions')
          } else {
            return path.join(os.homedir(), 'Bitwig Studio', 'Extensions')
          }
        default:
          throw new Error(`Unsupported Platform:[${process.platform}].`)
        }
      })()
    }
    return this._defaultExtensionDir
  }

  /**
   * create Bitwig Sudio Temporary Project.
   * @static
   * @async
   * @method
   * @param {String} project - source project file path.
   * @return {String} - temporary project path
   */
  static async createTemporaryProject(project) {
    const tempDirPath = await tmpDir.createTempDir(tmpDirPrefix),
          tempProject = path.join(tempDirPath, path.basename(project))
    fs.copyFileSync(project, tempProject)
    log.debug('temporary project file was created. file:', tempProject)
    const dotBitwigProject = path.join(tempDirPath, '.bitwig-project')
    fs.closeSync(fs.openSync(dotBitwigProject, 'w'))
    log.debug('temporary .bitwig-project file was created. file:', dotBitwigProject)
    return tempProject
  }

  /**
   * Launch a Bitwig Studio application.
   * @static
   * @async
   * @method
   * @param {Object} options
   * @return {BitwigStudio} - local interface.
   */
  static async launch(options) {
    const opts = Object.assign({}, this.defaultOptions, options)
    let projectFile = opts.project
    if (opts.project && opts.createTemporaryProjectFolder) {
      projectFile = await this.createTemporaryProject(opts.project)
    }
    let args = []
    if (opts.project) {
      args.push(this.isWSL() ? this.wsl2winPath(projectFile) : projectFile)
    }
    if (opts.args) {
      args = args.concat(opts.args)
    }
    const childProcess = spawn(opts.bitwig, args, {
      detached: true,
      stdio: opts.debug ? 'pipe' : 'ignore'
    })
    if (childProcess.stdout) {
      childProcess.stdout.on('data', data => {
        process.stdout.write(stdioStyle(data))
      })
    }
    if (childProcess.stderr) {
      childProcess.stderr.on('data', data => {
        process.stderr.write(stdioStyle(data))
      })
    }
    return new opts.Client(childProcess, projectFile, opts)
  }

  /**
   * Constructor.
   * @constructor
   * @param {child_process} bitwig
   * @param {String} project - project file path.
   * @param {Object} options
   */
  constructor(bitwig, project, options) {
    this.process = bitwig
    this.options = options
    if (project) {
      this.bounceFolder = path.join(path.dirname(project), 'bounce')
    }
    this._closed = false
    const ctx = this
    this.process.on('close', code => {
      log.info(`Bitwig Stduio process exited with code ${code}`)
      ctx._closed = true
    })
  }

  /**
   * Return a process is closed or not.
   * @property
   * @type {boolean}
   */
  get closed() {
    return this._closed
  }

  /**
   * remove bounce folder
   * @deprecated
   * @method
   */
  cleanBounceFolder() {
    if (!this.bounceFolder) {
      throw new Error('bounceFolder is undefined.')
    }
    rimraf.sync(this.bounceFolder)
    log.debug('cleanup bounce folder:', this.bounceFolder)
  }

  /**
   * remove bounce .wav files
   * @deprecated
   * @method
   */
  cleanBounceWavFiles() {
    if (!this.bounceFolder) {
      throw new Error('bounceFolder is undefined.')
    }
    rimraf.sync(path.join(this.bounceFolder, '*.wav'))
    log.debug('cleanup bounce folder:', this.bounceFolder)
  }

  /**
   * Read a .wav from bounce folder.
   * @async
   * @method
   * @param clipName {String} - bounced clip name
   * @param timeout {Number} - timeout millis, default = 6000
   * @return {Buffer} - bounce .wav file content.
   */
  async readBounceWavFile(clipName, timeout = 6000) {
    const interval = 200
    var remain = timeout - 150
    // initial wait
    await wait(150)
    while (remain > 0) {
      await wait(interval)
      remain -= interval
      const bouncedWav = path.join(this.bounceFolder, clipName + '.wav');
      try {
        // validate & read .wav file
        return await wavUtil.validateRead(bouncedWav)
        log.debug('readBounceWavFile()', 'completed.', bouncedWav)
      } catch (err) {
        // this err is within expectations.
        if (remain > 0) {
          log.debug('readBounceWavFile()', 'wav validation failed and retrying.', err)
        } else {
          log.debug('readBounceWavFile()', 'wav validation failed.', err)
        }
      }
    }
    throw new Error('readBounceWavFile() operation timeout.')
  }
}
