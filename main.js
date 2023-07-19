"use strict";

/*
 * Created with @iobroker/create-adapter v2.3.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const axios = require("axios");

class BluOSAdapter extends utils.Adapter {
  constructor(options) {
    super({
      ...options,
      name: "bluos",
    });
    this.devicesDir = `${this.namespace}.BluOS.Devices`;
    this.groupsDir = `${this.namespace}.BluOS.Groups`;
    this.devicesConfig = {
      type: 'array',
      title: 'Devices',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            title: 'Name'
          },
          ip: {
            type: 'string',
            title: 'IP Address'
          }
        }
      }
    };
    this.groupsConfig = {
      type: 'array',
      title: 'Groups',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            title: 'Name'
          },
          devices: {
            type: 'array',
            title: 'Devices',
            items: {
              type: 'string'
            }
          }
        }
      }
    };
    this.devices = [];
  }

  async onReady() {
    // Initialize your adapter here

    // Reset the connection indicator during startup
    this.setState("info.connection", false, true);

    // The adapters config (in the instance object everything under the attribute "native") is accessible via
    // this.config:
    this.log.info("config Player Name: " + this.config["Player Name"]);
    this.log.info("config Player IP: " + this.config["Player IP"]);

    // Get devices configuration
    const devicesConfig = await this.getForeignObjectAsync(this.devicesDir);
    if (devicesConfig && devicesConfig.common && devicesConfig.common.default) {
      this.devices = JSON.parse(devicesConfig.common.default);
    }

    // Get groups configuration
    const groupsConfig = await this.getForeignObjectAsync(this.groupsDir);
    if (!groupsConfig || !groupsConfig.common || !groupsConfig.common.default) {
      await this.extendForeignObjectAsync(this.groupsDir, {
        common: {
          default: JSON.stringify([]),
          schema: this.groupsConfig
        }
      });
    }

    // Subscribe to device configuration changes
    this.subscribeForeignObjects(this.devicesDir);

    // Create device control states
    for (const device of this.devices) {
      const deviceDir = `${this.namespace}.BluOS.${device.name}`;
      const playDataPoint = `${deviceDir}.Play`;
      const skipDataPoint = `${deviceDir}.Skip`;
      const backDataPoint = `${deviceDir}.Back`;
      const pauseDataPoint = `${deviceDir}.Pause`;
      const volumeDataPoint = `${deviceDir}.Volume`;
      const statusDataPoint = `${deviceDir}.Status`;

      this.setObjectNotExists(playDataPoint, {
        type: 'state',
        common: {
          name: 'Play',
          role: 'button',
          type: 'boolean',
          read: false,
          write: true,
          def: false,
          desc: 'Play'
        },
        native: {}
      });

      this.setObjectNotExists(skipDataPoint, {
        type: 'state',
        common: {
          name: 'Skip',
          role: 'button',
          type: 'boolean',
          read: false,
          write: true,
          def: false,
          desc: 'Skip'
        },
        native: {}
      });

      this.setObjectNotExists(backDataPoint, {
        type: 'state',
        common: {
          name: 'Back',
          role: 'button',
          type: 'boolean',
          read: false,
          write: true,
          def: false,
          desc: 'Back'
        },
        native: {}
      });

      this.setObjectNotExists(pauseDataPoint, {
        type: 'state',
        common: {
          name: 'Pause',
          role: 'button',
          type: 'boolean',
          read: false,
          write: true,
          def: false,
          desc: 'Pause'
        },
        native: {}
      });

      this.setObjectNotExists(volumeDataPoint, {
        type: 'state',
        common: {
          name: 'Volume',
          role: 'level.volume',
          type: 'number',
          read: true,
          write: true,
          def: 50,
          desc: 'Volume'
        },
        native: {}
      });

      this.setObjectNotExists(statusDataPoint, {
        type: 'state',
        common: {
          name: 'Status',
          role: 'media.status',
          type: 'string',
          read: true,
          write: false,
          desc: 'Player Status'
        },
        native: {}
      });

      this.subscribeStates(playDataPoint);
      this.subscribeStates(skipDataPoint);
      this.subscribeStates(backDataPoint);
      this.subscribeStates(pauseDataPoint);
      this.subscribeStates(volumeDataPoint);

      this.on('stateChange', async (id, state) => {
        if (!state || state.ack) {
          return;
        }

        const deviceId = id.split('.').pop();
        const deviceIp = this.devices.find(device => device.name === deviceId).ip;

        if (id.endsWith('Play') && state.val === true) {
          await this.controlPlayback(deviceIp, 'play');
        } else if (id.endsWith('Skip') && state.val === true) {
          await this.controlPlayback(deviceIp, 'skip');
        } else if (id.endsWith('Back') && state.val === true) {
          await this.controlPlayback(deviceIp, 'back');
        } else if (id.endsWith('Pause') && state.val === true) {
          await this.controlPlayback(deviceIp, 'pause');
        } else if (id.endsWith('Volume')) {
          const volume = state.val;
          await this.setVolume(deviceIp, volume);
        }
      });

      this.startPlayerStatusPolling(device.name);
    }
  }

  async controlPlayback(deviceIp, command) {
    const url = `http://${deviceIp}:11000/Play`;
    const params = { command };
    await axios.post(url, params);
  }

  async setVolume(deviceIp, volume) {
    const url = `http://${deviceIp}:11000/Volume`;
    const params = { volume };
    await axios.post(url, params);
  }

  async getPlayerStatus(deviceName) {
    const device = this.devices.find(device => device.name === deviceName);
    if (!device) {
      return;
    }

    const url = `http://${device.ip}:11000/Status`;
    const response = await axios.get(url);
    const statusDataPoint = `${this.namespace}.BluOS.${device.name}.Status`;
    this.setStateAsync(statusDataPoint, JSON.stringify(response.data));
  }

  startPlayerStatusPolling(deviceName) {
    setInterval(() => {
      this.getPlayerStatus(deviceName);
    }, 1000);
  }

  async onForeignObjectChange(id, obj) {
    if (id === this.devicesDir) {
      if (obj && obj.common && obj.common.default) {
        this.devices = JSON.parse(obj.common.default);
      } else {
        this.devices = [];
      }
    }
  }

  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   * @param {() => void} callback
   */
  onUnload(callback) {
    try {
      // Here you must clear all timeouts or intervals that may still be active
      // clearTimeout(timeout1);
      // clearTimeout(timeout2);
      // ...
      // clearInterval(interval1);

      callback();
    } catch (e) {
      callback();
    }
  }

  // If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
  // You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
  // /**
  //  * Is called if a subscribed object changes
  //  * @param {string} id
  //  * @param {ioBroker.Object | null | undefined} obj
  //  */
  // onObjectChange(id, obj) {
  // 	if (obj) {
  // 		// The object was changed
  // 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
  // 	} else {
  // 		// The object was deleted
  // 		this.log.info(`object ${id} deleted`);
  // 	}
  // }

  /**
   * Is called if a subscribed state changes
   * @param {string} id
   * @param {ioBroker.State | null | undefined} state
   */
  onStateChange(id, state) {
    if (state) {
      // The state was changed
      this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
    } else {
      // The state was deleted
      this.log.info(`state ${id} deleted`);
    }
  }

  // If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
  // /**
  //  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
  //  * Using this method requires "common.messagebox" property to be set to true in io-package.json
  //  * @param {ioBroker.Message} obj
  //  */
  // onMessage(obj) {
  // 	if (typeof obj === "object" && obj.message) {
  // 		if (obj.command === "send") {
  // 			// e.g. send email or pushover or whatever
  // 			this.log.info("send command");

  // 			// Send response in callback if required
  // 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
  // 		}
  // 	}
  // }
}

if (module.parent) {
  module.exports = (options) => new BluOSAdapter(options);
} else {
  // otherwise start the instance directly
  new BluOSAdapter();
}
