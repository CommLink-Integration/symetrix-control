# symetrix-control
 Implements v7.0 of the Composer Control Protocol from Symetrix

The Composer Control Protocol is a Telnet-style command/response API which is not typically well-suited to Javascript's asynchronous model. This package gets around that by keeping command requests and callbacks in a FIFO buffer and when a response is received from the endpoint, the callback is executed and the next command is sent. 
This package guarantees that commands are sent in the order in which they are called. 

You get Promises as a consumer of this package so every command takes the form of:
```js
symetrix.command()
        .then((data) => {
            console.log(data);
        })
        .catch((err) => console.log(err));
```
Additional commands can be nested inside returned Promises if desired

## Install
`npm install symetrix-control`

## Quick start

```js
const Symetrix = require('symetrix-control');

this.sym = new Symetrix({ host: '172.16.10.200' });

this.sym.on('connected', () => {
    this.sym.on('push', (data) => {
        console.log('Push received from Symetrix', data);
    });

    this.sym
        .pushState(true)
        .then((data) => {
            console.log('push state:', data);
        })
        .catch((err) => console.log(err));

    this.sym
        .controlGet(1000)
        .then((data) => {
            console.log('get:', data);
        })
        .catch((err) => console.log(err));

    this.sym
        .pushRefresh()
        .then((data) => {
            console.log('refresh push:', data);
        })
        .catch((err) => console.log(err));

    this.sym
        .controlGetBlock(1000, 10)
        .then((data) => {
            console.log('get block:', data);
        })
        .catch((err) => console.log(err));

    this.sym
        .flashUnit()
        .then((data) => {
            console.log('flash:', data);
        })
        .catch((err) => console.log(err));
});
```

<a name="Symetrix"></a>

## Symetrix

**Kind**: global class  

