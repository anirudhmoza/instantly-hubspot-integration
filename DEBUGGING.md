# Debugging Guide for Instantly → HubSpot Extension

## Quick Start Testing

### Step 1: Load the Extension

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `instantly-hubspot-extension` folder
5. You should see the extension appear with a green "Service worker" status

### Step 2: Configure API Key

1. Click the extension icon in Chrome toolbar
2. Paste your HubSpot Private App Access Token (starts with `pat-`)
3. Click **Save Settings**
4. Click **Test Connection** to verify it works

### Step 3: Test on Instantly

1. Go to https://app.instantly.ai and open any lead
2. **Important**: Refresh the page after loading the extension for the first time
3. Open DevTools (F12) and go to Console tab
4. You should see: `[Instantly → HubSpot] Content script loaded`

### Step 4: Trigger a Sync

1. On the Instantly lead page, change the status to "Meeting Booked"
2. Watch the console for log messages
3. You should see a notification in the top-right of the page
4. Check HubSpot to verify the contact was created/updated

## Console Logging

The extension logs everything to help you debug. Here's what to look for:

### Content Script Logs (Instantly page)

Open DevTools (F12) on the Instantly page and check Console:

```
[Instantly → HubSpot] Content script loaded
[Instantly → HubSpot] Initializing...
[Instantly → HubSpot] Monitoring started
[Instantly → HubSpot] New lead detected: example@email.com
[Instantly → HubSpot] Attempting to extract email...
[Instantly → HubSpot] Found email in main content: example@email.com
[Instantly → HubSpot] Attempting to extract status...
[Instantly → HubSpot] Found status in button: Meeting Booked
[Instantly → HubSpot] Status changed from null to Meeting Booked
[Instantly → HubSpot] Meeting booked detected!
[Instantly → HubSpot] ========== EXTRACTION STARTED ==========
[Instantly → HubSpot] Starting email thread extraction...
[Instantly → HubSpot] Extracted 1 email(s) from thread
[Instantly → HubSpot] Lead data extracted: {...}
[Instantly → HubSpot] Sending to background worker...
[Instantly → HubSpot] ========== SYNC SUCCESSFUL ==========
```

### Background Worker Logs

Go to `chrome://extensions/` → Find the extension → Click **Inspect views: service worker**

```
[Background] ========== SYNC STARTED ==========
[Background] Lead data received: {...}
[Background] API key found, proceeding with sync...
[Background] Step 1: Creating/updating contact...
[Background] Checking if contact already exists...
[Background] Contact already exists with ID: 12345
[Background] ✓ Contact created/updated successfully: 12345
[Background] Step 2: Creating note with 1 email(s)...
[Background] ✓ Note created successfully
[Background] ========== SYNC COMPLETED SUCCESSFULLY ==========
```

## Common Issues and Solutions

### Issue: "No email found on page"

**Problem**: The extension can't find the lead's email address.

**Solutions**:
1. Make sure you're on a lead detail page (not the inbox list)
2. Verify the email is visible on the page
3. Try refreshing the page
4. Check console for extraction attempts

**Debug**:
```javascript
// In console, manually test:
document.body.innerText.match(/\b[\w.+-]+@[\w.-]+\.\w{2,}\b/g)
// Should return an array with the email
```

### Issue: "No status found"

**Problem**: Extension can't detect the lead status.

**Solutions**:
1. Make sure the status button/dropdown is visible
2. The status must contain keywords like "meeting", "booked", "interested", etc.
3. Instantly may have changed their UI - check the button text

**Debug**:
```javascript
// In console, find all buttons:
Array.from(document.querySelectorAll('button')).map(b => b.textContent)
// Look for the status button in this list
```

### Issue: Status changes but sync doesn't trigger

**Problem**: The extension detects status but doesn't start sync.

**Checklist**:
1. Is auto-sync enabled in extension settings?
2. Is the HubSpot API key configured?
3. Check console for "Skipping sync" messages
4. Make sure status contains "meeting" AND "booked" (case-insensitive)

**Debug**:
```javascript
// Check settings:
chrome.storage.sync.get(['autoSync', 'hubspotKey'], console.log)
```

### Issue: "Extension context invalidated"

**Problem**: Extension was reloaded/updated while page was open.

**Solution**: Simply refresh the Instantly page.

### Issue: Email thread extraction fails

