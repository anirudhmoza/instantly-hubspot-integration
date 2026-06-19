# Quick Start Guide

## Installation (30 seconds)

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → Select `instantly-hubspot-extension` folder
4. Done! Extension icon appears in toolbar

## Configuration (1 minute)

1. Click extension icon
2. Paste HubSpot Private App Access Token
3. Click **Save Settings**
4. Click **Test Connection** (should show success)

## Usage

### Automatic Sync
1. Go to Instantly.ai lead page
2. Change status to **"Meeting Booked"**
3. Extension automatically syncs to HubSpot
4. Green notification confirms success

### Check Logs
- Open DevTools (F12) on Instantly page
- Look for green `[Instantly → HubSpot]` messages

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Not syncing | Refresh the Instantly page after installing extension |
| No email found | Make sure email is visible on the page |
| API error | Regenerate HubSpot Private App token with all scopes |
| Extension reloaded | Refresh the Instantly page |

## Required HubSpot Scopes

Your Private App needs these permissions:
- ✓ `crm.objects.contacts.read`
- ✓ `crm.objects.contacts.write`
- ✓ `crm.objects.notes.read`
- ✓ `crm.objects.notes.write`

## Where to Find Synced Data in HubSpot

1. Go to **Contacts**
2. Search for lead's email
3. Open contact
4. Click **Activity** tab
5. Look in **Notes** section for email thread

## Need Help?

- See `DEBUGGING.md` for detailed troubleshooting
- See `CHANGES.md` for what was fixed
- Check browser console for error messages

## Key Features

✓ Auto-detects "Meeting Booked" status
✓ Extracts email address, name, company
✓ Captures entire email thread
✓ Creates/updates HubSpot contact
✓ Adds email thread as note
✓ Visual notifications
✓ Comprehensive logging

**No API keys needed** - Just your HubSpot token!
