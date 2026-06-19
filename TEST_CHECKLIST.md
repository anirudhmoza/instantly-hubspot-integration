# Testing Checklist

Use this checklist to verify all fixes are working properly.

## Pre-Test Setup

- [ ] Extension loaded in Chrome (`chrome://extensions/`)
- [ ] Developer mode enabled
- [ ] HubSpot Private App token configured
- [ ] "Test Connection" shows success
- [ ] All required scopes enabled (contacts.read/write, notes.read/write)

## Test 1: Basic Sync

**Goal**: Verify sync happens when status changes to "Meeting Booked"

1. [ ] Open Instantly lead page
2. [ ] Open DevTools (F12) → Console
3. [ ] Verify console shows: `[Instantly → HubSpot] Content script loaded`
4. [ ] Change lead status to "Meeting Booked"
5. [ ] Verify blue notification appears: "Syncing to HubSpot..."
6. [ ] Verify console shows: `========== EXTRACTION STARTED ==========`
7. [ ] Verify green notification appears: "✓ Successfully synced..."
8. [ ] Verify console shows: `========== SYNC SUCCESSFUL ==========`

**Expected Result**: Green success notification, detailed console logs, no errors

---

## Test 2: Email Extraction

**Goal**: Verify extension finds the lead's email address

1. [ ] Open Instantly lead page with visible email
2. [ ] Open Console
3. [ ] Look for: `[Instantly → HubSpot] Found email in main content: [email]`
4. [ ] Verify the correct email was extracted

**Manual Test**:
```javascript
// Run in console:
document.body.innerText.match(/\b[\w.+-]+@[\w.-]+\.\w{2,}\b/g)
// Should return array with the email
```

**Expected Result**: Email correctly identified in console logs

---

## Test 3: Status Detection

**Goal**: Verify extension detects "Meeting Booked" status

1. [ ] Open lead page
2. [ ] Look for: `[Instantly → HubSpot] Attempting to extract status...`
3. [ ] Look for: `[Instantly → HubSpot] Found status in button: [status]`
4. [ ] Change status dropdown
5. [ ] Verify: `[Instantly → HubSpot] Status changed from X to Y`

**Manual Test**:
```javascript
// Find status buttons:
Array.from(document.querySelectorAll('button'))
  .filter(b => b.textContent.toLowerCase().includes('meeting'))
  .map(b => b.textContent)
```

**Expected Result**: Status detected and logged correctly

---

## Test 4: Email Thread Extraction

**Goal**: Verify email conversation is captured

1. [ ] Open lead with email thread visible
2. [ ] Trigger sync (mark as Meeting Booked)
3. [ ] Look for: `[Instantly → HubSpot] Starting email thread extraction...`
4. [ ] Look for: `[Instantly → HubSpot] Extracted X email(s) from thread`
5. [ ] Verify X is greater than 0

**Expected Result**: At least 1 email extracted from thread

---

## Test 5: HubSpot Contact Creation

**Goal**: Verify contact is created in HubSpot

1. [ ] Sync a new lead (not in HubSpot yet)
2. [ ] Check background worker console (`chrome://extensions/` → Inspect service worker)
3. [ ] Look for: `[Background] Contact does not exist, creating new contact...`
4. [ ] Look for: `[Background] ✓ Contact created/updated successfully: [ID]`
5. [ ] Go to HubSpot Contacts
6. [ ] Search for the email
7. [ ] Verify contact exists

**Expected Result**: New contact created in HubSpot

---

## Test 6: HubSpot Contact Update

**Goal**: Verify existing contact is updated (not duplicated)

1. [ ] Sync a lead that already exists in HubSpot
2. [ ] Check background worker console
3. [ ] Look for: `[Background] Contact already exists with ID: [ID]`
4. [ ] Look for: `[Background] Updating existing contact...`
5. [ ] Go to HubSpot
6. [ ] Verify only ONE contact exists (no duplicate)

**Expected Result**: Contact updated, not duplicated

---

## Test 7: Email Thread Note in HubSpot

**Goal**: Verify email thread appears as note

1. [ ] Sync a lead with email thread
2. [ ] Go to HubSpot → Open contact
3. [ ] Click **Activity** tab
4. [ ] Scroll to **Notes** section
5. [ ] Verify note exists with title: "📧 Email Conversation from Instantly.ai"
6. [ ] Verify note has:
   - [ ] Formatted headers (━━━)
   - [ ] Message numbers (📨 Message 1)
   - [ ] From/To fields (👤, 📬)
   - [ ] Date (📅)
   - [ ] Email content
   - [ ] Sync timestamp at bottom

