# Deploy Sahar Beauty

The repository is configured for:

- Backend: Railway
- Frontend: Netlify
- Database: MongoDB Atlas
- WhatsApp: WAHA

## 1. Deploy the backend to Railway

Create a Railway service from this GitHub repository. Railway reads `railway.json`
from the repository root, installs the backend dependencies, starts
`backend/server.js`, and checks `/api/health`.

Add these Railway variables:

```env
NODE_ENV=production
MONGODB_URI=<MongoDB Atlas connection string>
JWT_SECRET=<long random secret>
ADMIN_USERNAME=<dashboard username>
ADMIN_PASSWORD=<strong dashboard password>
FRONTEND_URL=https://saharbeauty12.netlify.app
OWNER_WHATSAPP_PHONE=0538800769
BANK_TRANSFER_DETAILS=בנק: ... | סניף: ... | חשבון: ... | שם בעלת החשבון: ...
WAHA_URL=<public Railway URL of the WAHA service>
WAHA_SESSION=facial
WAHA_API_KEY=<WAHA API key>
WAHA_TIMEOUT_MS=45000
```

Railway supplies `PORT`; do not create it manually.

Generate a public Railway domain and verify:

```text
https://YOUR-RAILWAY-DOMAIN/api/health
```

Configure the WAHA webhook to:

```text
https://YOUR-RAILWAY-DOMAIN/api/webhooks/waha
```

## 2. Deploy the frontend to Netlify

Create a Netlify site from the same GitHub repository. Netlify reads
`netlify.toml`; the publish directory and Functions directory are already set.

Add this Netlify variable:

```env
BACKEND_API_URL=https://YOUR-RAILWAY-DOMAIN
```

Do not add `/api` to this value.

Deploy the site, then verify:

```text
https://saharbeauty12.netlify.app/api/health
```

That URL is proxied securely through the included Netlify Function to Railway.

## 3. Final checks

1. Request a WhatsApp verification code.
2. Submit an appointment request.
3. Approve it in the dashboard.
4. Open the deposit link and test Bit, bank transfer, and cash.
5. Manually confirm the appointment and verify the final message and Waze link.

Never commit `.env`, MongoDB credentials, API keys, or dashboard passwords.
