/*!
 * handle chrome process
 *
 * @copyright 2017 Moos https://github.com/moos/chromate
 * @licence MIT
 */

// TODO support --user-data-dir


/**
 * @constant {string} CHROME_BIN (Environment variable) location
 * of Chrome executable
 */

/**
 * @constant {string} CHROME_PORT (Environment variable) port to use
 */

/**
 * Path to Chrome executable.  Update for your system.
 *
 * @typedef {object}
 * @prop darwin {string} path for darwin platform
 * @prop linux {string} path for linux platform
 * @prop win32 {string} path for win32 platform
 */
var execPaths = {
  darwin: '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome',
  linux: '/opt/google/chrome-beta/chrome',  // TODO remove beta once 59 is out of beta
  win32: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
};


var execPaths_canary = {
  darwin: '/Applications/Google\ Chrome\ Canary.app/Contents/MacOS/Google\ Chrome\ Canary',
  linux: 'Chrome Canary is currently not available on the Linux platform. :(',
  win32: process.env.LOCALAPPDATA + '\\Google\\Chrome SxS\\Application\\chrome.exe'
};


var platform = process.platform;
var spawn = require('child_process').spawn;
var net = require('net');
var CDP = require('chrome-remote-interface');
var KILL_SIG = 'SIGTERM';
var fs = require('fs');


function getExecPath(canary) {
  var path = process.env.CHROME_BIN || (canary ? execPaths_canary[platform] : execPaths[platform]);
  if (!path) throw new Error('No Chrome path given for platform ' + platform);
  if (!fs.existsSync(path)) return '';
  return path;
}

function getPort() {
  return process.env.CHROME_PORT || 9222;
}

function delay(msecs) {
  return new Promise((resolve) => setTimeout(resolve, msecs));
}


function checkReady(options) {
  var proc,
    close = function () {
      proc.end();
      proc.unref();
      proc.destroy();
    };

  return new Promise((resolve, reject) => {
    proc = net.createConnection(options && options.port || Chrome.settings.port);
    proc.once('error', err => {
      close();
      reject(err);
    });
    proc.once('connect', () => {
      close();
      resolve();
    });
  });
}

// https://cs.chromium.org/chromium/src/headless/app/headless_shell_switches.cc

/**
 * @external ChildProcess
 * @see {@link https://nodejs.org/api/child_process.html#child_process_class_childprocess}
 */


/**
 * This is a static class - no ctor!
 *
 * @class Chrome
 */
