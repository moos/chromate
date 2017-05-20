Automate [Headless Chrome](https://www.chromestatus.com/feature/5678767817097216) -- start/stop 
 Chrome instances, open & close tabs, and _communicate_ with the target page.

### Compatibility 
- You must use version >= 59 of Chrome (currently that means [Chrome Beta](https://www.google.com/chrome/browser/beta.html)) or use [Chrome Canary](https://www.google.com/chrome/browser/canary.html).
- Canary isn't supported on Linux platform.

## Install
```shell
npm install chromate
npm run sample
```

## Use
```js
let {Chrome, Tab} = require('chromate');

// start a headless Chrome process
Chrome.start().then(chrome => {
  let tab = new Tab({
    verbose: true,
    failonerror: false
  });
  
  tab.open(targetUrl)
  .then(() => tab.evaluate('testResults'))
  .then(res => console.log) // results...
  .then(() => tab.close())
  .then(() => {
    Chrome.kill(chrome);
    process.exit(0);
  });
});
```

### Page events
Handle events, including any [chrome-remote-interface](https://github.com/cyrus-and/chrome-remote-interface#class-cdp) events.
```js
new Tab(options)
 .on('ready', (tab) => console.log('tab is ready', tab.client.target.id))
 .on('load', () => console.log('page loaded'))
 .on('console', (args) => console.log('console.* called', args))
 .on('Network.requestWillBeSent', param => console.log('Getting resource', param.request.url))
 .once('Runtime.consoleAPICalled', param => console.log('Runtime.consoleAPICalled called', param))
 .open(targetUrl);
```
The `ready` event is fired once when the target client is ready (this overrides the CDP `ready` event).  The target may
fire any number of custom events.

### Custom events
A target page may communicate back to the controlling process by calling `console.debug(message)`, 
where `message`  is `{event, data}`.   This is useful for running automated tests, such as for
replacing [PhantomJS](http://phantomjs.org/).
```js
// useful for short messages (< 100 chars)
console.debug({
  event: 'done',
  data: JSON.stringify({foo: 1}) // must be stringify'd
});

// then, in runner process
new Tab()
  .on('done', res => console.log); // {event: 'done', data: foo:1}}
```
A special function `__chromate(message)` is injected in target 
page to facilitate this, so that the above can be replaced by:
```js
// in target (useful for any length message)
if (window.__chromate) __chromate({event: 'done', data: {foo:1}});;
```

The format of the message is flexible, but should be sensible.  If no `event` property is found in the message,
a 'data' event is triggered.
```js
// in target
__chromate('foo');
console.debug({a:1});

// in runner
tab.on('data', res => console.log); // 'foo' and {a:1}
```

### Script injection
Often it's useful for the running script to inject custom JS into the target page.  This can 
  be done thorough [Page.addScriptToEvaluateOnLoad()](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-addScriptToEvaluateOnLoad)
  or the [Runtime.evaluate()](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#method-evaluate) method. 
Two helper methods are provided: `tab.evaluate()` and `tab.execute()`:
```js
new Tab()
  .on('done', (res, tab) => {
     tab.evaluate('JSON.stringify(__coverage__)')
       .then(result => console.log(result))
       .then(() => tab.close());
  })
  .open(targetUrl);
```
Or execute a (named) function in target.
```js
new Tab()
  .open(targetUrl)
  .then(tab => {
    tab.execute('getResult').then(res => console.log);
  })
  
// in target
function getResult() {
  return JSON.stringify(result);
}
```
`tab.execute()` takes additional parameters to pass as arguments to the function.
If the function is expected to return a Promise, pass a `{awaitPromise: true}` as the
last argument.

## API

See [API docs](./api.md).


## Simple CLI
Usage:
```shell
$ chromate
Usage: chromate start [<chrome flags>] | list | kill <id> ... | killall | version | open <url> | 
    list-tabs | close <tabId> | close-tabs  [--canary | --verbose | -v]
```

Chrome process control:
```shell
$ chromate start --window-size=800x600
87335: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --remote-debugging-port=9222 --headless --disable-gpu --window-size=800x600

$ chromate list
[ { pid: '87335',
    command: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    arguments:
     [ '--remote-debugging-port=9222',
       '--headless',
       '--disable-gpu',
       '--window-size=800x600' ],
    ppid: '1' } ]

$ chromate killall 
```
For list of Chrome Headless flags, [see here](https://cs.chromium.org/chromium/src/headless/app/headless_shell_switches.cc).

To use a custom Chrome path and/or port, use:
```shell
$ CHROME_BIN=/path/to/chrome CHROME_PORT=9224 chromate start
```

Chrome tab control:
```shell
$ chromate open https://github.com
{ description: '',
  devtoolsFrontendUrl: '/devtools/inspector.html?ws=localhost:9222/devtools/page/904ddfa4-2344-4e45-a625-8261ffbee251',
  id: '904ddfa4-2344-4e45-a625-8261ffbee251',
  title: '',
  type: 'page',
  url: 'about:blank',
  webSocketDebuggerUrl: 'ws://localhost:9222/devtools/page/904ddfa4-2344-4e45-a625-8261ffbee251' }

$ chromate list-tabs
[ { description: '',
    devtoolsFrontendUrl: '/devtools/inspector.html?ws=localhost:9222/devtools/page/e97b0e1e-1fb5-41be-83d2-bdb9fbc406bc',
    id: 'e97b0e1e-1fb5-41be-83d2-bdb9fbc406bc',
    title: 'The world&#39;s leading software development platform · GitHub',
    type: 'page',
    url: 'https://github.com/',
    webSocketDebuggerUrl: 'ws://localhost:9222/devtools/page/e97b0e1e-1fb5-41be-83d2-bdb9fbc406bc' },
  { description: '',
    devtoolsFrontendUrl: '/devtools/inspector.html?ws=localhost:9222/devtools/page/e4c16358-7670-4deb-8b2e-29f802e599a3',
    id: 'e4c16358-7670-4deb-8b2e-29f802e599a3',
    title: 'about:blank',
    type: 'page',
    url: 'about:blank',
    webSocketDebuggerUrl: 'ws://localhost:9222/devtools/page/e4c16358-7670-4deb-8b2e-29f802e599a3' } ]
$ chromate close-tabs
2
```

## Test
```shell
# npm i -g mocha  (if you don't already have it)
npm test
```


## Thanks and references
- This library is based on the awesome work of [chrome-remote-interface](https://www.npmjs.com/package/chrome-remote-interface)
- Idea for Chrome.ready() taken from [Lighthouse](https://github.com/GoogleChrome/lighthouse)
- [DevTools Protocol Viewer](https://chromedevtools.github.io/devtools-protocol/) complete reference.
- [Getting Started with Headless Chrome](https://developers.google.com/web/updates/2017/04/headless-chrome)

## Change log

- v0.3.4 - Added Chrome.settings.userDataDir.  By default a temporary user data dir is used and cleaned up.  
- v0.3.3 - fixed 'ps-node' reference
- v0.3.2 - fixed internal print() method
- v0.3.1 - added events 'abort', 'exception', and 'console.*'.  Export chromate.version.
- v0.3.0 - tab.open(url) takes url rather than constructor.  tab.execute can take a local function.  Use ps-moos with fix for spaces in path.
- v0.2.0 - Added expression and function evaluation and __chromate global for general message passing.  Events now get complete message, not just the data part. (May 2017)
- v0.1.x - Initial version (May 2017)

## License
MIT
