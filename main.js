"use strict";

/*
 * Created with @iobroker/create-adapter v2.3.0
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");

// Load your modules here, e.g.:
// const fs = require("fs");


class BluOSAdapter extends utils.Adapter {
  constructor(options) {
    super({
      ...options,
      name: 'bluos-adapter',
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

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here

		// Reset the connection indicator during startup
		this.setState("info.connection", false, true);

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		this.log.info("config Player Name: " + this.config.Player Name);
		this.log.info("config Player IP: " + this.config.Player IP);

		/*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/
		await this.setObjectNotExistsAsync("testVariable", {
			type: "state",
			common: {
				name: "testVariable",
				type: "boolean",
				role: "indicator",
				read: true,
				write: true,
			},
			native: {},
		});

		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		this.subscribeStates("testVariable");
		// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// this.subscribeStates("lights.*");
		// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// this.subscribeStates("*");

		/*
			setState examples
			you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		*/
		// the variable testVariable is set to true as command (ack=false)
		await this.setStateAsync("testVariable", true);

		// same thing, but the value is flagged "ack"
		// ack should be always set to true if the value is received from or acknowledged from the target system
		await this.setStateAsync("testVariable", { val: true, ack: true });

		// same thing, but the state is deleted after 30s (getState will return null afterwards)
		await this.setStateAsync("testVariable", { val: true, ack: true, expire: 30 });

		// examples for the checkPassword/checkGroup functions
		let result = await this.checkPasswordAsync("admin", "iobroker");
		this.log.info("check user admin pw iobroker: " + result);

		result = await this.checkGroupAsync("admin", "admin");
		this.log.info("check group user admin group admin: " + result);
	}
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
}

if (module.parent) {
  module.exports = (options) => new BluOSAdapter(options);
} else {
  (() => new BluOSAdapter())();
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

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new Bluos(options);
} else {
	// otherwise start the instance directly
	new Bluos();
}
