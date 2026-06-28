// BrewOps — PhonePe PG Webhook Function  (Netlify Serverless)
// Register this URL in PhonePe Merchant Dashboard → Webhooks:
//   https://your-cafe.netlify.app/.netlify/functions/phonepe-webhook
// PhonePe POSTs here when payment reaches a terminal state.
// This function verifies the checksum and logs the event.
// Add your Firestore Admin SDK code here to auto-update order status.
const crypto = require('crypto');

const SALT_KEY   = process.env.PP_SALT_KEY;
const SALT_INDEX = process.env.PP_SALT_INDEX || '1';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const incomingXVerify = event.headers['x-verify'] || event.headers['X-VERIFY'] || '';
  let bodyParsed;
  try { bodyParsed = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const payload = bodyParsed?.response || '';

  // ── Verify X-VERIFY checksum to reject spoofed webhooks ──
  if (!SALT_KEY || !incomingXVerify) {
    console.warn('[Webhook] Missing credentials or X-VERIFY header — rejecting');
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing checksum' }) };
  }

  const expectedHash = crypto.createHash('sha256')
    .update(payload + SALT_KEY)
    .digest('hex');
  const expectedXV = expectedHash + '###' + SALT_INDEX;

  if (incomingXVerify !== expectedXV) {
    console.warn('[Webhook] Checksum MISMATCH — rejecting (possible spoofed request)');
    return { statusCode: 400, body: JSON.stringify({ error: 'Checksum mismatch' }) };
  }

  // ── Decode and process ──
  try {
    const decoded  = JSON.parse(Buffer.from(payload, 'base64').toString('utf-8'));
    const state    = decoded?.data?.state;
    const txnId    = decoded?.data?.merchantTransactionId;
    const amountPaise = decoded?.data?.amount || 0;

    console.log(`[Webhook] ✓ TXN: ${txnId} | State: ${state} | Amount: ₹${(amountPaise/100).toFixed(2)}`);

    // ── TODO: Update Firestore order status automatically ──
    // Uncomment and fill in when you add Firebase Admin SDK:
    //
    // const admin = require('firebase-admin');
    // if (!admin.apps.length) {
    //   admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    // }
    // const db = admin.firestore();
    // const newStatus = state === 'COMPLETED' ? 'billed' : state === 'FAILED' ? 'rejected' : 'confirmed';
    // await db.collection('orders').doc(txnId).update({ status: newStatus, webhookState: state, webhookAt: Date.now() });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.error('[Webhook Parse Error]', err.message);
    return { statusCode: 400, body: JSON.stringify({ error: 'Payload parse error: ' + err.message }) };
  }
};
