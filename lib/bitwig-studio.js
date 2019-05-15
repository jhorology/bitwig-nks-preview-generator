const fs = require('fs');
const child_process = require('child_process');
const WebSocket = require('rpc-websockets').Client;

const wait = millis => {
  return new Promise(resolve => setTimeout(resolve, millis));
};

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
      console.log("# BitwigStudio process", 'close');
      bitwig.close();
    });
    childProcess.on('exit', () => {
      console.log("# BitwigStudio process", 'exit');
      bitwig.close();
    });
    await bitwig.promise('open', undefined, true, opts.timeoutBitwig);

    if (config) {
      await bitwig.notify('rpc.config', config);
      await bitwig.promise('close', undefined, true);
      // wait for reconnect
      await bitwig.promise('open', undefined, true);
    }
    return bitwig;
  }

  static async quit(url) {
    const ws = new WebSocket(url, {
      autoconnect: true,
      reconnect: false,
      max_reconnects: 0
    });
    ws.notify('application.getAction.invoke', ['Quit']);
    await wait(2000);
    ws.notify('application.getAction.invoke', ['Dialog: No']);
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
    console.log("# BitwigStudio.promise", event, timeout);
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
        reject(new Error('operation timeout.'));
      }, timeout);
      handler = function() {
        let args = Array.prototype.slice.call(arguments);
        const ok = typeof conditions === 'undefined' ||
              conditions.every((e, i) => {return e === args[i];});
        if (ok) {
          cleanup();
          resolve(args);
        } else if (once) {
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
