# NaviAble AI hardware integration

## Camera and distance sensor

The phone camera runs the object detector and estimates whether an object looks near or far from its size in the image. It cannot measure metres. For a measured distance, connect a Bluetooth Low Energy (BLE) time-of-flight (ToF) sensor to an ESP32 and mount the sensor facing the same direction as the phone camera.

The sensor reports distance only along its own beam. It does not identify the object, detect objects outside that beam, or prove that a path is clear.

## Wiring

For an I2C ToF module and an ESP32 board:

| ToF module | ESP32 |
| --- | --- |
| VIN / 3V3 | 3.3 V, following the sensor board's voltage specification |
| GND | GND |
| SDA | The board's configured I2C SDA pin |
| SCL | The board's configured I2C SCL pin |

Use the pin assignments and library supported by the exact ESP32 and ToF boards. Secure the sensor beside the camera, keep the beam unobstructed, and add a stable battery supply before wearable use.

### Example ESP32 firmware

The repository includes a starter sketch for an ESP32 paired with a VL53L0X module: [`hardware/esp32_tof_naviable.ino`](../hardware/esp32_tof_naviable.ino). Install the Adafruit VL53L0X library, select the matching ESP32 board, connect the module over I2C, and flash the sketch. It advertises the BLE service below and sends valid readings four times per second. Change the I2C pins in the sketch if your board uses different defaults.

## BLE data contract

The browser connection expects:

- BLE service UUID `0000ffe0-0000-1000-8000-00805f9b34fb`
- Notify characteristic UUID `0000ffe1-0000-1000-8000-00805f9b34fb`
- One ASCII reading per notification in centimetres, for example `NAVIAI:54`
- Valid readings from 1 to 1000 cm

The ESP32 firmware should sample the ToF sensor, reject invalid/out-of-range readings, and notify the characteristic with `NAVIAI:<centimetres>`. The app shows a hardware distance only while a recent notification is arriving. If the BLE service or payload does not match, the app reports that the sensor did not connect or has no current reading.

The included sketch is an example for a VL53L0X sensor; other ToF modules need their own sensor library and range-status checks but can reuse the same BLE UUIDs and payload.

## Connect in the app

1. Open NaviAble AI from a secure browser origin (HTTPS, or localhost during development).
2. Open the AI Vision page and press **Connect ToF sensor**.
3. Choose the ESP32 sensor in the browser's Bluetooth picker.
4. Confirm that a centimetre reading appears in the Distance sensor panel.
5. Press **Describe Area** to hear the current scene and sensor reading.

The browser must support Web Bluetooth. If the browser does not expose Bluetooth, the app will still use the camera's approximate near/far estimate.

## Safety and placement

Treat camera range as visual approximation and ToF as a single-beam measurement. Keep a cane, guide dog, or human guide as the primary mobility aid. Test the full setup while stationary with a sighted helper before carrying it outdoors.