var Chrome = module.exports = {

  /**
   * Default settings. May be overridden by passing options.
   *
   * @prop debug=true {boolean} start Chrome in remote debugging mode
   * @prop port=9222 {number} port number of Chrome instance.  Or set env variable CHROME_PORT.
   * @prop headless=true {boolean} start Chrome in headless mode (note: non-headless mode not tested!)
   * @prop disableGpu=true {boolean} passed --disable-gpu to Chrome
   * @prop execPath {string} override Chrome exec path, or set env variable CHROME_BIN
   * @prop chromeFlags {string[]} array of additional flags to pass to Chrome, e.g. ['--foo']
   * @prop canary=false {boolean} use Chrome Canary (must be installed on your system)
   * @prop retry=3 {number} no. of times to retry to see if Chrome is ready
   * @prop retryInterval=100 {number} msecs between retries (incl. first attempt)
   * @prop verbose=false {boolean} outputs additional logs
   *
   * @memberOf Chrome
   */
  settings: {
    debug        : true,
    port         : getPort(),
    headless     : true,
    disableGpu   : true,
    execPath     : getExecPath(),
    chromeFlags  : [],
    canary       : false,
    retry        : 3,
    retryInterval: 100,
    verbose      : false
  },

  /**
   * Default set of flags passed to Chrome.
   *
   * Source: https://github.com/GoogleChrome/lighthouse/blob/master/lighthouse-cli/chrome-launcher.ts#L64
   *
   * @var flags {Array.<String>}
   * @memberOf Chrome
   */
  flags: [
    // Disable built-in Google Translate service
    '--disable-translate',
    // Disable all chrome extensions entirely
    '--disable-extensions',
    // Disable various background network services, including extension updating,
    //   safe browsing service, upgrade detector, translate, UMA
    '--disable-background-networking',
    // Disable fetching safebrowsing lists, likely redundant due to disable-background-networking
    '--safebrowsing-disable-auto-update',
    // Disable syncing to a Google account
    '--disable-sync',
    // Disable reporting to UMA, but allows for collection
    '--metrics-recording-only',
    // Disable installation of default apps on first run
    '--disable-default-apps',
    // Skip first run wizards
    '--no-first-run'

    // Place Chrome profile in a custom location we'll rm -rf later
    //`--user-data-dir=TBD`
  ],

  /**
   * Start a Chrome process and wait until it's ready
   *
   * @param [options] {object} see settings
   * @returns {Promise.<external:ChildProcess>}
   * @memberOf Chrome
   */
  start: function (options) {
    options = Object.assign({}, Chrome.settings, options);

    var args = [];
    if (options.debug) args.push(`--remote-debugging-port=${options.port}`);
    if (options.headless) args.push('--headless');
    if (options.disableGpu) args.push('--disable-gpu');

    if (options.canary) options.execPath = getExecPath(true);

    if (options.chromeFlags) {
      args = args.concat(options.chromeFlags, Chrome.flags);
    }

    var proc = spawn(options.execPath, args, {
      detached: true
    });

    return new Promise((resolve, reject) => {
      ['error', 'disconnect', 'close'].forEach(ev => {
        proc.on(ev, res => {
          options.verbose && console.log('Chrome says:', ev, res || '');
          delay(50).then(() => reject(res));
        });
      });

      // give process time to start
      delay(options.retryInterval)
        .then(() => Chrome.ready(options))
        .then(() => {
          resolve(proc);
        })
        .catch(reject);
    });
  },

  /**
   * Is the process ready? Attempts to connect (with retry) to process.
   *
   * @param [options] {object} see settings for port, retry, and retryInterval
   * @returns {Promise} resolves or rejects if process is not ready
   * @memberOf Chrome
   */
  ready: function (options) {
    options = Object.assign({}, Chrome.settings, options);
    var tries = 1 + options.retry;
    return new Promise((resolve, reject) => {
      (function retry() {
        checkReady(options)
          .then(resolve)
          .catch(err => {
            if (--tries > 0) {
              delay(options.retryInterval).then(retry);
              return;
            }
            reject(err);
          });
      })();
    });
  },

  /**
   * Kill process(es)
   *
   * @param job {ChildProcess|number[]} spawned process (resolve value of start) or (array of) process ids
   * @memberOf Chrome
   */
  kill: function (job) {
    if (!job) return;
    if (job.kill) return job.kill(KILL_SIG);

    [].concat(job).forEach(function (id) {
      process.kill(id, KILL_SIG);
    });
  },

  /**
   * Kill all (headless) Chrome processes
   *
   * @returns {Promise.<Number>} no. of processes killed
   * @memberOf Chrome
   */
  killall: function () {
    return Chrome.list(true)
      .then(list => {
        list.forEach(function (ps) {
          process.kill(ps.pid, KILL_SIG);
        });

        return list.length;
      });
  },

  /**
   * List all (headless) Chrome processes (doesn't list Chrome's child processes)
   *
   * @param [all] {boolean} if given, list all processes (including child)
   * @returns {Promise.<Array>} list of processes
   * @memberOf Chrome
   */
  list: function (all) {
    var ps = require('ps-node');

    return new Promise((resolve, reject) => {
      var done = function(err, result) {
        if (err) reject(err);
        else resolve(result);
      };

      ps.lookup({
        command  : /chrome/i,
        arguments: '--headless',
        // psargs: 'ux'
      }, function (err, result) {
        if (err || !result || all) {
          return done(err, result);
        }

        // filter
        result = result.filter(res => {
          var ok = true;
          res.arguments.forEach(arg => {
            if (/--type=/.test(arg)) {
              ok = false;
            }
          });
          return ok;
        });

        done(err, result);
      });
    });
  },

  /**
   * Get Chrome version info
   *
   * @param [options] {object} options.port of Chrome process
   * @returns {Promise.<VersionInfo>}
   * @memberOf Chrome
   */
  version: function (options) {
    options = options || {};
    if (!options.port) {
      options.port = Chrome.settings.port;
    }
    return CDP.Version(options);
  },

  /**
   * Get available Chrome path, checking for existence.
   *
   * @param [options] {object} specify options.canary to prefer Chrome Canary.  Otherwise first checks regular Chrome.
   * @returns {string}
   * @memberOf Chrome
   */
  getExecPath: function (options) {
    var canary = options && options.canary;
    return (!canary && getExecPath()) ||
      getExecPath(true) ||
      (canary && getExecPath()) ||
      'No Chrome installation found';
  }

};