* [Symetrix](#Symetrix)
    * [.controlSet(id, value)](#Symetrix+controlSet) ⇒ <code>Promise</code>
    * [.controlChange(id, value)](#Symetrix+controlChange) ⇒ <code>Promise</code>
    * [.controlGet(id)](#Symetrix+controlGet) ⇒ <code>Promise</code>
    * [.controlGetBlock(id, size)](#Symetrix+controlGetBlock) ⇒ <code>Promise</code>
    * [.reboot()](#Symetrix+reboot) ⇒ <code>Promise</code>
    * [.flashUnit()](#Symetrix+flashUnit) ⇒ <code>Promise</code>
    * [.setSystemString(resource, value)](#Symetrix+setSystemString) ⇒ <code>Promise</code>
    * [.getSystemString(resource)](#Symetrix+getSystemString) ⇒ <code>Promise</code>
    * [.getPreset()](#Symetrix+getPreset) ⇒ <code>Promise</code>
    * [.loadPreset(id)](#Symetrix+loadPreset) ⇒ <code>Promise</code>
    * [.pushState(enable, [low], [high])](#Symetrix+pushState) ⇒ <code>Promise</code>
    * [.getPushEnabled([low], [high])](#Symetrix+getPushEnabled) ⇒ <code>Promise</code>
    * [.pushRefresh([low], [high])](#Symetrix+pushRefresh) ⇒ <code>Promise</code>
    * [.pushClear([low], [high])](#Symetrix+pushClear) ⇒ <code>Promise</code>
    * [.pushInterval(value)](#Symetrix+pushInterval) ⇒ <code>Promise</code>
    * [.pushThreshold([meter], [other])](#Symetrix+pushThreshold) ⇒ <code>Promise</code>

<a name="Symetrix+controlSet"></a>

### symetrix.controlSet(id, value) ⇒ <code>Promise</code>
Use this command to move a controller position on the currently addressed unit to a new absolute value

**Kind**: instance method of [<code>Symetrix</code>](#Symetrix)  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>number</code> | the control ID to set, between 1 and 10000 |
| value | <code>number</code> | the value to set the control ID to, between 0 and 65535 |

<a name="Symetrix+controlChange"></a>

### symetrix.controlChange(id, value) ⇒ <code>Promise</code>
Use this command to move a controller to a new relative value. This command will increment or decrement
a controller by a specified amount

**Kind**: instance method of [<code>Symetrix</code>](#Symetrix)  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>number</code> | the control ID to set, between 1 and 10000 |
| value | <code>number</code> | the value to change the control ID by, between -65535 and 65535 |

<a name="Symetrix+controlGet"></a>

### symetrix.controlGet(id) ⇒ <code>Promise</code>
This command will return the controller position (value) associated with a specific controller number

**Kind**: instance method of [<code>Symetrix</code>](#Symetrix)  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>number</code> | the control ID to get, between 1 and 10000 |

<a name="Symetrix+controlGetBlock"></a>

### symetrix.controlGetBlock(id, size) ⇒ <code>Promise</code>
This command will return the controller position (value) of a specific range of consecutive controller numbers.

**Kind**: instance method of [<code>Symetrix</code>](#Symetrix)  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>number</code> | the first control ID to get, between 1 and 10000 |
| size | <code>number</code> | the number of consecutive control IDs to get, between 1 and 256 |

<a name="Symetrix+reboot"></a>

### symetrix.reboot() ⇒ <code>Promise</code>
This command will instantly reboot the unit

**Kind**: instance method of [<code>Symetrix</code>](#Symetrix)  
<a name="Symetrix+flashUnit"></a>

### symetrix.flashUnit() ⇒ <code>Promise</code>
This command momentarily flashes the front panel LEDs of the unit being addressed

**Kind**: instance method of [<code>Symetrix</code>](#Symetrix)  
<a name="Symetrix+setSystemString"></a>

### symetrix.setSystemString(resource, value) ⇒ <code>Promise</code>
This command sets a system string such as a speed dial name or number. Refer to the Composer Control
documentation for details on valid strings and values

**Kind**: instance method of [<code>Symetrix</code>](#Symetrix)  

| Param | Type | Description |
| --- | --- | --- |
| resource | <code>string</code> | the string resource to set |
| value | <code>string</code> | the value to set the string resource to |

<a name="Symetrix+getSystemString"></a>

### symetrix.getSystemString(resource) ⇒ <code>Promise</code>
This command sets a system string such as a speed dial name or number. Refer to the Composer Control
documentation for details on valid strings

**Kind**: instance method of [<code>Symetrix</code>](#Symetrix)  

| Param | Type | Description |
| --- | --- | --- |
| resource | <code>string</code> | the string resource to get |

<a name="Symetrix+getPreset"></a>

### symetrix.getPreset() ⇒ <code>Promise</code>
This command will return the last preset that was loaded

**Kind**: instance method of [<code>Symetrix</code>](#Symetrix)  
<a name="Symetrix+loadPreset"></a>

### symetrix.loadPreset(id) ⇒ <code>Promise</code>
This command will load the specified preset (1-1000) on the currently addressed unit.

**Kind**: instance method of [<code>Symetrix</code>](#Symetrix)  

| Param | Type | Description |
| --- | --- | --- |
| id | <code>number</code> | the preset number to set, between 1 and 1000 |

<a name="Symetrix+pushState"></a>

### symetrix.pushState(enable, [low], [high]) ⇒ <code>Promise</code>
This command enables or disables the push feature for an individual controller or range of controllers.
To select an individual controller to enable/disable push on set high equal to low
Using the default values will enable or disable pushing for all control IDs

**Kind**: instance method of [<code>Symetrix</code>](#Symetrix)  

| Param | Type | Description |
| --- | --- | --- |
| enable | <code>boolean</code> | if push should be enabled or disabled |
| [low] | <code>number</code> | the lowest control ID that should be enabled/disabled, defaults to 1 |
| [high] | <code>number</code> | the highest control ID that should be enabled/disabled, defaults to 10000 |

<a name="Symetrix+getPushEnabled"></a>

### symetrix.getPushEnabled([low], [high]) ⇒ <code>Promise</code>
This command returns a list of all controllers currently enabled for push on the addressed device.
To select an individual controller set high equal to low
Using the default values will query all control IDs

**Kind**: instance method of [<code>Symetrix</code>](#Symetrix)  

| Param | Type | Description |
| --- | --- | --- |
| [low] | <code>number</code> | the lowest control ID that should be queried, defaults to 1 |
| [high] | <code>number</code> | the highest control ID that should be queried, defaults to 10000 |

<a name="Symetrix+pushRefresh"></a>

### symetrix.pushRefresh([low], [high]) ⇒ <code>Promise</code>
This command causes data to be pushed immediately even if it hasn’t changed (assuming push is enabled).
To select an individual controller to refresh set high equal to low. Using the default values will
refresh all control IDs

**Kind**: instance method of [<code>Symetrix</code>](#Symetrix)  

| Param | Type | Description |
| --- | --- | --- |
| [low] | <code>number</code> | the lowest control ID that should be refreshed, defaults to 1 |
| [high] | <code>number</code> | the highest control ID that should be refreshed, defaults to 10000 |

<a name="Symetrix+pushClear"></a>

### symetrix.pushClear([low], [high]) ⇒ <code>Promise</code>
This command causes previous changes in data to be ignored and not pushed. It may be desirable to issue
this command when first enabling push to prevent being swamped by the flood incoming data.
To select an individual controller to clear set high equal to low. Using the default values will
clear all control IDs

**Kind**: instance method of [<code>Symetrix</code>](#Symetrix)  

| Param | Type | Description |
| --- | --- | --- |
| [low] | <code>number</code> | the lowest control ID that should be refreshed, defaults to 1 |
| [high] | <code>number</code> | the highest control ID that should be refreshed, defaults to 10000 |

<a name="Symetrix+pushInterval"></a>

### symetrix.pushInterval(value) ⇒ <code>Promise</code>
This command changes the minimum length of time between consecutive pushes of data. At power-up,
this value defaults to 100 milliseconds. Interval must be between 20 (20ms) and 30000 (30s)

**Kind**: instance method of [<code>Symetrix</code>](#Symetrix)  

| Param | Type | Description |
| --- | --- | --- |
| value | <code>number</code> | the new push interval in milliseconds |

<a name="Symetrix+pushThreshold"></a>

### symetrix.pushThreshold([meter], [other]) ⇒ <code>Promise</code>
This command changes the push threshold value. The threshold is the amount a value must change from
the previous push before it is pushed again. SymNet maintains two thresholds: one for parameter data
such as faders and buttons, and another for meters (including LEDs). It may be desirable to use a
large threshold for meters to avoid constant pushing of values. The power-on default for both is 1.

**Kind**: instance method of [<code>Symetrix</code>](#Symetrix)  

| Param | Type | Description |
| --- | --- | --- |
| [meter] | <code>number</code> | the threshold for meters, defaults to 1 |
| [other] | <code>number</code> | the threshold for everything else, defaults to 1 |