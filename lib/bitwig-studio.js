const fs = require('fs');
const child_process = require('child_process');
const log = require('fancy-log');
const WebSocket = require('rpc-websockets').Client;

const wait = millis => {
  return new Promise(resolve => setTimeout(resolve, millis));
};

let launchedBitwig = undefined;

/**
 * A remote client for Bitwigg Studio
 */
module.exports = class BitwigStudio extends WebSocket {
  /**
   * Launch a local Bitwig Studio application.
   * @static
   * @async
   * @method
   * @param {Array} args
   * @param {Object} config - configuration of rpc modules
   * @param {Object} options
   * @param {WebSocket} client - Inherit class of WebSocket
   * @return {WebSocket}
   */
  static async launch(args, config, client = BitwigStudio, options = {}) {
    const opts = Object.assign({
      bitwig: '/Applications/Bitwig Studio.app/Contents/MacOS/BitwigStudio',
      timwoutBitwig: 30000,
      url: 'ws://localhost:8887',
    }, options);
    const childProcess = child_process.spawn(
      opts.bitwig,
      args, {
        stdio: 'ignore'
      });
    const bitwig = new client(opts.url, {
      autoconnect: true,
      reconnect: true,
      max_reconnects: 0
    });
    childProcess.on('close', () => {
      log("BitwigStudio process", 'close');
      bitwig.close();
      launchedBitwig = undefined;
    });
    childProcess.on('exit', () => {
      log("BitwigStudio process", 'exit');
      bitwig.close();
      launchedBitwig = undefined;
    });
    try {
      await bitwig.promise('open', undefined, true, opts.timeoutBitwig);

      if (config) {
        await bitwig.notify('rpc.config', config);
        await bitwig.promise('close', undefined, true);
        // wait for reconnect
        await bitwig.promise('open', undefined, true);
      }
      launchedBitwig = bitwig;
    } catch (err) {
      log.error(err);
      throw new Error('# Bitwig Studio launch error.', err);
    }
    return bitwig;
  }

  static async quit(url) {
    if (launchedBitwig) {
      try {
        await launchedBitwig.msg('The process completed successfullly');
        await wait(1000);
        let remainingSeconds = 5;
        while(remainingSeconds) {
          await launchedBitwig.msg(`Automatically shutdown Bitwig Studio after ${remainingSeconds} seconds.`);
          await wait(1000);
          remainingSeconds--;
        }
        await launchedBitwig.notify('application.getAction.invoke', ['Quit']);
        await wait(500);
        await launchedBitwig.notify('application.getAction.invoke', ['Dialog: No']);
        launchedBitwig.close();
      } catch (err) {
        console.log(err);
      }
    }
  }
  
  /**
   * Invoke a action.
   * @method
   * @param {String} id - action id.
   * @return {Promise}
   */
  action(id) {
    return this.notify('application.getAction.invoke', [id]);
  }

  /**
   * Show popup message.
   * @method
   * @param {String} msg - message.
   * @return {Promise}
   */
  msg(msg) {
    return this.notify('host.showPopupNotification', [msg]);
  };
  
  /**
   * Promise a future event.
   * @constructor
   * @param {String} event - event name
   * @param {Array|String|Number|boolean} conditions - event name
   * @param {boolean} once
   * @param {Number} timeout
   * @return {Promise}
   */
  promise(event, conditions, once, timeout = 3000) {
    log('promise() expect event:', event, 'params:', conditions, 'timeout:', timeout);
    return new Promise((resolve, reject) => {
      let timerId, handler;
      if (typeof conditions !== 'undefined' && !Array.isArray(conditions)) {
        conditions = [conditions];
      };
      const cleanup = () => {
        clearTimeout(timerId);
        this.removeListener(event, handler);
      };
      timerId = setTimeout(() => {
        cleanup();
        log('promise() timeout event:', event, 'params:', conditions, 'timeout:', timeout);
        reject(new Error('operation timeout.'));
      }, timeout);
      handler = function() {
        let args = Array.prototype.slice.call(arguments);
        const ok = typeof conditions === 'undefined' ||
              conditions.every((e, i) => {return e === args[i];});
        log('promise() got event:', event, 'params:', args);
        if (ok) {
          log('promise() resolve event:', event, 'params:', args);
          cleanup();
          resolve(args);
        } else if (once) {
          log('promise() reject event:', event, 'params:', args);
          cleanup();
          reject(new Error(`event parameters are wrong. params:`));
        }
      };
      if (once) {
        this.once(event, handler);
      } else {
        this.on(event, handler);
      }
    });
  }
};
