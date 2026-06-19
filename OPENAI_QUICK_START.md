# OpenAI Integration - Quick Start

## 🚀 5-Minute Setup Guide

### Step 1: Get OpenAI API Key (2 minutes)
1. Visit [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Click your profile → **API keys**
4. Click **Create new secret key**
5. Copy the key (starts with `sk-` or `sk-proj-`)

### Step 2: Configure Extension (1 minute)
1. Click extension icon
2. Check ☑️ **"Use AI for email formatting"**
3. Paste your OpenAI API key
4. Select **GPT-4o-mini** (recommended)
5. Click **Save Settings**

### Step 3: Test It! (2 minutes)
1. Go to Instantly.ai lead page
2. Open DevTools (F12) → Console
3. Mark lead as "Meeting Booked"
4. Look for: `[Background] ✓ AI formatting successful`
5. Check HubSpot contact → Activity → Notes

---

## 💰 Cost

**GPT-4o-mini**: ~$0.0006 per contact (less than 1/10th of a cent!)

| Monthly Syncs | Monthly Cost |
|---------------|--------------|
| 100 contacts | $0.06 (6 cents) |
| 1,000 contacts | $0.60 (60 cents) |
| 10,000 contacts | $6.00 |

---

## ✅ What You Get

- **📤/📥 Direction indicators** - Clear incoming/outgoing labels
- **Smart deduplication** - Removes semantic duplicates
- **Clean formatting** - Removes signatures, disclaimers, artifacts
- **Professional output** - Consistently polished notes
- **Adaptive** - Works even if Instantly changes their UI

---

## 🔧 Model Comparison

| Model | Cost/Contact | Quality | Speed | Best For |
|-------|--------------|---------|-------|----------|
| **GPT-4o-mini** ⭐ | $0.0006 | Excellent | Fast | Most users |
| GPT-3.5 Turbo | $0.0010 | Good | Faster | High volume |
| GPT-4o | $0.0100 | Best | Slower | Critical contacts |

**Recommendation**: Start with GPT-4o-mini!

---

## ❌ Common Issues

### "Invalid API key"
- Check key starts with `sk-` or `sk-proj-`
- Copy the entire key (usually 50+ characters)

### "Insufficient credits"
- Add payment method at [platform.openai.com/billing](https://platform.openai.com/billing)
- OpenAI requires prepaid credits

### Slow formatting
- Normal! AI takes 1-2 seconds vs instant JavaScript
- Switch to GPT-4o-mini if using GPT-4o

### Still seeing artifacts
- Check console logs for errors
- Try disabling and re-enabling AI formatting
- Verify API key is correct

---

## 🔄 How to Disable

Don't like it? Easy to disable:

1. Open extension popup
2. Uncheck ☐ "Use AI for email formatting"
3. Click Save

Extension immediately switches back to standard JavaScript formatting.

---

## 🆚 AI vs Standard

| Feature | Standard | With AI |
|---------|----------|---------|
| Deduplication | Text matching | Semantic |
| Cleaning | Basic rules | Intelligent |
| Quality | Good | Excellent |
| Cost | Free | ~$0.0006 |
| Speed | Instant | 1-2 sec |

---

## 📊 Monitor Usage

Check your OpenAI usage at:
[platform.openai.com/usage](https://platform.openai.com/usage)

Set billing alerts to avoid surprises!

---

## 💡 Pro Tips

1. **Start small** - Test with 10-20 contacts first
2. **Monitor costs** - Check OpenAI dashboard weekly
3. **Use GPT-4o-mini** - Best value for money
4. **Set alerts** - Enable billing notifications
5. **Keep key secure** - Don't share or commit to code

---

## 📖 Full Documentation

For detailed information, see:
- **OPENAI_INTEGRATION.md** - Complete guide
- **TEST_CHECKLIST.md** - Testing procedures
- **DEBUGGING.md** - Troubleshooting

---

## ✨ Bottom Line

**Should you enable AI formatting?**

- ✅ YES if: You sync 100+ leads/month and want best quality
- ✅ YES if: You value consistently polished notes
- ❌ NO if: Cost is absolutely critical ($6/10k contacts)
- ❌ NO if: You prefer instant processing (no 1-2 sec delay)

**My recommendation**: Try it! At ~$0.0006 per contact, the quality improvement is worth it for most users.

---

**Ready?** Add your OpenAI API key and enjoy smarter email formatting! 🎉
