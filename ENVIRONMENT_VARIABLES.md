# Environment Variables Configuration Guide

This document describes all required and optional environment variables for the VibePhoto application.

## 📋 Quick Setup Checklist

### **Production Deployment (Vercel)**

```bash
# ✅ REQUIRED - Core Application
NEXTAUTH_URL=https://vibephoto-delta.vercel.app
NEXTAUTH_SECRET=<generate-with: openssl rand -base64 32>
NODE_ENV=production

# ✅ REQUIRED - Database
DATABASE_URL=postgres://postgres.czqlvuhfbtkaidvsugaa:password@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?sslmode=require&pgbouncer=true&statement_cache_size=0&pool_timeout=0&connection_limit=1

# ✅ REQUIRED - Payment Gateway (Asaas)
ASAAS_ENVIRONMENT=production  # ⚠️ CRITICAL: Must be 'production' for real payments!
ASAAS_API_KEY=$aact_prod_...  # ⚠️ CRITICAL: Must start with '$aact_prod_' for production
ASAAS_WEBHOOK_TOKEN=<your-secure-random-token>

# ✅ REQUIRED - AI Providers
AI_PROVIDER=hybrid  # Options: replicate | astria | hybrid
REPLICATE_API_TOKEN=r8_...
REPLICATE_USERNAME=vibephoto
REPLICATE_WEBHOOK_SECRET=<your-secure-secret>
ASTRIA_API_KEY=sd_...
ASTRIA_WEBHOOK_SECRET=<your-secure-secret>  # ⚠️ NEW: Add security to Astria webhook
ASTRIA_WEBHOOK_URL=https://vibephoto-delta.vercel.app/api/webhooks/astria

# ✅ REQUIRED - Storage (AWS S3)
STORAGE_PROVIDER=aws
AWS_ACCESS_KEY_ID=AKIAVIADBEC33A7BXRUD
AWS_SECRET_ACCESS_KEY=<your-secret-key>
AWS_REGION=us-east-2
AWS_S3_BUCKET=ensaio-fotos-prod

# ⚠️ OPTIONAL - OAuth Providers
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GITHUB_CLIENT_ID=<your-github-client-id>
GITHUB_CLIENT_SECRET=<your-github-client-secret>
```

---

## 🔧 Detailed Configuration

### 1. Core Application Settings

#### `NODE_ENV` (Required)
- **Values:** `development` | `production`
- **Default:** `development`
- **Description:** Determines environment mode. Affects webhook vs polling behavior.

#### `NEXTAUTH_URL` (Required)
- **Format:** `https://yourdomain.com` (must use HTTPS in production)
- **Example:** `https://vibephoto-delta.vercel.app`
- **Description:** Base URL for NextAuth callbacks and webhooks.
- **⚠️ Production:** MUST use HTTPS for webhooks to work!

#### `NEXTAUTH_SECRET` (Required)
- **Generate:** `openssl rand -base64 32`
- **Description:** Secret key for JWT encryption.
- **⚠️ Security:** Never use development secrets in production!

---

### 2. Database Configuration

#### `DATABASE_URL` (Required)
- **Format:** PostgreSQL connection string
- **Production Example:**
  ```
  postgres://user:pass@host:6543/postgres?sslmode=require&pgbouncer=true&statement_cache_size=0&pool_timeout=0&connection_limit=1
  ```
- **Required Parameters for Serverless:**
  - `sslmode=require` - SSL encryption
  - `pgbouncer=true` - Connection pooling mode
  - `statement_cache_size=0` - Disable prepared statements (prevents errors)
  - `pool_timeout=0` - No timeout
  - `connection_limit=1` - One connection per serverless function

---

### 3. Payment Gateway (Asaas)

#### `ASAAS_ENVIRONMENT` ⚠️ **CRITICAL**
- **Values:** `production` | `sandbox`
- **Default:** `sandbox`
- **Description:** Determines which Asaas environment to use.
- **⚠️ Production:** MUST be set to `production` for real payments!
- **Validation:** System checks if `ASAAS_API_KEY` matches the environment.

#### `ASAAS_API_KEY` ⚠️ **CRITICAL**
- **Production Format:** Must start with `$aact_prod_`
- **Sandbox Format:** Must start with `$aact_hmlg_`
- **Where to get:**
  - Production: https://www.asaas.com/config/apiKey
  - Sandbox: https://sandbox.asaas.com/config/apiKey
- **⚠️ Security:** System validates that production API key is used when `ASAAS_ENVIRONMENT=production`

#### `ASAAS_WEBHOOK_TOKEN` (Recommended)
- **Format:** Any secure random string
- **Generate:** `openssl rand -hex 32`
- **Description:** Secret token to validate Asaas webhook requests.
- **⚠️ Security:** Required for secure webhook authentication.

