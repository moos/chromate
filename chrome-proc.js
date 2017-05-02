/**
 * handle chrome process
 *
 * CLI Usage:
 *    node chrome-proc.js  start [<chrome flags>]| list | kill <id> ... | killall
 *
 * or
 *
 *    CHROME_BIN=<path to chrome> node chrome-proc.js  start ...
 *
 * @copyright moos
 * MIT License
 */

/**
 * Path to Chrome executable.  Update for your system.
 */
var execPaths = {
  Darwin: '/Applications/Google\ Chrome\ Canary.app/Contents/MacOS/Google\ Chrome\ Canary',
  Linux: '/opt/google/chrome/chrome',
  Windows_NT: 'C:\Program Files (x86)\Google\Chrome\Application\chrome'
};

/**
 * Search query teerm for list().
 */
var psQuery = {
  Darwin: 'Canary.app',
  Linux: 'chrome',
  Windows_NT: 'chrome'
};

var ostype = require('os').type();
var spawn = require('child_process').spawn;
var KILL_SIG = 'SIGTERM';

function getExecPath() {
  return process.env.CHROME_BIN || execPaths[ostype];
}

var Chrome = module.exports = {

  /**
   * @typedef Chrome.settings
   */
  settings: {
    debug     : true,
    port      : 9222,
    headless  : true,
    disableGpu: true,
    execPath  : getExecPath()
  },

  /**
   * start a Chrome process
   *
   * @param options
   * @returns {*}
   */
  start: function (options) {
    options = Object.assign({}, Chrome.settings, options);

    var args = [];
    if (options.debug) args.push([`--remote-debugging-port=${options.port}`]);
    if (options.headless) args.push('--headless');
    if (options.disableGpu) args.push('--disable-gpu');

    if (options.chromeflags) {
      args = args.concat(options.chromeflags);
    }

    return spawn(options.execPath, args, {
        detached: true
        // stdio: ignore
    });
  },

  /**
   * kill
   * @param job - spawned process or (array of) process ids (return value of start)
   */
  kill: function (job) {
    if (!job) return;
    if (job.kill) return job.kill(KILL_SIG);

    [].concat(job).forEach(function (id) {
      process.kill(id, KILL_SIG);
    })
  },

  /**
   * kill all (headless) Chrome processes
   */
  killall: function () {
    Chrome.list(function(err, list) {
      if (err) return console.log(err);

      list.forEach(function (ps) {
        process.kill(ps.pid, KILL_SIG);
      })
    });
  },

  /**
   * list all (headless) Chrome processes
   *
   * @param cb {function} call back, receives (err, result)
   */
  list: function (cb) {
    var ps = require('ps-node');
    return ps.lookup({
      command: psQuery[ostype],
      arguments: '--headless',
      // psargs: 'ux'
    }, function (err, result) {
      if (cb) cb(err, result)
      else console.log(err || result);
    })
  }
};


// cli
if (require.main === module) {
  var args = process.argv;
  var cmd = args[2];
  if (!cmd) {
    console.log('Usage:', require('path').basename(args[1]), 'start [<chrome flags>]| list | kill <id> ... | killall');
  } else if (cmd === 'start') {
    var p = Chrome.start({
      chromeflags: args.slice(3)
    });
    console.log(`${p.pid}: ${p.spawnargs.join(' ')}`);
    process.exit(0);
  } else if (cmd === 'kill') {
    Chrome.kill(args.slice(3));
  } else {
    console.log(Chrome[cmd]() || '');
  }
}
