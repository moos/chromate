chromate
============

Motor functions for [Headless Chrome](https://developers.google.com/web/updates/2017/04/headless-chrome), mate.


## Install
```shell
npm install chromate
npm test
npm run sample
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
  }).then((res) => {
    console.log('done', res); // done {foo: 1}
    Chrome.kill(chrome);
    process.exit(0);
  });
});
```
targetUrl is an HTML page (possibly test suite) that communicates back to the runner process
through `console.debug`:
```js
// in targetUrl
console.debug({
  event: 'done',
  data: {foo: 1}
});
```


## Simple CLI
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
Usage:
```shell
$ chromate
Usage: chromate start [<chrome flags>] | list | kill <id> ... | killall | open <url> | 
    list-tabs | close <tabId> | close-tabs  [--verbose]
```
## API


<a name="Chrome"></a>
## Chrome : <code>object</code>

* [Chrome](#Chrome) : <code>object</code>
    * [.settings](#Chrome.settings)
    * [.start([options])](#Chrome.start) ⇒ <code>Promise.&lt;ChildProcess&gt;</code>
    * [.ready([options])](#Chrome.ready) ⇒ <code>Promise</code>
    * [.kill(job)](#Chrome.kill)
    * [.killall()](#Chrome.killall) ⇒ <code>Promise.&lt;Number&gt;</code>
    * [.list([all])](#Chrome.list) ⇒ <code>Promise.&lt;Array&gt;</code>

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

<a name="Chrome.start"></a>
### Chrome.start([options]) ⇒ <code>Promise.&lt;ChildProcess&gt;</code>
Start a Chrome process and wait until it's ready.  Pass `options` to override any `Chrome.settings`.


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
List all (headless) Chrome processes (doesn't list Chrome's child processes).  If `all` is truem 
list all processes (including child).

**Returns**: <code>Promise.&lt;Array&gt;</code> - list of processes  


<a name="Tab"></a>
## Tab : <code>object</code>
**Kind**: global namespace  

* [Tab](#Tab) : <code>object</code>
    * [.settings](#Tab.settings)
    * [.open(url, [options])](#Tab.open) ⇒ <code>Promise.&lt;(result\|client)&gt;</code>
    * [.list([options])](#Tab.list) ⇒ <code>Promise.&lt;Array&gt;</code>
    * [.close(tabId, [options])](#Tab.close) ⇒ <code>Promise</code>
    * [.closeAll()](#Tab.closeAll) ⇒ <code>Promise.&lt;Number&gt;</code>

<a name="Tab.settings"></a>

### Tab.settings
Default settings. May be overridden by passing in options.

**Kind**: static property of [<code>Tab</code>](#Tab)  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| port | <code>number</code> | <code>9222</code> | port number of Chrome instance.  Or set env variable CHROME_PORT. |
| failonerror | <code>boolean</code> | <code>true</code> | stop processing and close tab in case of network or other errors |
| verbose | <code>boolean</code> | <code>false</code> | log info and console.logs |
| screenshot | <code>boolean</code> | <code>false</code> | take a screenshot (WIP!) |
| viewport | <code>object</code> | <code>width:680,height:800</code> | window width & height |
| waitForDone | <code>boolean</code> | <code>true</code> | set to false to have tab not wait for a 'done' event   from the target and close immediately |
| events | <code>object</code> |  | event handlers of type {event: handler}.  Standard events include   'init' & 'load'.  Target may fire any number of custom events via   console.debug({event, data}).  A 'done' event will close the tab. |


<a name="Tab.open"></a>
### Tab.open(url, [options]) ⇒ <code>Promise.&lt;(result\|client)&gt;</code>
Open a new tab at `url`.  Target url may close the tab by issuing a `console.debug({event:'done', data:{}})` event.  
Caller may close the tab by `Tab.close(options.client.target.id)`.

**Returns**: <code>Promise.&lt;(result\|client)&gt;</code> - if `options.waitForDone` is true, waits for 'done' event
  from the target page and returns the result.  Otherwise, returns the
  <a href="https://github.com/cyrus-and/chrome-remote-interface#cdpnewoptions-callback">CDP client</a> object.  
**Emits**: <code>&#x27;init&#x27; (tab initiated), &#x27;load&#x27; (page loaded) and &#x27;done&#x27; and other custom events
as fired by the target page.event:</code>  

`options` is passed as the second argument to event handlers and will contain these additional properties:
- `options.client` - the target client CDP object 
- `options.promise.resolve` - the resolve method
- `options.promise.reject` - the reject method

<a name="Tab.list"></a>
### Tab.list([options]) ⇒ <code>Promise.&lt;Array&gt;</code>
List all open tabs.  Give `options` to override the port. 

**Returns**: <code>Promise.&lt;Array&gt;</code> - with tabs array  


<a name="Tab.close"></a>
### Tab.close(tabId, [options]) ⇒ <code>Promise</code>
Close a tab. Give `options` to override the port. 


<a name="Tab.closeAll"></a>
### Tab.closeAll() ⇒ <code>Promise.&lt;Number&gt;</code>
Close all tabs.

**Returns**: <code>Promise.&lt;Number&gt;</code> - no. of tabs closed  

## Thanks and refs
- [chrome-remote-interface](https://www.npmjs.com/package/chrome-remote-interface)
- [Lighthouse](https://github.com/GoogleChrome/lighthouse)
- [DevTools Protocol Viewer](https://chromedevtools.github.io/devtools-protocol/)

## Change log

- v0.1.0 Initial version (Apr 2017)

## License
MIT