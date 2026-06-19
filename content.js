// Content Script - Monitors Instantly.ai page for lead status changes

(function() {
  'use strict';

  let currentLeadEmail = null;
  let isProcessing = false;
  let syncButtonInjected = false; // Track if sync button is already injected

  console.log('[Instantly → HubSpot] Content script loaded');

  // Initialize observer when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    console.log('[Instantly → HubSpot] Initializing...');

    // Start monitoring for status changes
    startMonitoring();

    // Also check immediately in case we're already on a lead page
    checkCurrentPage();
  }

  function startMonitoring() {
    // Use MutationObserver to watch for changes in the DOM
    const observer = new MutationObserver((mutations) => {
      // Debounce - only check after mutations settle
      clearTimeout(window.instantlyCheckTimeout);
      window.instantlyCheckTimeout = setTimeout(() => {
        checkCurrentPage();
      }, 500);
    });

    // Observe the entire document for changes
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-label', 'data-status']
    });

    console.log('[Instantly → HubSpot] Monitoring started');
  }

  async function checkCurrentPage() {
    try {
      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        console.log('[Instantly → HubSpot] Extension context invalidated, stopping monitoring');
        return;
      }

      // Extract email from the page
      const email = extractLeadEmail();

      if (!email) {
        // Not on a lead page or email not found
        console.log('[Instantly → HubSpot] No email found, removing any existing button');

        // Clean up if no email found
        const existingButton = document.getElementById('hubspot-sync-btn');
        if (existingButton) {
          existingButton.remove();
        }

        currentLeadEmail = null;
        syncButtonInjected = false;
        return;
      }

      // Check if we're on a new lead
      if (email !== currentLeadEmail) {
        console.log('[Instantly → HubSpot] 🔄 Lead changed from', currentLeadEmail, 'to', email);

        // CRITICAL: Remove old button before injecting new one
        const existingButton = document.getElementById('hubspot-sync-btn');
        if (existingButton) {
          console.log('[Instantly → HubSpot] Removing old button for previous lead');
          existingButton.remove();
        }

        currentLeadEmail = email;
        syncButtonInjected = false; // Reset button injection for new lead
        console.log('[Instantly → HubSpot] ✓ New lead detected:', email);
      }

      // ALWAYS try to inject if button doesn't exist in DOM (even if flag says it's injected)
      const buttonExists = document.getElementById('hubspot-sync-btn');
      if (!buttonExists) {
        console.log('[Instantly → HubSpot] Button missing from DOM, re-injecting...');
        syncButtonInjected = false;
      }

      // Inject sync button if not already present
      if (!syncButtonInjected) {
        injectSyncButton();
      }

    } catch (error) {
      // Check if it's an extension context invalidation error
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.log('[Instantly → HubSpot] Extension was reloaded, please refresh the page');
        return;
      }
      console.error('[Instantly → HubSpot] Error checking page:', error);
    }
  }

  /**
   * Inject a "Sync to HubSpot" button next to the lead status
   */
  function injectSyncButton() {
    console.log('[Instantly → HubSpot] Attempting to inject sync button...');

    // Remove any existing sync button first
    const existingButton = document.getElementById('hubspot-sync-btn');
    if (existingButton) {
      existingButton.remove();
    }

    // Find the status button area - look for buttons with EXACT status keywords
    // These are the exact status values from Instantly's dropdown
    const exactStatusValues = [
      'lead',
      'interested',
      'meeting booked',
      'meeting completed',
      'won',
      'out of office',
      'wrong person',
      'not interested',
      'lost',
      'called',
      'dnp',
      'invalid number',
      'contacted'
    ];

    const allButtons = document.querySelectorAll('button, div[role="button"], [class*="dropdown"], [class*="select"]');
    let statusButton = null;

    // Multi-breakpoint adaptive threshold for all screen sizes
    const screenWidth = window.innerWidth;
    let leftThreshold;

    if (screenWidth < 768) {
      // Mobile/small tablets
      leftThreshold = 0; // Check entire screen
    } else if (screenWidth < 1024) {
      // Tablets
      leftThreshold = screenWidth * 0.15;
    } else if (screenWidth < 1366) {
      // Small laptops
      leftThreshold = screenWidth * 0.2;
    } else if (screenWidth < 1920) {
      // Standard laptops/desktops
      leftThreshold = screenWidth * 0.25;
    } else {
      // Large desktops/ultrawides
      leftThreshold = screenWidth * 0.3;
    }

    console.log(`[Instantly → HubSpot] Screen width: ${screenWidth}px, threshold: ${Math.round(leftThreshold)}px`);

    // Find the status button - look for EXACT match with status values
    // IMPORTANT: Must be on the lead detail page (right side), NOT in the inbox list (left/middle)
    for (const button of allButtons) {
      const text = button.textContent.trim().toLowerCase();
      const rect = button.getBoundingClientRect();

      // Must be visible and positioned on the right side of screen
      if (rect.width > 0 && rect.height > 0 && rect.left > leftThreshold) {
        // Check for EXACT match with any status value (not just contains)
        const isExactMatch = exactStatusValues.some(status => {
          const statusLower = status.toLowerCase();
          // Match if the button text is EXACTLY the status, or button text IS the status (no extra text)
          return text === statusLower || text.startsWith(statusLower + '\n') || text.endsWith('\n' + statusLower);
        });

        if (isExactMatch) {
          // Additional validation: must be an interactive element
          const isInteractive =
            button.tagName === 'BUTTON' ||
            button.getAttribute('role') === 'button' ||
            button.onclick !== null ||
            button.classList.toString().match(/button|dropdown|select/i);

          if (isInteractive) {
            // CRITICAL: Verify this is on the LEAD DETAIL PAGE, not in the inbox list
            // Check if the button is near the current lead's email address
            let isOnDetailPage = false;

            if (currentLeadEmail) {
              // Look for the email address near this button (within 300px vertically)
              const allTextElements = document.querySelectorAll('*');
              for (const elem of allTextElements) {
                const elemText = elem.textContent || '';
                if (elemText.includes(currentLeadEmail)) {
                  const elemRect = elem.getBoundingClientRect();
                  const verticalDistance = Math.abs(elemRect.top - rect.top);
                  const horizontalDistance = Math.abs(elemRect.left - rect.left);

                  // Email should be near the status button (same header area)
                  if (verticalDistance < 300 && horizontalDistance < 500) {
                    isOnDetailPage = true;
                    console.log('[Instantly → HubSpot] Verified: Status button is on lead detail page (near email)');
                    break;
                  }
                }
              }
            }

            // Also accept if button is in the top portion of the screen (detail page header)
            // and far enough to the right (not in inbox list)
            if (!isOnDetailPage && rect.top < 400 && rect.left > screenWidth * 0.5) {
              isOnDetailPage = true;
              console.log('[Instantly → HubSpot] Verified: Status button is in detail page header area');
            }

            if (isOnDetailPage) {
              statusButton = button;
              console.log('[Instantly → HubSpot] Found status button:', button.textContent.trim());
              console.log('[Instantly → HubSpot] Status button position: x=%s, y=%s, width=%s',
                Math.round(rect.left), Math.round(rect.top), Math.round(rect.width));
              console.log('[Instantly → HubSpot] Element type:', button.tagName, button.className);
              break;
            } else {
              console.log('[Instantly → HubSpot] Skipping button (not on detail page):', text.substring(0, 30));
            }
          }
        }
      }
    }

    // Debug: Log all buttons found if no status button
    if (!statusButton) {
      console.log('[Instantly → HubSpot] No status button found. All visible interactive elements:');
      for (const button of allButtons) {
        const rect = button.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && rect.left > leftThreshold) {
          console.log('  - "%s" at x=%s (threshold=%s)',
            button.textContent.trim().substring(0, 40),
            Math.round(rect.left),
            Math.round(leftThreshold));
        }
      }
    }

    // Fallback: If no status button found, inject next to email address
    let targetElement = statusButton;

    if (!statusButton) {
      console.log('[Instantly → HubSpot] ⚠️ Could not find status button, looking for email instead...');

      // Find the email element on the page
      const allElements = document.querySelectorAll('div, span, p, h1, h2, h3');

      for (const element of allElements) {
        const text = element.textContent?.trim() || '';

        // Check if this element contains ONLY the email (not mixed with other text)
        if (text === currentLeadEmail || (text.includes(currentLeadEmail) && text.length < currentLeadEmail.length + 20)) {
          const rect = element.getBoundingClientRect();

          // Must be visible - use adaptive threshold
          if (rect.left > leftThreshold && rect.width > 0 && rect.height > 0) {
            targetElement = element;
            console.log('[Instantly → HubSpot] Found email element, will inject button next to it');
            break;
          }
        }
      }
    }

    if (!targetElement) {
      console.log('[Instantly → HubSpot] ⚠️ Could not find target element for button injection, will retry...');
      return;
    }

    // Create the sync button
    const syncButton = document.createElement('button');
    syncButton.id = 'hubspot-sync-btn';
    syncButton.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 3px;">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
        <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
        <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
        <line x1="12" y1="22.08" x2="12" y2="12"></line>
      </svg>
      <span>Sync to HubSpot</span>
    `;

    // Multi-breakpoint responsive sizing for all screen sizes - EXTRA COMPACT
    let buttonPadding, buttonFontSize, buttonMargin, iconSize;

    if (screenWidth < 768) {
      // Mobile/small tablets - extra compact
      buttonPadding = '3px 6px';
      buttonFontSize = '10px';
      buttonMargin = '3px';
      iconSize = '10px';
    } else if (screenWidth < 1024) {
      // Tablets - extra compact
      buttonPadding = '3px 7px';
      buttonFontSize = '10px';
      buttonMargin = '4px';
      iconSize = '10px';
    } else if (screenWidth < 1366) {
      // Small laptops - very compact
      buttonPadding = '4px 8px';
      buttonFontSize = '11px';
      buttonMargin = '5px';
      iconSize = '11px';
    } else if (screenWidth < 1920) {
      // Standard laptops/desktops - compact
      buttonPadding = '4px 9px';
      buttonFontSize = '11px';
      buttonMargin = '6px';
      iconSize = '11px';
    } else {
      // Large desktops/ultrawides - slightly larger but still compact
      buttonPadding = '5px 10px';
      buttonFontSize = '12px';
      buttonMargin = '8px';
      iconSize = '12px';
    }

    // Update the icon size in the SVG
    const svgIcon = syncButton.querySelector('svg');
    if (svgIcon) {
      svgIcon.setAttribute('width', iconSize);
      svgIcon.setAttribute('height', iconSize);
    }

    // Style the button to match Instantly's UI - fully responsive and extra compact
    syncButton.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: ${buttonPadding};
      margin-left: ${buttonMargin};
      background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
      color: white;
      border: none;
      border-radius: 4px;
      font-size: ${buttonFontSize};
      font-weight: 500;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(255, 107, 53, 0.2);
      white-space: nowrap;
      height: fit-content;
      flex-shrink: 0;
      max-width: fit-content;
      line-height: 1.2;
      vertical-align: middle;
    `;

    // Add hover effect - subtle for compact design
    syncButton.onmouseenter = () => {
      if (!syncButton.disabled) {
        syncButton.style.transform = 'translateY(-1px)';
        syncButton.style.boxShadow = '0 2px 6px rgba(255, 107, 53, 0.3)';
      }
    };
    syncButton.onmouseleave = () => {
      if (!syncButton.disabled) {
        syncButton.style.transform = 'translateY(0)';
        syncButton.style.boxShadow = '0 1px 3px rgba(255, 107, 53, 0.2)';
      }
    };

    // Store sizing for use in click handler
    syncButton.dataset.iconSize = iconSize;
    syncButton.dataset.buttonPadding = buttonPadding;
    syncButton.dataset.buttonFontSize = buttonFontSize;

    // Add click handler
    syncButton.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (isProcessing) {
        return;
      }

      console.log('[Instantly → HubSpot] Sync button clicked!');

      // Get responsive sizes from dataset
      const btnIconSize = syncButton.dataset.iconSize;

      // Disable button during sync
      syncButton.disabled = true;
      syncButton.style.cursor = 'not-allowed';
      syncButton.innerHTML = `
        <svg width="${btnIconSize}" height="${btnIconSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; animation: spin 1s linear infinite;">
          <circle cx="12" cy="12" r="10"></circle>
        </svg>
        <span>Syncing...</span>
      `;

      // Add spin animation
      if (!document.getElementById('hubspot-sync-spin')) {
        const style = document.createElement('style');
        style.id = 'hubspot-sync-spin';
        style.textContent = `
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
      }

      // Trigger sync and capture result
      const result = await handleSyncToHubSpot();

      // Show result in button
      if (result && result.success) {
        // Success state - green with checkmark
        syncButton.style.background = '#10b981';
        syncButton.style.boxShadow = '0 1px 3px rgba(16, 185, 129, 0.3)';
        syncButton.innerHTML = `
          <svg width="${btnIconSize}" height="${btnIconSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 3px;">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>Synced ✓</span>
        `;

        // Reset button after 3 seconds
        setTimeout(() => {
          syncButton.disabled = false;
          syncButton.style.cursor = 'pointer';
          syncButton.style.background = 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)';
          syncButton.style.boxShadow = '0 1px 3px rgba(255, 107, 53, 0.2)';
          syncButton.innerHTML = `
            <svg width="${btnIconSize}" height="${btnIconSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 3px;">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
              <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
              <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <span>Sync to HubSpot</span>
          `;
        }, 3000);
      } else {
        // Error state - red with X
        syncButton.style.background = '#ef4444';
        syncButton.style.boxShadow = '0 1px 3px rgba(239, 68, 68, 0.3)';
        syncButton.innerHTML = `
          <svg width="${btnIconSize}" height="${btnIconSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 3px;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          <span>Failed</span>
        `;

        // Reset button after 3 seconds
        setTimeout(() => {
          syncButton.disabled = false;
          syncButton.style.cursor = 'pointer';
          syncButton.style.background = 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)';
          syncButton.style.boxShadow = '0 1px 3px rgba(255, 107, 53, 0.2)';
          syncButton.innerHTML = `
            <svg width="${btnIconSize}" height="${btnIconSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 3px;">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="7.5 4.21 12 6.81 16.5 4.21"></polyline>
              <polyline points="7.5 19.79 7.5 14.6 3 12"></polyline>
              <polyline points="21 12 16.5 14.6 16.5 19.79"></polyline>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <span>Sync to HubSpot</span>
          `;
        }, 3000);
      }
    };

    // Insert button next to the target element (status button or email)
    try {
      // Use insertAdjacentElement for more precise placement
      // This inserts the button as a direct sibling, right after the target element
      targetElement.insertAdjacentElement('afterend', syncButton);

      syncButtonInjected = true;
      console.log('[Instantly → HubSpot] ✓ Sync button injected successfully!');
      console.log('[Instantly → HubSpot] Button position:', syncButton.getBoundingClientRect());
      console.log('[Instantly → HubSpot] Target position:', targetElement.getBoundingClientRect());
    } catch (error) {
      console.log('[Instantly → HubSpot] ⚠️ Failed to inject button:', error.message);

      // Fallback: Try the old method
      const targetParent = targetElement.parentElement;
      if (targetParent) {
        if (targetElement.nextSibling) {
          targetParent.insertBefore(syncButton, targetElement.nextSibling);
        } else {
          targetParent.appendChild(syncButton);
        }
        syncButtonInjected = true;
        console.log('[Instantly → HubSpot] ✓ Sync button injected using fallback method');
      } else {
        console.log('[Instantly → HubSpot] ⚠️ Could not find parent to inject button');
      }
    }
  }

  // Expose a manual sync function for testing
  window.manualSyncToHubSpot = async function() {
    console.log('[Instantly → HubSpot] MANUAL SYNC TRIGGERED');
    if (!currentLeadEmail) {
      console.error('[Instantly → HubSpot] No lead email found. Make sure you\'re on a lead page.');
      return;
    }
    await handleSyncToHubSpot();
  };

  function extractLeadEmail() {
    console.log('[Instantly → HubSpot] Attempting to extract email...');

    // Calculate adaptive threshold (same as button injection logic)
    const screenWidth = window.innerWidth;
    let rightSideThreshold;

    if (screenWidth < 768) {
      rightSideThreshold = screenWidth * 0.3;
    } else if (screenWidth < 1024) {
      rightSideThreshold = screenWidth * 0.35;
    } else if (screenWidth < 1366) {
      rightSideThreshold = screenWidth * 0.4;
    } else if (screenWidth < 1920) {
      rightSideThreshold = screenWidth * 0.45; // For 1366x768: 1366 * 0.45 = 614px
    } else {
      rightSideThreshold = screenWidth * 0.5;
    }

    console.log('[Instantly → HubSpot] Email extraction threshold: x >', Math.round(rightSideThreshold), 'px');

    // METHOD 1: Look for email at the TOP of the detail pane (most reliable for current lead)
    // This is where the lead's email appears in the header
    const topAreaElements = document.querySelectorAll('*');
    const topEmails = [];

    for (const element of topAreaElements) {
      const text = element.textContent?.trim() || '';
      const rect = element.getBoundingClientRect();

      // Must be: 1) Valid email, 2) In top 350px, 3) On right side, 4) Visible
      if (isValidEmail(text) && text.length < 100 && text.length > 5 &&
          rect.top < 350 && rect.left > rightSideThreshold && rect.width > 0) {

        topEmails.push({
          email: text,
          x: rect.left,
          y: rect.top,
          element: element
        });

        console.log('[Instantly → HubSpot] Found email in top area:', text, `at (${Math.round(rect.left)}, ${Math.round(rect.top)})`);
      }
    }

    // Prioritize emails in the top area (header of detail pane)
    if (topEmails.length > 0) {
      // Sort by: 1) Highest (smallest Y), 2) Rightmost (largest X)
      topEmails.sort((a, b) => {
        if (Math.abs(a.y - b.y) < 50) {
          return b.x - a.x; // Similar height, prefer rightmost
        }
        return a.y - b.y; // Different heights, prefer topmost
      });

      console.log('[Instantly → HubSpot] ✓ Selected top email (current lead):', topEmails[0].email);
      return topEmails[0].email;
    }

    // METHOD 2: Look for visible emails on the right side (detail pane)
    const allElements = document.querySelectorAll('div, span, p, a');
    const candidates = [];

    for (const element of allElements) {
      const text = element.textContent?.trim() || '';
      const rect = element.getBoundingClientRect();

      // Look for standalone email (not part of larger text)
      if (isValidEmail(text) && text.length < 100 && text.length > 5 &&
          rect.left > rightSideThreshold && rect.width > 0 && rect.height > 0) {

        candidates.push({
          email: text,
          x: rect.left,
          y: rect.top,
          element: element
        });
        console.log('[Instantly → HubSpot] Found email candidate:', text, `at (${Math.round(rect.left)}, ${Math.round(rect.top)})`);
      }
    }

    // Return the email that's topmost and rightmost (detail pane header)
    if (candidates.length > 0) {
      candidates.sort((a, b) => {
        // Prefer emails in top 500px
        const aIsTop = a.y < 500 ? 0 : 1000;
        const bIsTop = b.y < 500 ? 0 : 1000;

        // Then sort by rightmost
        return (aIsTop + (-a.x)) - (bIsTop + (-b.x));
      });

      console.log('[Instantly → HubSpot] ✓ Selected email from candidates:', candidates[0].email);
      return candidates[0].email;
    }

    console.log('[Instantly → HubSpot] ⚠️ No email found on page');
    return null;
  }

  function isValidEmail(email) {
    const emailRegex = /^[\w.-]+@[\w.-]+\.\w+$/;
    return emailRegex.test(email);
  }

  async function handleSyncToHubSpot() {
    if (isProcessing) {
      console.log('[Instantly → HubSpot] Already processing, skipping...');
      return { success: false, error: 'Sync already in progress' };
    }

    // Check if extension context is still valid
    if (!chrome.runtime?.id) {
      console.log('[Instantly → HubSpot] Extension context invalidated, cannot sync');
      return { success: false, error: 'Extension needs refresh' };
    }

    // Check if we have a lead email
    if (!currentLeadEmail) {
      console.error('[Instantly → HubSpot] No lead email found');
      return { success: false, error: 'No lead email found' };
    }

    isProcessing = true;

    try {
      console.log('[Instantly → HubSpot] ========== EXTRACTION STARTED ==========');

      // Extract all lead information
      const leadData = {
        email: currentLeadEmail,
        firstName: extractFirstName(),
        lastName: extractLastName(),
        company: extractCompany(),
        emailThread: await extractEmailThread()
      };

      console.log('[Instantly → HubSpot] Lead data extracted:', {
        email: leadData.email,
        firstName: leadData.firstName,
        lastName: leadData.lastName,
        company: leadData.company,
        emailThreadCount: leadData.emailThread?.length || 0
      });

      // Send to background script for HubSpot sync
      console.log('[Instantly → HubSpot] Sending to background worker...');
      const response = await chrome.runtime.sendMessage({
        action: 'syncToHubSpot',
        data: leadData
      });

      if (response && response.success) {
        console.log('[Instantly → HubSpot] ========== SYNC SUCCESSFUL ==========');
        return { success: true };
      } else {
        console.error('[Instantly → HubSpot] ========== SYNC FAILED ==========');
        console.error('[Instantly → HubSpot] Error:', response?.error || 'Unknown error');
        return { success: false, error: response?.error || 'Unknown error' };
      }
    } catch (error) {
      console.error('[Instantly → HubSpot] ========== ERROR ==========');
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.log('[Instantly → HubSpot] Extension was reloaded, please refresh the page');
        return { success: false, error: 'Extension was reloaded' };
      } else {
        console.error('[Instantly → HubSpot] Error details:', error);
        return { success: false, error: error.message };
      }
    } finally {
      // Reset after 5 seconds to allow re-processing if needed
      setTimeout(() => {
        isProcessing = false;
      }, 5000);
    }
  }

  function showNotification(message, type = 'info') {
    // Check if notifications are enabled
    chrome.storage.sync.get(['notificationsEnabled'], (settings) => {
      if (settings.notificationsEnabled === false) {
        return;
      }

      // Create notification element
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 10000;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
        max-width: 400px;
        animation: slideIn 0.3s ease-out;
      `;

      notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="font-weight: 600;">Instantly → HubSpot</div>
        </div>
        <div style="margin-top: 4px;">${message}</div>
      `;

      // Add animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);

      document.body.appendChild(notification);

      // Remove after 5 seconds
      setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
          notification.remove();
          style.remove();
        }, 300);
      }, 5000);
    });
  }

  function extractFirstName() {
    // Look for first name in the page
    const firstNameSelectors = [
      '[data-testid="lead-firstname"]',
      '.lead-firstname',
      '[class*="first-name"]',
      'input[name="firstname"]',
      'input[placeholder*="First"]'
    ];

    for (const selector of firstNameSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const value = element.value || element.textContent;
        if (value && value.trim()) {
          return value.trim();
        }
      }
    }

    return '';
  }

  function extractLastName() {
    // Look for last name in the page
    const lastNameSelectors = [
      '[data-testid="lead-lastname"]',
      '.lead-lastname',
      '[class*="last-name"]',
      'input[name="lastname"]',
      'input[placeholder*="Last"]'
    ];

    for (const selector of lastNameSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const value = element.value || element.textContent;
        if (value && value.trim()) {
          return value.trim();
        }
      }
    }

    return '';
  }

  function extractCompany() {
    // Look for company name in the page
    const companySelectors = [
      '[data-testid="lead-company"]',
      '.lead-company',
      '[class*="company"]',
      'input[name="company"]',
      'input[placeholder*="Company"]'
    ];

    for (const selector of companySelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const value = element.value || element.textContent;
        if (value && value.trim()) {
          return value.trim();
        }
      }
    }

    return '';
  }

  async function extractEmailThread() {
    console.log('[Instantly → HubSpot] Starting email thread extraction...');

    // FIRST: Try to expand all collapsed messages
    await expandAllMessages();

    const emails = [];

    // STRATEGY: Instantly uses iframes to display email content
    // We need to extract from iframe contentDocument

    // Method 1: Extract from ALL iframes (MOST RELIABLE for Instantly)
    console.log('[Instantly → HubSpot] Looking for iframes with email content...');
    const iframes = document.querySelectorAll('iframe');
    console.log(`[Instantly → HubSpot] Found ${iframes.length} iframe(s)`);

    const rawEmailTexts = [];

    for (const iframe of iframes) {
      try {
        // Check if iframe is visible and on right side
        const rect = iframe.getBoundingClientRect();
        if (rect.width > 100 && rect.height > 100 && rect.left > window.innerWidth * 0.2) {
          console.log(`[Instantly → HubSpot] Checking iframe: ${iframe.id || 'unnamed'} at x=${Math.round(rect.left)}, y=${Math.round(rect.top)}`);

          // Access iframe content
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

          if (iframeDoc) {
            const iframeBody = iframeDoc.body;
            const iframeText = iframeBody?.innerText || iframeBody?.textContent || '';

            console.log(`[Instantly → HubSpot] Iframe content length: ${iframeText.length} chars`);

            if (iframeText.length > 20) {
              rawEmailTexts.push({
                text: iframeText.trim(),
                y: rect.top, // Track vertical position for ordering
                preview: iframeText.substring(0, 80).replace(/\n/g, ' ')
              });

              console.log(`[Instantly → HubSpot] ✓ Found email content: "${iframeText.substring(0, 80)}..."`);
            }
          }
        }
      } catch (error) {
        console.log(`[Instantly → HubSpot] Could not access iframe:`, error.message);
      }
    }

    // Sort by vertical position (top to bottom)
    rawEmailTexts.sort((a, b) => a.y - b.y);

    console.log(`[Instantly → HubSpot] Collected ${rawEmailTexts.length} email text(s) from iframes`);

    // If we found emails in iframes, parse them
    if (rawEmailTexts.length > 0) {
      console.log('[Instantly → HubSpot] Parsing email thread from iframes...');

      // Each iframe might contain a separate email, or they might contain the same email
      // We need to de-duplicate and parse intelligently

      const allParsedEmails = [];
      const seenContent = new Set();

      for (const rawEmail of rawEmailTexts) {
        // Parse this iframe's content
        const parsed = parseEmailThread(rawEmail.text);

        for (const email of parsed) {
          // Create a fingerprint to detect duplicates
          const fingerprint = email.body.substring(0, 200).replace(/\s+/g, '');

          if (!seenContent.has(fingerprint)) {
            seenContent.add(fingerprint);
            allParsedEmails.push(email);
          } else {
            console.log(`[Instantly → HubSpot] Skipping duplicate email`);
          }
        }
      }

      if (allParsedEmails.length > 0) {
        console.log(`[Instantly → HubSpot] ✓ Successfully parsed ${allParsedEmails.length} unique email(s) from thread`);
        return allParsedEmails;
      }
    }

    console.log('[Instantly → HubSpot] No iframe content found, trying DOM extraction...');

    // Method 2: Fallback to DOM extraction (for non-iframe layouts)
    // Find the email detail pane (right side of screen)
    let mainContent = null;

    // Find container that has the lead email AND is on right side
    if (currentLeadEmail) {
      const allContainers = document.querySelectorAll('div[class*="detail"], div[class*="thread"], div[class*="conversation"], main, [role="main"]');

      for (const container of allContainers) {
        const rect = container.getBoundingClientRect();
        const text = container.innerText || '';

        // Must be on right side (x > 30% of screen) and contain the lead email
        if (rect.left > window.innerWidth * 0.3 && text.includes(currentLeadEmail)) {
          console.log('[Instantly → HubSpot] Found email detail container on right side');
          mainContent = container;
          break;
        }
      }
    }

    // Find the largest container on right side of screen
    if (!mainContent) {
      const allDivs = document.querySelectorAll('div, main, article');
      let largestRightSideDiv = null;
      let maxSize = 0;

      for (const div of allDivs) {
        const rect = div.getBoundingClientRect();

        // Must be on right side and visible
        if (rect.left > window.innerWidth * 0.3 && rect.width > 300 && rect.height > 300) {
          const size = rect.width * rect.height;
          if (size > maxSize) {
            maxSize = size;
            largestRightSideDiv = div;
          }
        }
      }

      if (largestRightSideDiv) {
        console.log('[Instantly → HubSpot] Using largest right-side container');
        mainContent = largestRightSideDiv;
      }
    }

    // Fallback: use main or body
    if (!mainContent) {
      mainContent = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
      console.log('[Instantly → HubSpot] Using fallback main content');
    }

    console.log('[Instantly → HubSpot] Main content element:', mainContent?.tagName, mainContent?.className);
    console.log('[Instantly → HubSpot] Content area dimensions:', {
      x: mainContent?.getBoundingClientRect().left,
      width: mainContent?.getBoundingClientRect().width,
      textLength: (mainContent?.innerText || '').length
    });

    // Method 1: Try to find individual message blocks
    const messageContainers = findMessageContainers(mainContent);

    if (messageContainers.length > 0) {
      console.log(`[Instantly → HubSpot] Found ${messageContainers.length} message containers`);

      const seenTexts = new Set();

      messageContainers.forEach((container, index) => {
        const text = container.innerText?.trim() || container.textContent?.trim() || '';

        // Avoid duplicates
        if (text.length > 20 && !seenTexts.has(text)) {
          seenTexts.add(text);

          const emailData = {
            subject: `Message ${index + 1}`,
            body: text,
            timestamp: new Date().toISOString(),
            from: extractFromField(text) || currentLeadEmail || '',
            to: extractToField(text) || ''
          };

          emails.push(emailData);
          console.log(`[Instantly → HubSpot] Extracted message ${index + 1}: ${text.substring(0, 100)}...`);
        }
      });
    }

    // Method 2: Look for any divs with substantial text content (email-like)
    if (emails.length === 0) {
      console.log('[Instantly → HubSpot] No structured messages, looking for text-heavy divs...');

      const allDivs = mainContent.querySelectorAll('div, article, section');
      const candidates = [];

      for (const div of allDivs) {
        const rect = div.getBoundingClientRect();

        // IMPORTANT: Skip elements on the left side (inbox list)
        // Only consider elements on the right side where email detail is shown
        if (rect.left < window.innerWidth * 0.3) {
          continue; // Skip left sidebar
        }

        // Get only the direct text, not nested children
        const text = div.innerText?.trim() || '';

        // Look for divs with substantial text (likely email content)
        // Increased minimum to 200 to filter out snippets
        if (text.length > 200 && text.length < 50000) {
          // Check if it looks like email content
          const hasEmailPatterns =
            text.match(/\b[\w.+-]+@[\w.-]+\.\w{2,}\b/) ||
            /\b(hi|hello|dear|thanks|regards|sincerely|best)\b/i.test(text) ||
            text.includes('wrote:') ||
            text.includes('From:') ||
            text.includes('Subject:');

          // Also filter out if it contains inbox list indicators
          const isInboxList =
            text.includes('Received') && text.includes('ago') && text.includes('Reply?') ||
            text.match(/\d+\s+days?\s+ago/i) ||
            text.includes('Load more');

          if (hasEmailPatterns && !isInboxList) {
            candidates.push({
              element: div,
              text,
              score: text.length,
              x: rect.left
            });
          }
        }
      }

      // Sort by position (rightmost first) and then by length
      candidates.sort((a, b) => {
        // Prioritize rightmost elements
        if (Math.abs(a.x - b.x) > 100) {
          return b.x - a.x;
        }
        // If similar position, prefer longer text
        return b.score - a.score;
      });

      console.log(`[Instantly → HubSpot] Found ${candidates.length} candidate divs with email-like content`);

      // Take top 5 candidates
      const topCandidates = candidates.slice(0, 5);
      const seenTexts = new Set();

      topCandidates.forEach((candidate, index) => {
        if (!seenTexts.has(candidate.text)) {
          seenTexts.add(candidate.text);

          emails.push({
            subject: `Email Message ${index + 1}`,
            body: candidate.text,
            timestamp: new Date().toISOString(),
            from: extractFromField(candidate.text) || currentLeadEmail || '',
            to: extractToField(candidate.text) || ''
          });

          console.log(`[Instantly → HubSpot] Added candidate ${index + 1} (${candidate.text.length} chars, x=${Math.round(candidate.x)})`);
        }
      });
    }

    // Method 3: Last resort - capture everything in main content
    if (emails.length === 0) {
      console.log('[Instantly → HubSpot] No structured content found, capturing entire main area...');

      const fullText = mainContent.innerText?.trim() || mainContent.textContent?.trim() || '';

      console.log(`[Instantly → HubSpot] Full text length: ${fullText.length} characters`);

      if (fullText.length > 100) {
        // Try to split by common email separators
        const parts = fullText.split(/\n\n\n+|\n─+\n|\n═+\n/);

        if (parts.length > 1) {
          console.log(`[Instantly → HubSpot] Split content into ${parts.length} parts`);
          parts.forEach((part, index) => {
            if (part.trim().length > 50) {
              emails.push({
                subject: `Thread Part ${index + 1}`,
                body: part.trim(),
                timestamp: new Date().toISOString(),
                from: currentLeadEmail || '',
                to: ''
              });
            }
          });
        } else {
          // Just capture everything as one email
          emails.push({
            subject: 'Complete Email Thread from Instantly',
            body: fullText.substring(0, 50000), // Limit to 50k chars
            timestamp: new Date().toISOString(),
            from: currentLeadEmail || '',
            to: ''
          });
          console.log(`[Instantly → HubSpot] Captured entire thread as single email`);
        }
      } else {
        console.log('[Instantly → HubSpot] ⚠️ Content area has very little text');
        emails.push({
          subject: 'Email Thread from Instantly (No content found)',
          body: fullText || 'No email content could be extracted from the page. The email conversation may be loaded dynamically or in a different format.',
          timestamp: new Date().toISOString(),
          from: currentLeadEmail || '',
          to: ''
        });
      }
    }

    console.log(`[Instantly → HubSpot] ✓ Final result: Extracted ${emails.length} email(s) from thread`);
    emails.forEach((email, i) => {
      console.log(`  Email ${i + 1}: ${email.subject} (${email.body.length} chars)`);
    });

    return emails;
  }

  function findMessageContainers(parent) {
    const containers = [];

    // Look for divs that might contain individual messages
    // Common patterns: message blocks, email cards, conversation items
    const possibleContainers = parent.querySelectorAll(
      'div[class*="message"], div[class*="email"], div[class*="item"], ' +
      '[class*="conversation-item"], [class*="thread-item"], ' +
      '[role="article"], [role="listitem"]'
    );

    for (const container of possibleContainers) {
      const text = container.innerText?.trim() || '';

      // Filter: must have substantial content but not be the entire page
      if (text.length > 50 && text.length < 10000) {
        // Check if it looks like an email message
        const looksLikeEmail =
          text.match(/\b[\w.+-]+@[\w.-]+\.\w{2,}\b/) || // has email
          /^(Hi|Hello|Dear|Hey|Thanks|Thank you|Regards)/im.test(text) || // starts with greeting
          text.includes('From:') || text.includes('To:') || text.includes('Subject:');

        if (looksLikeEmail) {
          containers.push(container);
        }
      }
    }

    // If we found too many or too few, the selectors might not be working
    if (containers.length === 0 || containers.length > 100) {
      console.log(`[Instantly → HubSpot] Found ${containers.length} containers, trying alternative approach`);
      return [];
    }

    return containers;
  }

  function extractFromField(text) {
    const fromMatch = text.match(/From:\s*([^\n]+)/i);
    return fromMatch ? fromMatch[1].trim() : null;
  }

  function extractToField(text) {
    const toMatch = text.match(/To:\s*([^\n]+)/i);
    return toMatch ? toMatch[1].trim() : null;
  }

  /**
   * Parse an email thread into individual emails
   * Splits by "wrote:" patterns and cleans up quoted text
   */
  function parseEmailThread(fullText) {
    console.log(`[Instantly → HubSpot] Parsing thread (${fullText.length} chars)...`);

    const emails = [];

    // Remove any IFRAME_SEPARATOR artifacts
    fullText = fullText.replace(/---IFRAME_SEPARATOR---/g, '\n\n');

    // Split by common email reply patterns
    // Pattern: "On [date] at [time] [email] wrote:" or "On [date], [name] <email> wrote:"
    const splitPattern = /On\s+(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\w+,?\s+\d{1,2},?\s+\d{4})[^<]*?(?:<[^>]+>)?\s+wrote:/gi;

    const parts = fullText.split(splitPattern);

    console.log(`[Instantly → HubSpot] Split into ${parts.length} part(s)`);

    // Process each part
    for (let i = 0; i < parts.length; i++) {
      let emailText = parts[i].trim();

      if (!emailText || emailText.length < 20) {
        continue; // Skip empty or very short parts
      }

      // Extract metadata BEFORE cleaning (so we can find From/To/Date headers)
      const metadata = extractEmailMetadata(emailText);

      // Clean the email body
      let body = cleanEmailBody(emailText);

      if (body.length > 20) {
        emails.push({
          subject: metadata.subject || `Email ${i + 1}`,
          body: body,
          from: metadata.from || currentLeadEmail || '',
          to: metadata.to || '',
          timestamp: metadata.date || new Date().toISOString(),
          isOutgoing: metadata.from && metadata.from.includes(currentLeadEmail)
        });

        console.log(`[Instantly → HubSpot]   Email ${i + 1}: ${body.substring(0, 60)}... (${body.length} chars)`);
      }
    }

    // If no splits found, treat entire text as one email
    if (emails.length === 0 && fullText.trim().length > 20) {
      console.log('[Instantly → HubSpot] No splits found, treating as single email');

      const metadata = extractEmailMetadata(fullText);
      let cleanText = cleanEmailBody(fullText);

      if (cleanText.length > 20) {
        emails.push({
          subject: metadata.subject || 'Email Conversation',
          body: cleanText,
          from: metadata.from || currentLeadEmail || '',
          to: metadata.to || '',
          timestamp: metadata.date || new Date().toISOString(),
          isOutgoing: metadata.from && metadata.from.includes(currentLeadEmail)
        });
      }
    }

    return emails;
  }

  /**
   * Clean email body - remove headers, quoted text, format nicely
   */
  function cleanEmailBody(text) {
    let body = text;

    // Remove quoted text first
    body = removeQuotedText(body);

    // Remove email headers that appear in the body
    body = body.replace(/^From:\s*.+$/gm, '');
    body = body.replace(/^To:\s*.+$/gm, '');
    body = body.replace(/^Subject:\s*.+$/gm, '');
    body = body.replace(/^Date:\s*.+$/gm, '');
    body = body.replace(/^Sent:\s*.+$/gm, '');
    body = body.replace(/^Cc:\s*.+$/gm, '');
    body = body.replace(/^Bcc:\s*.+$/gm, '');

    // Remove "Re:" or "RE:" at the start
    body = body.replace(/^Re:\s*.+$/gm, '');
    body = body.replace(/^RE:\s*.+$/gm, '');

    // Convert bullet points variations to consistent format
    body = body.replace(/^[\-\*\•]\s+/gm, '  • ');

    // Preserve paragraph breaks (double newline) but remove excessive spacing
    body = body.replace(/\n{4,}/g, '\n\n\n'); // Max 2 blank lines
    body = body.replace(/[ \t]+$/gm, ''); // Remove trailing spaces
    body = body.replace(/^[ \t]+/gm, ''); // Remove leading spaces (but preserve structure)

    // Add space after periods that are followed by capital letters (sentence breaks)
    body = body.replace(/\.([A-Z])/g, '. $1');

    // Remove any remaining IFRAME_SEPARATOR text
    body = body.replace(/IFRAME_SEPARATOR/g, '');
    body = body.replace(/---/g, '');

    return body.trim();
  }

  /**
   * Remove quoted text from email body
   * Removes lines starting with > and indented previous messages
   */
  function removeQuotedText(text) {
    const lines = text.split('\n');
    const cleanedLines = [];

    let inQuotedBlock = false;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Check if line is quoted (starts with > or multiple spaces)
      const isQuoted =
        trimmedLine.startsWith('>') ||
        line.startsWith('    ') || // 4+ spaces indent
        line.startsWith('\t'); // Tab indent

      // Check if this is start of a quoted section
      if (trimmedLine.startsWith('>') || /^On\s+\w+.*wrote:/i.test(trimmedLine)) {
        inQuotedBlock = true;
        continue;
      }

      // If not quoted and not in quoted block, keep the line
      if (!isQuoted && !inQuotedBlock) {
        cleanedLines.push(line);
      }

      // Reset quoted block if we hit a non-indented line
      if (!isQuoted && trimmedLine.length > 0) {
        inQuotedBlock = false;
      }
    }

    return cleanedLines.join('\n');
  }

  /**
   * Extract email metadata (from, to, subject, date) from email text
   */
  function extractEmailMetadata(text) {
    const metadata = {
      from: null,
      to: null,
      subject: null,
      date: null
    };

    // Extract From
    const fromMatch = text.match(/From:\s*(.+?)(?:\n|<)/i);
    if (fromMatch) {
      metadata.from = fromMatch[1].trim();
    }

    // Try to extract from email address in text
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch && !metadata.from) {
      metadata.from = emailMatch[1];
    }

    // Extract To
    const toMatch = text.match(/To:\s*(.+?)(?:\n|<)/i);
    if (toMatch) {
      metadata.to = toMatch[1].trim();
    }

    // Extract Subject
    const subjectMatch = text.match(/Subject:\s*(.+?)$/im);
    if (subjectMatch) {
      metadata.subject = subjectMatch[1].trim();
    } else {
      // Try to get subject from Re: pattern
      const reMatch = text.match(/Re:\s*(.+?)(?:\n|$)/i);
      if (reMatch) {
        metadata.subject = reMatch[1].trim();
      }
    }

    // Extract Date
    const datePatterns = [
      /(?:Date|Sent):\s*(.+?)$/im,
      /On\s+(.+?)\s+at\s+(.+?)\s+(?:<|wrote)/i,
      /(\w+,?\s+\w+\s+\d{1,2},?\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s*(?:am|pm)?)/i
    ];

    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        try {
          const dateStr = match[1] + (match[2] ? ' ' + match[2] : '');
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) {
            metadata.date = parsed.toISOString();
            break;
          }
        } catch (e) {
          // Continue to next pattern
        }
      }
    }

    return metadata;
  }

  async function expandAllMessages() {
    console.log('[Instantly → HubSpot] Looking for collapsed messages to expand...');

    // First, count how many iframes we have before expanding
    const iframesBefore = document.querySelectorAll('iframe').length;
    console.log(`[Instantly → HubSpot] Initial iframe count: ${iframesBefore}`);

    let foundCollapsedMessages = true;
    let attempts = 0;
    const maxAttempts = 20;
    let expandedCount = 0;

    while (foundCollapsedMessages && attempts < maxAttempts) {
      foundCollapsedMessages = false;
      attempts++;

      console.log(`[Instantly → HubSpot] Expand attempt ${attempts}/${maxAttempts}...`);

      // STRATEGY 1: Look for text containing "more message"
      const allTextNodes = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let node;
      while (node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (/\d+\s+more\s+messages?/i.test(text)) {
          allTextNodes.push(node);
        }
      }

      console.log(`[Instantly → HubSpot] Found ${allTextNodes.length} text node(s) with "more messages"`);

      if (allTextNodes.length > 0) {
        for (const textNode of allTextNodes) {
          const text = textNode.textContent.trim();
          console.log(`[Instantly → HubSpot] Trying to expand: "${text}"`);

          // Find the clickable parent element
          let clickableElement = textNode.parentElement;
          let searchDepth = 0;

          while (clickableElement && searchDepth < 10) {
            const tagName = clickableElement.tagName;
            const hasClickHandler = clickableElement.onclick || clickableElement.hasAttribute('onclick');
            const isClickable = tagName === 'BUTTON' || tagName === 'A' || tagName === 'DIV' && hasClickHandler;
            const cursorStyle = window.getComputedStyle(clickableElement).cursor;

            console.log(`[Instantly → HubSpot]   Checking parent (depth ${searchDepth}): ${tagName}, cursor=${cursorStyle}, clickable=${isClickable}`);

            if (isClickable || cursorStyle === 'pointer') {
              console.log(`[Instantly → HubSpot]   ✓ Found clickable element!`);

              try {
                // Try clicking
                clickableElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await new Promise(resolve => setTimeout(resolve, 300));

                clickableElement.click();

                // Also try mouse events
                const mouseEvents = ['mousedown', 'mouseup', 'click'];
                for (const eventType of mouseEvents) {
                  clickableElement.dispatchEvent(new MouseEvent(eventType, {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                    buttons: 1
                  }));
                }

                console.log(`[Instantly → HubSpot]   ✓ Clicked successfully!`);
                expandedCount++;
                foundCollapsedMessages = true;

                // Wait for new content to load
                await new Promise(resolve => setTimeout(resolve, 1500));

                // Check if iframe count increased
                const iframesAfter = document.querySelectorAll('iframe').length;
                console.log(`[Instantly → HubSpot]   Iframe count: ${iframesBefore} → ${iframesAfter}`);

                break; // Exit parent search, restart main loop
              } catch (error) {
                console.log(`[Instantly → HubSpot]   ✗ Click failed: ${error.message}`);
              }
            }

            clickableElement = clickableElement.parentElement;
            searchDepth++;
          }

          if (foundCollapsedMessages) {
            break; // Restart search from beginning
          }
        }
      }

      // STRATEGY 2: Look for buttons/divs with specific text
      if (!foundCollapsedMessages) {
        const buttons = document.querySelectorAll('button, div[role="button"], a');
        for (const button of buttons) {
          const text = button.textContent?.trim() || '';

          if (/\d+\s+more\s+messages?/i.test(text) && text.length < 50) {
            console.log(`[Instantly → HubSpot] Found button with "more messages": "${text}"`);

            try {
              button.scrollIntoView({ behavior: 'smooth', block: 'center' });
              await new Promise(resolve => setTimeout(resolve, 300));

              button.click();
              console.log(`[Instantly → HubSpot] Clicked button successfully`);

              expandedCount++;
              foundCollapsedMessages = true;
              await new Promise(resolve => setTimeout(resolve, 1500));
              break;
            } catch (error) {
              console.log(`[Instantly → HubSpot] Button click failed: ${error.message}`);
            }
          }
        }
      }
    }

    const iframesAfterAll = document.querySelectorAll('iframe').length;
    console.log(`[Instantly → HubSpot] ✓ Expansion complete:`);
    console.log(`[Instantly → HubSpot]   - Expanded ${expandedCount} time(s)`);
    console.log(`[Instantly → HubSpot]   - Iframes: ${iframesBefore} → ${iframesAfterAll}`);

    // Wait a bit more for any lazy-loaded iframes
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

})();
