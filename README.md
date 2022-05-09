# Web3 Event Monitor

## Install

`npm install web3-event-monitor`

## About

This node module is designed to make managing subscriptions to eth contract events easy by creating a wrapper around a few web3 functions. In particular this module allows you to perform 3 common actions for a given event you want to monitor:

- Create a subscription and call a callback function every time that event is recieved.
- Check periodically for any missed events from historic transactions
- Set a keep alive monitor to periodically check if events have been recieved recently.

## Usage

First import the module then setup the connection. First get the instance, set the providers and initialise web3.

```
const SubscribeService = require("web3-event-monitor");
const sub = SubscribeService.getInstance();
sub.setProviders(["ws://127.0.0.1:7545"]);
sub.initWeb3();
```

Afterwards the easiest way to use the module is by calling listen() with an object containing your parameters. At a minimum you should subscribe to an event, checking the historic transactions for missed events is optional, as is the keepAlive option. Note that the keepAlive function is very aggressive and will perform a full connection reset, unsubscribing all events even one's that haven't timed out. So may cause you to miss events.

Example usage for using all 3 functions, and simply logging events to the console as the callback event to both subscription events and historic events:

```

const SubscribeService = require("subscribe");
const sub = SubscribeService.getSubscribeInstance();
sub.setProviders(["ws://127.0.0.1:7545"]);
sub.initWeb3();

const ABI = ...
const CONTRACT_ADDRESS = ...

sub.listen({
    ABI: ABI,
    address: CONTRACT_ADDRESS,
    event: "YourEventName",
    dataCallback: console.log,
    changedCallback: console.log,
    updateEventHistoryCallback: console.log,
    updateEventHistoryTimeout: 5 * 1000,
    initBlock: 0,
    keepAliveTimeout: 10 * 1000,
});

```

If you simply want to subscribe to an event and get them as they happen and don't care about missed events or keepAlive functionality you can just use:

```
  sub.listen({
    ABI: ABI,
    address: CONTRACT_ADDRESS,
    event: "YourEventName",
    dataCallback: console.log,
  });
```

Notice this doesn't pass a callback for changed events. Changed events are emitted when a previous event becomes part of a chain fork and is orphaned.

## Methods

### getSubscriptionInstance

Returns a singleton instance that manages all subscriptions

`getSubscribeInstance()`

### setProviders

Accepts a list of web3 provider addresses. Returns -1 if provided list is empty.

`sub.setProviders(["ws://127.0.0.1:7545"])`

### initWeb3

Initialises the web3 instance with the first provider from your list. Returns -1 if provider list is not set.

`initWeb3()`

### clearWeb3

Resets the web3 intance to null.

`clearWeb3()`

### getCurrentProvider

Returns the current provider from the list provided. Returns -1 if not set.

`getCurrentProvider()`

### rotateProvider

Rotates the provider list pointer to point to the next provider in the list. This is useful if you want to reset web3 using a new provider, will still require initWeb3() afterwards. ResetConnection() makes use of this.

`rotateProvider()`

### createContract

Creates a contract instance from the provided ABI and contract address. This is a required parameter for subscribeEvent and updateEventHistory.

`createContract(ABI, address)`

### listen

A wrapper around subscribeEvent, updateEventHistory and keepAlive to perform 1 to 3 actions for a single subscription. At a minimun a subscribeEvent is created, with updateEventHistory and keepAlive optional. Accepts an object specifying all parameters.

```
listen({
    ABI,
    contractAddress,
    eventName,
    dataCallback = () => {},
    changedCallback = () => {},
    updateEventHistoryCallback,
    updateEventHistoryTimeout,
    initBlock = 0,
    keepAliveTimeout,
    filter = {},
})
```

### subscribeEvent

Create a subscription to the event at the specified contract. Contract should be created using createContract() first, then all events are passed to the callback functions provided.

```

subscribeEvent(
    contract,
    address,
    event,
    dataCallback = () => {},
    changedCallback = () => {}
)

```

### updateEventHistory

Checks periodically for events from historic blocks beginning at initBlock (default: 0). Subsequent calls check blocks since the previous last checked block. At a minimm the most recent block will always be checked if no events have occured. Timeout is the interval at which the blockchain will be polled, specified in milliseconds. Returns -1 if required parameters are undefined and -2 if web3 is not initialised.

```

updateEventHistory(
    event,
    contract,
    address,
    filter = {},
    callbackFunction,
    timeout = 5 _ 60 _ 1000
    initBlock = 0
)

```

### keepAlive

Set the keep alive for the events contract. If the contract has not sent an event within the timeout period (specified in millisecond), then the connection will be comepletely reset. The web3 provider will be rotated to the next available one, or the same one if only one. All subscriptions will be unsubscribed, then resubscribed. This is an agressive application level reset, in addition to lower level network reconnect options provided by web3.js. Sometimes this can be required if the node becomes unresponsive while the connection is still alive.

`keepAlive(address, event, timeout)`

### resetConnection

Performs a full reset of the connection. Rotating the provider if more than one is available. All subscribtions are cancelled, the web3 instance is recreated, then all events are resubscribed. This will cause downtime for all subscriptions and may cause you to miss events, so should ideally be used in conjection with updateEventHistory.

`resetConnection()`
