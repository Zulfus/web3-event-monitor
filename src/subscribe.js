const Web3 = require("web3");
let web3 = null;
let instance = null;

const options = {
  reconnect: {
    auto: true,
    delay: 5000, // ms
    maxAttempts: 5,
    onTimeout: false,
  },
};

class Subscribe {
  providers = [];
  providersPointer = 0;
  lastBlockMap = new Map();
  timeoutMap = new Map();
  cmn;
  subscriptionsMap = new Map();
  unsubscribeMap = new Map();
  clearIntervals = [];

  static getSubscribeInstance() {
    return instance ? instance : new Subscribe();
  }

  setProviders(providersList) {
    if (providersList.length > 0) {
      this.providers = providersList;
      return 1;
    } else {
      console.log("Providers list is empty");
      return -1;
    }
  }

  initWeb3() {
    if (this.providers.length == 0) {
      console.log("Please set providers first");
      return -1;
    } else {
      const provider = this.getCurrentProvider();
      web3 = new Web3(provider, options);
      return 1;
    }
  }

  clearWeb3() {
    web3 = null;
  }

  getCurrentProvider() {
    if (this.providers.length == 0) {
      console.log("No providers set");
      return -1;
    } else {
      return this.providers[this.providersPointer];
    }
  }

  rotateProvider() {
    if (this.providersPointer + 1 == this.providers.length) {
      this.providersPointer = 0;
    } else {
      this.providersPointer++;
    }
  }

  listen({
    ABI,
    address,
    event,
    dataCallback = () => {},
    changedCallback = () => {},
    updateEventHistoryCallback,
    updateEventHistoryTimeout,
    initBlock = 0,
    keepAliveTimeout,
    filter = {},
  }) {
    if (ABI == undefined || address == undefined || event == undefined) {
      console.log("ABI, address or event not defined");
      return -1;
    }

    if (web3 == null) {
      console.log("Please init web3 first");
      return -2;
    } else {
      const contract = new web3.eth.Contract(ABI, address);
      const key = event + " " + address;

      this.subscriptionsMap.set(key, [
        ABI,
        address,
        event,
        dataCallback,
        changedCallback,
        updateEventHistoryCallback,
        updateEventHistoryTimeout,
        initBlock,
        keepAliveTimeout,
        filter,
      ]);

      this.subscribeEvent(
        contract,
        address,
        event,
        dataCallback,
        changedCallback
      );

      if (keepAliveTimeout != undefined) {
        this.keepAlive(address, event, keepAliveTimeout);
      }

      if (updateEventHistoryCallback != undefined) {
        this.lastBlockMap.set(key, initBlock);
        this.updateEventHistory(
          event,
          contract,
          address,
          filter,
          updateEventHistoryCallback,
          updateEventHistoryTimeout
        );
      }
    }

    return 1;
  }

  async subscribeEvent(
    contract,
    address,
    event,
    dataCallback = () => {},
    changedCallback = () => {}
  ) {
    if (contract == undefined || address == undefined || event == undefined) {
      console.log("parameters undefined");
      return -1;
    }

    if (web3 == null) {
      console.log("Please init web3 first");
      return -2;
    } else {
      const connectedCallback = console.log("Subscription connected: " + event);

      const key = event + " " + address;
      this.timeoutMap.set(key, new Date());

      const eventObject = await contract.events[event]()
        .on("data", (data) => dataCallback(data))
        .on("changed", (changed) => changedCallback(changed))
        .on("error", (err) => {
          throw err;
        })
        .on("connected", (str) => connectedCallback);

      this.unsubscribeMap.set(key, eventObject);

      return 1;
    }
  }

  updateEventHistory(
    event,
    contract,
    address,
    filter = {},
    callbackFunction,
    timeout = 5 * 60 * 1000
  ) {
    //checks historic events every x mins incase we missed one (network issues etc.) - default: 5 mins

    if (
      contract == undefined ||
      address == undefined ||
      event == undefined ||
      callbackFunction == undefined
    ) {
      console.log("parameters undefined");
      return;
    }

    if (web3 == null) {
      console.log("Please init web3 first");
      return -2;
    } else {
      const key = event + " " + address;

      const interval = setInterval(() => {
        let options = {
          filter: filter,
          fromBlock: this.lastBlockMap.get(key),
          toBlock: "latest",
        };

        contract
          .getPastEvents(event, options)
          .then((results) => {
            if (results.length > 0) {
              callbackFunction(results);
              const lastBlock = results[results.length - 1].blockNumber;
              this.lastBlockMap.set(key, lastBlock);
            }
          })
          .catch((err) => {
            throw err;
          });
      }, timeout);

      this.clearIntervals.push(interval);
    }
  }

  keepAlive(address, event, timeout) {
    //resets the websocket if it we don't recieve input for x milliseconds

    if (address == undefined || event == undefined || timeout == undefined) {
      console.log("parameters undefined");
      return;
    }

    if (web3 == null) {
      console.log("Please init web3 first");
      return -2;
    } else {
      const interval = setInterval(() => {
        const now = new Date();
        const key = event + " " + address;
        const last = this.timeoutMap.get(key);
        const timeDiff = now - last; //in ms
        if (timeDiff > timeout) {
          console.log(
            "Keep alive timed out for event: " +
              event +
              ". Resetting web socket connections. Resetting all subscriptions."
          );
          console.log("WARN: interrupting any alive subscriptions");
          console.log(
            "INFO: Consider extending timeout interval if subscription may have still been alive"
          );
          this.resetConnection();
        }
      }, timeout);

      this.clearIntervals.push(interval);
    }
  }

  resetConnection() {
    if (web3 == null) {
      console.log("No existing connection");
      return -2;
    } else {
      //unsubscribe all events
      for (const [k, v] of this.unsubscribeMap.entries()) {
        v.unsubscribe();
      }

      //clear all intervals
      this.clearIntervals.forEach((thisInterval) => {
        clearInterval(thisInterval);
      });

      //reset web3
      this.rotateProvider();
      const provider = this.getCurrentProvider();
      web3 = new Web3(provider, options);

      //resubscribe all events
      for (const [k, v] of this.subscriptionsMap.entries()) {
        this.listen({
          ABI: v[0],
          address: v[1],
          event: v[2],
          dataCallback: v[3],
          changedCallback: v[4],
          updateEventHistoryCallback: v[5],
          updateEventHistoryTimeout: v[6],
          initBlock: v[7],
          keepAliveTimeout: v[8],
          filter: v[9],
        });
      }
    }
  }
}

module.exports = Subscribe;
