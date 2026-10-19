/*
 TerraPulse IoT example: NodeMCU ESP8266 + 3-pin DHT11 module.
 Typical wiring (confirm your board/sensor labels first):
 DHT VCC -> 3V3; DATA -> D4 (GPIO2); GND -> GND.
 Install Adafruit DHT sensor library, Adafruit Unified Sensor, and ThingSpeak library.
*/
#include <ESP8266WiFi.h>
#include <DHT.h>
#include <ThingSpeak.h>
#define DHTPIN D4
#define DHTTYPE DHT11
const char* WIFI_SSID = "your_ssid";
const char* WIFI_PASSWORD = "your_wifi_password";
const char* THINGSPEAK_WRITE_KEY = "QWYZTXJMG8ZKLYN8";
WiFiClient client;
DHT dht(DHTPIN, DHTTYPE);
unsigned long lastSend=0;
const unsigned long SEND_INTERVAL_MS=20000;
void setup(){Serial.begin(115200);dht.begin();WiFi.mode(WIFI_STA);WiFi.begin(WIFI_SSID,WIFI_PASSWORD);ThingSpeak.begin(client);Serial.println("TerraPulse IoT starting");}
void loop(){
 if(WiFi.status()!=WL_CONNECTED){WiFi.begin(WIFI_SSID,WIFI_PASSWORD);unsigned long start=millis();while(WiFi.status()!=WL_CONNECTED&&millis()-start<15000){delay(500);Serial.print(".");}Serial.println();if(WiFi.status()!=WL_CONNECTED){delay(3000);return;}}
 if(millis()-lastSend<SEND_INTERVAL_MS){delay(200);return;}lastSend=millis();
 float h=dht.readHumidity(),t=dht.readTemperature();
 if(isnan(h)||isnan(t)){Serial.println("DHT11 read failed; skipping upload.");return;}
 ThingSpeak.setField(1,t);ThingSpeak.setField(2,h);ThingSpeak.setField(3,1);
 int code=ThingSpeak.writeFields(0,THINGSPEAK_WRITE_KEY);
 if(code==200)Serial.printf("Uploaded %.1f C, %.1f %% RH\n",t,h);else Serial.printf("Upload failed: %d\n",code);
}
