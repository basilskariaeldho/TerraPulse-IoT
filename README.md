# TerraPulse IoT — Firebase + ThingSpeak starter

A phone-friendly starter for multi-user ESP8266/ESP-12E + DHT11 monitoring.

## Included
- Email/password registration and sign-in using Firebase Authentication
- Each account has its own Firestore device list
- Owner-only Firestore rules
- Add a ThingSpeak channel by ID and optional read-only key
- Temperature/humidity charts, latest-reading age, estimated online/offline status
- CSV export
- Basic in-page threshold alerts while the dashboard is open
- ESP8266 Arduino sketch that uploads fields to ThingSpeak

## Important limits / security notes
1. This is a starter project, not a security-audited production service.
2. Do not put a ThingSpeak Write API Key into the website. The firmware uses it on the board; users should keep their own key private.
3. The saved ThingSpeak Read API Key is private to the signed-in owner through Firestore rules, but it is available to that owner's browser. A server-side proxy is stronger for high-security use.
4. The current browser alerts only work while the dashboard is open. For email alerts when the page is closed, configure ThingSpeak React + MATLAB Analysis + Alerts API separately.
5. A channel ID and read key do not prove physical ownership of a device. This starter checks that a channel can be read, but a stronger ownership challenge needs a backend and a one-time device token.
6. The ESP sketch uses `WiFiClientSecure::setInsecure()` for prototype convenience. It encrypts transport but does not validate the server certificate; replace this with certificate validation before production.
7. This code assumes a NodeMCU-style ESP-12E board where D4 maps to GPIO2. Bare ESP-12E modules need appropriate regulated power and boot wiring.
8. ThingSpeak plan limits and API behavior can change; check the current ThingSpeak pricing/licensing documentation before opening the service to many users.

## A. Create Firebase project (phone browser)
1. Open https://console.firebase.google.com/ and create a project.
2. Add a Web App in Project settings. Copy the web configuration.
3. In `public/app.js`, replace `firebaseConfig` values. Do not leave `REPLACE_...` placeholders.
4. Authentication > Sign-in method > enable Email/Password.
5. Authentication > Settings > Authorized domains: ensure your eventual `web.app` domain is listed.
6. Firestore Database > Create database.
7. Firestore > Rules: paste `firestore.rules` and Publish.

## B. Deploy from an Android phone
Recommended no-PC workflow:
1. Create a private GitHub repository and upload the contents of this project ZIP (extract it first).
2. In Firebase Console, open Hosting and follow the available setup/deployment instructions. For CLI-based deployment, use Google Cloud Shell in your mobile browser at https://shell.cloud.google.com/ (Firebase CLI is available there).
3. In Cloud Shell, upload/extract the project folder, then run:
   `firebase login --no-localhost`
   `firebase use --add`
   `firebase deploy --only hosting,firestore:rules`
4. When prompted for the public directory, this project uses `public`. If the CLI is already configured from `firebase.json`, deploy directly.
5. Open the Hosting URL printed after deployment. Use HTTPS.

Cloud Shell workflow can vary by account and browser. If the console requires billing or access permissions, review the prompt before enabling paid services.

## C. Add the board
1. Create a ThingSpeak channel with Field 1 = Temperature, Field 2 = Humidity, Field 3 = Sensor Status.
2. On the ESP board, set Wi-Fi and that channel's Write API Key in `device/esp8266_dht11_thingspeak.ino`.
3. Install ESP8266 board support, Adafruit DHT sensor library, and Adafruit Unified Sensor in your compatible Arduino environment.
4. Upload and verify that ThingSpeak receives entries.
5. For a private channel, copy its Channel ID and Read API Key into the signed-in dashboard. For a public channel, the Read API Key can be left blank.
6. The dashboard reads the last 30 entries and refreshes about every 30 seconds.

## D. Data model
`users/{Firebase UID}/devices/{device document ID}` stores:
- `name`
- `channelId`
- `readKey` (empty for public channels)
- `createdAt`

Firestore rules let only the matching authenticated UID read/list/create/delete documents in that user's devices collection. They deny all other client access.

## E. Alerts
The app's browser alert thresholds are examples: temperature >= 35 C and humidity < 25%. Change them in `public/app.js` for your use case. Browser alerts are not push notifications and stop when the page is closed. For reliable email alerts, configure ThingSpeak React / MATLAB Analysis / Alerts API from the ThingSpeak account, or add a secure server-side scheduled service.

## F. Production checklist
- Verify Firestore rules using the Rules Playground and test with two accounts.
- Enable email verification and consider App Check, rate limiting, and abuse monitoring.
- Add a secure server-side device-ownership verification flow before advertising this publicly.
- Never expose service-account credentials or server secrets in frontend code.
- Consider moving ThingSpeak reads behind a backend if you need stronger credential protection.
