/*!
 * handle chrome tabs
 *
 * @copyright 2017 Moos https://github.com/moos/chromate
 * @licence MIT
 */

var CDP = require('chrome-remote-interface');
var fs = require('fs');
var unmirror = require('chrome-unmirror');


/**
 * @external EventEmitter
 * @see {@link https://nodejs.org/api/events.html#events_class_eventemitter}
 */
var EventEmitter = require('events').EventEmitter;

const outputPath = 'screenshot.png';

/**
 * Function loaded in target to communicate back to runner.
 *
 * @example
 *   // in target
 *   if (window.__chromate) __chromate({event: 'done', data: {pass: 10, fail: 1}});
 *
 * @function __chromate
 */
var __CHROMATE = ';if (!window.__chromate) window.__chromate = function (msg){ console.debug(JSON.stringify(msg||""))};';


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
  var timer;
  var fireEvent = function () {
    if (!self || !self.emit) return;
    return self.emit.apply(self, arguments);
  };
  var fulfilled = false;
  var fulfill  = function (fn, result) {
    if (timer) clearTimeout(timer);
    fulfilled = true;
    fn(result);
  };
  var print = function () {
    options.verbose && console.log.apply(console, arguments);
  };

  options = Object.assign({}, Tab.settings, options || {});

  return new Promise((resolve, reject) => {

    // set timer
    if (options.timeout) {
      timer = setTimeout(function () {
        clearTimeout(timer);
        if (!fulfilled) {
          reject(new Error(`Tab timed out at ${options.timeout} msec (${client.target.id}, ${client.target.url}).`));
        }
      }, options.timeout);
    }

    client.Emulation.setVisibleSize({
      width : options.viewport.width,
      height: options.viewport.height,
    });

    if (options.verbose) {
      client.Network.requestWillBeSent(params => {
        const url = params.request.url;
        print(`-> ${params.requestId} ${params.request.method} ${url.substring(0, 150)}`);
      });
    }

    client.Network.loadingFailed(params => {
      // console.log('loadingFailed:', params.requestId, params.errorText);
    });

    if (options.verbose > 1) client.Network.loadingFinished(params => {
      print('<-', params.requestId, params.encodedDataLength);
    });

    client.Page.loadEventFired(param => {
      print('-> loadEventFired');
      fireEvent('load', param, self);

      if (!options.waitForDone) fulfill(resolve,self);
    });

    // add helper method to target for comm with runner
    client.Page.addScriptToEvaluateOnLoad({
      scriptSource: __CHROMATE
    });

    client.Log.entryAdded((entry) => {
      var e = entry.entry;
      print(`--> ${e.networkRequestId} ${e.source} ${e.level}: ${e.text} (${e.url})`);

      if (entry.entry.level === 'error' && options.failonerror) {
        console.log('--> ', entry);
        fulfill(reject, entry.entry);
      }
    });

    // mirror console.log() and listen for console.debug()
    client.Runtime.consoleAPICalled(res => {
      var isDebug = res.type === 'debug';
      var msg, event, handled, result;

      if (!isDebug) {
        msg = messageToString(res);
        print('CONSOLE:', msg);
        result = {
          type: res.type,
          text: msg
        };
        handled = fireEvent(`console.${res.type}`, result , self);
        if (!handled) fireEvent('console', result, self);
        return;
      }

      // handle console.debug({event, data}) call from target
      result = {};
      var arg = res.args[0];

      if (arg.type === 'object' && !Array.isArray(arg.value) && arg.value !== null) {
        // NOTE: preview is limited to 100 characters!!!
        result = parsePreview(arg);

      } else if (arg.type === 'string') { // data passed via __chromate is JSON.stringify'd
        result = tryJsonParse(arg.value);

      } else {
        result = arg.value;
      }

      event = (result || {}).event;
      if (!event) event = 'data';

      // event handled?
      handled = fireEvent(event, result, self);

      // special handling for 'done'
      switch (event) {
        case 'abort':
          if (!handled) {
            print('-> Aborting.  code:', result.code);
            process.exit('code' in result ? result.code : -1);
          }
          break;
        case 'done':
          print('DONE', result)
          self.result = result;

          if (!options.waitForDone) break;

          if (options.screenshot) screenCapture(client, options).then(() => fulfill(resolve, self));
          else fulfill(resolve, self);
          break;

        default:
          !handled && print('CONSOLE: (UNHANDLED MESSAGE)', result);
      }
    });

    client.Runtime.exceptionThrown(res => {
      print('EXCEPTION', res);
      fireEvent('exception', res, self);
    });

    // list of client promises to await
    self.clientPromises = [
      client.Network.enable(),
      client.Page.enable(),
      client.Log.enable(),
      client.Runtime.enable(),
      // client.Debugger.enable()
    ];

    // fire ready event -- allowing caller to override any of the above
    fireEvent('ready', self);

    Promise.all(self.clientPromises)
    .then(() => {
      print('-> Navigate to', targetUrl)
      return client.Page.navigate({url: targetUrl});
    })
    .then(frameId => {
      options.frameId = frameId;
      return self;
    })
    .catch((err) => {
      // console.error(`ERROR: ${err.message}`, err);
      fulfill(reject, err);
    });
  });
}

