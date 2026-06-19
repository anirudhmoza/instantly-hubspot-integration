// Background Service Worker - Handles HubSpot API calls

console.log('[Instantly → HubSpot] Background service worker loaded');

// HubSpot API configuration
const HUBSPOT_API_BASE = 'https://api.hubapi.com';

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Background] Received message:', request.action);

  if (request.action === 'syncToHubSpot') {
    handleSyncToHubSpot(request.data)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep the message channel open for async response
  }

  if (request.action === 'testConnection') {
    testHubSpotConnection(request.apiKey)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'fetchPipelines') {
    fetchHubSpotPipelines(request.apiKey)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  return false;
});

/**
 * Main function to sync lead data to HubSpot
 */
async function handleSyncToHubSpot(leadData) {
  console.log('[Background] ========== SYNC STARTED ==========');
  console.log('[Background] Lead data received:', {
    email: leadData.email,
    firstName: leadData.firstName,
    lastName: leadData.lastName,
    company: leadData.company,
    emailThreadLength: leadData.emailThread?.length || 0
  });

  try {
    // Validate lead data
    if (!leadData.email) {
      throw new Error('Lead email is required');
    }

    // Get API key from storage
    const settings = await chrome.storage.sync.get('hubspotKey');
    const apiKey = settings.hubspotKey;

    if (!apiKey) {
      throw new Error('HubSpot API key not configured. Please add your API key in the extension settings.');
    }

    console.log('[Background] API key found, proceeding with sync...');

    // Step 1: Create or update contact
    console.log('[Background] Step 1: Creating/updating contact...');
    const contact = await createOrUpdateContact(apiKey, leadData);
    console.log('[Background] ✓ Contact created/updated successfully:', contact.id);

    // Step 2: Create associated deal
    console.log('[Background] Step 2: Creating deal...');
    const deal = await createDealForContact(apiKey, contact.id, leadData);
    console.log('[Background] ✓ Deal created successfully:', deal.id);

    // Step 3: Create note with email thread
    if (leadData.emailThread && leadData.emailThread.length > 0) {
      console.log(`[Background] Step 3: Creating note with ${leadData.emailThread.length} email(s)...`);
      await createNoteWithEmails(apiKey, contact.id, leadData.emailThread);
      console.log('[Background] ✓ Note created successfully');
    } else {
      console.log('[Background] Step 3: Skipped - no email thread to sync');
    }

    // Update statistics
    await updateStatistics();

    // Log activity
    const logEntry = {
      email: leadData.email,
      timestamp: new Date().toISOString(),
      success: true,
      contactId: contact.id,
      dealId: deal.id,
      details: `Synced ${leadData.emailThread?.length || 0} email(s) and created deal`
    };

    await addToActivityLog(logEntry);

    // Notify popup if it's open
    chrome.runtime.sendMessage({
      action: 'syncComplete',
      data: logEntry
    }).catch(() => {
      // Popup might not be open, ignore error
    });

    console.log('[Background] ========== SYNC COMPLETED SUCCESSFULLY ==========');

    return {
      success: true,
      contactId: contact.id,
      message: 'Successfully synced to HubSpot'
    };
  } catch (error) {
    console.error('[Background] ========== SYNC FAILED ==========');
    console.error('[Background] Error details:', {
      message: error.message,
      stack: error.stack,
      leadEmail: leadData.email
    });

    // Log failed activity
    const logEntry = {
      email: leadData.email,
      timestamp: new Date().toISOString(),
      success: false,
      error: error.message
    };

    await addToActivityLog(logEntry);

    // Notify popup of failure
    chrome.runtime.sendMessage({
      action: 'syncComplete',
      data: logEntry
    }).catch(() => {});

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Create or update a contact in HubSpot
 */
async function createOrUpdateContact(apiKey, leadData) {
  const url = `${HUBSPOT_API_BASE}/crm/v3/objects/contacts`;

  // Build contact properties
  const properties = {
    email: leadData.email
  };

  if (leadData.firstName) {
    properties.firstname = leadData.firstName;
  }

  if (leadData.lastName) {
    properties.lastname = leadData.lastName;
  }

  if (leadData.company) {
    properties.company = leadData.company;
  }

  // Add lead status - use CONNECTED since meeting is booked
  // Valid options: NEW, OPEN, IN_PROGRESS, OPEN_DEAL, UNQUALIFIED, ATTEMPTED_TO_CONTACT, CONNECTED, BAD_TIMING
  properties.hs_lead_status = 'CONNECTED';

  try {
    // FIRST: Check if contact already exists
    console.log('[Background] Checking if contact exists...');
    const existingContact = await findContactByEmail(apiKey, leadData.email);

    if (existingContact) {
      console.log('[Background] Contact already exists with ID:', existingContact.id);
      console.log('[Background] Updating existing contact...');

      // Update the existing contact
      const updateUrl = `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${existingContact.id}`;
      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ properties })
      });

      if (updateResponse.ok) {
        console.log('[Background] Contact updated successfully');
        return await updateResponse.json();
      }

      const errorData = await updateResponse.json().catch(() => null);
      throw new Error(errorData?.message || `Failed to update contact: ${updateResponse.statusText}`);
    }

    // Contact doesn't exist, create new one
    console.log('[Background] Contact does not exist, creating new contact...');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ properties })
    });

    if (response.ok) {
      const contact = await response.json();
      console.log('[Background] New contact created with ID:', contact.id);
      return contact;
    }

    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || `Failed to create contact: ${response.statusText}`);
  } catch (error) {
    console.error('[Background] Error creating/updating contact:', error);
    throw error;
  }
}

