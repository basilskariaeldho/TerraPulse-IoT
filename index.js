const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp();
const db = getFirestore();

// Reads only a device belonging to the authenticated caller. Never accept a channel/key from the client.
exports.getThingSpeakFeed = onCall({ region: "us-central1", maxInstances: 5 }, async request => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Please sign in first.");
  const deviceId = request.data && request.data.deviceId;
  if (typeof deviceId !== "string" || !/^[A-Za-z0-9_-]{1,150}$/.test(deviceId))
    throw new HttpsError("invalid-argument", "A valid deviceId is required.");
  const snap = await db.collection("users").doc(request.auth.uid).collection("devices").doc(deviceId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Device not found in your account.");
  const d = snap.data(), channelId = String(d.channelId || "");
  if (!/^\d+$/.test(channelId)) throw new HttpsError("failed-precondition", "Invalid channel ID.");
  const params = new URLSearchParams({results:"30"});
  if (!d.isPublic && d.readApiKey) params.set("api_key", String(d.readApiKey));
  let response;
  try { response = await fetch(`https://api.thingspeak.com/channels/${channelId}/feeds.json?${params}`, {signal:AbortSignal.timeout(10000)}); }
  catch { throw new HttpsError("unavailable", "Could not contact ThingSpeak. Try again shortly."); }
  if (!response.ok) throw new HttpsError("unavailable", `ThingSpeak returned HTTP ${response.status}.`);
  const data = await response.json();
  if (!data || !Array.isArray(data.feeds)) throw new HttpsError("internal", "Unexpected ThingSpeak response.");
  return {channel:{id:data.channel?.id,name:data.channel?.name},feeds:data.feeds.map(f=>({created_at:f.created_at||null,field1:f.field1??null,field2:f.field2??null,field3:f.field3??null}))};
});
