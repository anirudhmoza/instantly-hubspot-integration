# OpenAI Integration Guide

## Overview

The extension now supports **optional AI-powered email formatting** using OpenAI's GPT models. This provides superior formatting quality with intelligent deduplication and content cleaning.

---

## 🎯 Why Use AI Formatting?

### Benefits:
- **Smarter deduplication** - Understands semantic similarity, not just exact text matches
- **Better cleaning** - Intelligently removes signatures, disclaimers, and irrelevant content
- **Context-aware** - Understands conversation flow and email structure
- **Adaptive** - Works even if Instantly changes their UI
- **Professional output** - Consistently formatted, polished notes in HubSpot

### Cost:
- **GPT-4o-mini**: ~$0.0006 per contact (less than 1/10th of a cent)
- **GPT-3.5 Turbo**: ~$0.0010 per contact
- **GPT-4o**: ~$0.0100 per contact (higher quality)

Even at 10,000 contacts/month, GPT-4o-mini costs only **$6/month**.

---

## 📋 Setup Instructions

### Step 1: Get an OpenAI API Key

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in
3. Click on your profile → **API keys**
4. Click **Create new secret key**
5. Name it "Instantly HubSpot Extension"
6. Copy the key (starts with `sk-` or `sk-proj-`)
7. **Save it somewhere safe** - you won't be able to see it again!

### Step 2: Configure the Extension

1. Click the extension icon in Chrome
2. Scroll to **"AI Formatting (Optional)"** section
3. Check **"Use AI for email formatting"**
4. Two new fields will appear:
   - **OpenAI API Key**: Paste your API key
   - **OpenAI Model**: Choose your model (GPT-4o-mini recommended)
5. Click **Save Settings**

---

## 🔧 Model Selection

### GPT-4o-mini (Recommended) ⭐
- **Cost**: ~$0.0006 per contact
- **Quality**: Excellent for email formatting
- **Speed**: Very fast (~1-2 seconds)
- **Best for**: Most use cases

### GPT-3.5 Turbo
- **Cost**: ~$0.0010 per contact
- **Quality**: Good, slightly less accurate
- **Speed**: Fast (~1 second)
- **Best for**: High-volume, budget-conscious users

### GPT-4o
- **Cost**: ~$0.0100 per contact (16x more expensive!)
- **Quality**: Highest quality formatting
- **Speed**: Slower (~3-4 seconds)
- **Best for**: Critical contacts where quality is paramount

**Recommendation**: Start with **GPT-4o-mini**. It offers the best balance of cost, quality, and speed.

---

## 📊 Cost Calculator

| Volume | GPT-4o-mini | GPT-3.5 Turbo | GPT-4o |
|--------|-------------|---------------|--------|
| 10 contacts | $0.006 | $0.010 | $0.100 |
| 100 contacts | $0.060 | $0.100 | $1.000 |
| 1,000 contacts | $0.600 | $1.000 | $10.00 |
| 10,000 contacts | $6.00 | $10.00 | $100.00 |

---

## 🔄 How It Works

### Without AI (Standard JavaScript):
```
1. Extract emails from iframes
2. Parse with regex patterns
3. Remove duplicates by exact text matching
4. Clean with string replacement rules
5. Format and send to HubSpot
```

### With AI (OpenAI GPT):
```
1. Extract emails from iframes
2. Send raw data to OpenAI
3. AI analyzes content intelligently:
   - Understands email structure
   - Identifies direction (incoming/outgoing)
   - Removes semantic duplicates
   - Cleans quoted text and signatures
   - Formats bullet points naturally
4. Receive clean, structured JSON
5. Format and send to HubSpot
```

---

## 🎨 What AI Formatting Does

### Intelligent Deduplication
- Detects duplicate content even if text differs slightly
- Understands when emails are replies vs new messages
- Removes redundant quoted sections

### Smart Cleaning
- **Removes**:
  - Email signatures
  - Legal disclaimers
  - Quoted previous emails
  - Email headers from body (From:, To:, Subject:)
  - IFRAME_SEPARATOR artifacts
  - Excessive whitespace

