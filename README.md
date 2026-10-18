# TerraPulse IoT — full starter structure

Mobile-friendly starter for ESP8266/ESP-12E + DHT11, Firebase Authentication, Firestore, Firebase Hosting, Cloud Functions, and ThingSpeak.

## Files
- `public/`: website served by Firebase Hosting.
- `functions/`: authenticated Cloud Function proxy for ThingSpeak.
- `firestore.rules`: owner-scoped rules.
- `esp8266/`: example firmware.

## Configure before deployment
1. Firebase Console: enable Authentication > Email/Password and create Firestore.
2. Register a Firebase Web App. Copy its `apiKey` and `appId` into `public/app.js`. The project ID/auth domain are preset for `terrapulse-iot`; verify they match your Firebase project.
3. Review and test Firestore rules before production.
4. Cloud Functions deployment usually requires the Firebase Blaze billing plan. Ask a parent/guardian to review possible charges before enabling billing; budget alerts are not hard spending caps.
5. Create a ThingSpeak channel with Field 1 Temperature, Field 2 Humidity, Field 3 Sensor Status.
6. Put Wi-Fi credentials and the ThingSpeak Write API Key in the local firmware only. Do not commit real credentials to GitHub.
7. Check the installed ThingSpeak Arduino library's `writeFields` signature before flashing; library versions may differ.

## Deploy from Google Cloud Shell
Upload/extract this folder in Cloud Shell, open a terminal at the project root, then run:
```bash
npm --prefix functions install
firebase login --no-localhost
firebase use --add
firebase deploy --only hosting,firestore:rules,functions
```
Select `terrapulse-iot` when prompted. Never paste passwords or access tokens into chat.

## Important
This is a starter, not a security-audited production system. The function checks authentication and reads only the caller's own device record. The browser shows recent data but cannot prove the board is currently reachable. Keep API keys private.
