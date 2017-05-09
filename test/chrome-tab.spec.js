var assert = require('assert');
var Chrome = require('../index').Chrome;
var Tab = require('../index').Tab;
var targetUrl = 'file://' + require('path').resolve('./test/fixtures/test.html');
var noCloseUrl = 'file://' + require('path').resolve('./test/fixtures/no-close.html');
var aclient;
var expect = {foo:1};
var tabId;


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
        assert.deepEqual(tab.result, expect);
        done();
      });
  });

  it('should open a tab which closes itself', function (done) {
    var options = {foo: 2, waitForDone: true};
    new Tab(targetUrl, options)
      .open()
      .then(tab => {
        assert.deepEqual(tab.result, expect);
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
        assert.deepEqual(tab.result, expect);
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

  it('should open a tab & manually close it', function (done) {
    new Tab(noCloseUrl)
      .open()
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

    new Tab(targetUrl, options)
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
        assert.deepEqual(res, {bar: 1});
        assert.equal(tab.options.foo, 123);
      })
      .on('done', function (res, tab) {
        ++calls;
        assert.deepEqual(res, expect);
        assert.equal(tab.options.foo, 123);

        assert.equal(calls, 4);
        tab.close().then(done);
      })
      .open()
      .then(tab => {
        assert.deepEqual(tab.result, undefined, 'done event has not processed yet');
      });
  });

  it('should handle CDP events', function (done) {
    var calls = 0,
      options = {
        foo: 123
      };

    new Tab(targetUrl, options)
      .once('event', message => {
        ++calls;
        assert.equal(message.method, 'Runtime.executionContextCreated');
      })
      .once('Network.requestWillBeSent', param => {
        ++calls;
        assert.equal(param.request.url, targetUrl);
      })
      .open()
      .then(tab => {
        assert.equal(calls, 2);
        tab.close().then(done);
      });
  });

});
