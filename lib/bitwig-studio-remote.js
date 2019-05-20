const log = require('fancy-log');
const WebSocket = require('rpc-websockets').Client;


const wait = msec => {
  return new Promise(resolve => setTimeout(resolve, msec));
};

/**
 * A basic remote client class for Bitwig Studio
 * @class
 */
module.exports = class BitwigStudio extends WebSocket {
  /**
   * default connect() options.
   * @static
   * @type {Object}
   */
  static get defaultOptions() {
    return {
      url: 'ws://localhost:8887',
      timeout: 5000,
      client: BitwigStudio
    };
  }
  
  /**
   * connect() options descriptions
   * @static
   * @type {Object}
   */
  static get optionsDescriptions() {
    return {
      url: 'Bitwig Studio WebSockets URL.',
      timeout: 'timeout msec for connect Bitwig Studio.',
      client: 'Inherited Client class.'
    };
  }
  
  /**
   * Connect a Bitwig Studio application.
   * @static
   * @method
   * @param {Object} config - requirements configuration for RPC modules.
   * @param {class}  client - Inherit class of BitwigStudio
   * @param {Object} options
   * @return {Promise} - resolve client instance.
   */
  static async connect(config, options) {
    // default options
    const opts = Object.assign({}, this.defaultOptions, options);
    
    let bitwig;
    try {
      bitwig = new opts.client(opts.url, {
        autoconnect: true,
        reconnect: true,
        max_reconnects: 0
      });
      // wait for connect
      await bitwig.promise('open', undefined, true, opts.timeout);
      // requierments configuration
      console.log('########## config:', config);
      await bitwig.mergeConfig(Object.assign({}, config, {
        useAbbreviatedMethodNames: false,
        useApplication: true
      }));
      return bitwig;
    } catch (err) {
      if (bitwig) {
        bitwig.close();
      }
      log.error('connect() error:', err);
      throw err;
    }
  }

  /**
   * Get a current RPC configuration.
   * @property
   * @return {Object} - current RPC configuration.
   */
  get config() {
    return this._config; 
  }
  
  /**
   * Merge requierments configuration into current.
   * @method
   * @param {Object} config - requirements configuration.
   * @return {Promise} - resolve this instance.
   */
  async mergeConfig(config) {
    const currentConfig = await this.call('rpc.config');
    const fulfilled = Object.keys(config).every(key => {
      return config[key] === currentConfig[key];
    });
    if (fulfilled) {
      this._config = currentConfig;
    } else {
      this._config = Object.assign(currentConfig, config);
      await this.notify('rpc.config', this._config);
      // wait for restart rpc extension.
      await this.promise('close');
      // wait for reconnect
      await this.promise('open');
    }
    return this;
  }

  /**
   * Quit Bitwig Studio application.
   * @method
   * @param {Number} sec - shutdown warning seconds. 
   * @return {Promise} - resolve this instance.
   */
  async quit(sec = 5) {
    try {
      if (sec > 0) {
        let remains = sec;
        while(remains) {
          await this.msg(`Automatically shutdown Bitwig Studio after ${remains} seconds.`);
          await wait(1000);
          remains--;
        }
      }
      await this.action('Quit');
      await wait(500);
      await this.action('Dialog: No');
    } catch (err) {
      log.error('quite() error:', err);
      throw err;
    } finally {
      this.close();
    }
    return this;
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
   * @param {String} event - expect event name.
   * @param {Array|String|Number|boolean} conditions - expect event params.
   * @param {boolean} once
   * @param {Number} timeout - timeout msec, default = 3000.
   * @return {Promise} - resolve {Array} event params.
   */
  promise(event, conditions, once, timeout = 3000) {
    return new Promise((resolve, reject) => {
      let timerId, handler;
      const conds = typeof conditions !== 'undefined' && !Array.isArray(conditions) ?
            [conditions] : conditions;
      log('promise()', `expect event:${event} params:[${conds}] timeout:${timeout}`);
      const cleanup = () => {
        clearTimeout(timerId);
        this.removeListener(event, handler);
      };
      timerId = setTimeout(() => {
        cleanup();
        reject(new Error(`promise() operation timeout. expect event:${event} params:[${conds}]`));
      }, timeout);
      handler = function() {
        const args = Array.prototype.slice.call(arguments);
        const ok = typeof conds === 'undefined' ||
              conds.every((e, i) => {return e === args[i];});
        log(`promise() got event:${event} params:[${args}]`);
        if (ok) {
          cleanup();
          resolve(args);
        } else if (once) {
          cleanup();
          reject(new Error(`promise() event params are unexpeced. event:${event} expect:[${conds}] detect:[${args}]`));
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
