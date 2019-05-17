const log = require('fancy-log');
const WebSocket = require('rpc-websockets').Client;

const wait = millis => {
  return new Promise(resolve => setTimeout(resolve, millis));
};

/**
 * A basic client for Bitwig Studio
 */
module.exports = class BitwigStudio extends WebSocket {
  /**
   * Connect a Bitwig Studio application.
   * @static
   * @async
   * @method
   * @param {Object} config - configuration of rpc modules
   * @param {Object} options
   * @param {class}  client - Inherit class of BitwigStudio
   * @return {BitwigStudio}
   */
  static async connect(config, client = BitwigStudio, options = {}) {
    const opts = Object.assign({
      url: 'ws://localhost:8887',
      timeout: 30000
    }, options);
    let bitwig;
    try {
      bitwig = new client(opts.url, {
        autoconnect: true,
        reconnect: true,
        max_reconnects: 0
      });
      // wait for connect
      await bitwig.promise('open', undefined, true, opts.timeout);
      await bitwig.mergeConfig(Object.assign({}, config, {
        useAbbreviatedMethodNames: false,
        useApplication: true
      }));
      return bitwig;
    } catch (err) {
      if (bitwig) {
        bitwig.close();
      }
      log.error('rpc connect error:', err);
      throw err;
    }
  }
  
  /**
   * Merge requierments configuration.
   * @method
   * @param {Object} config - requirements configuration.
   * @return {Promise}
   */
  async mergeConfig(config) {
    const currentConfig = await this.call('rpc.config');
    const fulfilled = Object.keys(config).every(key => {
      return config[key] === currentConfig[key];
    });
    if (fulfilled) {
      this.config = currentConfig;
    } else  {
      this.config = Object.assign(currentConfig, config);
      await this.notify('rpc.config', this.config);
      // wait for restart rpc extension.
      await this.promise('close');
      // wait for reconnect
      await this.promise('open');
    }
  }

  /**
   * Quit Bitwig Studio application.
   * @async
   * @method
   */
  async quit() {
    try {
      let seconds = 5;
      while(seconds) {
        await this.msg(`Automatically shutdown Bitwig Studio after ${seconds} seconds.`);
        await wait(1000);
        seconds--;
      }
      await this.action('Quit');
      await wait(500);
      await this.action('Dialog: No');
    } catch (err) {
      console.log('quite() error:', err);
    } finally {
      this.close();
    }
  }

  /**
   * Invoke a action.
   * @method
   * @param {String} id - action id.
   * @return {Promise}
   */
  action(id) {
    log('bitwig invoke action:', id);
    return this.notify('application.getAction.invoke', [id]);
  }

  /**
   * Show popup message.
   * @method
   * @param {String} msg - message.
   * @return {Promise}
   */
  msg(msg) {
    log('bitwig popup notification:', msg);
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
        reject(new Error(`operation timeout. event:${event} expect:[${conditions}]`));
      }, timeout);
      handler = function() {
        let args = Array.prototype.slice.call(arguments);
        const ok = typeof conditions === 'undefined' ||
              conditions.every((e, i) => {return e === args[i];});
        log('promise() got event:', event, 'params:', args);
        if (ok) {
          cleanup();
          resolve(args);
        } else if (once) {
          cleanup();
          reject(Error(`event parameters are unexpeced. event:${event} expect:[${conditions}] detect:[${args}]`));
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
