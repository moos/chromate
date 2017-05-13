var assert = require('assert');
var Chrome = require('../index').Chrome;
var Tab = require('../index').Tab;
var targetUrl = 'file://' + require('path').resolve('./test/fixtures/test.html');
var noCloseUrl = 'file://' + require('path').resolve('./test/fixtures/no-close.html');
var aclient;
var expect = {foo:1};
var tabId;


// same as in fixture/test.html
var bigData = {
  name: 'Chrome DevTools Protocol allows for tools to instrument',
  result: {"failed":0,"passed":0,"total":0,"runtime":40}
};


describe('chrome-tab - basic', function () {
  /**
   * NOTE: there is dependency between the tests!!
   */

  before(done => {
    Chrome.start().then(() => done());
  });

  after(done => {
    Chrome.killall().then(() => done());
  });

  it('should get a client (default port)', function (done) {
    Tab.getClient().then(client => {
      assert.equal(client.host, 'localhost');
      assert.equal(client.port, 9222);
      assert.equal(client.target.type, 'page');
      assert.equal(client.target.url, 'about:blank');

      aclient = client;
      done();
    });
  });

  it('should get new tab (and keep it open)', function (done) {
    Tab.newTab(aclient, targetUrl + '?111', {waitForDone: true})
      .then(tab => {
        assert.deepEqual(tab.result.data, expect);
        done();
      });
  });

  it('should open a tab which closes itself', function (done) {
    var options = {foo: 2, waitForDone: true};
    new Tab(options)
      .open(targetUrl)
      .then(tab => {
        assert.deepEqual(tab.result.data, expect);
        assert.deepEqual(options.foo, 2, 'options was not modified');
        tab.close().then(done);
      });
  });

  it('should open a tab (shortcut) without waiting for done', function (done) {
    var options = {foo: 2, waitForDone: false};
    Tab.open(targetUrl, options)
      .then(tab => {
        assert.deepEqual(tab.result, undefined);
        assert.deepEqual(options.foo, 2, 'options was not modified');
        tab.close().then(done);
      });
  });

  it('should open a tab (shortcut) and waitForDone', function (done) {
    var options = {foo: 2, waitForDone: true};
    Tab.open(targetUrl, options)
      .then(tab => {
        assert.deepEqual(tab.result.data, expect);
        assert.deepEqual(options.foo, 2, 'options was not modified');
        tab.close().then(done);
      });
  });

  it('should list tabs', function (done) {
    Tab.list().then(result => {
      assert.equal(result.length, 2);
      assert.equal(result[0].url, targetUrl + '?111');
      tabId = result[0].id;
      done();
    });
  });

  it('should close a tab', function (done) {
    Tab.close(tabId).then(() => {
      Tab.list().then(result => {
        assert.equal(result.length, 1);
        done();
      });
    });
  });
});


describe('chrome-tab - more', function () {

  before(done => {
    Chrome.start().then(() => done());
  });

  after(done => {
    Chrome.killall().then(() => done());
  });

  it('should open a tab & manually close it', function (done) {
    new Tab()
      .open(noCloseUrl)
      .then(tab => {
        assert.equal(tab.client.target.type, 'page');
        tab.close().then(done);
      });
  });

  it('should open a tab & manually close it (shorthand)', function (done) {
    Tab.open(noCloseUrl)
      .then(tab => {
        assert.equal(tab.client.target.type, 'page');
        tab.close().then(done);
      });
  });

  it('should close all tab', function (done) {
    Promise.all([Tab.open(noCloseUrl), Tab.open(noCloseUrl)])
      .then(() => Tab.list())
      .then(result => {
        assert.equal(result.length, 3); // process always open an about:blank
        return Tab.closeAll();
      })
      .then(count => {
        assert.equal(count, 3);
        done();
      });
  });

  it('should timeout and reject', function (done) {
    Tab.open(noCloseUrl, {
      waitForDone: true,
      timeout: 50
    })
      .catch(err => {
        assert.ok(/Tab timed out/.test(err.message));
        done();
      })
  });
});


describe('chrome-tab - evaluate()', function () {

  before(done => {
    Chrome.start().then(() => done());
  });

  after(done => {
    Chrome.killall().then(() => done());
  });

  it('should evaluate a simple expression', function (done) {
    new Tab()
      .open(targetUrl)
      .then(tab => {
        tab.evaluate('one + two').then(res => {
          assert.equal(res, 3);
          tab.close().then(done);
        });
      })
  });

  it('should evaluate an object expression (using JSON.stringify)', function (done) {
    new Tab()
      .open(targetUrl)
      .then(tab => {
        tab.evaluate('JSON.stringify(bigData)').then(res => {
          assert.deepEqual(res, bigData);
          tab.close().then(done);
        });
      })
  });

  it('should evaluate a Promise expression', function (done) {
    new Tab()
      .open(targetUrl)
      .then(tab => {
        tab.evaluate('Promise.resolve(123)', {
          awaitPromise: true
        }).then(res => {
          assert.equal(res, 123);
          tab.close().then(done);
        });
      })
  });

  it('should evaluate an expression with errors', function (done) {
    new Tab()
      .open(targetUrl)
      .then(tab => {
        tab.evaluate('one + ')
          .then(res => {
            assert.equal(res, 'SyntaxError: Unexpected end of input');
          })
          .then(() => {
            tab.evaluate('unknown').then(res => {
              var expect = 'ReferenceError: unknown is not defined';
              assert.equal(res.substr(0, expect.length), expect);
            })
          })
          .then(() => tab.close())
          .then(done)
      })
  });

});

