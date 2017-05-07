
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

  // Chrome.list().then(res => console.log(`Got ${res.length} processes`));

  // new Tab(url, options)
  //   .on('init', foo)
  //   .open()
  //   .then(client => {});
  // var options = {};

  // Tab.open(targetUrl, options).then(client => {
  //   client.on('event', function (message) {
  //     console.log(111,message);
  //   });
  //
  // });


  Tab.open(targetUrl, {
    //verbose: true,
    failonerror: false,
    events     : {
      ready: function (client, options) {
        console.log('ready fired', client.target.id);

        client.on('event', function (message) {
          console.log(111,message);
        });
      },
      load: function (res, options) {
        console.log('load fired', res);
      },
      done: function (res, options) {
        console.log('my done', res);

        // options.promise.resolve(res);

        // return false to allow default handler
        return false;
      }
    }
  }).then((res) => {
    console.log('main done', res);
    Chrome.kill(chrome);
    process.exit(0)
  });
}
