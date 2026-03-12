/**
 * LinkedIn Comment Generator - Background Script
 * 
 * Handles extension-level functionality that requires background processing.
 */

/**
 * Logging utility for the background script
 */
const logger = {
    // Set to false in production
    enabled: false,
    
    log(message, data = null) {
        if (this.enabled) {
            console.log(`[LinkedIn Comment Generator] ${message}`, data || '');
        }
    },
    
    error(message, error = null) {
        // Always log errors
        console.error(`[LinkedIn Comment Generator] ${message}`, error || '');
    }
};

/**
 * Listen for messages from content script or popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    logger.log('Received message', request);
    
    try {
        if (request.action === 'apiRequest') {
            // Proxy API calls from content script to bypass CORS
            logger.log('Proxying API request', { url: request.url });
            
            fetchWithRetry(request.url, request.options, request.maxRetries || 2, request.timeoutMs || 30000)
                .then(result => sendResponse({ success: true, data: result }))
                .catch(error => {
                    logger.error('API proxy request failed', error);
                    sendResponse({ 
                        success: false, 
                        error: error.message 
                    });
                });
        } else if (request.action === 'checkPermissions') {
            // Check for required permissions
            logger.log('Checking extension permissions');
            
            checkClipboardPermission()
                .then(result => sendResponse(result))
                .catch(error => {
                    logger.error('Error checking permissions', error);
                    sendResponse({ 
                        success: false, 
                        error: error.message 
                    });
                });
        } else if (request.action === 'getExtensionInfo') {
            // Return basic extension information
            sendResponse({
                success: true,
                version: chrome.runtime.getManifest().version,
                name: chrome.runtime.getManifest().name
            });
        }
    } catch (error) {
        logger.error('Error handling message', error);
        sendResponse({ 
            success: false, 
            error: error.message
        });
    }
    
    return true; // Keep the message channel open for async response
});

/**
 * Fetch with retry and timeout logic (runs in background to bypass CORS)
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options (method, headers, body)
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<string>} Response text
 */
async function fetchWithRetry(url, options, maxRetries, timeoutMs) {
    // Capture body as string upfront so it can be re-sent on every retry
    // (Request body is a ReadableStream and can only be consumed once)
    const bodyStr = options && options.body ? String(options.body) : undefined;

    let retries = 0;
    
    while (retries <= maxRetries) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            const fetchOptions = { ...options, signal: controller.signal };
            if (bodyStr !== undefined) fetchOptions.body = bodyStr;
            
            const response = await fetch(url, fetchOptions);
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => response.statusText);
                throw new Error(`API error ${response.status}: ${errorText}`);
            }
            
            return await response.text();
        } catch (error) {
            retries++;
            if (retries > maxRetries) {
                throw error.name === 'AbortError'
                    ? new Error('API request timed out')
                    : error;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
        }
    }
}

/**
 * Check clipboard permission
 * @returns {Promise<Object>} Result of the permission check
 */
async function checkClipboardPermission() {
    try {
        // Try to write to clipboard as a test
        const testText = "Test clipboard permission";
        await navigator.clipboard.writeText(testText);
        logger.log('Clipboard permission granted');
        return { success: true };
    } catch (error) {
        logger.error('Clipboard permission denied', error);
        return { 
            success: false, 
            error: 'Clipboard access is required for copying comments.' 
        };
    }
}

/**
 * Listen for extension installation or update
 */
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        logger.log('Extension installed');
    } else if (details.reason === 'update') {
        logger.log('Extension updated', { 
            previousVersion: details.previousVersion,
            currentVersion: chrome.runtime.getManifest().version
        });
    }
});

logger.log('Background script initialized'); 