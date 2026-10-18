#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <DHT.h>

// NodeMCU-style ESP-12E: D4 = GPIO2
#define DHTPIN D4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

const char* WIFI_NAME = "AMMU";
const char* WIFI_PASSWORD = "kl17z2143";
const char* THINGSPEAK_WRITE_KEY = "QWYZTXJMG8ZKLYN8";

const unsigned long UPLOAD_MS = 20000; // free plan: keep >= 15000 ms
unsigned long lastUpload = 0;

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_NAME, WIFI_PASSWORD);
  Serial.print("Connecting");
  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) {
    delay(500); Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("Wi-Fi connected; IP: ");
    Serial.println(WiFi.localIP());
  } else Serial.println("Wi-Fi unavailable; will retry.");
}

bool sendReading(float temp, float humidity, bool sensorOK) {
  if (WiFi.status() != WL_CONNECTED) return false;

  String url = "https://api.thingspeak.com/update?api_key=";
  url += THINGSPEAK_WRITE_KEY;
  if (sensorOK) {
    url += "&field1=" + String(temp, 1);
    url += "&field2=" + String(humidity, 1);
  }
  url += "&field3=";
  url += sensorOK ? "1" : "0";

  WiFiClientSecure client;
  // Prototype convenience only: does not verify the server certificate.
  // For production, configure certificate validation.
  client.setInsecure();
  HTTPClient https;
  https.setTimeout(10000);
  if (!https.begin(client, url)) return false;
  int code = https.GET();
  String body = https.getString();
  https.end();
  Serial.printf("HTTP %d; ThingSpeak entry: %s\n", code, body.c_str());
  return code == HTTP_CODE_OK && body.toInt() > 0;
}

void setup() {
  Serial.begin(115200);
  delay(300);
  dht.begin();
  connectWiFi();
}

void loop() {
  connectWiFi();
  if (millis() - lastUpload >= UPLOAD_MS) {
    lastUpload = millis();
    float h = dht.readHumidity();
    float t = dht.readTemperature();
    bool ok = !isnan(t) && !isnan(h) &&
              t >= 0 && t <= 50 && h >= 0 && h <= 100;
    if (ok) {
      Serial.printf("Temperature %.1f C; humidity %.1f %%\n", t, h);
    } else {
      Serial.println("DHT11 read failed; reporting sensor status 0.");
    }
    if (sendReading(t, h, ok)) Serial.println("Cloud update successful.");
    else Serial.println("Cloud update failed; check Wi-Fi/key/interval.");
  }
  delay(100);
}