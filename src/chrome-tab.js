
var CDP = require('chrome-remote-interface');
var fs = require('fs');

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

/**
 * fire an event if a handler exists
 *
 * @param name
 * @param data
 * @param options
 * @returns {boolean} true if event was handled, false otherwise
 * @ignore
 */
function fireEvent(name, data, options) {
  if (name in options.events) {
    return options.events[ name ](data, options);
  }
  return false;
}

function newTab(client, targetUrl, options) {
  var opts = Object.assign({}, Tab.settings, options || {});

  // this is so we can pass back options!
  options = Object.assign(options || {}, opts);
  options.client = client;

  fireEvent('ready', client, options);

  return new Promise((resolve, reject) => {
    // make promise available to event handlers
    options.promise = {
      resolve: resolve,
      reject: reject
    };

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
      fireEvent('load', param, options);
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
      if (fireEvent(result.event, result.data, options) !== false) return;

      // else
      switch (result.event) {
        case 'done':
          options.verbose && console.log('-> done', result.data)

          if (options.screenshot) screenCapture(client, options).then(() => resolve(result.data));
          else resolve(result.data);
          break;

        default:
          options.verbose && console.log('CONSOLE: (UNHANDLED MESSAGE)', result);
      }
    });

    if (options.verbose) client.Runtime.exceptionThrown(res => {
      console.log('EXCEPTION', res)
    });

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
      if (!options.waitForDone) {
        resolve(client);
      }
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

/**
 * @namespace Tab
 */
var Tab = module.exports = {

  /**
   * Default settings. May be overridden by passing in options.
   *
   * @prop port=9222 {number} port number of Chrome instance.  Or set env variable CHROME_PORT.
   * @prop failonerror=true {boolean} stop processing and close tab in case of network or other errors
   * @prop verbose=false {boolean} log info and console.logs
   * @prop screenshot=false {boolean} take a screenshot (WIP!)
   * @prop viewport=width:680,height:800 {object} window width & height
   * @prop waitForDone=true {boolean} set to false to have tab not wait for a 'done' event
   *   from the target and close immediately
   * @prop events {object} event handlers of type {event: handler}.  Standard events include
   *   'init' & 'load'.  Target may fire any number of custom events via
   *   console.debug({event, data}).  A 'done' event will close the tab.
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
    waitForDone: true,
    events     : {}
  },

  /**
   * get a CDP client
   *
   * @returns {Promise.<Client>}
   */
  getClient: getClient,

  /**
   * open a new tab on given client
   *
   * @param client
   * @param url
   * @param options
   * @returns {Promise} with
   */
  newTab: newTab,

  /**
   * open a new tab at url.
   *
   * Target url may close the tab by issuing a console.debug({event:'done', data:{}}) event.
   *
   * Caller may close the tab by Tab.close(options.client.target.id)
   *
   * @param url {string} url to load in tab
   * @param [options] {object} see settings
   * @returns {Promise.<result|client>} if options.waitForDone is true, waits for 'done' event
   *   from the target page and returns the result.  Otherwise, returns the
   *   <a href="https://github.com/cyrus-and/chrome-remote-interface#cdpnewoptions-callback">CDP client</a> object.
   *
   * @emits 'init' (tab initiated), 'load' (page loaded) and 'done' and other custom events
   * as fired by the target page.
   * @memberOf Tab
   */
  open: function (url, options) {
    var client;
    var close = function(result) {
      if (!client) return result;
      options.verbose && console.log('-> Closing', client.target.id, result.target || result);
      client.close();
      return CDP.Close({id: client.target.id}).then(() => result);
    };

    return getClient(options)
      .then(cl => {
        client = cl;
        return newTab(client, url, options);
      })
      .then(close)
      .catch(err => {
        options.verbose && console.log('-> Exception', err);
        close('');
        throw err;
      });
  },

  /**
   * list all open tabs
   *
   * @param [options] {object} {port} no.
   * @returns {Promise.<Array>} with tabs array
   * @memberOf Tab
   */
  list: function (options) {
    options = options || {port: Tab.settings.port};
    return CDP.List(options);
  },

  /**
   * close a tab
   *
   * @param tabId {string} id of tab to close
   * @param [options] {object} {port} no.
   * @returns {Promise}
   * @memberOf Tab
   */
  close: function (tabId, options) {
    return CDP.Close({
      id: tabId,
      port: options && options.port || Tab.settings.port
    });
  },

  /**
   * close all tabs
   *
   * @returns {Promise.<Number>} no. of tabs closed
   * @memberOf Tab
   */
  closeAll: function () {
    return Tab.list().then(tabs => {
      return tabs.map(tab => Tab.close(tab.id));
    })
      .then(promises => Promise.all(promises))
      .then(x => x.length);
  }

};
