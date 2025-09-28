# 🧾 NAFDAC Manual Scraper

**Backup methods for scraping NAFDAC alerts when Vercel cron fails.**

## 🎯 Quick Start

### Prerequisites
1. ✅ `EXTERNAL_SCRAPER_TOKEN` in your `.env.local`
2. ✅ Local dev server running (`npm run dev`)
3. ✅ Database accessible

---

## 🚀 Method 1: VS Code Tasks (Recommended)

The easiest way to manually trigger scraping:

### In VS Code:
1. **Open Command Palette**: `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. **Find Task**: Type "Tasks: Run Task" → Select "Scrape NAFDAC (Local)"
   - Uses **CRON MODE** (2 alerts, sequential with delays)

**OR press F1 → "Tasks: Run Task"**

VS Code will prompt for your `EXTERNAL_SCRAPER_TOKEN` and run the scraper.

---

## ⚡ Method 2: npm Scripts

### Run scraper manually:
```bash
npm run scrape:local           # CRON MODE (2 alerts, sequential)
npm run scrape:continuous      # CONTINUOUS MODE (process ALL alerts)
```

### Check scraper status:
```bash
npm run scrape:test
npm run scrape:status  # Pretty-printed JSON
```

### Advanced usage:
```bash
node scripts/scrape-manual.js  # Detailed output
```

---

## 🔧 Method 3: Direct API Calls

### Manual cURL Commands:
```bash
# Scrape locally - CRON MODE (2 alerts, sequential)
curl -X POST 'http://localhost:3000/api/scraper/run' \
     -H 'Authorization: Bearer YOUR_EXTERNAL_SCRAPER_TOKEN' \
     -H 'Content-Type: application/json'

# Scrape locally - CONTINUOUS MODE (4 alerts/batch, process ALL alerts)
curl -X POST 'http://localhost:3000/api/scraper/run?mode=continuous' \
     -H 'Authorization: Bearer YOUR_EXTERNAL_SCRAPER_TOKEN' \
     -H 'Content-Type: application/json'

# Scrape production - CRON MODE (default)
curl -X POST 'https://fake-detector-app.vercel.app/api/scraper/run' \
     -H 'Authorization: Bearer YOUR_EXTERNAL_SCRAPER_TOKEN' \
     -H 'Content-Type: application/json'

# Check status
curl -X GET 'http://localhost:3000/api/scraper/stats'
```

---

## 📋 Environment Setup

### Required Environment Variable:

Add this to your `.env.local`:
```bash
# External scraper API authentication
EXTERNAL_SCRAPER_TOKEN="your-secure-token-here"
```

### Generate Secure Token:
```bash
# Option 1: Use OpenSSL (Linux/Mac)
openssl rand -hex 32

# Option 2: Use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 3: Use this online generator
# Visit: https://generate-random.org/api-key-generator?count=1&length=64&type=mixed-case-numeric-symbol
```

---

## 📊 Verifying Results

### Check Scraper Status:
```bash
npm run scrape:status
# Shows: total alerts, last scraped time, active alerts
```

### Check Database:
```bash
npm run db:studio  # View alerts in Prisma Studio
# Look for new entries in "nafdacAlert" table
```

### Manual Test:
```bash
# Test if scraper endpoint works
curl -X GET 'http://localhost:3000/api/scraper/stats'
```

---

## 🔍 Troubleshooting

### ❌ "Authentication failed"
- ✅ Check `EXTERNAL_SCRAPER_TOKEN` in `.env.local`
- ✅ Verify token in VS Code task prompt
- ✅ Verify token in cURL `Authorization` header

### ❌ "Connection refused"
- ✅ Start local dev server: `npm run dev`
- ✅ Server should be on `http://localhost:3000`

### ❌ "Database errors"
- ✅ Check database connection: `npm run db:studio`
- ✅ Verify Prisma client is generated: `npm run db:generate`

### ❌ "Timeout errors"
- ✅ Local scraper processes max 2 alerts quickly
- ✅ Production scraper runs every 6 hours

