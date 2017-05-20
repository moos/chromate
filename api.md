## Classes

<dl>
<dt><a href="#Tab">Tab</a> ⇐ <code><a href="https://nodejs.org/api/events.html#events_class_eventemitter">EventEmitter</a></code></dt>
<dd></dd>
</dl>

## Objects

<dl>
<dt><a href="#Chrome">Chrome</a> : <code>object</code></dt>
<dd></dd>
</dl>

## Constants

<dl>
<dt><a href="#CHROME_BIN">CHROME_BIN</a> : <code>string</code></dt>
<dd><p>(Environment variable) location
of Chrome executable</p>
</dd>
<dt><a href="#CHROME_PORT">CHROME_PORT</a> : <code>number</code></dt>
<dd><p>(Environment variable) port to use</p>
</dd>
</dl>

## Functions

<dl>
<dt><a href="#__chromate">__chromate()</a></dt>
<dd><p>Function loaded in target to communicate back to runner.</p>
</dd>
</dl>

<a name="Tab"></a>

## Tab ⇐ [<code>EventEmitter</code>](https://nodejs.org/api/events.html#events_class_eventemitter)
**Kind**: global class  
**Extends**: [<code>EventEmitter</code>](https://nodejs.org/api/events.html#events_class_eventemitter)  

* [Tab](#Tab) ⇐ [<code>EventEmitter</code>](https://nodejs.org/api/events.html#events_class_eventemitter)
    * [new Tab([options])](#new_Tab_new)
    * _instance_
        * [.open(targetUrl)](#Tab+open) ⇒ [<code>Promise.&lt;Tab&gt;</code>](#Tab)
        * [.close()](#Tab+close) ⇒ <code>Promise</code>
        * [.execute(func, ...args, options)](#Tab+execute) ⇒ <code>Promise.&lt;result&gt;</code>
        * [.evaluate(expr, options)](#Tab+evaluate) ⇒ <code>Promise.&lt;result&gt;</code>
    * _static_
        * [.settings](#Tab.settings)
        * [.list([options])](#Tab.list) ⇒ <code>Promise.&lt;Array&gt;</code>
        * [.open(targetUrl, [options])](#Tab.open) ⇒ [<code>Promise.&lt;Tab&gt;</code>](#Tab)
        * [.close(tabId, [options])](#Tab.close) ⇒ <code>Promise</code>
        * [.closeAll([options])](#Tab.closeAll) ⇒ <code>Promise.&lt;Number&gt;</code>
        * ["done"](#Tab.event_done)
        * ["ready"](#Tab.event_ready)
        * ["load"](#Tab.event_load)
        * ["event"](#Tab.event_event)
        * ["console.&lt;type&gt;"](#Tab.event_console.&lt;type&gt;)
        * ["console"](#Tab.event_console)
        * ["exception"](#Tab.event_exception)
        * ["abort"](#Tab.event_abort)
        * ["data"](#Tab.event_data)

<a name="new_Tab_new"></a>

### new Tab([options])

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>object</code> | see settings |

<a name="Tab+open"></a>

### tab.open(targetUrl) ⇒ [<code>Promise.&lt;Tab&gt;</code>](#Tab)
Open a new tab at url.

See also: events fired by <a href="https://github.com/cyrus-and/chrome-remote-interface#class-cdp">CDP</a>.

Note that tab.client is the <a href="https://github.com/cyrus-and/chrome-remote-interface#cdpnewoptions-callback">CDP client</a> object.

Target may fire any number of custom events via
<code>console.debug({event, data})</code>.

**Kind**: instance method of [<code>Tab</code>](#Tab)  
**Returns**: [<code>Promise.&lt;Tab&gt;</code>](#Tab) - Resolved as soon as the page loads.  If <code>options.waitForDone</code> is true,
  waits for 'done' event from the target page before resolving.
  The data from the 'done' event is available as tab.result.  
**Emits**: <code>see {@link Tab#event:events}</code>  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| targetUrl | <code>string</code> | <code>&quot;\&quot;about:blank\&quot;&quot;</code> | url to load in tab |

<a name="Tab+close"></a>

### tab.close() ⇒ <code>Promise</code>
Close a tab opened by open()

**Kind**: instance method of [<code>Tab</code>](#Tab)  
<a name="Tab+execute"></a>

### tab.execute(func, ...args, options) ⇒ <code>Promise.&lt;result&gt;</code>
Execute a (named) function in target and get the result.

The function should return simple text values or use JSON.stringify.

Pass <code>options.awaitPromise</code> if the function returns a Promise.

**Kind**: instance method of [<code>Tab</code>](#Tab)  
**Returns**: <code>Promise.&lt;result&gt;</code> - Promise gets return value of function.  Objects
  (including Arrays) should be JSON.stringify'd.  

| Param | Type | Description |
| --- | --- | --- |
| func | <code>string</code> \| <code>function</code> | function name in target, or function, to execute in target. |
| ...args | <code>any</code> | additional arguments to pass to function |
| options | <code>object</code> | options to pass to client.Runtime.evaluate(). |

**Example**  
```js
tab.execute('getResults').then(result => console.log )  // {a:1}

  // in target:
  function getResult() { return JSON.stringify({a:1}); }
```
**Example**  
```js
tab.execute(function(){ return document.title })
   .then(result => console.log) // -> foo bar

  // in target html:  <title>foo bar</title>
```
<a name="Tab+evaluate"></a>

### tab.evaluate(expr, options) ⇒ <code>Promise.&lt;result&gt;</code>
Evaluate an expression in target and get the result.

**Kind**: instance method of [<code>Tab</code>](#Tab)  
**Returns**: <code>Promise.&lt;result&gt;</code> - Promise gets return value of expression.  

| Param | Type | Description |
| --- | --- | --- |
| expr | <code>string</code> | expression in target to evaluate |
| options | <code>object</code> | options to pass to client.Runtime.evaluate(). |

**Example**  
```js
// Objects must be evaluated using JSON.stringify:
  tab.evaluate('JSON.stringify( data )').then(result => console.log) // data object
```
**Example**  
```js
tab.evaluate('one + two').then(result => console.log) // 3

  // in target
  var one = 1;
  var two = 2;
```
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
| waitForDone | <code>boolean</code> | <code>false</code> | set to true to have tab wait for a 'done' event   from the target.  The result is returned in tab.result. |
| timeout | <code>number</code> | <code>0</code> | tab rejects and closes after this time in msec (0 to disable) |

<a name="Tab.list"></a>

### Tab.list([options]) ⇒ <code>Promise.&lt;Array&gt;</code>
List all open tabs

**Kind**: static method of [<code>Tab</code>](#Tab)  
**Returns**: <code>Promise.&lt;Array&gt;</code> - of tab objects  

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>object</code> | options.port of Chrome process |

<a name="Tab.open"></a>

### Tab.open(targetUrl, [options]) ⇒ [<code>Promise.&lt;Tab&gt;</code>](#Tab)
Open a tab at target url.  Short hand for new Tab(url, opt).open().

**Kind**: static method of [<code>Tab</code>](#Tab)  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| targetUrl | <code>string</code> | <code>&quot;\&quot;about:blank\&quot;&quot;</code> | url to load in tab |
| [options] | <code>object</code> |  | see settings |

<a name="Tab.close"></a>

### Tab.close(tabId, [options]) ⇒ <code>Promise</code>
Close a tab with given tab Id.

**Kind**: static method of [<code>Tab</code>](#Tab)  

| Param | Type | Description |
| --- | --- | --- |
| tabId | <code>string</code> | id of tab to close |
| [options] | <code>object</code> | options.port of Chrome process |

<a name="Tab.closeAll"></a>

### Tab.closeAll([options]) ⇒ <code>Promise.&lt;Number&gt;</code>
Close all tabs

**Kind**: static method of [<code>Tab</code>](#Tab)  
**Returns**: <code>Promise.&lt;Number&gt;</code> - no. of tabs closed  

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>object</code> | {port} no. |

<a name="Tab.event_done"></a>

### "done"
'done' (and other custom events) as fired by the target page.
Handlers get <code>(message, tab)</code>.

**Kind**: event emitted by [<code>Tab</code>](#Tab)  
<a name="Tab.event_ready"></a>

### "ready"
Tab client is ready.  Handlers get <code>(tab)</code>.  Note: this
overrides the CDP 'ready' event.

**Kind**: event emitted by [<code>Tab</code>](#Tab)  
<a name="Tab.event_load"></a>

### "load"
Page loaded.  Handlers get <code>(data, tab)</code>.

**Kind**: event emitted by [<code>Tab</code>](#Tab)  
<a name="Tab.event_event"></a>

### "event"
Events fired by CDP.  See [CDP events](https://github.com/cyrus-and/chrome-remote-interface#class-cdp).

**Kind**: event emitted by [<code>Tab</code>](#Tab)  
<a name="Tab.event_console.&lt;type&gt;"></a>

### "console.&lt;type&gt;"
console.&lt;type&gt; was called, where &lt;type&gt; is one of <code>log|info|warn|error|debug</code>.
Handlers get <code>({type, text}, tab)</code>

**Kind**: event emitted by [<code>Tab</code>](#Tab)  
<a name="Tab.event_console"></a>

### "console"
console.&lt;type&gt; was called and no type-specific handler was found.

**Kind**: event emitted by [<code>Tab</code>](#Tab)  
<a name="Tab.event_exception"></a>

### "exception"
An uncaught exception was thrown.  Handlers get <code>(exception, tab)</code>.

**Kind**: event emitted by [<code>Tab</code>](#Tab)  
<a name="Tab.event_abort"></a>

### "abort"
Target is requesting a process abort. If no handler is found, a
  process.exit(code) is issued.  Handlers get <code>(message, tab)</code>.

**Kind**: event emitted by [<code>Tab</code>](#Tab)  
<a name="Tab.event_data"></a>

### "data"
Unhandled calls to __chromate() or console.debug().  Handlers get <code>(message, tab)</code>.

**Kind**: event emitted by [<code>Tab</code>](#Tab)  
<a name="Chrome"></a>

## Chrome : <code>object</code>
**Kind**: global namespace  

* [Chrome](#Chrome) : <code>object</code>
    * [.settings](#Chrome.settings)
    * [.flags](#Chrome.flags) : <code>Array.&lt;String&gt;</code>
    * [.start([options])](#Chrome.start) ⇒ [<code>Promise.&lt;ChildProcess&gt;</code>](https://nodejs.org/api/child_process.html#child_process_class_childprocess)
    * [.ready([options])](#Chrome.ready) ⇒ <code>Promise</code>
    * [.kill(job)](#Chrome.kill)
    * [.killall()](#Chrome.killall) ⇒ <code>Promise.&lt;Number&gt;</code>
    * [.list([all])](#Chrome.list) ⇒ <code>Promise.&lt;Array&gt;</code>
    * [.version([options])](#Chrome.version) ⇒ <code>Promise.&lt;VersionInfo&gt;</code>
    * [.getExecPath([options])](#Chrome.getExecPath) ⇒ <code>string</code>

<a name="Chrome.settings"></a>

### Chrome.settings
Default settings. May be overridden by passing options.

**Kind**: static property of [<code>Chrome</code>](#Chrome)  
**Properties**

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| debug | <code>boolean</code> | <code>true</code> | start Chrome in remote debugging mode |
| port | <code>number</code> | <code>9222</code> | port number of Chrome instance.  Or set env variable CHROME_PORT. |
| headless | <code>boolean</code> | <code>true</code> | start Chrome in headless mode (note: non-headless mode not tested!) |
| disableGpu | <code>boolean</code> | <code>true</code> | passed --disable-gpu to Chrome |
| execPath | <code>string</code> |  | override Chrome exec path, or set env variable CHROME_BIN |
| userDataDir | <code>string</code> \| <code>false</code> |  | path to (possibly existing) dir to use for user data dir.  If none given,    a temporary user data dir is used and cleaned up after exit.  Set to === false to use    default user in your system.  If path is given, the directory isn't removed after exit.    The used value can be obtained as the <code>userDataDir</code> property of the resolved    child process of start(). |
| chromeFlags | <code>Array.&lt;string&gt;</code> |  | array of additional flags to pass to Chrome, e.g. ['--foo'] |
| canary | <code>boolean</code> | <code>false</code> | use Chrome Canary (must be installed on your system) |
| retry | <code>number</code> | <code>3</code> | no. of times to retry to see if Chrome is ready |
| retryInterval | <code>number</code> | <code>100</code> | msecs between retries (incl. first attempt) |
| verbose | <code>boolean</code> | <code>false</code> | outputs additional logs |

<a name="Chrome.flags"></a>

### Chrome.flags : <code>Array.&lt;String&gt;</code>
Default set of flags passed to Chrome.

Source: https://github.com/GoogleChrome/lighthouse/blob/master/lighthouse-cli/chrome-launcher.ts#L64

**Kind**: static property of [<code>Chrome</code>](#Chrome)  
<a name="Chrome.start"></a>

### Chrome.start([options]) ⇒ [<code>Promise.&lt;ChildProcess&gt;</code>](https://nodejs.org/api/child_process.html#child_process_class_childprocess)
Start a Chrome process and wait until it's ready.

**Kind**: static method of [<code>Chrome</code>](#Chrome)  
**Returns**: [<code>Promise.&lt;ChildProcess&gt;</code>](https://nodejs.org/api/child_process.html#child_process_class_childprocess) - In addition to the usual child process properties,
   <code>child.userDataDir</code> contains the temporary user data dir used (unless one was specified).  

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>object</code> | see settings |

<a name="Chrome.ready"></a>

### Chrome.ready([options]) ⇒ <code>Promise</code>
Is the process ready? Attempts to connect (with retry) to process.

**Kind**: static method of [<code>Chrome</code>](#Chrome)  
**Returns**: <code>Promise</code> - resolves or rejects if process is not ready  

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>object</code> | see settings for port, retry, and retryInterval |

<a name="Chrome.kill"></a>

### Chrome.kill(job)
Kill process(es)

**Kind**: static method of [<code>Chrome</code>](#Chrome)  

| Param | Type | Description |
| --- | --- | --- |
| job | <code>ChildProcess</code> \| <code>Array.&lt;number&gt;</code> | spawned process (resolve value of start) or (array of) process ids |

<a name="Chrome.killall"></a>

### Chrome.killall() ⇒ <code>Promise.&lt;Number&gt;</code>
Kill all (headless) Chrome processes

**Kind**: static method of [<code>Chrome</code>](#Chrome)  
**Returns**: <code>Promise.&lt;Number&gt;</code> - no. of processes killed  
<a name="Chrome.list"></a>

### Chrome.list([all]) ⇒ <code>Promise.&lt;Array&gt;</code>
List all (headless) Chrome processes (doesn't list Chrome's child processes)

**Kind**: static method of [<code>Chrome</code>](#Chrome)  
**Returns**: <code>Promise.&lt;Array&gt;</code> - list of processes  

| Param | Type | Description |
| --- | --- | --- |
| [all] | <code>boolean</code> | if given, list all processes (including child) |

<a name="Chrome.version"></a>

### Chrome.version([options]) ⇒ <code>Promise.&lt;VersionInfo&gt;</code>
Get Chrome version info

**Kind**: static method of [<code>Chrome</code>](#Chrome)  

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>object</code> | options.port of Chrome process |

**Example**  
```js
Chrome.version().then(res => console.log)
 // ->
{ Browser: 'HeadlessChrome/60.0.3099.0',
  'Protocol-Version': '1.2',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_4) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/60.0.3099.0 Safari/537.36',
  'V8-Version': '6.0.204',
  'WebKit-Version': '537.36 (@c3445e93b940e12b2e2275e9a985880a58aaa4b0)' }
```
<a name="Chrome.getExecPath"></a>

### Chrome.getExecPath([options]) ⇒ <code>string</code>
Get available Chrome path, checking for existence.

**Kind**: static method of [<code>Chrome</code>](#Chrome)  

| Param | Type | Description |
| --- | --- | --- |
| [options] | <code>object</code> | specify options.canary to prefer Chrome Canary.  Otherwise first checks regular Chrome. |

<a name="CHROME_BIN"></a>

## CHROME_BIN : <code>string</code>
(Environment variable) location
of Chrome executable

**Kind**: global constant  
<a name="CHROME_PORT"></a>

## CHROME_PORT : <code>number</code>
(Environment variable) port to use

**Kind**: global constant  
<a name="__chromate"></a>

## __chromate()
Function loaded in target to communicate back to runner.

**Kind**: global function  
**Example**  
```js
// in target
  if (window.__chromate) __chromate({event: 'done', data: {pass: 10, fail: 1}});
```