describe('chrome-tab - execute()', function () {

  before(done => {
    Chrome.start().then(() => done());
  });

  after(done => {
    Chrome.killall().then(() => done());
  });

  it('should execute a named function', function (done) {
    new Tab()
      .open(targetUrl)
      .then(tab => {
        tab.execute('three').then(res => {
          assert.equal(res, 3);
          tab.close().then(done);
        });
      })
  });

  it('should execute a local function in target', function (done) {
    var fn = function() {
      // note this is executed in target context!
      return JSON.stringify({a: 1, b: 'foo-bar', c: document.title});
    };
    new Tab()
      .open(targetUrl)
      .then(tab => {
        tab.execute(fn).then(res => {
          assert.deepEqual(res, {a: 1, b: 'foo-bar', c: 'test.html'});
          tab.close().then(done);
        });
      })
  });

  it('should execute a named function with arguments', function (done) {
    var tab = new Tab({verbose: false});
    tab.open(targetUrl)
      .then(() => tab.execute('three').then(res =>
        assert.equal(res, 3)))

      .then(() => tab.execute('three', 1, 2).then(res =>
        assert.equal(res, 6)))

      .then(() => tab.execute('three', 'pre-', '-post').then(res =>
        assert.equal(res, 'pre-3-post')))

      .then(() => tab.execute('three', [1, 2]).then(res =>
        assert.equal(res, [1, 23])))

      .then(() => tab.execute('getObject', {a: 1}).then(res =>
        assert.deepEqual(res, {a:1})))

      .then(() => tab.execute('withPromise', 123).then(res =>
        assert.equal(res, 'Promise')))

      .then(() => tab.execute('withPromise', 123, {awaitPromise: true}).then(res =>
        assert.equal(res, 123)))

      .then(() => tab.close())
      .then(done);
  });

  it('should execute a local function with arguments', function (done) {
    var fn = function (a,b) {
      return b ? a + b : a;
    };
    var fnPromise = function(a) {
      return Promise.resolve(a);
    };
    var tab = new Tab({verbose: false});
    tab.open(targetUrl)
      .then(() => tab.execute(fn).then(res =>
        assert.equal(res, undefined)))

      .then(() => tab.execute(fn, 1, 2).then(res =>
        assert.equal(res, 3)))

      .then(() => tab.execute(fn, 'pre-', '-post').then(res =>
        assert.equal(res, 'pre--post')))

      .then(() => tab.execute(fn, [1, 2]).then(res =>
        assert.equal(res, 'Array(2)')))

      .then(() => tab.execute(fn, {a: 1}).then(res =>
        assert.deepEqual(res, 'Object')))

      .then(() => tab.execute(fnPromise, 123).then(res =>
        assert.equal(res, 'Promise')))

      .then(() => tab.execute(fnPromise, 123, {awaitPromise: true}).then(res =>
        assert.equal(res, 123)))

      .then(() => tab.close())
      .then(done);
  });

});


describe('chrome-tab - events', function () {

  before((done) => {
    Chrome.start().then(() => done());
  });

  after((done) => {
    Chrome.killall().then(() => done());
  });

  it('should call events + custom event', function (done) {
    var calls = 0,
      options = {
        foo: 123
      };

    new Tab(options)
      .on('ready', function (tab) {
        ++calls;
        assert.equal(tab.client.target.type, 'page');
        assert.equal(tab.options.foo, 123);
      })
      .on('load', function (res, tab) {
        ++calls;
        assert.ok('timestamp' in res);
        assert.equal(tab.options.foo, 123);
      })
      .on('foo', function (res, tab) {
        ++calls;
        assert.deepEqual(res.data, {bar: 1});
        assert.equal(tab.options.foo, 123);
      })
      .on('done', function (res, tab) {
        ++calls;
        assert.deepEqual(res.data, expect);
        assert.equal(tab.options.foo, 123);
        assert.equal(calls, 4);
        tab.close().then(done);
      })
      .open(targetUrl)
      .then(tab => {
        assert.deepEqual(tab.result, undefined, 'done event has not processed yet');
      });
  });

  it('should call funky events', function (done) {
    var count = 0;
    var expect = 13;
    new Tab({verbose: false})
      .on('data', res =>  {++count})
      .on('baz', res => {assert.equal(res.a, 'was here'); ++count})
      .on('bigData', res => {assert.deepEqual(res.data, bigData); ++count})
      .on('done', function (res, tab) {
        assert.equal(count, expect);
        tab.close().then(done);
      })
      .open(targetUrl);
  });

  it('should return long message as truncated string', function (done) {
    new Tab()
      .on('long-message', function (res, tab) {
        assert.equal(typeof res.data, 'string', 'data is a string');
        assert.ok(/…/.test(res.data), 'data has ellipses');
      })
      .on('done', function (res, tab) {
        tab.close().then(done);
      })
      .open(targetUrl);
  });

  it('should handle callbacks', function (done) {
    new Tab()
      .on('done', function (res, tab) {
        assert.deepEqual(res.data, expect);
        assert.equal(typeof res.callback, 'string');

        // call callback
        tab.execute(res.callback).then(res => {
          assert.deepEqual(res, bigData);
          tab.close().then(done);
        });
      })
      .open(targetUrl);
  });

  it('should handle CDP events', function (done) {
    var calls = 0,
      options = {
        foo: 123
      };

    new Tab(options)
      .once('event', message => {
        ++calls;
        assert.equal(message.method, 'Runtime.executionContextCreated');
      })
      .once('Network.requestWillBeSent', param => {
        ++calls;
        var expectedUrl = targetUrl.replace(/\\/g, '/');
        if (process.platform === 'win32') expectedUrl = expectedUrl.replace('/C:', '//C:');
        assert.equal(param.request.url, expectedUrl);
      })
      .open(targetUrl)
      .then(tab => {
        assert.equal(calls, 2);
        tab.close().then(done);
      });
  });

});
