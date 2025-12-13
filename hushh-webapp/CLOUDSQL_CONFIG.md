# Cloud SQL Configuration for Hushh Food App

## ✅ Instance Details

**Instance Name:** hushh-vault-db
**Database:** hushh_vault
**User:** hushh_app
**Password:** hushh_secure_2024!
**Region:** us-central1-c
**Public IP:** 136.113.243.187
**Connection Name:** hushh-pda:us-central1:hushh-vault-db

---

## 🔌 Connection Strings

### Local Development (Cloud SQL Proxy)

```bash
# .env.local
DATABASE_URL=postgresql://hushh_app:hushh_secure_2024!@localhost:5432/hushh_vault
```

### Production (Cloud Run/App Engine)

```bash
# .env (production)
DATABASE_URL=postgresql://hushh_app:hushh_secure_2024!@/hushh_vault?host=/cloudsql/hushh-pda:us-central1:hushh-vault-db
```

### Direct Connection (if authorized networks configured)

```bash
DATABASE_URL=postgresql://hushh_app:hushh_secure_2024!@136.113.243.187:5432/hushh_vault?sslmode=require
```

---

## 🚀 Quick Start

### 1. Install Cloud SQL Proxy

**Windows:**

```powershell
curl -o cloud-sql-proxy.exe https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.2/cloud-sql-proxy.x64.exe
```

**macOS:**

```bash
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.2/cloud-sql-proxy.darwin.amd64
chmod +x cloud-sql-proxy
```

### 2. Start Proxy

```bash
# Windows
.\cloud-sql-proxy.exe hushh-pda:us-central1:hushh-vault-db

# macOS/Linux
./cloud-sql-proxy hushh-pda:us-central1:hushh-vault-db
```

**Expected output:**

```
Listening on 127.0.0.1:5432
```

### 3. Update .env.local

```bash
# hushh-webapp/.env.local
DATABASE_URL=postgresql://hushh_app:hushh_secure_2024!@localhost:5432/hushh_vault
```

### 4. Test Connection

**Terminal 1: Keep proxy running**
**Terminal 2:**

```bash
cd hushh-webapp
npm run dev
```

**Expected:**

```
✅ Using PostgreSQL database
✅ Database schema initialized
✓ Ready in 2.5s
```

---

## 🧪 Verify Database

```bash
# Connect with psql
psql "postgresql://hushh_app:hushh_secure_2024!@localhost:5432/hushh_vault"

# Check tables
\dt

# Should show:
#  vault_keys
#  vault_data
```

---

## 🔐 Security Notes

⚠️ **IMPORTANT:** Change the password before production deployment!

```bash
# Update password
gcloud sql users set-password hushh_app \
  --instance=hushh-vault-db \
  --password=NEW_SECURE_PASSWORD

# Store in Secret Manager
gcloud secrets create database-password \
  --data-file=- <<< "NEW_SECURE_PASSWORD"
```

---

## 💰 Cost Tracking

Current configuration:

- Tier: db-f1-micro
- Storage: 10 GB
- Backups: Automated daily
- **Estimated:** ~$7-10/month
- **Free tier:** First instance eligible

---

## 📊 Monitoring

**Console:** https://console.cloud.google.com/sql/instances/hushh-vault-db?project=hushh-pda

**Enable query insights:**

```bash
gcloud sql instances patch hushh-vault-db \
  --insights-config-query-insights-enabled
```

---

Ready to test! 🚀
