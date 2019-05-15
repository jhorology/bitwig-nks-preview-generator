const child_process = require('child_process');
const WebSocket = require('rpc-websockets').Client;

/**
 * A remote client for Bitwigg Studio
 */
export default class BitwigStudio extends WebSocket {
  /**
   * Constructor.
   * @constructor
   * @param {String} url
   * @param {Obhect} options
   * @return {BitwigStudio}
   */
  constructor(url, options) {
    super(url, options);
    this.bounceFolder = path.join(path.dirname(opts.bwprojectFile), 'bounce');
  }

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
      command: '/Applications/Bitwig Studio.app/Contents/MacOS/BitwigStudio',
      port: 8887,
      timeout: 15000
    }, options);
    const childProcess = child_process.spawn(
      opts.command,
      args, {
        stdio: 'ignore'
      });
    const bitwig = new client(`ws//:localhost:${opts.port}`, {
      autoconnect: true,
      reconnect: true,
      max_reconnects: 0
    });
    await bitwig.promise('open', undefined, true, opts.timeout);
    if (config) {
      await bitwig.notify('rpc.config', config);
      await bitwig.promise('close', undefined, true);
      // wait for reconnect
      await bitwig.promise('open', undefined, true);
    }
    return bitwig;
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
        console.info('promise', args);
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
}
