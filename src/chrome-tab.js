/*!
 * handle chrome tabs
 *
 * @copyright 2017 Moos https://github.com/moos/chromate
 * @licence MIT
 */

var CDP = require('chrome-remote-interface');
var fs = require('fs');

/**
 * @external EventEmitter
 * @see {@link https://nodejs.org/api/events.html#events_class_eventemitter}
 */
var EventEmitter = require('events').EventEmitter;

const outputPath = 'screenshot.png';


function getPort() {
  return process.env.CHROME_PORT || 9222;
}

function getClient(options) {
  if (!options || !options.port) {
    options = Object.assign(options || {}, {port: Tab.settings.port});
  }

  return CDP.New(options).then((tab) => {
    return CDP({target: tab});
  });
}

function closeTab(tabId, options) {
  return CDP.Close({
    id  : tabId,
    port: options && options.port || Tab.settings.port
  });
}

function newTab(client, targetUrl, options) {
  var self = this;
  var fireEvent = function () {
    if (!self || !self.emit) return;
    return self.emit.apply(self, arguments);
  };

  options = Object.assign({}, Tab.settings, options || {});

  return new Promise((resolve, reject) => {

    client.Emulation.setVisibleSize({
      width : options.viewport.width,
      height: options.viewport.height,
    });

    if (options.verbose) {
      client.Network.requestWillBeSent(params => {
        const url = params.request.url;
        console.log(`-> ${params.requestId} ${params.request.method} ${url.substring(0, 150)}`);
      });
    }

    client.Network.loadingFailed(params => {
      // console.log('loadingFailed:', params.requestId, params.errorText);
    });

    if (options.verbose) client.Network.loadingFinished(params => {
      console.log('<-', params.requestId, params.encodedDataLength);
    });

    client.Page.loadEventFired(param => {
      options.verbose && console.log('-> loadEventFired');
      fireEvent('load', param, self);

      if (!options.waitForDone) resolve(self);
    });

    client.Log.entryAdded((entry) => {
      var e = entry.entry;
      if (options.verbose) {
        console.log(`-> ${e.networkRequestId} ${e.source} ${e.level}: ${e.text} (${e.url})`);
      }

      if (entry.entry.level === 'error' && options.failonerror) {
        console.log('-> ', entry);
        reject(entry.entry);
      }
    });

    // mirror console.log() and listen for console.debug()
    client.Runtime.consoleAPICalled(res => {
      var isDebug = res.type === 'debug';

      if (options.verbose && !isDebug) {
        console.log('CONSOLE:', messageToString(res));
      }

      if (!isDebug) return;

      // handle console.debug({event, data}) call from target
      var result = parsePreview(res.args[0].preview);

      // event handled?
      var handled = fireEvent(result.event, result.data, self);

      switch (result.event) {
        case 'done':
          options.verbose && console.log('-> done', result.data)
          self.result = result.data;

          if (!options.waitForDone) break;

          if (options.screenshot) screenCapture(client, options).then(() => resolve(self));
          else resolve(self);
          break;

        default:
          !handled && options.verbose && console.log('CONSOLE: (UNHANDLED MESSAGE)', result);
      }
    });

    if (options.verbose) client.Runtime.exceptionThrown(res => {
      console.log('EXCEPTION', res)
    });

    // fire ready event -- allowing caller to override any of the above
    fireEvent('ready', self);

    Promise.all([
      client.Network.enable(),
      client.Page.enable(),
      client.Log.enable(),
      client.Runtime.enable(),
      // client.Debugger.enable()
    ])
    .then(() => {
      options.verbose && console.log('-> Navigate to', targetUrl)
      return client.Page.navigate({url: targetUrl});
    })
    .then(frameId => {
      options.frameId = frameId;
      return self;
    })
    .catch((err) => {
      // console.error(`ERROR: ${err.message}`, err);
      reject(err);
    });
  });
}

/**
 * parse a CDP 'preview' object consisting of {name, type, value}
 * @param prev
 * @returns {object}
 * @ignore
 */
function parsePreview(prev) {
  var out = {};
  prev.properties.forEach(o => {
    if (o.name === 'data') {
      out[o.name] = JSON.parse(o.value);
    } else {
      out[o.name] = o.value;
    }
  });
  return out;
}

function messageToString(res) {
  return res.args.map((arg) => {
    return arg.value || arg.preview || '';
  }).join(' ');
}

function screenCapture(client, options) {
  return client.Page.captureScreenshot().then(
    v => {
      options.verbose && console.log('writing screenshot to', outputPath, v);
      fs.writeFileSync(outputPath, Buffer.from(v.data, 'base64'));
      options.verbose && console.log(`Image saved as ${outputPath}`);
    }
  );
}


