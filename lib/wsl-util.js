const fs = require('fs'),
  os = require('os'),
  { execSync } = require('child_process'),
  log = require('./logger')('wsl-util')

const _cache = {}

/**
 * Return platform is WSL or not.
 * @return {number} 0: not WSL, 1: WSL1,  2: WSL2
 */
function isWSL() {
  if (typeof _cache.isWSL === 'undefined') {
    if (
      process.platform === 'linux' &&
      os.release().toLowerCase().includes('microsoft') &&
      fs
        .readFileSync('/proc/version', 'utf8')
        .toLowerCase()
        .includes('microsoft')
    ) {
      _cache.isWSL = /^\/run\/WSL\/.*/.exec(process.env.WSL_INTEROP) ? 2 : 1
      log.debug('isWSL()', _cache.isWSL)
    } else {
      _cache.isWSL = 0
    }
  }
  return _cache.isWSL
}

/**
 * Return a environment value.
 * if platform is WSL, return a Windows variable.
 * @param {string} name - environment value name.
 * @return {string} - environement value
 */
function winenv(name) {
  if (isWSL()) {
    const env = _cache.winenv || {}
    if (!env[name]) {
      env[name] = execSync(
        `/mnt/c/Windows/System32/cmd.exe /C "echo %${name}%" 2> /dev/null`,
        {
          stdio: ['pipe', 'pipe', 'ignore']
        }
      )
        .toString()
        .replace(/[\r\n]+$/g, '')
      _cache.winenv = env
      log.debug('wslenv()', `${name}=${env[name]}`)
    }
    return _cache.winenv[name]
  }
  return process.env[name]
}

/**
 * Translate Windows path to WSL path.
 * @param {string} path - WSL path
 * @return {string} - Windows path
 */
function winpath(path) {
  if (isWSL()) {
    const result = execSync(`wslpath -w "${path}" 2> /dev/null`)
      .toString()
      .replace(/[\r\n]+$/g, '')
    log.debug('winpath()', result)
    return result
  }
  return path
}

/**
 * Translate Windows path to WSL path.
 * @param {string} path - Windows path
 * @return {string} - WSL path
 */
function wslpath(path) {
  if (isWSL()) {
    const result = execSync(`wslpath -u "${path}" 2> /dev/null`)
      .toString()
      .replace(/[\r\n]+$/g, '')
    log.debug('wslpath()', result)
    return result
  }
  return path
}

/**
 * Return a Host ip address
 * @return {string} - address
 */
function winipaddress() {
  // WSL2 ?
  if (isWSL() === 2) {
    if (_cache.winipaddress) {
      return _cache.winipaddress
    } else {
      const match = /^nameserver\s+([0-9|.]+)/m.exec(
        fs.readFileSync('/etc/resolv.conf')
      )
      if (match) {
        _cache.winipaddress = match[1]
        return _cache.winipaddress
      }
    }
  }
  return 'localhost'
}

module.exports = {
  isWSL,
  winenv,
  winpath,
  wslpath,
  winipaddress
}
