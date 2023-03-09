import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge'
import { HubSpace, HubSpaceConfig } from './hubspace'

import { HubspaceHomebridgePlatform } from './platform'

function convertColorTemperature(temp: number): number {
  return Math.floor(1000000 / temp)
}

function convertHue(hue: number): number {
  return Math.floor(hue / 360);
}

// https://stackoverflow.com/a/17243070
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h /= 360;
  s /= 100;
  v /= 100;

  var r, g, b, i, f, p, q, t;
  /*if (arguments.length === 1) {
      s = h.s, v = h.v, h = h.h;
  }*/
  i = Math.floor(h * 6);
  f = h * 6 - i;
  p = v * (1 - s);
  q = v * (1 - f * s);
  t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v, g = t, b = p; break;
    case 1: r = q, g = v, b = p; break;
    case 2: r = p, g = v, b = t; break;
    case 3: r = p, g = q, b = v; break;
    case 4: r = t, g = p, b = v; break;
    case 5: r = v, g = p, b = q; break;
  }
  /*return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
  };*/
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}


/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class HubspacePlatformAccessory {
  private service: Service
  private hsConfig: HubSpaceConfig

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private state = {
    on: false,
    brightness: 100,
    //temperature: 2500,
    mode: '',
    //rgb: [0, 0, 0],
    hue: 0,
    saturation: 0,
  }

  constructor(private readonly platform: HubspaceHomebridgePlatform, private readonly accessory: PlatformAccessory) {
    this.hsConfig = {
      username: this.platform.config.username,
      password: this.platform.config.password,
      refreshToken: this.platform.config.refreshToken,
      accountId: this.platform.config.accountId,
    }
    // set accessory information
    /*this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, this.accessory.context.device.description.device.manufacturerName)
      .setCharacteristic(this.platform.Characteristic.Model, this.accessory.context.device.description.device.model)*/
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'OpenRGB')
      .setCharacteristic(this.platform.Characteristic.Model, 'RGB Device')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, '9876543210');

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb)

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.friendlyName)

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this)) // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this)) // GET - bind to the `getOn` method below

    // register handlers for the Brightness Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.Brightness)
      .onSet(this.setBrightness.bind(this))
      .onGet(this.getBrightness.bind(this))

    /*this.service
      .getCharacteristic(this.platform.Characteristic.ColorTemperature)
      .onSet(this.setColorTemperature.bind(this))
      .onGet(this.getColorTemperature.bind(this))*/

    // register handlers for the Hue Characteristic
    this.service
      .getCharacteristic(this.platform.Characteristic.Hue)
      .onSet(this.setHue.bind(this))
      .onGet(this.getHue.bind(this))
    // this.service.getCharacteristic(this.platform.Characteristic.Saturation).onSet(this.setSaturation.bind(this))

    // register handlers for the Saturation Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.Saturation)
      .onSet(this.setSaturation.bind(this))
      .onGet(this.getSaturation.bind(this));


    /**
     * Creating multiple services of the same type.
     *
     * To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
     * when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
     * this.accessory.getService('NAME') || this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE_ID');
     *
     * The USER_DEFINED_SUBTYPE must be unique to the platform accessory (if you platform exposes multiple accessories, each accessory
     * can use the same sub type id.)
     */

    // // Example: add two "motion sensor" services to the accessory
    // const motionSensorOneService =
    //   this.accessory.getService('Motion Sensor One Name') ||
    //   this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor One Name', 'YourUniqueIdentifier-1')

    // const motionSensorTwoService =
    //   this.accessory.getService('Motion Sensor Two Name') ||
    //   this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor Two Name', 'YourUniqueIdentifier-2')

    /**
     * Updating characteristics values asynchronously.
     *
     * Example showing how to update the state of a Characteristic asynchronously instead
     * of using the `on('get')` handlers.
     * Here we change update the motion sensor trigger states on and off every 10 seconds
     * the `updateCharacteristic` method.
     *
     */
    // let motionDetected = false
    // setInterval(() => {
    //   // EXAMPLE - inverse the trigger
    //   motionDetected = !motionDetected

    //   // push the new value to HomeKit
    //   motionSensorOneService.updateCharacteristic(this.platform.Characteristic.MotionDetected, motionDetected)
    //   motionSensorTwoService.updateCharacteristic(this.platform.Characteristic.MotionDetected, !motionDetected)

    //   this.platform.log.debug('Triggering motionSensorOneService:', motionDetected)
    //   this.platform.log.debug('Triggering motionSensorTwoService:', !motionDetected)
    // }, 10000)
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    const hs = new HubSpace(this.hsConfig)
    await hs.setDeviceFunctionState(this.accessory.context.device.friendlyName, 'power', value ? 'on' : 'off')

    this.state.on = value as boolean
    this.platform.log.debug('Set Characteristic On ->', value)
    //this.platform.log.debug(JSON.stringify(await hs.getDeviceFunctionStates(this.accessory.context.device.friendlyName)));
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getOn(): Promise<CharacteristicValue> {
    const h = new HubSpace(this.hsConfig)
    const currentState = await h.getDeviceFunctionState(this.accessory.context.device.friendlyName, 'power')
    const isOn = currentState.state?.value === 'on' ? true : false

    this.platform.log.debug('Get Characteristic On ->', isOn)

    // if you need to return an error to show the device as "Not Responding" in the Home app:
    // throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);

    return isOn
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  async setBrightness(value: CharacteristicValue) {
    const h = new HubSpace(this.hsConfig)
    if (value === 0) {
      return
    }
    await h.setDeviceFunctionState(this.accessory.context.device.friendlyName, 'brightness', value as number)
    this.state.brightness = value as number

    this.platform.log.debug('Set Characteristic Brightness -> ', value)
  }

  async getBrightness(): Promise<CharacteristicValue> {
    const h = new HubSpace(this.hsConfig)
    const currentState = await h.getDeviceFunctionState(this.accessory.context.device.friendlyName, 'brightness')
    const brightness = currentState.state?.value

    this.platform.log.debug('Get Characteristic Brightness -> ', brightness)

    return brightness
  }

  /*async setColorTemperature(value: CharacteristicValue) {
    const h = new HubSpace(this.hsConfig)
    if (value === 0) {
      return
    }
    await h.setDeviceFunctionState(
      this.accessory.context.device.friendlyName,
      'color-temperature',
      convertColorTemperature(value as number),
    )
    this.state.temperature = convertColorTemperature(value as number)
    this.platform.log.debug('Set Characteristic Temperature -> ', value)
  }

  async getColorTemperature(): Promise<CharacteristicValue> {
    const h = new HubSpace(this.hsConfig)
    const currentState = await h.getDeviceFunctionState(this.accessory.context.device.friendlyName, 'color-temperature')
    const temperature = convertColorTemperature(Number(currentState.state?.value))

    this.platform.log.debug('Get Characteristic Temperature -> ', temperature)

    return temperature
  }*/

  async setHue(value: CharacteristicValue) {
    let saturation = this.state.saturation;
    if (Number.isNaN(value)) {
      value = 0
    }
    //await h.setDeviceFunctionState(this.accessory.context.device.friendlyName, 'hue', convertHue(value as number) as number)
    let [r, g, b] = hsvToRgb(value as number, saturation, 100)
    if ((r === 0 && g === 0 && b === 0) || (saturation == 0 && value == 0)) {
      r = 255, g = 255, b = 255
    }
    //this.platform.log.debug(`Converted ${value} hue and ${saturation} saturation to -> `, r, g, b)
    const h = new HubSpace(this.hsConfig)
    await h.setDeviceFunctionState(this.accessory.context.device.friendlyName, 'color-rgb', {
      "color-rgb": {
        "r": r,
        "b": b,
        "g": g
      }
    })
    this.state.hue = convertHue(value as number)

    this.platform.log.debug('Set Characteristic Hue -> ', value)
  }

  async getHue(): Promise<CharacteristicValue> {
    const h = new HubSpace(this.hsConfig);
    const currentState = await h.getDeviceFunctionState(this.accessory.context.device.friendlyName, 'hue')
    const hue = convertHue(currentState.state?.value)

    this.platform.log.debug('Get Characteristic Hue -> ', hue)

    return hue
  }

  async setSaturation(value: CharacteristicValue) {
    //const h = new HubSpace(this.hsConfig)
    if (Number.isNaN(value)) {
      value = 0
    }
    //await h.setDeviceFunctionState(this.accessory.context.device.friendlyName, 'saturation', convertSaturation(value as number))

    /*let [r, g, b] = hsvToRgb(this.state.hue, value as number, 100)
    if ((r === 0 && g === 0 && b === 0) || (this.state.hue = 0 && value == 0)) {
      r = 255, g = 255, b = 255
    }
    await h.setDeviceFunctionState(this.accessory.context.device.friendlyName, 'color-rgb', {
      "color-rgb": {
        "r": r,
        "b": b,
        "g": g
      }*
    })*/

    this.state.saturation = value as number
    this.platform.log.debug('Set Characteristic Saturation -> ', value)
  }


  async getSaturation(): Promise<CharacteristicValue> {
    const h = new HubSpace(this.hsConfig)
    const currentState = await h.getDeviceFunctionState(this.accessory.context.device.friendlyName, 'saturation')
    const saturation = currentState.state?.value || this.state.saturation //convertSaturation(currentState.state?.value)

    this.platform.log.debug('Get Characteristic Saturation -> ', saturation)

    return saturation
    //return 100;
  }


  // async setHue(value: CharacteristicValue) {
  //   const h = new HubSpace(this.hsConfig)
  //   if (value === 0) {
  //     return
  //   }
  //   await h.setDeviceFunctionState(this.accessory.context.device.friendlyName, 'brightness', value as number)
  //   this.state.brightness = value as number

  //   this.platform.log.debug('Set Characteristic Brightness -> ', value)
  // }

  // async setSaturation(value: CharacteristicValue) {
  //   this.platform.log.debug('Saturation Set -> ', value)
  // }
}
