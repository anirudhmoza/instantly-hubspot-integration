# Instantly → HubSpot Sync Extension

A Chrome extension that automatically syncs leads from Instantly.ai to HubSpot when they're marked as "Meeting Booked". The extension captures the lead's email, contact information, and entire email thread, then creates a contact in HubSpot with all email activities properly logged.

## Features

- **Auto-Sync on Status Change**: Automatically detects when a lead is marked as "Meeting Booked" in Instantly
- **Contact Creation**: Creates or updates HubSpot contacts with email, first name, last name, and company
- **Email Thread Sync**: Converts the entire email conversation into beautifully formatted HubSpot Notes
- **📤/📥 Direction Indicators**: Clearly shows outgoing vs incoming emails
- **Smart Deduplication**: Prevents duplicate contacts AND duplicate emails in threads
- **Clean Formatting**: Removes artifacts, preserves paragraphs, formats bullet points consistently
- **Professional UI**: Clean, modern popup interface for managing settings
- **Real-time Notifications**: Visual feedback when syncs complete
- **Statistics Tracking**: Track total syncs and last sync time
- **Secure Storage**: API keys stored securely using Chrome's storage API

## Prerequisites

1. **HubSpot Account** with API access
2. **HubSpot Private App Access Token**
3. **Google Chrome** browser (version 88 or higher)
4. **Instantly.ai** account

## Setup Instructions

### Step 1: Create HubSpot Private App

1. Log in to your HubSpot account
2. Go to **Settings** → **Integrations** → **Private Apps**
3. Click **Create a private app**
4. Name it "Instantly Integration" (or your preferred name)
5. Go to the **Scopes** tab and enable these scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.objects.notes.read`
   - `crm.objects.notes.write`
6. Click **Create app**
7. Copy the **Access Token** (starts with `pat-na1-` or `pat-eu1-`)

### Step 2: Generate Extension Icons (Optional)

The extension includes an SVG icon. To generate PNG icons for Chrome:

**Option A: Online Converter**
1. Go to https://cloudconvert.com/svg-to-png
2. Upload `icons/icon.svg`
3. Convert to PNG at these sizes: 16x16, 48x48, 128x128
4. Save as `icon16.png`, `icon48.png`, `icon128.png` in the `icons/` folder

**Option B: Using ImageMagick (if installed)**
```bash
convert -background none icons/icon.svg -resize 16x16 icons/icon16.png
convert -background none icons/icon.svg -resize 48x48 icons/icon48.png
convert -background none icons/icon.svg -resize 128x128 icons/icon128.png
```

**Option C: Skip this step**
Chrome will use default icons if PNGs are not provided.

### Step 3: Install the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `instantly-hubspot-extension` folder
5. The extension should now appear in your extensions list

### Step 4: Configure the Extension

1. Click the extension icon in your Chrome toolbar
2. Paste your HubSpot API key in the **HubSpot API Key** field
3. Ensure **Auto-sync when marked as "Meeting Booked"** is checked
4. Click **Save Settings**
5. Click **Test Connection** to verify your API key works

### Step 5 (Optional): Enable AI-Powered Formatting

The extension can use OpenAI to clean up and format synced email threads (remove signatures/disclaimers, label 📤/📥 direction, de-duplicate). This is **optional** — formatting works without it.

1. Get an OpenAI API key at [platform.openai.com](https://platform.openai.com) → **API keys** (starts with `sk-` or `sk-proj-`).
2. In the extension popup, check **"Use AI for email formatting"**, paste the key, and pick a model (**GPT-4o-mini** recommended — ~$0.0006/contact).
3. Click **Save Settings**.

Your OpenAI key, like the HubSpot key, is stored only in Chrome's `storage.sync` and is sent only to OpenAI's API. See `OPENAI_QUICK_START.md` and `OPENAI_INTEGRATION.md` for details.

## Usage

### Automatic Sync

1. Navigate to Instantly.ai and open any lead
2. The extension will automatically monitor the page
3. When you change the lead status to "Meeting Booked", the extension will:
   - Extract the lead's email address
   - Extract first name, last name, and company (if available)
   - Extract the entire email thread
   - Create or update the contact in HubSpot
   - Add all email messages as Email activities in HubSpot
   - Show a success notification

### Manual Testing

You can test the connection at any time:
1. Click the extension icon
2. Click **Test Connection** at the bottom
3. A success or error message will appear

### View Statistics

The extension popup shows:
- **Total Syncs**: Number of leads successfully synced to HubSpot
- **Last Sync**: Timestamp of the most recent sync

### Settings

- **Auto-sync**: Toggle automatic syncing on/off
- **Show notifications**: Toggle on-page notifications
- **Clear Data**: Reset statistics (doesn't affect HubSpot data)

## How It Works

### Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌──────────────┐
│  Instantly.ai   │ ───→ │  Content Script  │ ───→ │  Background  │
│  (Web Page)     │      │  (Monitoring)    │      │   Service    │
└─────────────────┘      └──────────────────┘      │   Worker     │
                                                    └──────┬───────┘
                                                           │
                                                           ↓
                                                    ┌──────────────┐
                                                    │   HubSpot    │
                                                    │     API      │
                                                    └──────────────┘
```

