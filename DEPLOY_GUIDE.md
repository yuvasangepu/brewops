# BrewOps — Netlify Deploy Guide
## Sandbox / Test Mode

---

## STEP 1 — Deploy to Netlify (30 seconds)

1. Go to https://app.netlify.com → Log in
2. Click **"Add new site" → "Deploy manually"**
3. **Drag & drop this entire `BrewOps-Deploy` folder** onto the upload box
4. Netlify deploys in ~30 seconds → you get a URL like:
   `https://magical-name-abc123.netlify.app`
5. **Copy that URL** — you'll need it in Step 2.

---

## STEP 2 — Update your site URL in Netlify (1 minute)

1. In Netlify dashboard → **Site configuration → Environment variables**
2. Edit these two variables — replace `YOUR-SITE` with your actual subdomain:

   | Variable         | Value                                                      |
   |------------------|------------------------------------------------------------|
   | PP_REDIRECT_URL  | `https://magical-name-abc123.netlify.app/customer-menu.html` |
   | PP_CALLBACK_URL  | `https://magical-name-abc123.netlify.app/.netlify/functions/phonepe-webhook` |

3. Click **"Save"** → then go to **Deploys → Trigger deploy → Deploy site** (to pick up the new env vars)

---

## STEP 3 — Configure BrewOps POS

1. Open `https://YOUR-SITE.netlify.app/BrewOps.html`
2. Go to **Settings (⚙) → PhonePe Payment Gateway**
3. Fill in:

   | Field               | Value                                              |
   |---------------------|----------------------------------------------------|
   | Enable PhonePe      | ✅ Check the box                                   |
   | Merchant ID         | `PGTESTPAYUAT`                                     |
   | Backend Proxy URL   | `https://YOUR-SITE.netlify.app/api/phonepe/pay`    |
   | Customer Menu URL   | `https://YOUR-SITE.netlify.app/customer-menu.html` |
   | Environment         | **Sandbox**                                        |

4. Click **Save Settings**

---

## STEP 4 — Test a Payment

1. Create a test order in BrewOps → click **Charge / Online Payment**
2. You'll be redirected to PhonePe's sandbox payment page
3. Use these **test card/UPI details**:
   - UPI ID: `success@ybl` → simulates **SUCCESS**
   - UPI ID: `failure@ybl` → simulates **FAILURE**
4. After payment, you'll land back on `customer-menu.html` with status

---

## Sandbox Credentials Used (public test values — safe to share)

| Key           | Value                                  |
|---------------|----------------------------------------|
| Merchant ID   | `PGTESTPAYUAT`                         |
| Salt Key      | `099eb0cd-02cf-4dc2-a4c3-f5a4b9e0f9d5`|
| Salt Index    | `1`                                    |
| API Base URL  | `https://api-preprod.phonepe.com/apis/pg-sandbox` |

---

## Going Live Later?

Replace env vars in Netlify dashboard with your **real** PhonePe Merchant credentials
(from https://developer.phonepe.com) and change `env: 'production'` in your proxy calls.

---

## Folder Structure

```
BrewOps-Deploy/
├── public/
│   ├── BrewOps.html          ← Staff POS (access directly via URL)
│   └── customer-menu.html    ← Customer QR Menu + payment landing
├── netlify/
│   └── functions/
│       ├── phonepe-pay.js      ← Initiates payment with PhonePe
│       ├── phonepe-status.js   ← Checks payment status
│       └── phonepe-webhook.js  ← Receives PhonePe server callbacks
└── netlify.toml              ← Routing + env vars config
```
