
var Chrome = require('../index').Chrome;
var Tab = require('../index').Tab;
var targetUrl = 'file://' + require('path').resolve('./sample/target.html');

// process.on('uncaughtException', err => console.log(333, err))

Chrome.start()
  .then(run)
  .catch(err => {
    console.log('Error starting chrome', err);
    process.exit(0)
  });


function run(chrome) {
  console.log(`started pid ${chrome.pid} on port ${Chrome.settings.port}`);

  Chrome.list().then(res => console.log(`Got ${res.length} processes`));

  var options = {
    verbose: true,
    failonerror: false
  };

  new Tab(targetUrl, options)
    .on('ready', tab => {
      console.log('ready', tab.client.target.id);

      // add script to target
      tab.client.Page.addScriptToEvaluateOnLoad({
        scriptSource: 'console.log("in target", location.href)'
      });

      // any event may prematurely terminate the Promise chain
      // tab.promise.resolve(4444);
    })
    .on('Network.requestWillBeSent', param => console.log('network request custom handler', param.request.method))
    .once('Runtime.consoleAPICalled', param => console.log('Runtime.consoleAPICalled called', param))
    .on('load', (param, tab) => console.log('load', param))
    .on('foo', (param, tab) => console.log('foo', param))
    .on('done', (param, tab) => console.log('done', param))
    .on('disconnect', (param, tab) => console.log('disconnect', param)) // not firing!
    .open()
    .then(tab => {
      return tab.client.Runtime.evaluate({expression: 'JSON.stringify(__coverage__)'})
        .then(result => console.log('Got coverage', JSON.parse(result.result.value)))
        .then(() => tab);
    })
    .then(tab => tab.close())
    .then(() => {
      console.log('Exiting chrome', chrome.pid);
      Chrome.kill(chrome);
      process.exit(0);
    });
}