class Tab extends EventEmitter {
  /**
   * @param targetUrl="about:blank" {string} url to load in tab
   * @param [options] {object} see settings
   * @constructor
   * @extends external:EventEmitter
   */
  constructor(targetUrl, options) {
    super(); //must call super for "this" to be defined.

    this.options = Object.assign({}, Tab.settings, options || {});
    this.targetUrl = targetUrl || 'about:blank';
  }

  /**
   * Open a new tab at url.
   *
   * @emits 'ready' - tab client is ready.  Handlers get (this).
   * @emits 'load' - page loaded.  Handlers get (data, this).
   * @emits 'done' and other custom events as fired by the target page. Handlers get (data, this).
   *
   * See also: events fired by <a href="https://github.com/cyrus-and/chrome-remote-interface#class-cdp">CDP</a>.
   *
   * Target may fire any number of custom events via
   * <tt>console.debug({event, data})</tt>.
   *
   * @returns {Promise.<this>} Resolved as soon as the page loads.  If options.waitForDone is true,
   *   waits for 'done' event from the target page before resolving.
   *   The data from the 'done' event is available as this.result.
   *
   * Note that this.client is the <a href="https://github.com/cyrus-and/chrome-remote-interface#cdpnewoptions-callback">CDP client</a> object.
   *
   * @memberOf Tab
   */
  open() {
    var self = this;
    var options = this.options;
    var close = function (result) {
      if (!self.client || result === self) return result;
      return self.close().then(() => result);
    };

    var pipeClientEvents = function(client) {
      client.on('event', function (message) {
        if (message.method) {
          self.emit('event', message);
          self.emit(message.method, message.params);
        }
      });
      return Promise.resolve(client);
    };

    return getClient(options)
      .then(pipeClientEvents)
      .then(client => {
        this.client = client;
        return newTab.bind(this)(this.client, this.targetUrl, options);
      })
      .catch(err => {
        options.verbose && console.log('-> Exception', err);
        close('');
        throw err;
      });
  }

  /**
   * Close a tab opened by open()
   *
   * @returns {Promise}
   * @memberOf Tab
   */
  close() {
    var target = this.client && this.client.target || {};
    if (this.options.verbose) {
      console.log('-> Closing', target.id);
    }
    return closeTab(target.id, this.options);
  }
}

Object.assign(Tab, {
  /**
   * Default settings. May be overridden by passing in options.
   *
   * @prop port=9222 {number} port number of Chrome instance.  Or set env variable CHROME_PORT.
   * @prop failonerror=true {boolean} stop processing and close tab in case of network or other errors
   * @prop verbose=false {boolean} log info and console.logs
   * @prop screenshot=false {boolean} take a screenshot (WIP!)
   * @prop viewport=width:680,height:800 {object} window width & height
   * @prop waitForDone=false {boolean} set to true to have tab wait for a 'done' event
   *   from the target.  The result is returned in tab.result.
   *
   * @memberOf Tab
   */
  settings: {
    port       : getPort(),
    failonerror: true,
    verbose    : false,
    screenshot : false,
    viewport   : {
      width : 680,
      height: 800
    },
    waitForDone: false
  },

  /**
   * Get a CDP client
   *
   * @returns {Promise.<Client>}
   * @ignore
   */
  getClient: getClient,

  /**
   * Open a new tab on given client
   *
   * @param client
   * @param url
   * @param options
   * @returns {Promise}
   * @ignore
   */
  newTab: newTab,

  /**
   * List all open tabs
   *
   * @param [options] {object} options.port of Chrome process
   * @returns {Promise.<Array>} of tab objects
   * @memberOf Tab
   */
  list: function (options) {
    options = options || {};
    if (!options.port) {
      options.port = Tab.settings.port;
    }
    return CDP.List(options);
  },

  /**
   * Open a tab at target url.  Short hand for new Tab(url, opt).open().
   *
   * @param targetUrl="about:blank" {string} url to load in tab
   * @param [options] {object} see settings
   * @returns {Promise.<Tab>}
   * @memberOf Tab
   */
  open: function (targetUrl, options) {
    return new Tab(targetUrl, options).open()
  },

  /**
   * Close a tab with given tab Id.
   *
   * @param tabId {string} id of tab to close
   * @param [options] {object} options.port of Chrome process
   * @returns {Promise}
   * @memberOf Tab
   * @function
   */
  close: closeTab,

  /**
   * Close all tabs
   *
   * @param [options] {object} {port} no.
   * @returns {Promise.<Number>} no. of tabs closed
   * @memberOf Tab
   */
  closeAll: function (options) {
    return Tab.list().then(tabs => {
      return tabs.map(tab => closeTab(tab.id, options));
    })
      .then(promises => Promise.all(promises))
      .then(x => x.length);
  }
});


module.exports = Tab;
