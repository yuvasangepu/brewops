// BrewOps — PhonePe PG Pay Function  (Netlify Serverless)
// URL: https://your-cafe.netlify.app/.netlify/functions/phonepe-pay
// Or via redirect: https://your-cafe.netlify.app/api/phonepe/pay
// Receives: { amount_paise, merchantTransactionId, merchantUserId, redirectUrl, env }
// Returns:  { ok: true, url, txnId } | { ok: false, error }
const crypto = require('crypto');

const MERCHANT_ID  = process.env.PP_MERCHANT_ID;
const SALT_KEY     = process.env.PP_SALT_KEY;
const SALT_INDEX   = process.env.PP_SALT_INDEX || '1';
const REDIRECT_URL = process.env.PP_REDIRECT_URL || '';
const CALLBACK_URL = process.env.PP_CALLBACK_URL || '';

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
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') return respond(200, {});
  if (event.httpMethod !== 'POST') return respond(405, { ok: false, error: 'Method not allowed' });

  // Validate credentials are configured
  if (!MERCHANT_ID || !SALT_KEY) {
    return respond(500, { ok: false, error: 'PhonePe credentials not set in Netlify environment variables.' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return respond(400, { ok: false, error: 'Invalid JSON body.' }); }

  const {
    amount_paise,
    merchantTransactionId = 'CAFE' + Date.now(),
    merchantUserId        = 'GUEST001',
    redirectUrl           = REDIRECT_URL,
    env                   = 'sandbox'
  } = body;

  const amtPaise = Math.round(Number(amount_paise));
  if (!amtPaise || amtPaise <= 0) {
    return respond(400, { ok: false, error: 'amount_paise must be a positive integer.' });
  }
  if (!redirectUrl) {
    return respond(400, { ok: false, error: 'redirectUrl is required. Set PP_REDIRECT_URL in Netlify env vars.' });
  }

  const payload = {
    merchantId:             MERCHANT_ID,
    merchantTransactionId,
    merchantUserId,
    amount:                 amtPaise,
    redirectUrl,
    redirectMode:           'REDIRECT',
    callbackUrl:            CALLBACK_URL,
    paymentInstrument:      { type: 'PAY_PAGE' }
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  const xVerify    = buildXVerify(payloadB64 + '/pg/v1/pay');

  try {
    const ppRes = await fetch(`${getBaseUrl(env)}/pg/v1/pay`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'X-VERIFY':      xVerify,
        'X-MERCHANT-ID': MERCHANT_ID
      },
      body: JSON.stringify({ request: payloadB64 })
    });

    const data = await ppRes.json();
    console.log(`[PhonePe Pay] txn=${merchantTransactionId} code=${data.code}`);

    if (data.success) {
      const url = data.data?.instrumentResponse?.redirectInfo?.url;
      return respond(200, { ok: true, url, txnId: merchantTransactionId });
    }
    return respond(400, { ok: false, error: data.message || data.code || 'PhonePe API error' });

  } catch (err) {
    console.error('[PhonePe Pay Error]', err.message);
    return respond(502, { ok: false, error: 'PhonePe upstream error: ' + err.message });
  }
};
