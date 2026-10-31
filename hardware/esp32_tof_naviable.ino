#include <Wire.h>
#include <Adafruit_VL53L0X.h>
#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>

// Example bridge: VL53L0X distance readings -> NaviAble's BLE contract.
// Install the Adafruit VL53L0X Arduino library. ESP32 Arduino core provides BLE.
static const char* SERVICE_UUID = "0000ffe0-0000-1000-8000-00805f9b34fb";
static const char* DISTANCE_UUID = "0000ffe1-0000-1000-8000-00805f9b34fb";

Adafruit_VL53L0X tof;
BLEServer* bleServer = nullptr;
BLECharacteristic* distanceCharacteristic = nullptr;
bool clientConnected = false;

class NaviServerCallbacks final : public BLEServerCallbacks {
  void onConnect(BLEServer*) override {
    clientConnected = true;
  }

  void onDisconnect(BLEServer* server) override {
    clientConnected = false;
    server->getAdvertising()->start();
  }
};

void setup() {
  Serial.begin(115200);
  Wire.begin();

  if (!tof.begin()) {
    Serial.println("VL53L0X was not found. Check 3.3 V, GND, SDA, and SCL.");
    while (true) delay(1000);
  }

  BLEDevice::init("NaviAble-ToF");
  bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new NaviServerCallbacks());

  BLEService* service = bleServer->createService(SERVICE_UUID);
  distanceCharacteristic = service->createCharacteristic(
    DISTANCE_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  distanceCharacteristic->addDescriptor(new BLE2902());
  distanceCharacteristic->setValue("NAVIAI:0");
  service->start();

  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.println("Advertising as NaviAble-ToF");
}

void loop() {
  VL53L0X_RangingMeasurementData_t measurement;
  tof.rangingTest(&measurement, false);

  // RangeStatus 0 means the sensor reports a valid measurement.
  if (measurement.RangeStatus == 0) {
    const uint16_t centimetres = (measurement.RangeMilliMeter + 5) / 10;
    if (centimetres > 0 && centimetres <= 1000) {
      const String payload = "NAVIAI:" + String(centimetres) + "\n";
      distanceCharacteristic->setValue(payload.c_str());
      if (clientConnected) distanceCharacteristic->notify();
      Serial.print(payload);
    }
  }

  delay(250); // Four readings per second; invalid readings are not advertised.
}