---

### 4. AI Generation Providers

#### `AI_PROVIDER` (Required)
- **Values:** `replicate` | `astria` | `hybrid` | `local`
- **Default:** `hybrid`
- **Description:**
  - `replicate` - Use only Replicate
  - `astria` - Use only Astria
  - `hybrid` - Use Replicate for general images, Astria for specific models
  - `local` - Development only, no external API

#### Replicate Configuration

##### `REPLICATE_API_TOKEN` (Required if using Replicate)
- **Where to get:** https://replicate.com/account/api-tokens
- **Format:** `r8_...`

##### `REPLICATE_USERNAME` (Optional)
- **Example:** `vibephoto`
- **Description:** Your Replicate username for model references.

##### `REPLICATE_WEBHOOK_SECRET` (Recommended)
- **Generate:** `openssl rand -hex 32`
- **Description:** Secret for validating Replicate webhook signatures.
- **⚠️ Security:** Required for production webhook security.

#### Astria Configuration

##### `ASTRIA_API_KEY` (Required if using Astria)
- **Where to get:** https://www.astria.ai/settings
- **Format:** `sd_...`

##### `ASTRIA_WEBHOOK_SECRET` ⚠️ **NEW** (Recommended)
- **Generate:** `openssl rand -hex 32`
- **Description:** Secret token to validate Astria webhook requests.
- **⚠️ Security:** Without this, Astria webhooks are INSECURE!

##### `ASTRIA_WEBHOOK_URL` (Optional)
- **Format:** `https://yourdomain.com/api/webhooks/astria`
- **Description:** Webhook URL for Astria callbacks.
- **Note:** Auto-generated from `NEXTAUTH_URL` if not provided.

##### `ASTRIA_TEST_MODE` (Development only)
- **Values:** `true` | `false`
- **Default:** `false`
- **Description:** Enable test mode for Astria API.

---

### 5. Storage Configuration

#### `STORAGE_PROVIDER` (Required)
- **Values:** `aws` | `local`
- **Default:** `aws`
- **Description:**
  - `aws` - Use AWS S3 for production
  - `local` - Use local filesystem for development

#### AWS S3 Configuration (Required if `STORAGE_PROVIDER=aws`)

##### `AWS_ACCESS_KEY_ID`
- **Where to get:** AWS IAM Console
- **Description:** AWS access key with S3 permissions.

##### `AWS_SECRET_ACCESS_KEY`
- **Where to get:** AWS IAM Console
- **Description:** AWS secret key (keep secure!).

##### `AWS_REGION`
- **Example:** `us-east-2`
- **Description:** AWS region for S3 bucket.

##### `AWS_S3_BUCKET`
- **Example:** `ensaio-fotos-prod`
- **Description:** S3 bucket name for storing images.

---

### 6. Optional - OAuth Providers

#### Google OAuth

##### `GOOGLE_CLIENT_ID`
- **Where to get:** Google Cloud Console → APIs & Services → Credentials

##### `GOOGLE_CLIENT_SECRET`
- **Where to get:** Google Cloud Console → APIs & Services → Credentials

#### GitHub OAuth

##### `GITHUB_CLIENT_ID`
- **Where to get:** GitHub Settings → Developer settings → OAuth Apps

##### `GITHUB_CLIENT_SECRET`
- **Where to get:** GitHub Settings → Developer settings → OAuth Apps

---

## 🔍 Environment Detection & Behavior

The application automatically detects the environment and adjusts behavior:

### Webhook vs Polling Strategy

```typescript
// Production with HTTPS → Use webhooks (polling as backup)
NEXTAUTH_URL=https://... + NODE_ENV=production → Webhooks enabled

// Development or no HTTPS → Use polling
NEXTAUTH_URL=http://localhost:3000 → Polling only

// Astria always uses polling (webhooks as notification only)
AI_PROVIDER=astria → Always polls for status
```

### Payment Flow

```typescript
// Production mode → Real payments
ASAAS_ENVIRONMENT=production + API key starts with $aact_prod_
→ Charges real credit cards

// Sandbox mode → Test payments
ASAAS_ENVIRONMENT=sandbox + API key starts with $aact_hmlg_
→ No real charges, testing only
```

---

## ⚙️ Validation & Debugging

The application validates environment configuration on startup:

### Check Environment Status

```bash
# View logs in Vercel
# Look for: "🌍 ENVIRONMENT CONFIGURATION"

# Expected output in production:
✅ NODE_ENV: production
✅ HTTPS Enabled: true
✅ Use Webhooks: true
✅ Asaas Environment: production
✅ Asaas API URL: https://api.asaas.com/v3
```

### Common Issues

