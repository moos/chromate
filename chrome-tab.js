var cri = require('chrome-remote-interface');
var tabManagerP;

var fs = require('fs');

let viewportSize = {
  width: 680,
  height: 800,
};

const outputPath = 'screenshot.png';


function getTabManager() {
  if (tabManagerP) return tabManagerP;

  tabManagerP = new Promise((resolve, reject) => {
    const emitter = cri({target: `ws://localhost:${9222}/devtools/browser`}, resolve);
    emitter.once('disconnect', () => {
      tabManagerP = null;
      reject(new Error('Tabmanager disconnected'));
    });
    emitter.once('error', error => {
      tabManagerP = null;
      reject(error);
    });
  });
  return tabManagerP;
}

function executeInTab(workFn) {
  return getTabManager()
    .then(tabManager => {
      return tabManager.Target.createTarget({ url: 'about:blank' })
        .then(({ targetId }) => {
          return cri.List({ port: 9222 })
            .then(list => {
              // console.log(1111, list)
              var url = list.find(target => target.id === targetId).webSocketDebuggerUrl;
              console.log('url', url);
              return cri({ tab: url });
            })
            .then(devtools => workFn(devtools))
            .then(result => {
              console.log('closing tab with targetId', targetId)
              return tabManager.Target.closeTarget({ targetId })
                .then(() => result);
            }, error => {
              return tabManager.Target.closeTarget({ targetId })
                .then(() => {
                  throw error;
                });
            });
        });
    });
}

function init(client, targetUrl) {
  return new Promise((resolve, reject) => {
    const {Emulation, Network, Page, Log, Runtime} = client;
    // console.log('init', targetUrl);

    Emulation.setVisibleSize({
      width : viewportSize.width,
      height: viewportSize.height,
    });

    Network.requestWillBeSent(params => {
      const url = params.request.url;
      console.log(`-> ${params.requestId} ${url.substring(0, 150)}`);
    });

    Network.loadingFailed(params => {
      // console.log('*** loadingFailed: ', params.requestId, params.errorText);
    });

    if (0) Network.loadingFinished(params => {
      console.log('<-', params.requestId, params.encodedDataLength);
    });

    Page.loadEventFired(() => {
        console.log('loadEventFired!');
        // Runtime.evaluate({expression: 'window.location.toString()'}).then((a)=>console.log(111, a));
      }
    );

    Log.entryAdded((entry) => {
      console.log('--log: ', entry);
      if (entry.entry.level === 'error') reject(entry.entry);
    });

    var data = {};
    Runtime.consoleAPICalled(res => {
      // TODO more than 1 args
      console.log('CONSOLE:',
        res.args[0].value || res.args[0].preview,
        res.args.length > 1 ? res.args[1].value || res.args[1].preview : ''
      );

      switch (res.args[0].value) {
        case 'msg:coverage':
          data.coverate = res.args[2];
          break;

        case 'msg:qunitDone':
          data.name = res.args[1].value;
          data.result = JSON.parse(res.args[2].value);

          // screenCapture(client).then(() => resolve(data));
          resolve(data);
          break;
      }
    });

    Runtime.exceptionThrown(res => {
      console.log('EXCEPTION', res)
      // reject(res);
    });

    Promise.all([
      Network.enable(),
      Page.enable(),
      Log.enable(),
      Runtime.enable()
    ]).then(() => {
      console.log('Page.navigate', targetUrl)
      return Page.navigate({url: targetUrl});
    })
    .catch((err) => {
      console.error(`ERROR: ${err.message}`);
      client.close();
      reject(err);
    });
  });
}

function screenCapture(client) {
  return client.Page.captureScreenshot().then(
    v => {
      console.log('writing screenshot to', outputPath, v);
      fs.writeFileSync(outputPath, v.data, 'base64');
      console.log(`Image saved as ${outputPath}`);
      // client.close();
      // resolve();
    }
  );
}


var ChromeTab = module.exports = {

  open: function (url) {
    return executeInTab(devtools => init(devtools, url));
  },

  list: function () {
    // return getTabManager().then(tabManager => {
      // Error: 'Target.getTargets' wasn't found
      // return tabManager.Target.getTargets();
    // });

    return cri.List({ port: 9222 });
  },

  close: function (tabId) {
    return cri.Close({
      id: tabId
    });
  }
};


// cli
if (require.main === module) {
  var args = process.argv;
  var cmd = args[2];
  var url = args[3];
  var done = function () {
    process.exit(0);
  };
  var log = function (t) {
    console.log(t);
  };

  if (!cmd) {
    console.log('Usage:', require('path').basename(args[1]), 'open | list');
  } else if (cmd === 'open') {
    ChromeTab.open(url).then(done, done);
    // console.log(`${p.pid}: ${p.spawnargs.join(' ')}`);
    // process.exit(0);
  } else {
    ChromeTab[cmd]().then(log, log).then(done);
  }
}