- **Preserves**:
  - Important content
  - Paragraph structure
  - Bullet points (reformatted with •)
  - Conversation flow

### Direction Detection
- Analyzes sender/recipient to determine email direction
- Adds 📤 Outgoing or 📥 Incoming indicators
- Works even with complex email threads

---

## 📁 Technical Implementation

### OpenAI API Call

The extension sends this request to OpenAI:

```javascript
{
  "model": "gpt-4o-mini",
  "messages": [
    {
      "role": "system",
      "content": "You are an email formatting assistant..."
    },
    {
      "role": "user",
      "content": "Email thread data: {...}"
    }
  ],
  "temperature": 0.3,
  "max_tokens": 4000
}
```

### Response Format

OpenAI returns structured JSON:

```json
[
  {
    "direction": "outgoing",
    "from": "you@company.com",
    "to": "lead@company.com",
    "subject": "Product Demo",
    "timestamp": "2025-01-15T10:30:00Z",
    "body": "Hi John,\n\nI wanted to reach out..."
  },
  {
    "direction": "incoming",
    "from": "lead@company.com",
    "to": "you@company.com",
    "subject": "Re: Product Demo",
    "timestamp": "2025-01-15T14:15:00Z",
    "body": "Thanks for reaching out!\n\nI'm definitely interested..."
  }
]
```

### Fallback Mechanism

If AI formatting fails (API error, invalid key, etc.), the extension **automatically falls back** to standard JavaScript formatting. No sync is lost!

```javascript
try {
  processedEmails = await formatEmailsWithAI(...);
} catch (aiError) {
  console.error('AI formatting failed, using standard formatting');
  // Continues with regular formatting
}
```

---

## 🔒 Privacy & Security

### What Gets Sent to OpenAI:
- Email addresses (sender/recipient)
- Email subjects
- Email body text
- Timestamps

### What Does NOT Get Sent:
- Your HubSpot API key
- Other extension settings
- Activity logs
- Statistics