#### ❌ Asaas payments not processing
- **Check:** `ASAAS_ENVIRONMENT=production`
- **Check:** `ASAAS_API_KEY` starts with `$aact_prod_`
- **Fix:** Update variables in Vercel → Settings → Environment Variables → Redeploy

#### ❌ Webhooks not working
- **Check:** `NEXTAUTH_URL` uses `https://`
- **Check:** `NODE_ENV=production`
- **Fix:** Ensure production deployment, not preview

#### ❌ AI generation stuck
- **Check:** Webhook secrets are configured
- **Check:** Provider API keys are valid
- **Fallback:** System will use polling after 60s if webhook fails

#### ❌ Database connection errors
- **Check:** `DATABASE_URL` includes all required parameters
- **Required:** `pgbouncer=true&statement_cache_size=0&pool_timeout=0&connection_limit=1`
- **Fix:** Update connection string with all parameters

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Set `NODE_ENV=production`
- [ ] Set `NEXTAUTH_URL` with HTTPS
- [ ] Generate new `NEXTAUTH_SECRET` (never reuse dev secret)
- [ ] Set `ASAAS_ENVIRONMENT=production`
- [ ] Use production `ASAAS_API_KEY` (starts with `$aact_prod_`)
- [ ] Set `ASAAS_WEBHOOK_TOKEN` for security
- [ ] Set `REPLICATE_WEBHOOK_SECRET` for security
- [ ] Set `ASTRIA_WEBHOOK_SECRET` for security (NEW!)
- [ ] Verify `DATABASE_URL` includes serverless parameters
- [ ] Test payment flow in Asaas dashboard
- [ ] Register webhooks in Asaas, Replicate, and Astria dashboards
- [ ] Monitor first webhook delivery in Vercel logs

---

## 📞 Webhook Registration

After configuring environment variables, register webhooks in each platform:

### Asaas Webhook
1. Go to: https://www.asaas.com/config/webhook
2. Add URL: `https://vibephoto-delta.vercel.app/api/payments/asaas/webhook`
3. Set token: Same as `ASAAS_WEBHOOK_TOKEN`
4. Enable events: PAYMENT_CONFIRMED, PAYMENT_RECEIVED, SUBSCRIPTION_*

### Replicate Webhook
1. Go to: https://replicate.com/account/webhooks
2. Add URL: `https://vibephoto-delta.vercel.app/api/webhooks/replicate`
3. Set secret: Same as `REPLICATE_WEBHOOK_SECRET`

### Astria Webhook
1. Go to: https://www.astria.ai/settings
2. Add webhook URL: `https://vibephoto-delta.vercel.app/api/webhooks/astria`
3. Set authentication header: `x-astria-secret: <ASTRIA_WEBHOOK_SECRET>`

---

## 🔐 Security Best Practices

1. **Never commit secrets to git**
   - Use `.env.local` for development (gitignored)
   - Use Vercel environment variables for production

2. **Rotate secrets regularly**
   - Change webhook tokens every 90 days
   - Update in both Vercel and provider dashboards

3. **Use different secrets per environment**
   - Development: `dev-webhook-secret-...`
   - Production: Strong random tokens

4. **Validate API keys before deployment**
   - Production API keys must start with `$aact_prod_`
   - Test in sandbox first before going live

5. **Monitor webhook delivery**
   - Check Vercel logs for webhook authentication failures
   - Set up alerts for failed webhooks

---

## 📝 Example .env Files

### `.env.local` (Development)
```bash
NODE_ENV=development
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-secret-key
DATABASE_URL=postgresql://...
ASAAS_ENVIRONMENT=sandbox
ASAAS_API_KEY=$aact_hmlg_...
AI_PROVIDER=local
STORAGE_PROVIDER=local
```

### `.env.production` (Vercel)
```bash
NODE_ENV=production
NEXTAUTH_URL=https://vibephoto-delta.vercel.app
NEXTAUTH_SECRET=<strong-random-secret>
DATABASE_URL=postgresql://...?pgbouncer=true&statement_cache_size=0
ASAAS_ENVIRONMENT=production
ASAAS_API_KEY=$aact_prod_...
ASAAS_WEBHOOK_TOKEN=<secure-token>
AI_PROVIDER=hybrid
STORAGE_PROVIDER=aws
REPLICATE_WEBHOOK_SECRET=<secure-secret>
ASTRIA_WEBHOOK_SECRET=<secure-secret>
```

---

## ℹ️ Need Help?

- **Environment validation errors:** Check Vercel logs for specific error messages
- **Webhook issues:** Enable debug logging and check delivery in provider dashboards
- **Payment issues:** Verify Asaas environment and API key in Asaas dashboard
- **Database connection issues:** Ensure all serverless parameters are in connection string
