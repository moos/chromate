Automate [Headless Chrome](https://www.chromestatus.com/feature/5678767817097216) -- start/stop 
 Chrome instances, open & close tabs, and _communicate_ with the target page.


## Install
```shell
npm install chromate
npm run sample
```
Test
```shell
# npm i -g mocha  (if you don't already have it)
npm test
```


## Use
```js
var Chrome = require('chromate').Chrome;
var Tab = require('chromate').Tab;

// start a headless Chrome process
Chrome.start().then(chrome => {
  Tab.open(targetUrl, {
    verbose: true,
    failonerror: false
  })
  .then(tab => tab.close())
  .then(
    Chrome.kill(chrome);
    process.exit(0);
  });
});
```

### Page events
Handle events, including any [chrome-remote-interface](https://github.com/cyrus-and/chrome-remote-interface#class-cdp) events.
In this case we instantiate a class (rather than calling `Tab.open` statically like above):
```js
new Tab(targetUrl, options)
 .on('ready', (tab) => console.log('tab is ready', tab.client.target.id))
 .on('load', () => console.log('page loaded'))
 .on('Network.requestWillBeSent', param => console.log('Getting resource', param.request.url))
 .once('Runtime.consoleAPICalled', param => console.log('Runtime.consoleAPICalled called', param))
 .open();
```
The `ready` event is fired once when the target client is ready (this overrides the CDP `ready` event).  The target may
fire any number of custom events.

### Custom target events
A target page may communicate back to the controlling process by
calling `console.debug()` in the following format.  This is useful for running automated tests, such as for
replacing [PhantomJS](http://phantomjs.org/).
```js
// in targetUrl
console.debug({
  event: 'done',
  data: JSON.stringify({foo: 1})
});

// in runner process
new Tab(targetUrl)
  .on('done', res => console.log); // {foo:1}
```

### Script injection
Often it's useful for the running script to inject custom JS into the target page.  This can 
  be done thorough [Page.addScriptToEvaluateOnLoad()](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-addScriptToEvaluateOnLoad)
  or the [Runtime.evalauate()](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/#method-evaluate) method.
```js
new Tab(targetUrl)
  .on('done', (param, tab) => {
     tab.client.Runtime.evaluate({expression: 'JSON.stringify(__coverage__)'})
       .then(result => console.log(result))
       .then(() => tab.close());
  })
  .open();
```



## API

<a name="Chrome"></a>
## Chrome : <code>object</code>

* [Chrome](#Chrome) : <code>object</code>
    * [.settings](#Chrome.settings)
    * [.flags](#Chrome.flags) : <code>Array.&lt;String&gt;</code>
    * [.start([options])](#Chrome.start) ⇒ <code>Promise.&lt;ChildProcess&gt;</code>
    * [.ready([options])](#Chrome.ready) ⇒ <code>Promise</code>
    * [.kill(job)](#Chrome.kill)
    * [.killall()](#Chrome.killall) ⇒ <code>Promise.&lt;Number&gt;</code>
    * [.list([all])](#Chrome.list) ⇒ <code>Promise.&lt;Array&gt;</code>
    * [.version([options])](#Chrome.version) ⇒ <code>Promise.&lt;VersionInfo&gt;</code>

<a name="Chrome.settings"></a>
### Chrome.settings
Default settings. May be overridden by passing options.

**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| debug | <code>boolean</code> | <code>true</code> | start Chrome in remote debugging mode |
| port | <code>number</code> | <code>9222</code> | port number of Chrome instance.  Or set env variable CHROME_PORT. |
| headless | <code>boolean</code> | <code>true</code> | start Chrome in headless mode (note: non-headless mode not tested!) |
| disableGpu | <code>boolean</code> | <code>true</code> | passed --disable-gpu to Chrome |
| execPath | <code>string</code> |  | override Chrome exec path, or set env variable CHROME_BIN |
| chromeFlags | <code>Array.&lt;string&gt;</code> |  | array of flags to pass to Chrome, e.g. ['--foo'] |
| retry | <code>number</code> | <code>3</code> | no. of times to retry to see if Chrome is ready |
| retryInterval | <code>number</code> | <code>100</code> | msecs between retries (incl. first attempt) |
| verbose | <code>boolean</code> | <code>false</code> | outputs additional logs |


<a name="Chrome.flags"></a>
### Chrome.flags : <code>Array.&lt;String&gt;</code>
Default set of flags passed to Chrome.  See [src/chrome-proc.js](src/chrome-proc.js).



<a name="Chrome.start"></a>
### Chrome.start([options]) ⇒ <code>Promise.&lt;ChildProcess&gt;</code>
Start a Chrome process and wait until it's ready.  Pass `options` to override any `Chrome.settings`.

**Returns**: <code>Promise.&lt;ChildProcess&gt;</code> - spawned process  

<a name="Chrome.ready"></a>
### Chrome.ready([options]) ⇒ <code>Promise</code>
Is the process ready? Attempts to connect (with retry) to process.

**Returns**: <code>Promise</code> - resolves or rejects if process is not ready.  `options`, if provided,
can override settings for port, retry, and retryInterval.


<a name="Chrome.kill"></a>
### Chrome.kill(job)
Kill process(es).  `job` can be the spawned process (resolve value of start) or (array of) process ids.


<a name="Chrome.killall"></a>
### Chrome.killall() ⇒ <code>Promise.&lt;Number&gt;</code>
Kill all (headless) Chrome processes.

**Returns**: <code>Promise.&lt;Number&gt;</code> - no. of processes killed  


<a name="Chrome.list"></a>
### Chrome.list([all]) ⇒ <code>Promise.&lt;Array&gt;</code>
List all (headless) Chrome processes (doesn't list Chrome's child processes).  If `all` is true
include Chrome's sub-processes.

**Returns**: <code>Promise.&lt;Array&gt;</code> - list of processes  


<a name="Chrome.version"></a>
### Chrome.version([options]) ⇒ <code>Promise.&lt;VersionInfo&gt;</code>
Get Chrome version info.  Provide  `options.port` of Chrome process.




<a name="Tab"></a>
## Tab
**Extends**: [<code>EventEmitter</code>](https://nodejs.org/api/events.html#events_class_eventemitter)  

* [Tab](#Tab) ⇐ [<code>EventEmitter</code>](https://nodejs.org/api/events.html#events_class_eventemitter)
    * [new Tab(targetUrl, [options])](#new_Tab_new)
    * _instance_
        * [.open()](#Tab+open) ⇒ <code>Promise.&lt;Tab&gt;</code>
        * [.close()](#Tab+close) ⇒ <code>Promise</code>
    * _static_
        * [.settings](#Tab.settings)
        * [.list([options])](#Tab.list) ⇒ <code>Promise.&lt;Array&gt;</code>
        * [.open(targetUrl, [options])](#Tab.open) ⇒ [<code>Promise.&lt;Tab&gt;</code>](#Tab)
        * [.close(tabId, [options])](#Tab.close) ⇒ <code>Promise</code>
        * [.closeAll([options])](#Tab.closeAll) ⇒ <code>Promise.&lt;Number&gt;</code>


<a name="new_Tab_new"></a>
### new Tab(targetUrl, [options])

Constructor - `targetUrl` {<code>string</code>} is the url to load in tab.  Provide `[options]` to override any   `Tab.settings`.


<a name="Tab+open"></a>
### tab.open() ⇒ <code>Promise.&lt;Tab&gt;</code>
Open a new tab at url.

**Returns**: <code>Promise.&lt;Tab&gt;</code> - Resolved as soon as the page loads.  If `options.waitForDone` is true,
  waits for 'done' event from the target page before resolving.
  The data from the 'done' event is available as `tab.result`.

Note that `tab.client` is the <a href="https://github.com/cyrus-and/chrome-remote-interface#cdpnewoptions-callback">CDP client</a> object.
  
**Emits**: 
- <code>&#x27;ready&#x27;</code> - tab client is ready. Handlers get (tab).
- <code>&#x27;load&#x27;</code> - page loaded.  Handlers get (data, tab).
- <code>&#x27;done&#x27;</code> and other custom events as fired by the target page. Handlers get (data, tab).

See also events fired by [CDP](https://github.com/cyrus-and/chrome-remote-interface#class-cdp).

Target may fire any number of custom events via `console.debug({event, data})`.  


<a name="Tab+close"></a>
### tab.close() ⇒ <code>Promise</code>
Close a tab opened by tab.open().

<a name="Tab.settings"></a>


### Tab.settings
Default settings. May be overridden by passing in options.

**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| port | <code>number</code> | <code>9222</code> | port number of Chrome instance.  Or set env variable CHROME_PORT. |
| failonerror | <code>boolean</code> | <code>true</code> | stop processing and close tab in case of network or other errors |
| verbose | <code>boolean</code> | <code>false</code> | log info and console.logs |
| screenshot | <code>boolean</code> | <code>false</code> | take a screenshot (WIP!) |
| viewport | <code>object</code> | <code>width:680,height:800</code> | window width & height |
| waitForDone | <code>boolean</code> | <code>false</code> | set to true to have tab wait for a 'done' event   from the target.  The result is returned in tab.result. |

<a name="Tab.list"></a>
### Tab.list([options]) ⇒ <code>Promise.&lt;Array&gt;</code>
List all open tabs.  Provide  `options.port` of Chrome process.

**Returns**: <code>Promise.&lt;Array&gt;</code> - of tab objects.  

<a name="Tab.open"></a>
### Tab.open(targetUrl, [options]) ⇒ [<code>Promise.&lt;Tab&gt;</code>](#Tab)
Open a tab at target url.  Shorthand for new Tab(url, opt).open() when 
you don't need `.on()` usage.


<a name="Tab.close"></a>
### Tab.close(tabId, [options]) ⇒ <code>Promise</code>
Close a tab with given tab Id.  Provide  `options.port` of Chrome process.


<a name="Tab.closeAll"></a>
### Tab.closeAll([options]) ⇒ <code>Promise.&lt;Number&gt;</code>
Close all tabs.  Provide  `options.port` of Chrome process.

**Returns**: <code>Promise.&lt;Number&gt;</code> - no. of tabs closed  


<a name="CHROME_BIN"></a>
## CHROME_BIN : <code>string</code>
(Environment variable) location
of Chrome executable

<a name="CHROME_PORT"></a>
## CHROME_PORT : <code>string</code>
(Environment variable) port to use


<a name="execPaths"></a>
## execPaths : <code>object</code> 
Path to Chrome executable (in [src/chrome-proc.js](src/chrome-proc.js)).  Update for your system.

**Properties**

| Name | Type | Description |
| --- | --- | --- |
| darwin | <code>string</code> | path for darwin platform |
| linux | <code>string</code> | path for linux platform |
| win32 | <code>string</code> | path for win32 platform |




## Simple CLI
Usage:
```shell
$ chromate
Usage: chromate start [<chrome flags>] | list | kill <id> ... | killall | version | open <url> | 
    list-tabs | close <tabId> | close-tabs  [--verbose]
```

Chrome process control:
```shell
$ chromate start --window-size=800x600
87335: /Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary --remote-debugging-port=9222 --headless --disable-gpu --window-size=800x600

$ chromate list
[ { pid: '87335',
    command: '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    arguments:
     [ '--remote-debugging-port=9222',
       '--headless',
       '--disable-gpu',
       '--window-size=800x600' ],
    ppid: '1' } ]

$ chromate killall 
```
For list of Chrome Headless flags, [see here](https://cs.chromium.org/chromium/src/headless/app/headless_shell_switches.cc).

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

## Issues
Please use at least version >= 59 of Chrome  (currently that means Chrome Beta).


## Thanks and references
- This library is based on the great work of [chrome-remote-interface](https://www.npmjs.com/package/chrome-remote-interface)
- Idea for Chrome.ready() taken from [Lighthouse](https://github.com/GoogleChrome/lighthouse)
- [DevTools Protocol Viewer](https://chromedevtools.github.io/devtools-protocol/) complete reference.
- [Getting Started with Headless Chrome](https://developers.google.com/web/updates/2017/04/headless-chrome)

## Change log

- v0.1.x Initial version (May 2017)

## License
MIT