**Expected Result**: Well-formatted note with complete email thread

---

## Test 8: Visual Notifications

**Goal**: Verify on-page notifications work

1. [ ] Mark lead as Meeting Booked
2. [ ] Verify blue notification slides in from right: "Syncing to HubSpot..."
3. [ ] Wait for sync to complete
4. [ ] Verify green notification: "✓ Successfully synced..."
5. [ ] Wait 5 seconds
6. [ ] Verify notification slides out and disappears

**Expected Result**: Smooth animated notifications

---

## Test 9: Error Handling

**Goal**: Verify errors are handled gracefully

**Test 9a: Invalid API Key**
1. [ ] Change API key to invalid value
2. [ ] Try to sync
3. [ ] Verify red notification appears with error
4. [ ] Verify console shows detailed error

**Test 9b: No Email on Page**
1. [ ] Navigate to Instantly inbox (not lead detail)
2. [ ] Check console
3. [ ] Verify: `[Instantly → HubSpot] No email found on page`
4. [ ] Verify no sync attempt

**Test 9c: Extension Reloaded**
1. [ ] Reload extension at `chrome://extensions/`
2. [ ] Try to sync on open Instantly page
3. [ ] Verify notification: "Extension needs refresh - please reload the page"

**Expected Result**: Clear error messages, no crashes

---

## Test 10: Settings Management

**Goal**: Verify extension settings work

1. [ ] Click extension icon
2. [ ] Verify current settings load
3. [ ] Uncheck "Auto-sync when marked as Meeting Booked"
4. [ ] Click Save
5. [ ] Mark lead as Meeting Booked
6. [ ] Verify NO sync happens
7. [ ] Re-check auto-sync
8. [ ] Save and verify sync works again

**Expected Result**: Settings persist and control behavior

---

## Test 11: Activity Log

**Goal**: Verify activity is logged in extension popup

1. [ ] Sync a lead
2. [ ] Click extension icon
3. [ ] Scroll to "Activity Log" section
4. [ ] Verify sync appears with:
   - [ ] Lead email
   - [ ] Timestamp
   - [ ] Success status
   - [ ] "Synced X email(s)"

**Expected Result**: All syncs logged with details

---

## Test 12: Statistics

**Goal**: Verify statistics are tracked

1. [ ] Click extension icon
2. [ ] Note "Total Syncs" count
3. [ ] Sync a lead
4. [ ] Reopen extension popup
5. [ ] Verify "Total Syncs" increased by 1
6. [ ] Verify "Last Sync" shows "Just now" or recent time

**Expected Result**: Statistics update correctly

---

## Edge Cases to Test

- [ ] Lead with no email thread (should still create contact)
- [ ] Lead with very long email thread (>10 messages)
- [ ] Lead with special characters in email
- [ ] Lead with no first/last name
- [ ] Lead with no company
- [ ] Multiple rapid status changes
- [ ] Changing status away from Meeting Booked then back

---

## Performance Checks

- [ ] Page load doesn't slow down noticeably
- [ ] Sync completes within 5 seconds
- [ ] No memory leaks (check in Chrome Task Manager)
- [ ] Console logs don't spam excessively

---

## Browser Console Checks

**Content Script (Instantly page)**
- [ ] No red errors
- [ ] Clear status messages
- [ ] Email/status extraction logged

**Background Worker** (`chrome://extensions/` → Inspect service worker)
- [ ] No red errors
- [ ] API calls logged
- [ ] Sync steps clearly marked

**Popup** (Right-click icon → Inspect popup)
- [ ] Settings load correctly
- [ ] No errors on settings save

---

## Final Verification

1. [ ] Synced at least 3 different leads successfully
2. [ ] All contacts appear correctly in HubSpot
3. [ ] All email threads appear as notes
4. [ ] No duplicates created
5. [ ] Extension statistics accurate
6. [ ] Activity log shows all syncs
7. [ ] No console errors in any context

---

## Success Criteria

✓ All basic tests pass
✓ Email and status detection work reliably
✓ HubSpot sync completes successfully
✓ Notes are well-formatted and readable
✓ Error handling is graceful
✓ Visual feedback is clear
✓ No duplicate contacts created
✓ Settings work as expected

## If Any Tests Fail

1. Check console logs in all three contexts (page, background, popup)
2. Verify API key and scopes
3. Check network tab for API errors
4. See `DEBUGGING.md` for specific troubleshooting
5. Try refreshing the Instantly page
6. Try reloading the extension