### Components

1. **Content Script** (`content.js`)
   - Monitors Instantly.ai pages for DOM changes
   - Detects when lead status changes to "Meeting Booked"
   - Extracts lead data (email, name, company, email thread)
   - Sends data to background worker

2. **Background Service Worker** (`background.js`)
   - Handles all HubSpot API calls
   - Creates or updates contacts
   - Creates email activities
   - Manages statistics and error handling

3. **Popup UI** (`popup.html`, `popup.js`, `popup.css`)
   - Provides settings interface
   - Displays connection status
   - Shows sync statistics
   - Allows testing API connection

### Data Flow

1. User marks lead as "Meeting Booked" in Instantly
2. Content script detects status change
3. Content script extracts:
   - Email address (primary identifier)
   - First name, last name, company
   - Complete email thread
4. Data sent to background worker
5. Background worker:
   - Creates/updates HubSpot contact by email
   - Creates Email activity for each message in thread
   - Associates emails with contact
6. Statistics updated
7. Success notification shown

### HubSpot API Integration

**Contact Creation** (`POST /crm/v3/objects/contacts`)
- Creates new contact or finds existing by email
- Updates contact properties if already exists
- Sets lead status to "MEETING_BOOKED"

**Email Activities** (`POST /crm/v3/objects/emails`)
- Creates separate email engagement for each message
- Associates each email with contact (association type 198)
- Preserves email metadata (subject, timestamp, direction)

## Troubleshooting

### Extension Not Detecting Status Changes

- **Refresh the Instantly page** after installing the extension
- Check browser console (F12) for any error messages
- Verify you're on the correct Instantly.ai URL
- The email address must be visible on the page

### API Connection Failed

- Verify your HubSpot API key is correct
- Check that the private app has the required scopes:
  - `crm.objects.contacts.read`
  - `crm.objects.contacts.write`
  - `crm.objects.emails.read`
  - `crm.objects.emails.write`
- Ensure your HubSpot account has API access enabled
- Try regenerating the private app token

### Contacts Not Created

- Check that the email address is valid
- Verify the API key has write permissions
- Check HubSpot for any contact creation limits
- Look in browser console for detailed error messages

### Email Thread Not Syncing

- The extension attempts to extract emails from the page structure
- If Instantly changes their page layout, email extraction may need updates
- Emails are created as HubSpot Email activities (not Notes)
- Check HubSpot contact's Activity timeline for emails

### Multiple Syncs for Same Lead

- The extension tracks the current lead by email address
- Status must change from a non-meeting-booked state to meeting-booked
- Processing is debounced to prevent duplicate syncs
- If you mark and unmark repeatedly, it may sync multiple times