### OpenAI's Data Policy:
- API requests are **not used to train models** (as of March 2023)
- Data is **not stored long-term**
- Requests are **encrypted in transit** (HTTPS)
- See [OpenAI's data usage policy](https://openai.com/policies/api-data-usage-policies)

### Your Control:
- AI formatting is **100% optional**
- Can disable at any time
- Falls back to local processing if disabled
- API key stored securely in Chrome's encrypted storage

---

## 🧪 Testing AI Formatting

### Step 1: Enable AI Formatting

1. Open extension popup
2. Check "Use AI for email formatting"
3. Enter your OpenAI API key
4. Select GPT-4o-mini
5. Save settings

### Step 2: Test with a Lead

1. Go to Instantly.ai lead page
2. Open DevTools (F12) → Console
3. Mark lead as "Meeting Booked"
4. Watch for logs:
   ```
   [Background] AI formatting is enabled, using OpenAI...
   [Background] Formatting emails with OpenAI...
   [Background] Model: gpt-4o-mini
   [Background] OpenAI response received
   [Background] ✓ AI formatting successful: 3 emails
   ```

### Step 3: Verify in HubSpot

1. Go to HubSpot → Contacts
2. Find the synced contact
3. Open Activity → Notes
4. Check the email thread formatting:
   - ✅ Direction indicators (📤/📥)
   - ✅ No duplicates
   - ✅ Clean, formatted text
   - ✅ Proper bullet points
   - ✅ No artifacts or clutter

---

## ❌ Troubleshooting

### "Invalid OpenAI API key format"
- **Cause**: API key doesn't start with `sk-` or `sk-proj-`
- **Fix**: Copy the key again from OpenAI platform

### "OpenAI API error: 401 Unauthorized"
- **Cause**: Invalid or expired API key
- **Fix**: Generate a new API key on OpenAI platform

### "OpenAI API error: 429 Rate limit exceeded"
- **Cause**: Too many requests to OpenAI
- **Fix**: Wait a moment and try again, or upgrade your OpenAI plan

### "OpenAI API error: Insufficient credits"
- **Cause**: No credits on your OpenAI account
- **Fix**: Add payment method at platform.openai.com/billing

### AI formatting takes too long
- **Cause**: GPT-4o is slower than GPT-4o-mini
- **Fix**: Switch to GPT-4o-mini in settings

### Formatting still looks bad
- **Cause**: AI might have misunderstood the email structure
- **Fix**: Try disabling AI formatting for this case, or report the issue

### Extension falls back to standard formatting
- **Cause**: AI formatting failed (check console logs)
- **Fix**: Check API key, check OpenAI account credits, check console errors

---

## 📈 Monitoring API Usage

### Check OpenAI Usage Dashboard

1. Go to [platform.openai.com/usage](https://platform.openai.com/usage)
2. View daily usage and costs
3. Set up billing alerts if needed

### Average Token Usage

Per contact (3-4 emails, ~1000 chars each):
- **Input tokens**: ~1,000 tokens
- **Output tokens**: ~800 tokens
- **Total cost with GPT-4o-mini**: ~$0.0006

---

## 🔄 Disabling AI Formatting

If you want to go back to standard formatting:

1. Open extension popup
2. Uncheck "Use AI for email formatting"
3. Click Save Settings

The extension will immediately switch back to JavaScript-based formatting. No need to remove the API key.

---

## 💡 Best Practices

1. **Start with GPT-4o-mini** - Best balance of cost/quality
2. **Monitor costs initially** - Check OpenAI dashboard after first week
3. **Set billing alerts** - Prevent unexpected charges
4. **Test with a few leads first** - Verify quality before enabling permanently
5. **Keep API key secure** - Don't share it or commit it to code

---

## 🆚 AI vs Standard Formatting

| Feature | Standard JS | AI Formatting |
|---------|-------------|---------------|
| **Deduplication** | Exact text match | Semantic understanding |
| **Cleaning** | Regex patterns | Context-aware |
| **Direction detection** | Simple heuristics | Intelligent analysis |
| **Signature removal** | Basic rules | Smart detection |
| **Bullet formatting** | String replacement | Natural formatting |
| **Cost** | Free | ~$0.0006 per contact |
| **Speed** | Instant | ~1-2 seconds |
| **Quality** | Good | Excellent |
| **Reliability** | Very high | High (with fallback) |

---

## 📚 Example Output Comparison

### Standard JavaScript Formatting:
```
📤 Outgoing • Email 1 of 3

👤 From: you@company.com
📬 To: lead@company.com
📅 Date: Mon, Jan 15, 2025, 10:30 AM

Hi John,

I wanted to reach out about our product demo. Would you be interested in:

  • Feature A overview
  • Feature B walkthrough
  • Q&A session

Best regards,
Your Name
Company Name | your@company.com | +1-555-0100
```

### AI-Enhanced Formatting:
```
📤 Outgoing • Email 1 of 3

👤 From: you@company.com
📬 To: lead@company.com
📅 Date: Mon, Jan 15, 2025, 10:30 AM

Hi John,

I wanted to reach out about our product demo. Would you be interested in:

  • Feature A overview
  • Feature B walkthrough
  • Q&A session

Best regards,
Your Name
```

**Notice**: AI automatically removed the email signature footer.

---

## ✅ Summary

- **Easy setup**: Just add OpenAI API key
- **Flexible**: Choose model based on needs
- **Affordable**: ~$0.0006 per contact with GPT-4o-mini
- **Optional**: Falls back to standard if disabled or fails
- **Secure**: API key encrypted, data not stored by OpenAI
- **Smart**: Superior formatting with intelligent cleaning

**Recommendation**: Enable AI formatting if you're syncing more than 100 leads/month. The improved quality is worth the minimal cost!

---

## 🔗 Useful Links

- [OpenAI Platform](https://platform.openai.com)
- [OpenAI API Documentation](https://platform.openai.com/docs)
- [OpenAI Pricing](https://openai.com/api/pricing/)
- [OpenAI Usage Dashboard](https://platform.openai.com/usage)
- [OpenAI Data Policy](https://openai.com/policies/api-data-usage-policies)

---

**Questions or issues?** Check the console logs for detailed error messages, or disable AI formatting and use standard JavaScript formatting instead.
