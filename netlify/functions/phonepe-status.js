// BrewOps — PhonePe PG Status Function  (Netlify Serverless)
// URL: https://your-cafe.netlify.app/.netlify/functions/phonepe-status
// Or via redirect: https://your-cafe.netlify.app/api/phonepe/status
// Receives: { merchantTransactionId, env }
// Returns:  { state: 'COMPLETED'|'PENDING'|'FAILED'|null }
const crypto = require('crypto');

const MERCHANT_ID = process.env.PP_MERCHANT_ID;
const SALT_KEY    = process.env.PP_SALT_KEY;
const SALT_INDEX  = process.env.PP_SALT_INDEX || '1';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}

function respond(statusCode, body) {
  return { statusCode, headers: corsHeaders(), body: JSON.stringify(body) };
}

function buildXVerify(strToHash) {
  const hash = crypto.createHash('sha256')
    .update(strToHash + SALT_KEY)
    .digest('hex');
  return hash + '###' + SALT_INDEX;
}

function getBaseUrl(env) {
  return env === 'production'
    ? 'https://api.phonepe.com/apis/hermes'
    : 'https://api-preprod.phonepe.com/apis/pg-sandbox';
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return respond(200, {});
  if (event.httpMethod !== 'POST') return respond(405, { state: null, error: 'Method not allowed' });

  if (!MERCHANT_ID || !SALT_KEY) {
    return respond(500, { state: null, error: 'PhonePe credentials not configured.' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return respond(400, { state: null, error: 'Invalid JSON.' }); }

  const { merchantTransactionId, env = 'sandbox' } = body;
  if (!merchantTransactionId) {
    return respond(400, { state: null, error: 'merchantTransactionId is required.' });
  }

  const endpoint = `/pg/v1/status/${MERCHANT_ID}/${merchantTransactionId}`;
  const xVerify  = buildXVerify(endpoint);

  try {
    const ppRes = await fetch(`${getBaseUrl(env)}${endpoint}`, {
      method:  'GET',
      headers: {
        'X-VERIFY':      xVerify,
        'X-MERCHANT-ID': MERCHANT_ID,
        'Content-Type':  'application/json',
        'accept':        'application/json'
      }
    });

    const data = await ppRes.json();
    console.log(`[PhonePe Status] txn=${merchantTransactionId} state=${data?.data?.state}`);
    return respond(200, { state: data?.data?.state || null, code: data?.code });

  } catch (err) {
    console.error('[PhonePe Status Error]', err.message);
    return respond(502, { state: null, error: err.message });
  }
};