**Problem**: No email content is being synced to HubSpot.

**Solutions**:
1. Check if there are any email messages visible on the page
2. Try clicking to expand collapsed messages first
3. The extension will capture the entire visible content as fallback

**Debug**:
```javascript
// Check what content is available:
const main = document.querySelector('main, [role="main"]');
console.log(main?.innerText.length, 'characters available');
```

### Issue: API errors (401, 403, etc.)

**Problem**: HubSpot API returns errors.

**Solutions**:
1. **401 Unauthorized**: API key is invalid or expired
   - Regenerate your Private App token in HubSpot
2. **403 Forbidden**: Missing required scopes
   - Add these scopes: contacts.read, contacts.write, notes.read, notes.write
3. **429 Too Many Requests**: Rate limit exceeded
   - Wait a few minutes before trying again

### Issue: Contact created but no note appears

**Problem**: Contact syncs but email thread doesn't appear in HubSpot.

**Solutions**:
1. Check if email thread was extracted (look in console logs)
2. Verify your HubSpot Private App has `notes.write` scope
3. Check the contact's Activity Timeline in HubSpot (Notes section)
4. Look in background worker console for note creation errors

## Manual Testing Steps

### Test Email Extraction

1. Open Instantly lead page
2. Open console (F12)
3. Run:
```javascript
// This simulates what the extension does
const text = document.body.innerText;
const emails = text.match(/\b[\w.+-]+@[\w.-]+\.\w{2,}\b/g);
console.log('Found emails:', emails);
```

### Test Status Detection

```javascript
// Find all buttons with status-like text
const buttons = Array.from(document.querySelectorAll('button'));
const statusButtons = buttons.filter(b => {
  const text = b.textContent.toLowerCase();
  return text.includes('meeting') || text.includes('interested') || text.includes('booked');
});
console.log('Status buttons:', statusButtons.map(b => b.textContent));
```

### Manually Trigger Sync

```javascript
// Force a sync (replace with real email)
chrome.runtime.sendMessage({
  action: 'syncToHubSpot',
  data: {
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    company: 'Test Company',
    emailThread: [{
      subject: 'Test Email',
      body: 'This is a test email thread.',
      timestamp: new Date().toISOString(),
      from: 'test@example.com',
      to: 'you@yourcompany.com'
    }]
  }
}, console.log);
```

## Viewing All Logs

### Content Script Logs
- Open Instantly page
- Press F12 → Console
- Filter by `Instantly → HubSpot`

### Background Worker Logs
- Go to `chrome://extensions/`
- Find "Instantly to HubSpot Sync"
- Click "Inspect views: service worker"
- Console tab shows all background logs

### Popup Logs
- Right-click extension icon
- Click "Inspect popup"
- Console tab shows popup logs

## Testing HubSpot API Connection

### Via Extension
1. Click extension icon
2. Click "Test Connection" button
3. Should show green "Connection successful!" message

### Via Console (Background Worker)
```javascript
// Test API connection manually
const apiKey = 'YOUR_API_KEY_HERE';
fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
})
.then(r => r.ok ? console.log('✓ Connected') : console.error('✗ Failed', r.status))
.catch(console.error);
```

## Performance Tips

1. **Reduce console noise**: Once working, you can reduce logging by modifying console.log statements
2. **Debouncing**: The extension waits 500ms after DOM changes before checking - this prevents excessive checks
3. **Processing lock**: Once a sync starts, it won't start another for 5 seconds

## Need More Help?

1. Check all three consoles (page, background, popup)
2. Look for red error messages
3. Verify your API key has all required scopes
4. Try with a fresh Private App token
5. Make sure you're using Chrome (not Firefox/Safari)
6. Refresh the Instantly page after any extension changes

## Advanced Debugging

### Enable Verbose Logging

Add this to the top of content.js:
```javascript
const DEBUG = true;
function debugLog(...args) {
  if (DEBUG) console.log('[DEBUG]', ...args);
}
```

### Monitor All DOM Changes

Add this to content.js after line 40:
```javascript
const observer = new MutationObserver((mutations) => {
  console.log('DOM changed:', mutations.length, 'mutations');
});
```

### Track Network Requests

In DevTools → Network tab:
- Filter by "hubapi.com"
- Watch for POST/PATCH requests to contacts and notes
- Check request/response payloads for errors