---

## 📈 Production Usage

### Vercel Cron (Primary):
- ✅ **Runs every 6 hours** (optimized for Hobby plan)
- ✅ **Processes max 2 alerts** per cycle
- ✅ **10-second completion** (fits Hobby timeout)

### Manual Backup (Secondary):
- ✅ **VS Code Tasks** (easiest)
- ✅ **npm Scripts** (developer-friendly)
- ✅ **Direct API** (automation-ready)

---

## 🎯 Best Practices

### 🔄 Regular Manual Runs:
- **Run weekly** if Vercel cron stops working
- **Run immediately** after deploying scraper updates
- **Monitor logs** in Vercel dashboard

### 📊 Data Verification:
- Check **scraper stats** after each run
- Verify **new alerts** in database
- Ensure **no duplicate alerts** (same URL)

### 🚨 Alerts Monitoring:
- Watch **system notifications** for scraper failures
- Check **admin dashboard** for scraping statistics
- Monitor **alert counts** in NAFDAC database

---

## 🆘 Need Help?

### Common Issues:
1. **Token mismatch** → Regenerate `EXTERNAL_SCRAPER_TOKEN`
2. **Local connection** → Start `npm run dev`
3. **Database issues** → Check `npm run db:studio`
4. **Permissions** → Verify admin email in session

### Debug Commands:
```bash
# Full scraper logs
npm run scrape:manual

# Check environment
echo $EXTERNAL_SCRAPER_TOKEN

# Test connection
curl -I http://localhost:3000/api/scraper/stats
```

---

## 🔥 Your Backup Strategy

**Multi-Layer Backup:**
1. **Vercel Cron** (primary - automatic) ✅
2. **GitHub Actions** (reserve - automatic) ❓
3. **Manual Scripts** (emergency - you control) ✅

## ⚡ CONTINUOUS MODE: Complete Alert Processing

### **What is CONTINUOUS MODE?**
- ✅ **4 alerts per batch** (not 2 like cron)
- ✅ **3-second pause between batches** (gentle on NAFDAC servers)
- ✅ **Processes ALL available alerts** (continues until complete)
- ✅ **Stops automatically** when no more alerts found
- ✅ **Progress tracking** (shows batch-by-batch progress)
- ✅ **Safety limits** (max 10 batches to prevent infinite loops)

### **Continuous Mode Results:**
```json
{
  "success": true,
  "totalBatches": 3,
  "totalAlerts": 12,
  "newAlerts": 8,
  "totalProcessed": 12,
  "batchDetails": [
    {"batch": 1, "alerts": 4, "processed": 4, "new": 3},
    {"batch": 2, "alerts": 4, "processed": 4, "new": 3},
    {"batch": 3, "alerts": 4, "processed": 4, "new": 2}
  ]
}
```

### **When to Use Continuous Mode:**
- **Catch up on missed alerts** when cron failed for days
- **Initial data population** when setting up the system
- **One-time comprehensive scraping** sessions
- **Maximum reliability** backup method

### **Cron Mode vs Continuous Mode:**
| Aspect | Cron Mode | Continuous Mode |
|--------|-----------|-----------------|
| **Alerts per run** | 2 maximum | 4 per batch |
| **Completion** | Stops at limit | Runs all batches |
| **Use case** | Scheduled production | Manual comprehensive |
| **Runtime** | <5 seconds | Minutes (but complete) |
| **Server load** | Gentle | Respectful (with delays) |

**Zero Downtime:** At least one method will work when others fail! 🚀


priority 1

plan	     |	OCR	     |	Verification
free 	|	gemini	|	gemini
basic	|	gemini	|	gemini
standard  |	gemini	|	claude
business  |	gemini	|	openAi

priority 2 (fallback)	

plan	     |	OCR	     |	Verification
free	     |	claude	|	claude
basic	|	claude	|	claude
standard  |	claude	|	gemini
business  |	claude	|	gemini