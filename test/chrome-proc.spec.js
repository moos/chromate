
var assert = require('assert');
var Chrome = require('../index').Chrome;

var execPath = Chrome.getExecPath({canary: true});


Chrome.settings.execPath = execPath;

describe('chrome-proc', function () {

  beforeEach((done) => {
    Chrome.killall().then(() => done());
  });

  afterEach((done) => {
    Chrome.killall().then(() => done());
  });

  it('should start a process (non default port)', function (done) {
    var expected = [
      execPath,
      '--remote-debugging-port=9224',
      '--headless',
      '--disable-gpu',
      '--user-data-dir=' // [4]
      ].concat(Chrome.flags);

    Chrome.start({
      port: 9224
    }).then(chrome => {
      assert.equal(typeof chrome.pid, 'number');
      assert.equal(chrome.spawnfile, execPath);

      // custom attribute
      assert.equal(typeof chrome.userDataDir, 'string');
      expected[4] += chrome.userDataDir;
      assert.deepEqual(chrome.spawnargs, expected);
      done();
    });
  });

  it('should reject for bad executable', function (done) {
    Chrome.start({
      execPath: '/foo/bar'
    }).catch(err => {
      assert.equal(err, 'Error: spawn /foo/bar ENOENT');
      done();
    });
  });

  it('should list single process', function (done) {
    Chrome.start().then((chrome) => {
      Chrome.list().then(res => {
        assert.equal(res.length, 1);
        assert.equal(res[0].pid, chrome.pid);
        done();
      });
    });
  });

  it('should list multiple process', function (done) {
    Promise.all([Chrome.start(), Chrome.start()]).then((clients) => {
      Chrome.list().then(res  => {
        assert.equal(res.length, 2);
        assert.equal(res[0].pid, clients[0].pid);
        assert.equal(res[1].pid, clients[1].pid);
        done();
      });
    });
  });

  it('should kill all processes', function (done) {
    Promise.all([Chrome.start(), Chrome.start()]).then(clients => {
      Chrome.list().then(res => {
        assert.equal(res.length, 2);
      });

      Chrome.killall().then(() => {
        Chrome.list().then(res => {
          assert.equal(res.length, 0);
          done();
        });
      });
    });
  });

});