## Development

### File Structure

```
instantly-hubspot-extension/
├── manifest.json           # Extension configuration
├── background.js           # Service worker (API calls)
├── content.js             # Page monitoring script
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic
├── styles/
│   └── popup.css          # Popup styling
├── icons/
│   ├── icon.svg           # Source icon
│   ├── icon16.png         # 16x16 icon
│   ├── icon48.png         # 48x48 icon
│   └── icon128.png        # 128x128 icon
└── README.md              # This file
```

### Debugging

**Content Script**
```javascript
// Open Instantly.ai page
// Press F12 → Console tab
// Filter by "Instantly → HubSpot"
```

**Background Worker**
```javascript
// Go to chrome://extensions/
// Click "Inspect views: service worker"
// Console shows background worker logs
```

**Popup**
```javascript
// Right-click extension icon → Inspect popup
// Console shows popup logs
```

### Modifying Extraction Logic

If Instantly.ai changes their page structure, you may need to update `content.js`:

1. Inspect the Instantly page with DevTools (F12)
2. Find the element containing email/status
3. Update selectors in `extractLeadEmail()` or `extractLeadStatus()`
4. Reload extension in `chrome://extensions/`

## Privacy & Security

- **API keys** are stored securely using Chrome's `storage.sync` API
- **No data** is sent to any server except HubSpot's official API
- **No tracking** or analytics included
- **Open source** - all code is reviewable

## Limitations

- Only works with Instantly.ai (as designed)
- Requires the email address to be visible on the page
- Email thread extraction depends on Instantly's page structure
- Chrome only (not compatible with Firefox/Safari without modifications)
- Requires manual API key setup (no OAuth flow)

## Future Enhancements

Potential features for future versions:
- Support for other lead statuses besides "Meeting Booked"
- Custom field mapping
- Bulk sync option
- Sync history with filtering
- Two-way sync (HubSpot → Instantly)
- Webhook support for real-time updates

## Documentation

Comprehensive documentation is available:

| Document | Description |
|----------|-------------|
| **README.md** (this file) | Overview, setup, and basic usage |
| **QUICK_START.md** | Fast installation and configuration guide |
| **OPENAI_QUICK_START.md** | 5-minute setup for optional AI email formatting |
| **OPENAI_INTEGRATION.md** | Technical details of the OpenAI integration |
| **DEBUGGING.md** | Detailed troubleshooting and debugging guide |
| **CHANGES.md** | History of fixes and improvements |
| **FORMATTING_IMPROVEMENTS.md** | Technical details of email formatting |
| **BEFORE_AFTER_COMPARISON.md** | Visual examples of formatting improvements |
| **FINAL_IMPLEMENTATION_SUMMARY.md** | Complete implementation overview |

**New users**: Start with `QUICK_START.md` for fastest setup!

## Support

For issues or questions:
1. Check the **Troubleshooting** section above
2. Review `DEBUGGING.md` for detailed troubleshooting steps
3. Review browser console logs for errors
4. Verify all setup steps completed correctly
5. Check that Instantly page structure hasn't changed

## License

This extension is provided as-is for internal use. Modify as needed for your workflow.

## Changelog

### Version 1.1.0 (Latest - Formatting Improvements)
- **📤/📥 Direction indicators** for outgoing/incoming emails
- **Smart deduplication** - each email appears exactly once
- **Clean formatting** - removes artifacts, headers, quoted text
- **Proper paragraph breaks** preserved in email bodies
- **Formatted bullet points** with consistent styling
- **Better visual spacing** between emails
- **Professional appearance** in HubSpot notes
- Works reliably with 5-6+ email threads
- Comprehensive documentation added

### Version 1.0.0 (Initial Release)
- Auto-sync on "Meeting Booked" status
- Contact creation/update in HubSpot
- Email thread sync as Notes (changed from Email activities)
- Professional popup UI with settings
- Statistics tracking
- Connection testing
- Secure API key storage