function tryJsonParse(data) {
  try {
    return JSON.parse(data);
  } catch (e) {
  }
  return data;
}

/**
 * parse a CDP 'preview' object consisting of {name, type, value}
 * @param arg
 * @returns {object|array}
 * @ignore
 */
function parsePreview(arg) {
  var out = {};

  if (arg.subtype === 'array') {
    return unmirror(arg);
  }

  arg.preview.properties.forEach(o => {
    // console.log(66, o.name, o.value)
    if (o.name === 'data') {
      out[o.name] = tryJsonParse(o.value);
    } else {
      out[o.name] = o.value;
    }
  });
  return out;
}

// NOTE preview is limited to 100 chars!
function messageToString(res) {
  return res.args.map((arg) => {
    return arg.value ||
      (arg.subtype === 'array' || arg.className === 'Object'
        ? JSON.stringify(parsePreview(arg))
        : arg.description) || arg.preview || '';
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

/**
 * Tab client is ready.  Handlers get <code>(tab)</code>.  Note: this
 * overrides the CDP 'ready' event.
 * @event 'ready'
 * @memberOf Tab
 */

/**
 * Page loaded.  Handlers get <code>(data, tab)</code>.
 * @event 'load'
 * @memberOf Tab
 */

/**
 * Events fired by CDP.  See [CDP events](https://github.com/cyrus-and/chrome-remote-interface#class-cdp).
 * @event 'event'
 * @memberOf Tab
 */

/**
 * console.&lt;type&gt; was called, where &lt;type&gt; is one of <code>log|info|warn|error|debug</code>.
 * Handlers get <code>({type, text}, tab)</code>
 * @event 'console.&lt;type&gt;'
 * @memberOf Tab
 */

/**
 * console.&lt;type&gt; was called and no type-specific handler was found.
 * @event 'console'
 * @memberOf Tab
 */

/**
 * An uncaught exception was thrown.  Handlers get <code>(exception, tab)</code>.
 * @event 'exception'
 * @memberOf Tab
 */

/**
 * Target is requesting a process abort. If no handler is found, a
 *   process.exit(code) is issued.  Handlers get <code>(message, tab)</code>.
 * @event 'abort'
 * @memberOf Tab
 */

/**
 * Unhandled calls to __chromate() or console.debug().  Handlers get <code>(message, tab)</code>.
 * @event 'data'
 * @memberOf Tab
 */

/**
 * 'done' (and other custom events) as fired by the target page.
 * Handlers get <code>(message, tab)</code>.
 * @event 'done'
 * @memberOf Tab
 */


class Tab extends EventEmitter {
  /**
   * @param [options] {object} see settings
   * @constructor
   * @extends external:EventEmitter
   */
  constructor(options) {
    super(); //must call super for "this" to be defined.

    this.options = Object.assign({}, Tab.settings, options || {});
  }

  /**
   * Open a new tab at url.
   *
   * See also: events fired by <a href="https://github.com/cyrus-and/chrome-remote-interface#class-cdp">CDP</a>.
   *
   * Note that tab.client is the <a href="https://github.com/cyrus-and/chrome-remote-interface#cdpnewoptions-callback">CDP client</a> object.
   *
   * Target may fire any number of custom events via
   * <code>console.debug({event, data})</code>.
   *
   * @param targetUrl="about:blank" {string} url to load in tab
   * @returns {Promise.<Tab>} Resolved as soon as the page loads.  If <code>options.waitForDone</code> is true,
   *   waits for 'done' event from the target page before resolving.
   *   The data from the 'done' event is available as tab.result.
   * @emits see {@link Tab#events}
   *
   * @memberOf Tab
   */
  open(targetUrl) {
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

    this.targetUrl = targetUrl || 'about:blank';

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

  /**
   * Execute a (named) function in target and get the result.
   *
   * The function should return simple text values or use JSON.stringify.
   *
   * Pass <code>options.awaitPromise</code> if the function returns a Promise.
   *
   * @param func {string|function} function name in target, or function, to execute in target.
   * @param args {...any} additional arguments to pass to function
   * @param options {object} options to pass to client.Runtime.evaluate().
   * @returns {Promise.<result>} Promise gets return value of function.  Objects
   *   (including Arrays) should be JSON.stringify'd.
   * @example
   *   tab.execute('getResults').then(result => console.log )  // {a:1}
   *
   *   // in target:
   *   function getResult() { return JSON.stringify({a:1}); }
   *
   * @example
   *   tab.execute(function(){ return document.title })
   *    .then(result => console.log) // -> foo bar
   *
   *   // in target html:  <title>foo bar</title>
   */
  execute(func /*, args, ...*/) {
    var args = Array.from(arguments);
    args.shift();

    // convert function to string to pass to target
    if (typeof func === 'function') {
      func = `(${String(func)})`;
    }

    // check for options
    var options = arguments.length > 1 && arguments[arguments.length - 1];
    if (options &&
      typeof options === 'object' &&
        /awaitPromise|userGesture|returnByValue|generatePreview|contextId|includeCommandLineAPI|objectGroup|expression/.test(Object.keys(options).join())
    ) {
      args.pop();
    } else {
      options = {};
    }

    // map args
    args = args.map(arg => {
      if (typeof arg === 'number') return arg;
      return JSON.stringify(arg);
    });
    args = `(${args.join()})`;

    return this.evaluate(func + args, options);
  }

  /**
   * Evaluate an expression in target and get the result.
   *
   * @param expr {string} expression in target to evaluate
   * @param options {object} options to pass to client.Runtime.evaluate().
   * @returns {Promise.<result>} Promise gets return value of expression.
   *
   * @example
   *   // Objects must be evaluated using JSON.stringify:
   *   tab.evaluate('JSON.stringify( data )').then(result => console.log) // data object
   *
   * @example
   *   tab.evaluate('one + two').then(result => console.log) // 3
   *
   *   // in target
   *   var one = 1;
   *   var two = 2;
   */
  evaluate(expr, options) {
    options = options || {};
    options.expression = expr;
    return this.client.Runtime.evaluate(options)
      .then(res => {
        let value = res.result.value || res.result.description;
        try {
          value = JSON.parse(res.result.value);
        } catch (e) {
        }
        return value;
      });
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
   * @prop timeout=0 {number} tab rejects and closes after this time in msec (0 to disable)
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
    waitForDone: false,
    timeout: 0
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
    return new Tab(options).open(targetUrl);
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
