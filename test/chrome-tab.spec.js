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
    Tab.newTab(aclient, targetUrl + '?111')
      .then(result => {
        assert.deepEqual(result, expect)
        done();
      });
  });

  it('should open a tab which closes itself', function (done) {
    var options = {foo: 2};
    Tab.open(targetUrl, options)
      .then(result => {
        assert.deepEqual(result, expect);
        assert.equal(options.foo, 2);
        assert.equal(typeof options.client, 'object');
        assert.equal(typeof options.promise.resolve, 'function');
        assert.equal(typeof options.promise.reject, 'function');
        done();
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
    var options = {
      waitForDone: false
    };
    Tab.open(noCloseUrl, options)
      .then(client => {
        assert.equal(client.target.type, 'page');
        client.close();
        done();
      });
  });

  it('should close all tab', function (done) {
    var options = {
      waitForDone: false
    };
    Promise.all([Tab.open(noCloseUrl, options), Tab.open(noCloseUrl, options)])
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
        foo: 123,
        events: {
          init: function (res, opt) {
            ++calls;
            assert.equal(res, targetUrl);
            assert.equal(opt.foo, 123);
          },
          load: function (res, opt) {
            ++calls;
            assert.ok('timestamp' in res);
            assert.equal(opt.foo, 123);
          },
          foo : function (res, opt) {
            ++calls;
            assert.deepEqual(res, {bar: 1});
            assert.equal(opt.foo, 123);
          },
          done: function (res, opt) {
            ++calls;
            assert.deepEqual(res, expect);
            assert.equal(opt.foo, 123);
            // returning false to let default 'done' handler resolve
            return false;
          }
        }
      };

    Tab.open(targetUrl, options)
      .then(result => {
        assert.deepEqual(result, expect);
        assert.equal(calls, 4);
        done();
      });
  });

  it('should call done event and resolve', function (done) {
    var options = {
      events: {
        done: function (result, options) {
          assert.deepEqual(result, expect);
          options.promise.resolve(222);
        }
      }
    };

    Tab.open(targetUrl, options)
      .then(result => {
        assert.deepEqual(result, 222);
        done();
      });
  });

  it('should call done event and reject', function (done) {
    var options = {
      events: {
        done: function (result, options) {
          assert.deepEqual(result, expect);
          options.promise.reject(333);
        }
      }
    };

    Tab.open(targetUrl, options)
      .catch(result => {
        assert.equal(result, 333);
        done();
      });
  });

});