/**
 * Find a contact by email address
 */
async function findContactByEmail(apiKey, email) {
  const url = `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'EQ',
            value: email
          }]
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to search contact: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      return data.results[0];
    }

    return null;
  } catch (error) {
    console.error('[Background] Error finding contact:', error);
    throw error;
  }
}

/**
 * Create a deal for the contact
 */
async function createDealForContact(apiKey, contactId, leadData) {
  const url = `${HUBSPOT_API_BASE}/crm/v3/objects/deals`;

  try {
    // Get deal settings from storage
    const settings = await chrome.storage.sync.get({
      dealPipeline: '',
      dealStage: ''
    });

    console.log('[Background] Deal settings:', settings);

    // Validate settings
    if (!settings.dealPipeline || !settings.dealStage) {
      throw new Error('Deal pipeline and stage not configured. Please configure them in extension settings.');
    }

    // Create deal name from contact info
    let dealName = leadData.email;
    if (leadData.firstName && leadData.lastName) {
      dealName = `${leadData.firstName} ${leadData.lastName}`;
    } else if (leadData.firstName) {
      dealName = leadData.firstName;
    } else if (leadData.company) {
      dealName = leadData.company;
    }

    dealName += ' - Instantly Lead';

    // Build deal properties using configured pipeline and stage IDs
    const properties = {
      dealname: dealName,
      dealstage: settings.dealStage,
      pipeline: settings.dealPipeline,
      amount: '0'
    };

    console.log('[Background] Creating deal with pipeline:', settings.dealPipeline, 'and stage:', settings.dealStage);

    // Add company if available
    if (leadData.company) {
      properties.company = leadData.company;
    }

    // Create the deal
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: properties,
        associations: [
          {
            to: {
              id: contactId
            },
            types: [
              {
                associationCategory: 'HUBSPOT_DEFINED',
                associationTypeId: 3 // Deal to Contact association
              }
            ]
          }
        ]
      })
    });

    if (response.ok) {
      const deal = await response.json();
      console.log('[Background] Deal created with ID:', deal.id);
      return deal;
    }

    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || `Failed to create deal: ${response.statusText}`);
  } catch (error) {
    console.error('[Background] Error creating deal:', error);
    throw error;
  }
}

/**
 * Format emails using OpenAI API
 */
async function formatEmailsWithAI(emailThread, leadEmail, openaiKey, model) {
  console.log('[Background] Formatting emails with OpenAI...');
  console.log('[Background] Model:', model);
  console.log('[Background] Email count:', emailThread?.length || 0);

  try {
    const prompt = `You are an email formatting assistant. Format the following email thread data into a clean, professional structure.

Email thread data (JSON):
${JSON.stringify(emailThread, null, 2)}

Lead email address: ${leadEmail}

Your task:
1. Analyze each email and determine if it's OUTGOING (from our team) or INCOMING (from the lead)
   - If the "from" field contains "${leadEmail}", it's INCOMING
   - Otherwise, it's OUTGOING

2. Remove any duplicate emails (check body content similarity)

3. Clean up each email body:
   - Remove quoted/indented previous emails (lines starting with > or heavy indentation)
   - Remove email headers from body text (From:, To:, Subject:, Date: etc.)
   - Format bullet points consistently with the • character
   - Preserve paragraph structure with proper spacing
   - Remove any artifacts like "IFRAME_SEPARATOR"

4. Return a JSON array with this EXACT structure:
[
  {
    "direction": "outgoing" or "incoming",
    "from": "sender email",
    "to": "recipient email",
    "subject": "email subject" or null,
    "timestamp": "ISO timestamp" or null,
    "body": "clean formatted body text"
  }
]

IMPORTANT:
- Return ONLY valid JSON, no markdown code blocks, no explanation
- Preserve chronological order (oldest first)
- Keep body text natural and readable
- Remove ALL duplicate content`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an email formatting assistant. You analyze email threads and return clean, structured JSON data. Always return valid JSON only, no markdown formatting.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error?.message || `OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content.trim();

    console.log('[Background] OpenAI response received');

    // Parse the JSON response
    // Remove markdown code blocks if present
    let jsonContent = content;
    if (content.startsWith('```json')) {
      jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    } else if (content.startsWith('```')) {
      jsonContent = content.replace(/```\n?/g, '').trim();
    }

    const formattedEmails = JSON.parse(jsonContent);

    console.log('[Background] ✓ AI formatting successful:', formattedEmails.length, 'emails');

    // Convert to our email format with isOutgoing flag
    return formattedEmails.map(email => ({
      from: email.from,
      to: email.to,
      subject: email.subject,
      timestamp: email.timestamp,
      body: email.body,
      isOutgoing: email.direction === 'outgoing'
    }));

  } catch (error) {
    console.error('[Background] Error formatting with AI:', error);
    throw new Error(`AI formatting failed: ${error.message}`);
  }
}

/**
 * Convert plain text note to HTML format for HubSpot
 * HubSpot requires HTML formatting to preserve line breaks and formatting
 */
function convertToHubSpotHtml(plainText) {
  // Escape HTML special characters
  let html = plainText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Convert newlines to <br> tags
  html = html.replace(/\n/g, '<br>');

  // Wrap in a div with normal font for better readability
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; white-space: pre-wrap; line-height: 1.6; font-size: 14px;">${html}</div>`;
}

/**
 * Create a note with the email thread
 */
async function createNoteWithEmails(apiKey, contactId, emailThread) {
  const notesUrl = `${HUBSPOT_API_BASE}/crm/v3/objects/notes`;

  try {
    // Check if AI formatting is enabled
    const settings = await chrome.storage.sync.get(['useAiFormatting', 'openaiKey', 'openaiModel']);

    let processedEmails = emailThread;

    // Use AI formatting if enabled and configured
    if (settings.useAiFormatting && settings.openaiKey) {
      console.log('[Background] AI formatting is enabled, using OpenAI...');
      try {
        // Extract lead email from first email in thread
        const leadEmail = emailThread[0]?.from || emailThread[0]?.to || '';
        processedEmails = await formatEmailsWithAI(
          emailThread,
          leadEmail,
          settings.openaiKey,
          settings.openaiModel || 'gpt-4o-mini'
        );
        console.log('[Background] ✓ Using AI-formatted emails');
      } catch (aiError) {
        console.error('[Background] AI formatting failed, falling back to standard formatting:', aiError);
        // Fall back to regular formatting if AI fails
      }
    } else {
      console.log('[Background] Using standard JavaScript formatting');
    }

    // Build note body with all emails in a clean, beautiful format
    const totalEmails = processedEmails?.length || 0;

    let noteBody = '📧 Email Conversation from Instantly.ai\n';
    noteBody += `💬 ${totalEmails} ${totalEmails === 1 ? 'message' : 'messages'} in thread\n`;
    noteBody += '━'.repeat(70) + '\n\n';

    if (!processedEmails || processedEmails.length === 0) {
      noteBody += '⚠️ No email content available.\n';
    } else {
      // Keep original order from extraction (newest first)
      // Don't reverse - Instantly extracts newest emails first, which matches user expectation
      const sortedEmails = processedEmails;

      sortedEmails.forEach((email, index) => {
        const emailNum = index + 1;

        // Determine direction with visual indicator
        const direction = email.isOutgoing ? '📤 Outgoing' : '📥 Incoming';

        // Header with direction and email number
        noteBody += `${direction} • Email ${emailNum} of ${totalEmails}`;

        // Add subject if available and meaningful
        if (email.subject &&
            email.subject !== `Message ${index + 1}` &&
            email.subject !== `Email ${index + 1}` &&
            email.subject !== 'Email Conversation' &&
            email.subject !== 'Email from Instantly') {
          noteBody += ` • ${email.subject}`;
        }

        noteBody += '\n';
        noteBody += '─'.repeat(70) + '\n\n';

        // Metadata section
        if (email.from) {
          noteBody += `👤 From: ${email.from}\n`;
        }
        if (email.to && email.to.trim()) {
          noteBody += `📬 To: ${email.to}\n`;
        }
        if (email.timestamp) {
          try {
            const date = new Date(email.timestamp);
            if (!isNaN(date.getTime())) {
              noteBody += `📅 Date: ${date.toLocaleString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}\n`;
            }
          } catch (e) {
            // Skip invalid dates
          }
        }

        noteBody += '\n';

        // Body content - preserve natural formatting with better structure
        const body = email.body || '';
        if (body.trim()) {
          // Format body with proper paragraph breaks and bullet points
          const cleanBody = body
            .replace(/IFRAME_SEPARATOR/g, '') // Remove any separator artifacts
            .replace(/\n{4,}/g, '\n\n\n') // Max 2 blank lines between paragraphs
            .replace(/[ \t]+$/gm, '') // Remove trailing spaces
            .replace(/^[\-\*\•]\s+/gm, '  • ') // Format bullet points consistently
            .trim();

          noteBody += cleanBody;
        } else {
          noteBody += '(No content)';
        }

        // Add extra spacing between emails for better readability
        if (emailNum < totalEmails) {
          noteBody += '\n\n\n';
          noteBody += '━'.repeat(70) + '\n\n';
        }
      });
    }

    // Footer
    noteBody += '\n\n';
    noteBody += '─'.repeat(70) + '\n';
    noteBody += `✨ Synced automatically when lead was marked as "Meeting Booked"\n`;
    noteBody += `⏰ Sync time: ${new Date().toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}\n`;

    // Convert plain text to HTML for proper HubSpot rendering
    const htmlNoteBody = convertToHubSpotHtml(noteBody);

    // Create note
    const response = await fetch(notesUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          hs_note_body: htmlNoteBody,
          hs_timestamp: new Date().toISOString()
        },
        associations: [
          {
            to: {
              id: contactId
            },
            types: [
              {
                associationCategory: 'HUBSPOT_DEFINED',
                associationTypeId: 202 // Note to Contact association
              }
            ]
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('[Background] Failed to create note:', errorData);
      throw new Error(errorData?.message || `Failed to create note: ${response.statusText}`);
    }

    console.log('[Background] Note with email thread created successfully');
  } catch (error) {
    console.error('[Background] Error creating note:', error);
    throw error;
  }
}

/**
 * Create email activities in HubSpot (DEPRECATED - using notes instead)
 */
async function createEmailActivities(apiKey, contactId, emailThread) {
  const engagementsUrl = `${HUBSPOT_API_BASE}/crm/v3/objects/emails`;

  for (const email of emailThread) {
    try {
      // Build email properties
      const properties = {
        hs_timestamp: email.timestamp || new Date().toISOString(),
        hs_email_subject: email.subject || 'Email from Instantly',
        hs_email_text: email.body || '',
        hs_email_direction: determineEmailDirection(email),
        hs_email_status: 'SENT'
      };

      if (email.from) {
        properties.hs_email_from_email = email.from;
      }

      if (email.to) {
        properties.hs_email_to_email = email.to;
      }

      // Create email engagement
      const response = await fetch(engagementsUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: properties,
          associations: [
            {
              to: {
                id: contactId
              },
              types: [
                {
                  associationCategory: 'HUBSPOT_DEFINED',
                  associationTypeId: 198 // Email to Contact association
                }
              ]
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('[Background] Failed to create email activity:', errorData);
        // Continue with other emails even if one fails
        continue;
      }

      console.log('[Background] Email activity created');
    } catch (error) {
      console.error('[Background] Error creating email activity:', error);
      // Continue with other emails
    }
  }
}

/**
 * Determine email direction (incoming/outgoing)
 */
function determineEmailDirection(email) {
  // Simple heuristic: if it starts with "Re:" or "From:" it's likely incoming
  const subject = (email.subject || '').toLowerCase();
  const body = (email.body || '').toLowerCase();

  if (subject.startsWith('re:') || body.includes('wrote:')) {
    return 'INCOMING_EMAIL';
  }

  return 'EMAIL'; // Default to outgoing
}

/**
 * Test HubSpot API connection
 */
async function testHubSpotConnection(apiKey) {
  try {
    const url = `${HUBSPOT_API_BASE}/crm/v3/objects/contacts?limit=1`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      return {
        success: true,
        message: 'Connection successful'
      };
    }

    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.message || `Connection failed: ${response.statusText}`);
  } catch (error) {
    console.error('[Background] Connection test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Fetch all deal pipelines and their stages from HubSpot
 */
async function fetchHubSpotPipelines(apiKey) {
  try {
    console.log('[Background] Fetching HubSpot pipelines...');
    const url = `${HUBSPOT_API_BASE}/crm/v3/pipelines/deals`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `Failed to fetch pipelines: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[Background] ✓ Fetched', data.results?.length || 0, 'pipelines');

    // Transform the data into a more usable format
    const pipelines = data.results.map(pipeline => ({
      id: pipeline.id,
      label: pipeline.label,
      displayOrder: pipeline.displayOrder,
      stages: pipeline.stages.map(stage => ({
        id: stage.id,
        label: stage.label,
        displayOrder: stage.displayOrder,
        metadata: stage.metadata
      })).sort((a, b) => a.displayOrder - b.displayOrder)
    })).sort((a, b) => a.displayOrder - b.displayOrder);

    return {
      success: true,
      pipelines: pipelines
    };
  } catch (error) {
    console.error('[Background] Error fetching pipelines:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update sync statistics
 */
async function updateStatistics() {
  try {
    const stats = await chrome.storage.local.get({
      syncCount: 0,
      lastSyncTime: null,
      syncHistory: []
    });

    stats.syncCount += 1;
    stats.lastSyncTime = new Date().toISOString();

    // Keep last 10 syncs in history
    stats.syncHistory.unshift({
      timestamp: stats.lastSyncTime,
      status: 'success'
    });
    stats.syncHistory = stats.syncHistory.slice(0, 10);

    await chrome.storage.local.set(stats);
  } catch (error) {
    console.error('[Background] Error updating statistics:', error);
  }
}

/**
 * Add entry to activity log
 */
async function addToActivityLog(entry) {
  try {
    const data = await chrome.storage.local.get({ activityLog: [] });
    const log = data.activityLog || [];

    log.unshift(entry);

    // Keep only last 50 entries
    if (log.length > 50) {
      log.splice(50);
    }

    await chrome.storage.local.set({ activityLog: log });
  } catch (error) {
    console.error('[Background] Error adding to activity log:', error);
  }
}

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Background] Extension installed');

    // Initialize storage with default settings
    chrome.storage.sync.set({
      autoSync: true,
      notificationsEnabled: true
    });

    chrome.storage.local.set({
      syncCount: 0,
      lastSyncTime: null,
      syncHistory: [],
      activityLog: []
    });
  }
});
