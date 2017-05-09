#!/usr/bin/env node

/*!
 * chromate cli
 *
 * @copyright 2017 Moos https://github.com/moos/chromate
 * @licence MIT
 */

var Chrome = require('../index').Chrome;
var Tab = require('../index').Tab;

var args = process.argv;
var me = require('path').basename(args[1]);
var cmd = args[2];
var url = args[3];
var verbose = args.some(x => /--verbose\b/.test(x));


function done(res) {
  res && console.log(res);
  process.exit(0);
}

function usage() {
  console.log('Usage:', me,
    'start [<chrome flags>] | list | kill <id> ... | killall | open <url> | list-tabs | close <tabId> | close-tabs  [--verbose]');
  process.exit();
}

if (!cmd) usage();

switch (cmd) {
  case 'start':
    var cargs = args.slice(3);
    Chrome.start({
      debug: !/--remote-debugging-port/.test(cargs.join()),
      verbose: verbose,
      chromeFlags: cargs
    }).then(chrome => {
      console.log(`${chrome.pid}: ${chrome.spawnargs.join(' ')}`);
      done();
    }, done);
    break;

  case 'kill':
    var pid = args.slice(3);
    if (!pid.length) done(me + ' kill <pid> ...');
    Chrome.kill(pid);
    break;

  case 'open':
    Tab.open(url, {
      failonerror: false,
      verbose: verbose
    }).then(tab => done(tab.client.target), done);
    break;

  case 'list-tabs':
    Tab.list().then(done, done);
    break;

  case 'close-tabs':
    Tab.closeAll().then(done, done);
    break;

  default:
    if (cmd in Chrome) {
      Chrome[cmd]().then(done, done);
    } else if (cmd in Tab) {
      Tab[cmd](args.slice(3)).then(done, done);
    } else {
      usage();
    }
}
