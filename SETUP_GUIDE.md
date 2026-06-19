# Quick Setup Guide

## Installation Steps

### 1. Get Your HubSpot API Key

1. Log into your HubSpot account
2. Go to **Settings** (gear icon) → **Integrations** → **Private Apps**
3. Click **Create a private app**
4. Name it "Instantly Integration"
5. Go to **Scopes** tab and enable:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.objects.emails.read`
   - `crm.objects.emails.write`
6. Click **Create app** and copy the access token (starts with `pat-`)

### 2. Install the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right corner)
3. Click **Load unpacked**
4. Select this folder: `instantly-hubspot-extension`
5. The extension will appear in your extensions list

### 3. Configure the Extension

1. Click the extension icon in Chrome toolbar
2. Paste your HubSpot API key
3. Keep "Auto-sync when marked as Meeting Booked" checked
4. Click **Save Settings**
5. Click **Test Connection** to verify it works

### 4. Generate Icons (Optional)

The extension will work without custom icons, but if you want professional icons:

**Online Method:**
1. Visit https://cloudconvert.com/svg-to-png
2. Upload `icons/icon.svg`
3. Convert to 16x16, 48x48, and 128x128 PNG
4. Save as `icon16.png`, `icon48.png`, `icon128.png` in the `icons/` folder
5. Go to `chrome://extensions/` and click the refresh icon on the extension

## How to Use

1. Open Instantly.ai and navigate to any lead
2. The extension automatically monitors in the background
3. When you mark a lead as "Meeting Booked":
   - Email address is extracted
   - First name, last name, company are captured (if available)
   - Entire email thread is collected
   - Contact is created/updated in HubSpot
   - Emails are added as Email activities
4. Click the extension icon anytime to see the live activity log

## Viewing Activity

The extension popup shows:
- **Status**: Whether it's connected and monitoring
- **Settings**: Configure API key and options
- **Statistics**: Total syncs and last sync time
- **Activity Log**: Real-time log of all sync operations
  - Green = Success
  - Red = Failed
  - Shows email, timestamp, and HubSpot link

## Troubleshooting

**No email detected?**
- Make sure the email is visible on the Instantly page
- Refresh the page and try again

**Sync not working?**
- Click extension icon → Test Connection
- Check that API key is correct
- Verify HubSpot permissions are set

**Nothing happens when marking as Meeting Booked?**
- Open browser console (F12) and look for logs starting with `[Instantly → HubSpot]`
- Make sure auto-sync is enabled in extension settings
- Verify the lead status actually changed to "Meeting Booked"

## Features

- **Silent Background Operation**: No popups, just works in the background
- **Live Activity Log**: See real-time sync status in extension popup
- **Auto-Deduplication**: Won't create duplicate contacts
- **Email Threading**: Preserves entire conversation history
- **Smart Extraction**: Finds email and contact data automatically
- **Secure**: API keys stored securely in Chrome

## What Gets Synced

**Contact Fields:**
- Email (required)
- First Name
- Last Name
- Company Name
- Lead Status = "MEETING_BOOKED"

**Email Activities:**
- Subject line
- Email body
- Timestamp
- Direction (incoming/outgoing)
- Associated with contact

## Support

Check the browser console for detailed logs:
- Open Instantly page
- Press F12 → Console tab
- Filter by "Instantly → HubSpot"

For background worker logs:
- Go to `chrome://extensions/`
- Click "Inspect views: service worker"
