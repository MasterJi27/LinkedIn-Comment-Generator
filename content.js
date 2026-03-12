/**
 * LinkedIn AI Comment & Reply Generator
 * Author: MasterJi27
 * GitHub: https://github.com/MasterJi27/LinkedIn-Comment-Generator
 * Debug logging utility with production-ready configuration
 */
const debug = {
    // Control whether logs should be shown (defaults to false in production)
    enabled: false,
    // Control whether debug mode is active
    isDebugMode: false,
    
    /**
     * Log informational messages if debugging is enabled
     * @param {string} message - Message to log
     * @param {any} data - Optional data to include
     */
    log: (message, data = null) => {
        if (!debug.enabled && !debug.isDebugMode) return;
        console.log(`[LinkedIn Comment Generator] ${message}`, data || '');
    },
    
    /**
     * Log error messages (these will always show in console)
     * @param {string} message - Error message
     * @param {Error} error - Optional error object
     */
    error: (message, error = null) => {
        console.error(`[LinkedIn Comment Generator] ${message}`, error || '');
    },
    
    /**
     * Show visual feedback element (only in debug mode)
     * @param {string} message - Message to display
     * @param {HTMLElement} element - Optional element to highlight
     * @param {string} type - Message type (info, error, success, warning)
     */
    showVisualFeedback: (message, element = null, type = 'info') => {
        if (!debug.isDebugMode) return;
        
        // Create visual feedback element
        const feedback = document.createElement('div');
        feedback.className = 'lcg-debug-feedback';
        feedback.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 10px 15px;
            border-radius: 5px;
            z-index: 9999;
            max-width: 400px;
            font-size: 14px;
            font-family: Arial, sans-serif;
            box-shadow: 0 3px 10px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
        `;
        
        // Set style based on message type
        switch (type) {
            case 'error':
                feedback.style.backgroundColor = '#f44336';
                feedback.style.color = 'white';
                break;
            case 'success':
                feedback.style.backgroundColor = '#4CAF50';
                feedback.style.color = 'white';
                break;
            case 'warning':
                feedback.style.backgroundColor = '#FF9800';
                feedback.style.color = 'white';
                break;
            default:
                feedback.style.backgroundColor = '#2196F3';
                feedback.style.color = 'white';
        }
        
        feedback.textContent = message;
        
        // Highlight the element if provided
        if (element && element instanceof HTMLElement) {
            const originalOutline = element.style.outline;
            const originalZIndex = element.style.zIndex;
            
            element.style.outline = type === 'error' ? '3px solid #f44336' : '3px solid #2196F3';
            element.style.zIndex = '10000';
            
            // Restore original styles after a delay
            setTimeout(() => {
                element.style.outline = originalOutline;
                element.style.zIndex = originalZIndex;
            }, 5000);
        }
        
        // Add feedback to page
        document.body.appendChild(feedback);
        
        // Remove after 5 seconds
        setTimeout(() => {
            feedback.style.opacity = '0';
            setTimeout(() => feedback.remove(), 300);
        }, 5000);
    },
    
    /**
     * Toggle debug mode on/off with keyboard shortcut
     * @returns {boolean} New debug mode state
     */
    toggleDebugMode: () => {
        debug.isDebugMode = !debug.isDebugMode;
        debug.enabled = debug.isDebugMode;
        
        if (debug.isDebugMode) {
            debug.showVisualFeedback('Debug mode activated! Press Ctrl+Shift+D to deactivate', null, 'success');
        }
        
        return debug.isDebugMode;
    }
};

/**
 * API configuration for comment generation service
 */
const API_CONFIG = {
    /**
     * N8N Webhook endpoint with OpenRouter integration
     * Note: Must use HTTPS when calling from LinkedIn (HTTPS site)
     */
    URL: 'https://n8n.devflow.me/webhook/linkedin-comment',
    
    /**
     * Maximum number of retries for API calls
     */
    MAX_RETRIES: 2,
    
    /**
     * Default timeout for API calls in milliseconds
     */
    TIMEOUT_MS: 30000
};

/**
 * OpenRouter model configuration and mapping
 */
const GPT_MODELS = {
    /**
     * Available OpenRouter models with their display names and API identifiers
     */
    MODELS: [
        { value: 'nemotron-super', label: 'Nemotron Super 120B 🚀', apiName: 'nvidia/nemotron-3-super-120b-a12b:free' }
    ],
    
    /**
     * Get API name for a given model value
     * @param {string} modelValue - The model value from dropdown
     * @returns {string} The corresponding API model name
     */
    getApiName: function(modelValue) {
        const model = this.MODELS.find(m => m.value === modelValue);
        return model ? model.apiName : 'nvidia/nemotron-3-super-120b-a12b:free'; // Default to Nemotron Super if not found
    },
    
    /**
     * Get display label for a given model value
     * @param {string} modelValue - The model value from dropdown
     * @returns {string} The display label
     */
    getDisplayLabel: function(modelValue) {
        const model = this.MODELS.find(m => m.value === modelValue);
        return model ? model.label : 'Nemotron Super 120B 🚀'; // Default to Nemotron Super if not found
    }
};

/**
 * Generates a comment by calling the API with post content, hint, tone, and model
 * 
 * @param {string} content - The content of the post to generate a comment for
 * @param {string} hint - Optional hint to guide comment generation
 * @param {string} tone - Optional tone for the comment (professional, friendly, etc.)
 * @param {string} model - Optional GPT model to use for generation
 * @returns {Promise<string>} The generated comment
 * @throws {Error} If API call fails or response is invalid
 */
async function generateCommentAPI(content, hint, tone, model) {
    if (!API_CONFIG.URL) {
        throw new Error('API endpoint not configured in code.');
    }
    
    // Get user info from LinkedIn
    const userInfo = await getUserInfo();
    
    // Prepare N8N webhook payload
    const payload = {
        hint: hint || "",
        caption: content,
        tone: tone || "professional",
        model: GPT_MODELS.getApiName(model || "nemotron-super"),
        user_info: {
            id: userInfo.id || 'unknown',
            email: userInfo.email || 'unknown',
            name: userInfo.name || 'unknown',
            profile_url: userInfo.profileUrl || 'unknown'
        }
    };
    
    debug.log('Sending payload to N8N webhook', payload);
    
    const requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    };
    
    try {
        // Route fetch through background script to bypass CORS
        debug.log('Sending API request via background script');
        
        const bgResponse = await chrome.runtime.sendMessage({
            action: 'apiRequest',
            url: API_CONFIG.URL,
            options: requestOptions,
            maxRetries: API_CONFIG.MAX_RETRIES,
            timeoutMs: API_CONFIG.TIMEOUT_MS
        });
        
        if (!bgResponse || !bgResponse.success) {
            throw new Error(bgResponse?.error || 'Background script request failed');
        }
        
        const responseText = bgResponse.data;
        debug.log('N8N Raw Response:', responseText);
        
        if (!responseText || responseText.trim() === '') {
            throw new Error('N8N returned empty response. Check if workflow is active and configured correctly.');
        }
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            throw new Error(`Invalid JSON from N8N: ${responseText.substring(0, 100)}`);
        }
        
        // Try to find the comment in various possible locations
        let comment = null;
        
        // Try common field names
        if (data.comment) {
            comment = data.comment;
        } else if (data.output) {
            comment = data.output;
        } else if (data.text) {
            comment = data.text;
        } else if (data.response) {
            comment = data.response;
        } else if (data.result) {
            comment = data.result;
        } else if (Array.isArray(data) && data.length > 0) {
            // If it returns an array, try to find comment in first item
            const firstItem = data[0];
            comment = firstItem.comment || firstItem.output || firstItem.text || firstItem.response;
        }
        
        if (!comment) {
            debug.error('Could not find comment in N8N response:', data);
            throw new Error('API response missing comment field. Response structure: ' + JSON.stringify(Object.keys(data)));
        }
        
        return comment;
    } catch (error) {
        debug.error('Error calling comment generation API', error);
        // Log more details about the error
        console.error('Fetch Error Details:', {
            message: error.message,
            type: error.name,
            url: API_CONFIG.URL,
            payload: payload
        });
        throw error;
    }
}

/**
 * Generates multiple reply suggestions for a comment on the user's post.
 * Makes 3 parallel API calls with varied instructions for diverse replies.
 */
async function generateReplyAPI(postContext, commentText, commenterName, tone, replyType, replyLength, model) {
    const lengthMap = {
        short: 'Keep it to exactly 1 sentence.',
        medium: 'Write 2-3 sentences.',
        detailed: 'Write 4-5 sentences with depth and substance.'
    };
    const replyTypeMap = {
        'thank': 'Thank them genuinely for their comment',
        'answer-question': 'Answer their question helpfully and directly',
        'add-insight': 'Add a valuable insight or new perspective',
        'appreciate': 'Show heartfelt appreciation and support',
        'continue': 'Continue the conversation with a follow-up thought or question'
    };

    const caption = [
        '[REPLY TO COMMENT ON MY POST]',
        postContext ? `My original post: "${postContext}"` : '',
        `Comment${commenterName ? ` from ${commenterName}` : ''}: "${commentText}"`
    ].filter(Boolean).join('\n');

    const baseHint = [
        `Reply intent: ${replyTypeMap[replyType] || 'Reply naturally'}.`,
        lengthMap[replyLength] || lengthMap.medium,
        commenterName ? `Naturally include the name "${commenterName}" in the reply.` : '',
        'Be natural and conversational for LinkedIn.',
        'Do NOT use generic phrases like "Great post" or "Thanks for sharing".',
        'Always acknowledge what the commenter specifically said.',
        'Keep it professional yet warm.'
    ].filter(Boolean).join(' ');

    const variations = [
        baseHint,
        baseHint + ' Use a warm and personable opening style.',
        baseHint + ' Try a unique angle or fresh perspective in your reply.'
    ];

    const promises = variations.map(hint =>
        generateCommentAPI(caption, hint, tone, model)
    );

    const results = await Promise.allSettled(promises);
    const replies = [];
    for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
            replies.push(result.value);
        }
    }

    if (replies.length === 0) {
        const firstError = results.find(r => r.status === 'rejected');
        throw new Error(firstError?.reason?.message || 'All reply generation attempts failed.');
    }

    return replies;
}

/**
 * Retrieves information about the currently logged-in LinkedIn user
 * 
 * @returns {Promise<Object>} User information including id, name, email, and profileUrl
 */
async function getUserInfo() {
    try {
        const userInfo = {
            id: null,
            email: null,
            name: null,
            profileUrl: null
        };

        // Method 1: Get from global nav element (works on all LinkedIn pages including feed)
        const globalNav = document.getElementById('global-nav');
        if (globalNav) {
            // Try to find the profile nav item
            const profileNavItem = globalNav.querySelector('a[href*="/in/"], a[data-control-name="identity_profile_photo"]');
            if (profileNavItem) {
                userInfo.profileUrl = profileNavItem.href;
                if (userInfo.profileUrl) {
                    const idMatch = userInfo.profileUrl.match(/\/in\/([^\/]+)/);
                    if (idMatch) {
                        userInfo.id = idMatch[1];
                    }
                }
            }
        }

        // Method 2: Get from the Me dropdown (read-only, no clicks to avoid side effects)
        if (!userInfo.profileUrl) {
            const meDropdown = document.querySelector('.global-nav__me-photo, .nav-item__profile-photo, [data-control-name="identity_profile_photo"]');
            if (meDropdown) {
                const link = meDropdown.closest('a[href*="/in/"]');
                if (link) {
                    userInfo.profileUrl = link.href;
                    const idMatch = link.href.match(/\/in\/([^\/]+)/);
                    if (idMatch) userInfo.id = idMatch[1];
                }
            }
        }

        // Method 3: Get from the feed identity module
        if (!userInfo.profileUrl || !userInfo.name) {
            const feedIdentity = document.querySelector('.feed-identity-module');
            if (feedIdentity) {
                const profileLink = feedIdentity.querySelector('a[href*="/in/"]');
                if (profileLink) {
                    userInfo.profileUrl = profileLink.href;
                    if (!userInfo.name) {
                        userInfo.name = profileLink.textContent.trim();
                    }
                    
                    if (userInfo.profileUrl && !userInfo.id) {
                        const idMatch = userInfo.profileUrl.match(/\/in\/([^\/]+)/);
                        if (idMatch) {
                            userInfo.id = idMatch[1];
                        }
                    }
                }
            }
        }

        // Method 4: Get from data attributes in the DOM
        if (!userInfo.id) {
            // LinkedIn often stores member ID in data attributes
            const memberElements = document.querySelectorAll('[data-urn*="urn:li:member:"], [data-entity-urn*="urn:li:member:"]');
            for (const element of memberElements) {
                const urn = element.getAttribute('data-urn') || element.getAttribute('data-entity-urn');
                if (urn) {
                    const match = urn.match(/urn:li:member:(\d+)/);
                    if (match) {
                        userInfo.id = match[1];
                        break;
                    }
                }
            }
        }

        // Method 5: Get name from profile sections if available
        if (!userInfo.name) {
            const nameSelectors = [
                '.profile-rail-card__actor-link',
                '.feed-identity-module__actor-link',
                '.identity-headline',
                '.profile-card-one-to-one__profile-link',
                '.profile-rail-card__name',
                '.identity-name'
            ];
            
            for (const selector of nameSelectors) {
                const nameElement = document.querySelector(selector);
                if (nameElement) {
                    userInfo.name = nameElement.textContent.trim();
                    break;
                }
            }
        }

        // Method 6: Try to get from meta tags
        if (!userInfo.id || !userInfo.name) {
            const metaTags = document.querySelectorAll('meta');
            for (const meta of metaTags) {
                const content = meta.getAttribute('content');
                if (!content) continue;
                
                // Look for profile info in meta tags
                if (meta.getAttribute('name') === 'profile:first_name' || meta.getAttribute('property') === 'profile:first_name') {
                    userInfo.name = (userInfo.name || '') + ' ' + content;
                }
                if (meta.getAttribute('name') === 'profile:last_name' || meta.getAttribute('property') === 'profile:last_name') {
                    userInfo.name = (userInfo.name || '') + ' ' + content;
                }
            }
            
            if (userInfo.name) {
                userInfo.name = userInfo.name.trim();
            }
        }

        // Method 7: Check local storage for any saved user info
        if (!userInfo.id || !userInfo.profileUrl) {
            try {
                const localStorageData = JSON.parse(localStorage.getItem('linkedin-comment-generator-user-info'));
                if (localStorageData) {
                    if (!userInfo.id && localStorageData.id) {
                        userInfo.id = localStorageData.id;
                    }
                    if (!userInfo.profileUrl && localStorageData.profileUrl) {
                        userInfo.profileUrl = localStorageData.profileUrl;
                    }
                    if (!userInfo.name && localStorageData.name) {
                        userInfo.name = localStorageData.name;
                    }
                }
            } catch (e) {
                debug.log('Error reading from localStorage', e);
            }
        }

        // If we still don't have a profile URL, try to construct it from the ID
        if (!userInfo.profileUrl && userInfo.id) {
            userInfo.profileUrl = `https://www.linkedin.com/in/${userInfo.id}/`;
        }

        // Save the user info we found to localStorage for future use
        if (userInfo.id || userInfo.profileUrl) {
            try {
                localStorage.setItem('linkedin-comment-generator-user-info', JSON.stringify(userInfo));
            } catch (e) {
                debug.log('Error saving to localStorage', e);
            }
        }

        // Generate a stable ID if we don't have one yet
        if (!userInfo.id) {
            // Use a hash of the navigator properties to create a device fingerprint
            const deviceInfo = `${navigator.userAgent}|${navigator.language}|${navigator.platform}|${screen.width}x${screen.height}`;
            const deviceHash = Array.from(deviceInfo).reduce((hash, char) => 
                ((hash << 5) - hash) + char.charCodeAt(0), 0).toString(36).replace('-', '');
            
            userInfo.id = `user_${deviceHash}`;
        }

        debug.log('Retrieved user info', userInfo);
        return userInfo;
    } catch (error) {
        debug.error('Error getting user info', error);
        // Return fallback user info with a random ID
        return {
            id: `user_${Math.random().toString(36).substring(2, 15)}`,
            email: 'unknown',
            name: 'unknown',
            profileUrl: null
        };
    }
}

// Fallback local comment generation
function generateCommentLocally(postContent, hint) {
    const templates = [
        "This is a great point about {content}! {hint_text}I've found that engaging with these ideas can lead to valuable insights.",
        "Really appreciate you sharing this perspective on {content}. {hint_text}It's given me something to think about.",
        "Interesting take on {content}! {hint_text}Thanks for sharing these thoughts with the community.",
        "I found this quite insightful, especially regarding {content}. {hint_text}Looking forward to more of your content on this topic.",
        "Thanks for highlighting these points about {content}. {hint_text}It's an important conversation to have."
    ];
    
    // Select a random template
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    // Prepare a shortened version of the content
    const shortContent = postContent.length > 30 
        ? postContent.substring(0, 30) + "..." 
        : postContent;
    
    // Format the hint text if present
    const hintText = hint ? `(${hint}) ` : '';
    
    // Generate the comment using the template
    return template
        .replace('{content}', shortContent)
        .replace('{hint_text}', hintText);
}

// Track which posts have been processed and the active comment UI
// Cap size to prevent memory leak on long LinkedIn sessions
const MAX_PROCESSED_IDS = 500;
let processedPostIds = new Set();
let activeCommentUI = null;

function addProcessedId(id) {
    processedPostIds.add(id);
    // Trim oldest entries if set grows too large
    if (processedPostIds.size > MAX_PROCESSED_IDS) {
        const first = processedPostIds.values().next().value;
        processedPostIds.delete(first);
    }
}

// Function to get a unique ID for a post
function getPostId(post) {
    // Try to get data-urn attribute which is typically unique for posts
    const urn = post.getAttribute('data-urn');
    if (urn) return `urn-${urn}`;
    
    // If no urn, try to find an id attribute
    const id = post.id;
    if (id) return `id-${id}`;
    
    // Try to find any unique content
    const uniqueText = extractPostContent(post).slice(0, 40).replace(/\s+/g, '-');
    if (uniqueText && uniqueText !== 'LinkedIn-post') {
        return `content-${uniqueText}`;
    }
    
    // As a fallback, use a combination of classList and position in document
    const postIndex = Array.from(document.querySelectorAll('.feed-shared-update-v2, .occludable-update')).indexOf(post);
    return `post-${post.classList.toString()}-${postIndex}`;
}

// Check if a post has meaningful content/caption
function hasContent(post) {
    // Look for text content with minimum length
    const minContentLength = 20; // Minimum characters to consider as meaningful content
    
    // Try to find text in common LinkedIn post content areas
    const contentSelectors = [
        '.feed-shared-update-v2__description-wrapper',
        '.feed-shared-text__text-view',
        '.update-components-text',
        '.feed-shared-inline-show-more-text',
        '.feed-shared-text-view',
        '.feed-shared-actor__description',
        '.update-components-actor__description',
        '.update-components-article__title',
        '.update-components-article__description',
        '.feed-shared-external-video__description',
        '.feed-shared-update-v2__commentary'
    ];
    
    for (const selector of contentSelectors) {
        const elements = post.querySelectorAll(selector);
        for (const element of elements) {
            const text = element.textContent.trim();
            if (text.length >= minContentLength) {
                return true;
            }
        }
    }
    
    // Also check for posts with images or videos (they might not have text but are still commentable)
    const mediaSelectors = [
        'img.feed-shared-image',
        '.feed-shared-image__container',
        '.feed-shared-linkedin-video',
        '.feed-shared-external-video',
        '.feed-shared-mini-article',
        '.feed-shared-article__preview-image'
    ];
    
    for (const selector of mediaSelectors) {
        if (post.querySelector(selector)) {
            return true;
        }
    }
    
    return false;
}

// Simple function to extract content from a post
function extractPostContent(post) {
    debug.log('Extracting content from post', post);
    
    // Try to find the main post content using more specific LinkedIn selectors first
    const contentSelectors = [
        '.feed-shared-update-v2__description-wrapper', 
        '.feed-shared-text__text-view',
        '.update-components-text',
        '.feed-shared-inline-show-more-text',
        '.feed-shared-text-view',
        '.feed-shared-update-v2__commentary',
        '.update-components-article__title',
        '.update-components-article__description',
        '.feed-shared-external-video__description'
    ];
    
    // Try each selector to find content
    for (const selector of contentSelectors) {
        const elements = post.querySelectorAll(selector);
        for (const element of elements) {
            const text = element.textContent.trim();
            if (text.length > 10) { // More permissive length check
                debug.log('Found post content using selector', { selector, text });
                return text;
            }
        }
    }
    
    // Fallback: Look for any text content with reasonable length
    debug.log('Falling back to generic content extraction');
    const textElements = post.querySelectorAll('span, p, div');
    let content = '';
    
    for (const element of textElements) {
        const text = element.textContent.trim();
        // More permissive check - don't exclude elements with children
        if (text.length > 30) {
            content = text;
            debug.log('Found content through fallback method', content);
            break;
        }
    }
    
    if (!content) {
        debug.log('No suitable content found in post, using default text');
        return 'LinkedIn post';
    }
    
    return content;
}

// Check if a post is commentable (has comment functionality)
function isCommentable(post) {
    // Check for the presence of a comment button
    const commentButtonSelectors = [
        'button[aria-label*="comment" i]',
        'button.comment-button',
        '[aria-label*="Comment" i][role="button"]',
        '.comment-button',
        '[data-control-name="comment"]'
    ];
    
    for (const selector of commentButtonSelectors) {
        if (post.querySelector(selector)) {
            return true;
        }
    }
    
    // Check for the presence of a comment section
    const commentSectionSelectors = [
        '.comments-comment-box',
        '.comments-comment-texteditor',
        '.feed-shared-comment-box'
    ];
    
    for (const selector of commentSectionSelectors) {
        if (post.querySelector(selector)) {
            return true;
        }
    }
    
    // If we couldn't find any comment functionality, this post is not commentable
    return false;
}

// Create settings UI for the extension
function createSettingsUI() {
    const container = document.createElement('div');
    container.className = 'linkedin-comment-generator-settings';
    container.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 20px;
        background: white;
        border: 2px solid #0a66c2;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        width: 400px;
        max-width: 90vw;
    `;
    
    const heading = document.createElement('h3');
    heading.textContent = 'LinkedIn Comment Generator Settings';
    heading.style.cssText = `
        margin: 0 0 16px 0;
        font-size: 18px;
        color: #0a66c2;
    `;
    
    const infoText = document.createElement('p');
    infoText.textContent = 'This extension is using a pre-configured API endpoint for generating comments.';
    infoText.style.cssText = `
        margin-bottom: 16px;
        font-size: 14px;
        color: #666;
    `;
    
    const formatInfo = document.createElement('div');
    formatInfo.innerHTML = `
        <p style="font-size: 12px; color: #666; margin-top: 0;">
            API request format:
            <code style="display: block; background: #f5f5f5; padding: 8px; margin: 8px 0; border-radius: 4px; font-family: monospace;">
            {
              "hint": "optional text",
              "caption": "post content text"
            }
            </code>
            
            API response format:
            <code style="display: block; background: #f5f5f5; padding: 8px; margin: 8px 0; border-radius: 4px; font-family: monospace;">
            {
              "comment": "generated comment text"
            }
            </code>
        </p>
    `;
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        justify-content: flex-end;
        gap: 8px;
    `;
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText = `
        padding: 8px 16px;
        border: none;
        border-radius: 16px;
        background-color: #0a66c2;
        color: white;
        cursor: pointer;
        font-weight: 600;
        font-size: 14px;
    `;
    
    closeBtn.addEventListener('click', () => {
        container.remove();
    });
    
    buttonContainer.appendChild(closeBtn);
    
    container.appendChild(heading);
    container.appendChild(infoText);
    container.appendChild(formatInfo);
    container.appendChild(buttonContainer);
    
    document.body.appendChild(container);
}

// Create a comment UI that appears when the generate button is clicked
function createCommentUI(post, generateButton) {
    // Inject global styles for the comment UI
    if (!document.getElementById('lcg-ui-styles')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'lcg-ui-styles';
        styleSheet.textContent = `
            @keyframes lcg-slideIn {
                from { opacity: 0; transform: translateY(-10px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes lcg-slideOut {
                from { opacity: 1; transform: translateY(0) scale(1); }
                to { opacity: 0; transform: translateY(-10px) scale(0.98); }
            }
            @keyframes lcg-shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
            }
            @keyframes lcg-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            @keyframes lcg-dotBounce {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1); }
            }
            @keyframes lcg-fadeSlideIn {
                from { opacity: 0; transform: translateY(6px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes lcg-successPop {
                0% { transform: scale(0.8); opacity: 0; }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); opacity: 1; }
            }
            @keyframes lcg-toast {
                0% { transform: translateX(-50%) translateY(10px); opacity: 0; }
                10% { transform: translateX(-50%) translateY(0); opacity: 1; }
                90% { transform: translateX(-50%) translateY(0); opacity: 1; }
                100% { transform: translateX(-50%) translateY(-10px); opacity: 0; }
            }
            @keyframes lcg-progressBar {
                0% { width: 5%; }
                20% { width: 25%; }
                50% { width: 55%; }
                80% { width: 80%; }
                95% { width: 92%; }
                100% { width: 100%; }
            }
            @keyframes lcg-borderGlow {
                0%, 100% { border-color: #e5e7eb; }
                50% { border-color: #0a66c2; }
            }
            .lcg-panel { animation: lcg-slideIn 0.35s cubic-bezier(0.16,1,0.3,1); }
            .lcg-panel.closing { animation: lcg-slideOut 0.25s ease-in forwards; }
            .lcg-tone-pill {
                padding: 7px 16px;
                border: 1.5px solid #e0e0e0;
                border-radius: 20px;
                background: white;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
                color: #555;
                white-space: nowrap;
                user-select: none;
            }
            .lcg-tone-pill:hover {
                border-color: #0a66c2;
                color: #0a66c2;
                background: #f0f7ff;
                transform: translateY(-1px);
            }
            .lcg-tone-pill.active {
                background: linear-gradient(135deg, #0a66c2 0%, #0052a3 100%);
                color: white;
                border-color: transparent;
                box-shadow: 0 2px 8px rgba(10,102,194,0.3);
                transform: translateY(-1px);
            }
            .lcg-generate-btn {
                width: 100%;
                padding: 13px 24px;
                border: none;
                border-radius: 12px;
                background: linear-gradient(135deg, #0a66c2 0%, #004182 50%, #0a66c2 100%);
                background-size: 200% auto;
                color: white;
                cursor: pointer;
                font-weight: 700;
                font-size: 15px;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
                box-shadow: 0 4px 15px rgba(10,102,194,0.3);
                letter-spacing: 0.3px;
                position: relative;
                overflow: hidden;
            }
            .lcg-generate-btn::before {
                content: '';
                position: absolute;
                top: 0; left: -100%; width: 100%; height: 100%;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
                transition: left 0.5s ease;
            }
            .lcg-generate-btn:hover:not(:disabled)::before { left: 100%; }
            .lcg-generate-btn:hover:not(:disabled) {
                background-position: right center;
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(10,102,194,0.4);
            }
            .lcg-generate-btn:active:not(:disabled) {
                transform: translateY(0);
                box-shadow: 0 2px 8px rgba(10,102,194,0.3);
            }
            .lcg-generate-btn:disabled {
                opacity: 0.85;
                cursor: not-allowed;
                background: linear-gradient(135deg, #5b9bd5 0%, #4a8bc7 100%);
            }
            .lcg-textarea {
                width: 100%;
                min-height: 120px;
                padding: 14px 40px 14px 14px;
                border: 1.5px solid #e5e7eb;
                border-radius: 12px;
                font-size: 14px;
                line-height: 1.7;
                resize: vertical;
                box-sizing: border-box;
                background-color: #fafbfc;
                transition: all 0.25s ease;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                color: #1a1a1a;
                outline: none;
            }
            .lcg-textarea:focus {
                border-color: #0a66c2;
                box-shadow: 0 0 0 3px rgba(10,102,194,0.08);
                background-color: white;
            }
            .lcg-textarea.has-content {
                background-color: white;
                border-color: #c5d9ed;
            }
            .lcg-textarea.loading {
                background: linear-gradient(90deg, #f0f2f5 25%, #e4e6e9 50%, #f0f2f5 75%);
                background-size: 200% 100%;
                animation: lcg-shimmer 1.5s infinite;
                color: transparent;
                border-color: #d0d5dd;
            }
            .lcg-textarea.error {
                border-color: #ef4444;
                background-color: #fef2f2;
            }
            .lcg-hint-input {
                width: 100%;
                padding: 10px 14px 10px 36px;
                border: 1.5px solid #e5e7eb;
                border-radius: 10px;
                font-size: 14px;
                box-sizing: border-box;
                transition: all 0.2s ease;
                outline: none;
                font-weight: 400;
                color: #333;
                background: white;
            }
            .lcg-hint-input:focus {
                border-color: #0a66c2;
                box-shadow: 0 0 0 3px rgba(10,102,194,0.08);
            }
            .lcg-hint-input::placeholder { color: #9ca3af; }
            .lcg-action-btn {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 6px 14px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s ease;
                border: 1px solid #e5e7eb;
                background: white;
                color: #374151;
            }
            .lcg-action-btn:hover {
                border-color: #0a66c2;
                color: #0a66c2;
                background: #f0f7ff;
                transform: translateY(-1px);
            }
            .lcg-action-btn.primary {
                background: #0a66c2;
                color: white;
                border-color: #0a66c2;
            }
            .lcg-action-btn.primary:hover {
                background: #004182;
                border-color: #004182;
                box-shadow: 0 2px 8px rgba(10,102,194,0.3);
            }
            .lcg-action-btn.success {
                background: #059669;
                color: white;
                border-color: #059669;
                animation: lcg-successPop 0.3s ease-out;
            }
            .lcg-close-btn {
                background: rgba(255,255,255,0.1);
                border: none;
                color: white;
                cursor: pointer;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 8px;
                transition: all 0.2s ease;
                opacity: 0.85;
            }
            .lcg-close-btn:hover {
                opacity: 1;
                background: rgba(255,255,255,0.2);
                transform: rotate(90deg);
            }
            .lcg-loading-dots span {
                display: inline-block;
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: white;
                animation: lcg-dotBounce 1.4s infinite ease-in-out both;
                margin: 0 2px;
            }
            .lcg-loading-dots span:nth-child(1) { animation-delay: -0.32s; }
            .lcg-loading-dots span:nth-child(2) { animation-delay: -0.16s; }
            .lcg-loading-dots span:nth-child(3) { animation-delay: 0s; }
            .lcg-char-count {
                font-size: 11px;
                color: #9ca3af;
                text-align: right;
                margin-top: 4px;
                transition: color 0.2s;
            }
            .lcg-toast {
                position: fixed;
                bottom: 24px;
                left: 50%;
                transform: translateX(-50%);
                padding: 10px 20px;
                border-radius: 10px;
                font-size: 13px;
                font-weight: 600;
                color: white;
                z-index: 99999;
                box-shadow: 0 8px 30px rgba(0,0,0,0.15);
                animation: lcg-toast 2.5s ease-in-out forwards;
                pointer-events: none;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            }
            .lcg-toast.success { background: linear-gradient(135deg, #059669, #047857); }
            .lcg-toast.error { background: linear-gradient(135deg, #ef4444, #dc2626); }
            .lcg-toast.info { background: linear-gradient(135deg, #0a66c2, #004182); }
            .lcg-progress-bar {
                height: 3px;
                background: linear-gradient(90deg, #0a66c2, #38bdf8, #0a66c2);
                background-size: 200% 100%;
                border-radius: 0 0 14px 14px;
                animation: lcg-progressBar 15s ease-out forwards, lcg-shimmer 1.5s infinite;
            }
            .lcg-status-text {
                font-size: 12px;
                color: #6b7280;
                text-align: center;
                padding: 8px 0;
                animation: lcg-pulse 1.5s infinite;
            }
            .lcg-action-bar {
                display: flex;
                gap: 8px;
                align-items: center;
                margin-top: 10px;
                animation: lcg-fadeSlideIn 0.3s ease-out;
            }
            .lcg-section-label {
                font-size: 11px;
                font-weight: 600;
                color: #6b7280;
                text-transform: uppercase;
                letter-spacing: 0.6px;
                margin-bottom: 8px;
            }
            .lcg-mode-toggle {
                display: flex;
                background: #f0f2f5;
                border-radius: 10px;
                padding: 3px;
                margin-bottom: 16px;
                gap: 3px;
            }
            .lcg-mode-btn {
                flex: 1;
                padding: 9px 12px;
                border: none;
                border-radius: 8px;
                background: transparent;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s cubic-bezier(0.16,1,0.3,1);
                color: #6b7280;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                white-space: nowrap;
            }
            .lcg-mode-btn.active {
                background: white;
                color: #0a66c2;
                box-shadow: 0 1px 4px rgba(0,0,0,0.08);
            }
            .lcg-mode-btn:hover:not(.active) {
                color: #374151;
                background: rgba(255,255,255,0.5);
            }
            .lcg-input-group { margin-bottom: 12px; }
            .lcg-input-label {
                font-size: 11px;
                font-weight: 600;
                color: #6b7280;
                text-transform: uppercase;
                letter-spacing: 0.6px;
                margin-bottom: 6px;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .lcg-optional {
                font-weight: 400;
                color: #9ca3af;
                text-transform: none;
                letter-spacing: 0;
                font-size: 10px;
            }
            .lcg-text-input {
                width: 100%;
                padding: 10px 14px;
                border: 1.5px solid #e5e7eb;
                border-radius: 10px;
                font-size: 13px;
                line-height: 1.5;
                box-sizing: border-box;
                background: #fafbfc;
                transition: all 0.2s ease;
                font-family: inherit;
                color: #1a1a1a;
                outline: none;
                resize: vertical;
            }
            .lcg-text-input:focus {
                border-color: #0a66c2;
                box-shadow: 0 0 0 3px rgba(10,102,194,0.08);
                background: white;
            }
            .lcg-text-input::placeholder { color: #9ca3af; }
            .lcg-reply-type-pill {
                padding: 6px 12px;
                border: 1.5px solid #e0e0e0;
                border-radius: 18px;
                background: white;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                color: #555;
                white-space: nowrap;
                user-select: none;
            }
            .lcg-reply-type-pill:hover {
                border-color: #7c3aed;
                color: #7c3aed;
                background: #f5f3ff;
                transform: translateY(-1px);
            }
            .lcg-reply-type-pill.active {
                background: linear-gradient(135deg, #7c3aed, #6d28d9);
                color: white;
                border-color: transparent;
                box-shadow: 0 2px 6px rgba(124,58,237,0.3);
            }
            .lcg-length-pill {
                padding: 6px 14px;
                border: 1.5px solid #e0e0e0;
                border-radius: 18px;
                background: white;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                color: #555;
                white-space: nowrap;
                user-select: none;
            }
            .lcg-length-pill:hover {
                border-color: #059669;
                color: #059669;
                background: #ecfdf5;
                transform: translateY(-1px);
            }
            .lcg-length-pill.active {
                background: linear-gradient(135deg, #059669, #047857);
                color: white;
                border-color: transparent;
                box-shadow: 0 2px 6px rgba(5,150,105,0.3);
            }
            .lcg-suggestion-card {
                background: #fafbfc;
                border: 1.5px solid #e5e7eb;
                border-radius: 12px;
                padding: 14px;
                margin-bottom: 10px;
                animation: lcg-fadeSlideIn 0.3s ease-out;
                transition: all 0.2s ease;
            }
            .lcg-suggestion-card:hover {
                border-color: #c5d9ed;
                box-shadow: 0 2px 8px rgba(0,0,0,0.04);
            }
            .lcg-suggestion-text {
                font-size: 14px;
                line-height: 1.65;
                color: #1a1a1a;
                margin-bottom: 10px;
                white-space: pre-wrap;
                word-wrap: break-word;
            }
            .lcg-suggestion-actions {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }
            .lcg-suggestion-num {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 22px;
                height: 22px;
                border-radius: 7px;
                background: linear-gradient(135deg, #0a66c2, #004182);
                color: white;
                font-size: 11px;
                font-weight: 700;
                flex-shrink: 0;
            }
        `;
        document.head.appendChild(styleSheet);
    }

    // Toast notification helper
    function showToast(message, type = 'success') {
        const existing = document.querySelector('.lcg-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = 'lcg-toast ' + type;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2600);
    }

    const container = document.createElement('div');
    container.className = 'linkedin-comment-generator-ui lcg-panel';
    container.style.cssText = `
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        margin: 12px 8px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.08), 0 2px 10px rgba(0,0,0,0.04);
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    `;

    // ── Header ──
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg, #0a66c2 0%, #004182 100%);
        padding: 14px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
    `;

    const headerLeft = document.createElement('div');
    headerLeft.style.cssText = 'display:flex;align-items:center;gap:10px;';
    headerLeft.innerHTML = `
        <div style="width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;">
            <span style="font-size:16px;">✨</span>
        </div>
        <div>
            <div style="color:white;font-weight:700;font-size:14px;letter-spacing:-0.2px;">AI Comment Generator</div>
            <div style="color:rgba(255,255,255,0.6);font-size:10px;font-weight:500;margin-top:1px;">Nemotron Super 120B</div>
        </div>
    `;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'lcg-close-btn';
    closeBtn.title = 'Close panel';
    closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
    closeBtn.addEventListener('click', () => {
        container.classList.add('closing');
        setTimeout(() => {
            container.remove();
            activeCommentUI = null;
            if (generateButton) generateButton.style.display = 'inline-flex';
        }, 250);
    });

    header.appendChild(headerLeft);
    header.appendChild(closeBtn);

    // ── Progress bar (hidden by default) ──
    const progressBar = document.createElement('div');
    progressBar.className = 'lcg-progress-bar';
    progressBar.style.display = 'none';

    // ── Body ──
    const body = document.createElement('div');
    body.style.cssText = 'padding: 18px;';

    // ── Tone Selector (pills) ──
    const toneSection = document.createElement('div');
    toneSection.style.cssText = 'margin-bottom: 16px;';

    const toneLabel = document.createElement('div');
    toneLabel.className = 'lcg-section-label';
    toneLabel.textContent = 'Tone';

    const tonePills = document.createElement('div');
    tonePills.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';

    // Hidden select for value retrieval
    const toneSelect = document.createElement('select');
    toneSelect.className = 'linkedin-comment-generator-tone-select';
    toneSelect.style.display = 'none';

    const tones = [
        { value: 'professional', label: 'Professional 💼' },
        { value: 'supportive', label: 'Supportive 🤝' },
        { value: 'friendly', label: 'Friendly 😊' },
        { value: 'inquisitive', label: 'Inquisitive ❓' },
        { value: 'cheerful', label: 'Cheerful 🎉' },
        { value: 'funny', label: 'Funny 😂' }
    ];

    // Guard: prevent double-clicks while generating
    let isGenerating = false;

    let activePill = null;
    tones.forEach((tone, idx) => {
        const option = document.createElement('option');
        option.value = tone.value;
        option.textContent = tone.label;
        if (idx === 0) option.selected = true;
        toneSelect.appendChild(option);

        const pill = document.createElement('button');
        pill.className = 'lcg-tone-pill' + (idx === 0 ? ' active' : '');
        pill.textContent = tone.label;
        pill.type = 'button';
        if (idx === 0) activePill = pill;

        pill.addEventListener('click', () => {
            if (activePill) activePill.classList.remove('active');
            pill.classList.add('active');
            activePill = pill;
            toneSelect.value = tone.value;
        });
        tonePills.appendChild(pill);
    });

    toneSection.appendChild(toneLabel);
    toneSection.appendChild(tonePills);
    toneSection.appendChild(toneSelect);

    // Hidden model select (single model, no UI needed)
    const modelSelect = document.createElement('select');
    modelSelect.className = 'linkedin-comment-generator-model-select';
    modelSelect.style.display = 'none';
    GPT_MODELS.MODELS.forEach(model => {
        const option = document.createElement('option');
        option.value = model.value;
        option.textContent = model.label;
        option.selected = true;
        modelSelect.appendChild(option);
    });

    // ── Comment Output ──
    const commentLabel = document.createElement('div');
    commentLabel.className = 'lcg-section-label';
    commentLabel.textContent = 'Generated Comment';

    const commentSection = document.createElement('div');
    commentSection.style.cssText = 'margin-bottom: 6px;';

    const commentBoxContainer = document.createElement('div');
    commentBoxContainer.style.cssText = 'position:relative;';

    const commentBox = document.createElement('textarea');
    commentBox.readOnly = true;
    commentBox.placeholder = 'Click "Generate" to create your AI comment...';
    commentBox.className = 'lcg-textarea';

    // Status text for loading
    const statusText = document.createElement('div');
    statusText.className = 'lcg-status-text';
    statusText.style.display = 'none';

    const charCount = document.createElement('div');
    charCount.className = 'lcg-char-count';
    charCount.textContent = '';

    const LINKEDIN_CHAR_LIMIT = 1250;
    commentBox.addEventListener('input', () => {
        const len = commentBox.value.length;
        if (len === 0) {
            charCount.textContent = '';
            charCount.style.color = '#9ca3af';
        } else if (len > LINKEDIN_CHAR_LIMIT) {
            charCount.textContent = `${len}/${LINKEDIN_CHAR_LIMIT} — too long for LinkedIn!`;
            charCount.style.color = '#ef4444';
        } else if (len > LINKEDIN_CHAR_LIMIT * 0.9) {
            charCount.textContent = `${len}/${LINKEDIN_CHAR_LIMIT} characters`;
            charCount.style.color = '#f59e0b';
        } else {
            charCount.textContent = `${len} character${len !== 1 ? 's' : ''}`;
            charCount.style.color = '#9ca3af';
        }
    });

    // Copy button inside textarea
    const copyButton = document.createElement('button');
    copyButton.className = 'lcg-action-btn';
    copyButton.title = 'Copy to clipboard';
    copyButton.style.cssText = 'position:absolute;top:8px;right:8px;padding:4px 8px;font-size:11px;z-index:1;opacity:0;transition:opacity 0.2s;';
    copyButton.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;

    commentBoxContainer.addEventListener('mouseenter', () => {
        if (commentBox.value && !commentBox.classList.contains('loading')) copyButton.style.opacity = '1';
    });
    commentBoxContainer.addEventListener('mouseleave', () => { copyButton.style.opacity = '0'; });

    copyButton.addEventListener('click', () => {
        if (!commentBox.value) return;
        navigator.clipboard.writeText(commentBox.value).then(() => {
            copyButton.className = 'lcg-action-btn success';
            copyButton.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
            showToast('Comment copied to clipboard!', 'success');
            setTimeout(() => {
                copyButton.className = 'lcg-action-btn';
                copyButton.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
            }, 2000);
        }).catch(() => {
            commentBox.select();
            document.execCommand('copy');
            showToast('Comment copied!', 'success');
        });
    });

    commentBoxContainer.appendChild(commentBox);
    commentBoxContainer.appendChild(copyButton);
    commentSection.appendChild(commentLabel);
    commentSection.appendChild(commentBoxContainer);
    commentSection.appendChild(statusText);
    commentSection.appendChild(charCount);

    // ── Action bar (copy + paste buttons, shown after generation) ──
    const actionBar = document.createElement('div');
    actionBar.className = 'lcg-action-bar';
    actionBar.style.display = 'none';

    const actionCopyBtn = document.createElement('button');
    actionCopyBtn.className = 'lcg-action-btn';
    actionCopyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
    actionCopyBtn.addEventListener('click', () => {
        if (!commentBox.value) return;
        navigator.clipboard.writeText(commentBox.value).then(() => {
            actionCopyBtn.className = 'lcg-action-btn success';
            actionCopyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
            showToast('Copied to clipboard!', 'success');
            setTimeout(() => {
                actionCopyBtn.className = 'lcg-action-btn';
                actionCopyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
            }, 2000);
        }).catch(() => { commentBox.select(); document.execCommand('copy'); });
    });

    const pasteBtn = document.createElement('button');
    pasteBtn.className = 'lcg-action-btn primary';
    pasteBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> Paste to Comment`;
    pasteBtn.addEventListener('click', () => {
        if (!commentBox.value) return;
        // Find LinkedIn's comment input box
        const commentInputSelectors = [
            '.ql-editor[data-placeholder]',
            '.ql-editor',
            '.comments-comment-box__form .ql-editor',
            '.editor-content .ql-editor',
            '[contenteditable="true"][role="textbox"]',
            'div[data-placeholder="Add a comment…"]',
        ];
        let targetInput = null;
        // Walk up from the container to find the nearest comment section
        let ancestor = container.parentElement;
        for (let i = 0; i < 10 && ancestor; i++) {
            for (const sel of commentInputSelectors) {
                targetInput = ancestor.querySelector(sel);
                if (targetInput) break;
            }
            if (targetInput) break;
            ancestor = ancestor.parentElement;
        }
        if (!targetInput) {
            // Broader search
            for (const sel of commentInputSelectors) {
                const all = document.querySelectorAll(sel);
                if (all.length > 0) { targetInput = all[all.length - 1]; break; }
            }
        }
        if (targetInput) {
            targetInput.focus();
            // Safe insertion — avoid innerHTML with AI-generated text
            targetInput.textContent = '';
            commentBox.value.split('\n').forEach((line, i) => {
                const p = document.createElement('p');
                p.textContent = line;
                targetInput.appendChild(p);
            });
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
            pasteBtn.className = 'lcg-action-btn success';
            pasteBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Pasted!`;
            showToast('Comment pasted! Review and post.', 'success');
            setTimeout(() => {
                pasteBtn.className = 'lcg-action-btn primary';
                pasteBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> Paste to Comment`;
            }, 2500);
        } else {
            showToast('Could not find comment box. Click on the comment area first.', 'error');
        }
    });

    actionBar.appendChild(actionCopyBtn);
    actionBar.appendChild(pasteBtn);

    // ── Hint Input ──
    const hintContainer = document.createElement('div');
    hintContainer.style.cssText = 'margin-bottom: 16px; position: relative; display: none;';

    const hintIcon = document.createElement('span');
    hintIcon.innerHTML = '💡';
    hintIcon.style.cssText = 'position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px;pointer-events:none;';

    const hintInput = document.createElement('input');
    hintInput.type = 'text';
    hintInput.placeholder = 'Refine: e.g., mention AI, keep it short, add a question...';
    hintInput.className = 'lcg-hint-input';

    // Submit hint on Enter
    hintInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !regenerateBtn.disabled) {
            e.preventDefault();
            regenerateBtn.click();
        }
    });

    hintContainer.appendChild(hintIcon);
    hintContainer.appendChild(hintInput);

    // ── Generate Button ──
    const regenerateBtn = document.createElement('button');
    regenerateBtn.className = 'lcg-generate-btn';
    regenerateBtn.innerHTML = `<span style="font-size:16px;">✨</span> Generate Comment`;

    const loadingMessages = [
        '🔍 Reading the post...',
        '🧠 Crafting your comment...',
        '✍️ Polishing the response...',
    ];

    regenerateBtn.addEventListener('click', async () => {
        if (isGenerating) return;
        isGenerating = true;

        const content = extractPostContent(post);
        debug.log('Extracted post content for comment generation', content);

        // Show loading state
        commentBox.value = '';
        commentBox.readOnly = true;
        commentBox.classList.remove('has-content', 'error');
        commentBox.classList.add('loading');
        regenerateBtn.disabled = true;
        regenerateBtn.innerHTML = `<span class="lcg-loading-dots"><span></span><span></span><span></span></span> Generating...`;
        charCount.textContent = '';
        actionBar.style.display = 'none';
        progressBar.style.display = 'block';
        progressBar.style.animation = 'none';
        void progressBar.offsetHeight;
        progressBar.style.animation = 'lcg-progressBar 15s ease-out forwards, lcg-shimmer 1.5s infinite';

        // Rotate loading messages
        statusText.style.display = 'block';
        statusText.textContent = loadingMessages[0];
        let msgIdx = 0;
        const msgInterval = setInterval(() => {
            msgIdx = (msgIdx + 1) % loadingMessages.length;
            statusText.textContent = loadingMessages[msgIdx];
        }, 3000);

        try {
            const hint = hintInput.value.trim();
            const tone = toneSelect.value;
            const model = modelSelect.value;

            try {
                const comment = await generateCommentAPI(content, hint, tone, model);
                clearInterval(msgInterval);
                commentBox.classList.remove('loading');
                commentBox.classList.add('has-content');
                statusText.style.display = 'none';
                progressBar.style.display = 'none';

                // Typing animation
                commentBox.value = '';
                const typingSpeed = Math.max(8, Math.min(25, 2000 / comment.length));
                let charIdx = 0;
                await new Promise(resolve => {
                    const typeInterval = setInterval(() => {
                        const chunk = Math.min(3, comment.length - charIdx);
                        commentBox.value += comment.substring(charIdx, charIdx + chunk);
                        charIdx += chunk;
                        commentBox.scrollTop = commentBox.scrollHeight;
                        if (charIdx >= comment.length) {
                            clearInterval(typeInterval);
                            resolve();
                        }
                    }, typingSpeed);
                });

                const clen = comment.length;
            if (clen > LINKEDIN_CHAR_LIMIT) {
                charCount.textContent = `${clen}/${LINKEDIN_CHAR_LIMIT} — too long for LinkedIn!`;
                charCount.style.color = '#ef4444';
            } else if (clen > LINKEDIN_CHAR_LIMIT * 0.9) {
                charCount.textContent = `${clen}/${LINKEDIN_CHAR_LIMIT} characters`;
                charCount.style.color = '#f59e0b';
            } else {
                charCount.textContent = `${clen} character${clen !== 1 ? 's' : ''}`;
                charCount.style.color = '#9ca3af';
            }
                commentBox.readOnly = false;
                hintContainer.style.display = 'block';
                actionBar.style.display = 'flex';
            } catch (apiError) {
                clearInterval(msgInterval);
                debug.error('API generation failed', apiError);
                commentBox.classList.remove('loading');
                commentBox.classList.add('error');
                statusText.style.display = 'none';
                progressBar.style.display = 'none';
                commentBox.value = `Error: ${apiError.message || 'Could not generate comment.'}\n\nTip: Check your connection and try again.`;
                showToast('Generation failed. Please try again.', 'error');
            }
        } catch (error) {
            clearInterval(msgInterval);
            debug.error('Error in comment generation process', error);
            commentBox.classList.remove('loading');
            commentBox.classList.add('error');
            statusText.style.display = 'none';
            progressBar.style.display = 'none';
            commentBox.value = `Error: ${error.message || 'Unknown error occurred.'}`;
            showToast('Something went wrong.', 'error');
        }

        regenerateBtn.disabled = false;
        regenerateBtn.innerHTML = `<span style="font-size:16px;">🔄</span> Regenerate`;
        isGenerating = false;
    });

    // ── Helper: paste text to LinkedIn comment box ──
    function pasteToLinkedIn(text) {
        const selectors = [
            '.ql-editor[data-placeholder]', '.ql-editor',
            '.comments-comment-box__form .ql-editor',
            '[contenteditable="true"][role="textbox"]',
            'div[data-placeholder="Add a comment\u2026"]',
        ];
        let target = null;
        let ancestor = container.parentElement;
        for (let i = 0; i < 10 && ancestor; i++) {
            for (const sel of selectors) {
                target = ancestor.querySelector(sel);
                if (target) break;
            }
            if (target) break;
            ancestor = ancestor.parentElement;
        }
        if (!target) {
            for (const sel of selectors) {
                const all = document.querySelectorAll(sel);
                if (all.length > 0) { target = all[all.length - 1]; break; }
            }
        }
        if (target) {
            target.focus();
            // Safe insertion — avoid innerHTML with AI-generated text
            target.textContent = '';
            text.split('\n').forEach(line => {
                const p = document.createElement('p');
                p.textContent = line;
                target.appendChild(p);
            });
            target.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        }
        return false;
    }

    // ══════════════════════════════════
    // ══  MODE TOGGLE                ══
    // ══════════════════════════════════
    const modeToggle = document.createElement('div');
    modeToggle.className = 'lcg-mode-toggle';

    const writeModeBtn = document.createElement('button');
    writeModeBtn.className = 'lcg-mode-btn active';
    writeModeBtn.type = 'button';
    writeModeBtn.innerHTML = '<span>✍️</span> Write Comment';

    const replyModeBtn = document.createElement('button');
    replyModeBtn.className = 'lcg-mode-btn';
    replyModeBtn.type = 'button';
    replyModeBtn.innerHTML = '<span>💬</span> Reply to Comment';

    modeToggle.appendChild(writeModeBtn);
    modeToggle.appendChild(replyModeBtn);

    const writeModePanel = document.createElement('div');
    writeModePanel.id = 'lcg-write-mode';

    const replyModePanel = document.createElement('div');
    replyModePanel.id = 'lcg-reply-mode';
    replyModePanel.style.display = 'none';

    writeModeBtn.addEventListener('click', () => {
        writeModeBtn.classList.add('active');
        replyModeBtn.classList.remove('active');
        writeModePanel.style.display = '';
        replyModePanel.style.display = 'none';
    });

    replyModeBtn.addEventListener('click', () => {
        replyModeBtn.classList.add('active');
        writeModeBtn.classList.remove('active');
        replyModePanel.style.display = '';
        writeModePanel.style.display = 'none';
        // Auto-fill post context from current post
        if (!replyPostCtx.value && post) {
            try {
                const extracted = extractPostContent(post);
                if (extracted) replyPostCtx.value = extracted;
            } catch (e) {}
        }
    });

    // ══════════════════════════════════
    // ══  REPLY MODE ELEMENTS        ══
    // ══════════════════════════════════

    // ── Reply: Post Context ──
    const replyPostCtxGroup = document.createElement('div');
    replyPostCtxGroup.className = 'lcg-input-group';
    const replyPostCtxLabel = document.createElement('div');
    replyPostCtxLabel.className = 'lcg-input-label';
    replyPostCtxLabel.innerHTML = '📄 Post Context <span class="lcg-optional">(recommended)</span>';
    const replyPostCtx = document.createElement('textarea');
    replyPostCtx.className = 'lcg-text-input';
    replyPostCtx.rows = 2;
    replyPostCtx.placeholder = 'Your original post content (auto-filled if available)...';
    replyPostCtxGroup.appendChild(replyPostCtxLabel);
    replyPostCtxGroup.appendChild(replyPostCtx);

    // ── Reply: Comment to Reply ──
    const replyCommentGroup = document.createElement('div');
    replyCommentGroup.className = 'lcg-input-group';
    const replyCommentLabel = document.createElement('div');
    replyCommentLabel.className = 'lcg-input-label';
    replyCommentLabel.innerHTML = '💬 Comment to Reply <span style="color:#ef4444;font-size:12px;">*</span>';
    const replyCommentInput = document.createElement('textarea');
    replyCommentInput.className = 'lcg-text-input';
    replyCommentInput.rows = 2;
    replyCommentInput.placeholder = 'Paste the comment you want to reply to...';
    replyCommentGroup.appendChild(replyCommentLabel);
    replyCommentGroup.appendChild(replyCommentInput);

    // ── Reply: Commenter Name ──
    const replyNameGroup = document.createElement('div');
    replyNameGroup.className = 'lcg-input-group';
    const replyNameLabel = document.createElement('div');
    replyNameLabel.className = 'lcg-input-label';
    replyNameLabel.innerHTML = '👤 Commenter\'s Name <span class="lcg-optional">(optional)</span>';
    const replyNameInput = document.createElement('input');
    replyNameInput.type = 'text';
    replyNameInput.className = 'lcg-text-input';
    replyNameInput.style.resize = 'none';
    replyNameInput.placeholder = 'e.g., Arjun';
    replyNameGroup.appendChild(replyNameLabel);
    replyNameGroup.appendChild(replyNameInput);

    // ── Reply: Tone ──
    const replyToneSection = document.createElement('div');
    replyToneSection.style.cssText = 'margin-bottom: 12px;';
    const replyToneLabel = document.createElement('div');
    replyToneLabel.className = 'lcg-section-label';
    replyToneLabel.textContent = 'Tone';
    const replyTonePills = document.createElement('div');
    replyTonePills.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';

    const replyTones = [
        { value: 'professional', label: 'Professional 💼' },
        { value: 'friendly', label: 'Friendly 😊' },
        { value: 'supportive', label: 'Supportive 🤝' },
        { value: 'insightful', label: 'Insightful 💡' },
        { value: 'inquisitive', label: 'Inquisitive ❓' },
        { value: 'celebratory', label: 'Celebratory 🎉' }
    ];

    let activeReplyTone = null;
    let replyToneValue = 'professional';
    replyTones.forEach((tone, idx) => {
        const pill = document.createElement('button');
        pill.className = 'lcg-tone-pill' + (idx === 0 ? ' active' : '');
        pill.textContent = tone.label;
        pill.type = 'button';
        if (idx === 0) activeReplyTone = pill;
        pill.addEventListener('click', () => {
            if (activeReplyTone) activeReplyTone.classList.remove('active');
            pill.classList.add('active');
            activeReplyTone = pill;
            replyToneValue = tone.value;
        });
        replyTonePills.appendChild(pill);
    });
    replyToneSection.appendChild(replyToneLabel);
    replyToneSection.appendChild(replyTonePills);

    // ── Reply: Reply Type ──
    const replyTypeSection = document.createElement('div');
    replyTypeSection.style.cssText = 'margin-bottom: 12px;';
    const replyTypeLabel = document.createElement('div');
    replyTypeLabel.className = 'lcg-section-label';
    replyTypeLabel.textContent = 'Reply Type';
    const replyTypePills = document.createElement('div');
    replyTypePills.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';

    const replyTypes = [
        { value: 'thank', label: '🙏 Thank' },
        { value: 'answer-question', label: '💡 Answer Question' },
        { value: 'add-insight', label: '🧠 Add Insight' },
        { value: 'appreciate', label: '❤️ Appreciate' },
        { value: 'continue', label: '🔄 Continue Chat' }
    ];

    let activeReplyType = null;
    let replyTypeValue = 'thank';
    replyTypes.forEach((rt, idx) => {
        const pill = document.createElement('button');
        pill.className = 'lcg-reply-type-pill' + (idx === 0 ? ' active' : '');
        pill.textContent = rt.label;
        pill.type = 'button';
        if (idx === 0) activeReplyType = pill;
        pill.addEventListener('click', () => {
            if (activeReplyType) activeReplyType.classList.remove('active');
            pill.classList.add('active');
            activeReplyType = pill;
            replyTypeValue = rt.value;
        });
        replyTypePills.appendChild(pill);
    });
    replyTypeSection.appendChild(replyTypeLabel);
    replyTypeSection.appendChild(replyTypePills);

    // ── Reply: Reply Length ──
    const replyLengthSection = document.createElement('div');
    replyLengthSection.style.cssText = 'margin-bottom: 16px;';
    const replyLengthLabel = document.createElement('div');
    replyLengthLabel.className = 'lcg-section-label';
    replyLengthLabel.textContent = 'Reply Length';
    const replyLengthPills = document.createElement('div');
    replyLengthPills.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';

    const replyLengths = [
        { value: 'short', label: '📝 Short (1 sentence)' },
        { value: 'medium', label: '📄 Medium (2-3 sentences)' },
        { value: 'detailed', label: '📋 Detailed (4-5 sentences)' }
    ];

    let activeReplyLength = null;
    let replyLengthValue = 'medium';
    replyLengths.forEach((rl, idx) => {
        const pill = document.createElement('button');
        pill.className = 'lcg-length-pill' + (idx === 1 ? ' active' : '');
        pill.textContent = rl.label;
        pill.type = 'button';
        if (idx === 1) activeReplyLength = pill;
        pill.addEventListener('click', () => {
            if (activeReplyLength) activeReplyLength.classList.remove('active');
            pill.classList.add('active');
            activeReplyLength = pill;
            replyLengthValue = rl.value;
        });
        replyLengthPills.appendChild(pill);
    });
    replyLengthSection.appendChild(replyLengthLabel);
    replyLengthSection.appendChild(replyLengthPills);

    // ── Reply: Generate Button ──
    const generateReplyBtn = document.createElement('button');
    generateReplyBtn.className = 'lcg-generate-btn';
    generateReplyBtn.innerHTML = '<span style="font-size:16px;">💬</span> Generate 3 Replies';

    // Reply status + suggestions container
    const replyStatusText = document.createElement('div');
    replyStatusText.className = 'lcg-status-text';
    replyStatusText.style.display = 'none';

    const suggestionsContainer = document.createElement('div');
    suggestionsContainer.style.cssText = 'margin-top: 14px;';

    // Helper: regenerate a single reply
    async function regenerateSingleReply() {
        const lengthMap = { short: '1 sentence', medium: '2-3 sentences', detailed: '4-5 sentences' };
        const rtMap = {
            'thank': 'Thank them genuinely',
            'answer-question': 'Answer their question',
            'add-insight': 'Add a valuable insight',
            'appreciate': 'Show appreciation',
            'continue': 'Continue the conversation'
        };
        const cap = [
            '[REPLY TO COMMENT ON MY POST]',
            replyPostCtx.value.trim() ? `My post: "${replyPostCtx.value.trim()}"` : '',
            `Comment${replyNameInput.value.trim() ? ` from ${replyNameInput.value.trim()}` : ''}: "${replyCommentInput.value.trim()}"`
        ].filter(Boolean).join('\n');
        const h = [
            `Reply intent: ${rtMap[replyTypeValue] || 'Reply naturally'}.`,
            `Length: ${lengthMap[replyLengthValue] || '2-3 sentences'}.`,
            replyNameInput.value.trim() ? `Include "${replyNameInput.value.trim()}" naturally.` : '',
            'Be conversational for LinkedIn. Avoid generic phrases. Try a unique approach.'
        ].filter(Boolean).join(' ');
        return generateCommentAPI(cap, h, replyToneValue, modelSelect.value);
    }

    // Helper: build suggestion card
    function createSuggestionCard(text, index) {
        const card = document.createElement('div');
        card.className = 'lcg-suggestion-card';
        card.style.animationDelay = (index * 0.1) + 's';

        const cardHeader = document.createElement('div');
        cardHeader.style.cssText = 'display:flex;align-items:flex-start;gap:10px;';

        const num = document.createElement('span');
        num.className = 'lcg-suggestion-num';
        num.textContent = index + 1;

        const textDiv = document.createElement('div');
        textDiv.className = 'lcg-suggestion-text';
        textDiv.textContent = text;

        cardHeader.appendChild(num);
        cardHeader.appendChild(textDiv);

        const actions = document.createElement('div');
        actions.className = 'lcg-suggestion-actions';

        // Copy
        const cpBtn = document.createElement('button');
        cpBtn.className = 'lcg-action-btn';
        cpBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
        cpBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(textDiv.textContent).then(() => {
                cpBtn.className = 'lcg-action-btn success';
                cpBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
                showToast('Reply copied!', 'success');
                setTimeout(() => {
                    cpBtn.className = 'lcg-action-btn';
                    cpBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
                }, 2000);
            }).catch(() => showToast('Reply copied!', 'success'));
        });

        // Paste to comment box
        const psBtn = document.createElement('button');
        psBtn.className = 'lcg-action-btn primary';
        psBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> Paste`;
        psBtn.addEventListener('click', () => {
            if (pasteToLinkedIn(textDiv.textContent)) {
                psBtn.className = 'lcg-action-btn success';
                psBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg> Pasted!`;
                showToast('Reply pasted! Review and post.', 'success');
                setTimeout(() => {
                    psBtn.className = 'lcg-action-btn primary';
                    psBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> Paste`;
                }, 2500);
            } else {
                showToast('Click the comment area first, then try again.', 'error');
            }
        });

        // Regenerate single
        const rgBtn = document.createElement('button');
        rgBtn.className = 'lcg-action-btn';
        rgBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> Redo`;
        rgBtn.addEventListener('click', async () => {
            rgBtn.disabled = true;
            rgBtn.innerHTML = `<span class="lcg-loading-dots"><span></span><span></span><span></span></span>`;
            textDiv.style.opacity = '0.4';
            try {
                const newReply = await regenerateSingleReply();
                textDiv.textContent = newReply;
                textDiv.style.opacity = '1';
                showToast('Reply refreshed!', 'success');
            } catch (err) {
                textDiv.style.opacity = '1';
                showToast('Regeneration failed.', 'error');
            }
            rgBtn.disabled = false;
            rgBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> Redo`;
        });

        actions.appendChild(cpBtn);
        actions.appendChild(psBtn);
        actions.appendChild(rgBtn);

        card.appendChild(cardHeader);
        card.appendChild(actions);
        return card;
    }

    // ── Reply: Generate handler ──
    generateReplyBtn.addEventListener('click', async () => {
        const commentText = replyCommentInput.value.trim();
        if (!commentText) {
            showToast('Please enter the comment you want to reply to.', 'error');
            replyCommentInput.focus();
            replyCommentInput.style.borderColor = '#ef4444';
            setTimeout(() => { replyCommentInput.style.borderColor = ''; }, 2000);
            return;
        }

        generateReplyBtn.disabled = true;
        generateReplyBtn.innerHTML = `<span class="lcg-loading-dots"><span></span><span></span><span></span></span> Generating Replies...`;
        suggestionsContainer.innerHTML = '';
        progressBar.style.display = 'block';
        progressBar.style.animation = 'none';
        void progressBar.offsetHeight;
        progressBar.style.animation = 'lcg-progressBar 20s ease-out forwards, lcg-shimmer 1.5s infinite';

        const replyLoadingMsgs = [
            '🔍 Analyzing the comment...',
            '🧠 Crafting reply suggestions...',
            '✍️ Polishing replies...',
            '🎯 Adding personal touches...',
        ];
        replyStatusText.style.display = 'block';
        replyStatusText.textContent = replyLoadingMsgs[0];
        let rIdx = 0;
        const rInterval = setInterval(() => {
            rIdx = (rIdx + 1) % replyLoadingMsgs.length;
            replyStatusText.textContent = replyLoadingMsgs[rIdx];
        }, 2500);

        try {
            const postContext = replyPostCtx.value.trim();
            const commenterName = replyNameInput.value.trim();
            const replies = await generateReplyAPI(postContext, commentText, commenterName, replyToneValue, replyTypeValue, replyLengthValue, modelSelect.value);

            clearInterval(rInterval);
            replyStatusText.style.display = 'none';
            progressBar.style.display = 'none';

            const sugLabel = document.createElement('div');
            sugLabel.className = 'lcg-section-label';
            sugLabel.textContent = `\u2705 ${replies.length} Suggestion${replies.length !== 1 ? 's' : ''}`;
            suggestionsContainer.appendChild(sugLabel);

            replies.forEach((reply, idx) => {
                suggestionsContainer.appendChild(createSuggestionCard(reply, idx));
            });

            showToast(`${replies.length} reply suggestions ready!`, 'success');
        } catch (error) {
            clearInterval(rInterval);
            replyStatusText.style.display = 'none';
            progressBar.style.display = 'none';
            suggestionsContainer.innerHTML = `<div style="text-align:center;padding:20px;color:#ef4444;font-size:13px;background:#fef2f2;border-radius:10px;border:1px solid #fecaca;">\u274C ${error.message || 'Failed to generate replies'}</div>`;
            showToast('Reply generation failed.', 'error');
        }

        generateReplyBtn.disabled = false;
        generateReplyBtn.innerHTML = '<span style="font-size:16px;">🔄</span> Regenerate All Replies';
    });

    // ── Footer ──
    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top: 14px; padding-top: 12px; border-top: 1px solid #f0f0f0; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 10px; color: #b0b0b0;';
    footer.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Powered by Nemotron Super 120B`;

    // ── Assemble ──
    // Write mode panel
    writeModePanel.appendChild(toneSection);
    writeModePanel.appendChild(commentSection);
    writeModePanel.appendChild(actionBar);
    writeModePanel.appendChild(hintContainer);
    writeModePanel.appendChild(regenerateBtn);

    // Reply mode panel
    replyModePanel.appendChild(replyPostCtxGroup);
    replyModePanel.appendChild(replyCommentGroup);
    replyModePanel.appendChild(replyNameGroup);
    replyModePanel.appendChild(replyToneSection);
    replyModePanel.appendChild(replyTypeSection);
    replyModePanel.appendChild(replyLengthSection);
    replyModePanel.appendChild(generateReplyBtn);
    replyModePanel.appendChild(replyStatusText);
    replyModePanel.appendChild(suggestionsContainer);

    body.appendChild(modeToggle);
    body.appendChild(writeModePanel);
    body.appendChild(replyModePanel);
    body.appendChild(modelSelect);
    body.appendChild(footer);

    container.appendChild(header);
    container.appendChild(progressBar);
    container.appendChild(body);

    return container;
}

// Create the Generate Comment button
function createGenerateButton() {
    const button = document.createElement('button');
    button.innerHTML = `<span class="lcg-btn-icon">✨</span> Generate Comment`;
    button.className = 'linkedin-comment-generator-button';
    button.setAttribute('data-lcg-processed', 'true');
    button.style.cssText = `
        background: linear-gradient(135deg, #0a66c2 0%, #004182 100%);
        color: white;
        border: none;
        border-radius: 24px;
        padding: 8px 18px;
        margin: 0 4px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 700;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        min-width: 160px;
        text-align: center;
        box-shadow: 0 2px 10px rgba(10,102,194,0.3);
        transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
        position: relative;
        overflow: hidden;
        letter-spacing: 0.2px;
    `;

    // Add styles for the button icon animation
    if (!document.getElementById('lcg-btn-styles')) {
        const style = document.createElement('style');
        style.id = 'lcg-btn-styles';
        style.textContent = `
            .linkedin-comment-generator-button .lcg-btn-icon {
                display: inline-block;
                font-size: 14px;
                transition: transform 0.3s ease;
            }
            .linkedin-comment-generator-button:hover .lcg-btn-icon {
                animation: lcg-sparkle 1.2s infinite;
            }
            @keyframes lcg-sparkle {
                0% { transform: rotate(0deg) scale(1); }
                25% { transform: rotate(15deg) scale(1.15); }
                50% { transform: rotate(0deg) scale(1); }
                75% { transform: rotate(-15deg) scale(1.15); }
                100% { transform: rotate(0deg) scale(1); }
            }
            .linkedin-comment-generator-button::after {
                content: '';
                position: absolute;
                top: -50%;
                left: -50%;
                width: 200%;
                height: 200%;
                background: linear-gradient(
                    115deg,
                    transparent 30%,
                    rgba(255,255,255,0.18) 50%,
                    transparent 70%
                );
                transform: translateX(-100%);
                transition: transform 0.6s ease;
            }
            .linkedin-comment-generator-button:hover::after {
                transform: translateX(100%);
            }
        `;
        document.head.appendChild(style);
    }

    button.onmouseover = () => {
        button.style.transform = 'translateY(-2px) scale(1.02)';
        button.style.boxShadow = '0 6px 20px rgba(10,102,194,0.45)';
    };

    button.onmouseout = () => {
        button.style.transform = 'translateY(0) scale(1)';
        button.style.boxShadow = '0 2px 10px rgba(10,102,194,0.3)';
    };

    return button;
}

// Find posts and add buttons
function addButtonsToPosts() {
    try {
        // Cleanup before adding new buttons
        cleanupDuplicateButtons();
        
        // Find LinkedIn posts with different possible selectors
        const postSelectors = [
            // Feed posts
            '.feed-shared-update-v2',
            '.occludable-update',
            // Article posts
            '.feed-shared-article',
            // Any post-like element
            '.feed-shared-update',
            '.update-components-actor',
            '.update-components-article',
            '.update-components-image',
            '.feed-shared-external-video',
            '.feed-shared-text'
        ];
        
        let allPosts = [];
        
        // Try each selector
        for (const selector of postSelectors) {
            const posts = document.querySelectorAll(selector);
            if (posts.length > 0) {
                debug.log(`Found ${posts.length} posts with selector: ${selector}`);
                allPosts = [...allPosts, ...posts];
            }
        }
        
        // Make posts unique
        allPosts = [...new Set(allPosts)];
        debug.log(`Processing ${allPosts.length} total posts`);
        
        let buttonsAdded = 0;
        
        // Process each post
        allPosts.forEach(post => {
            // Get a unique ID for this post
            const postId = getPostId(post);
            
            // Skip if already processed
            if (processedPostIds.has(postId)) return;
            
            // Skip if not commentable
            if (!isCommentable(post)) {
                debug.log(`Skipping post ${postId} - not commentable`);
                return;
            }
            
            // Skip if no content
            if (!hasContent(post)) {
                debug.log(`Skipping post ${postId} - no meaningful content`);
                return;
            }
            
            // Check if the button already exists somewhere in this post
            if (post.querySelector('.linkedin-comment-generator-button')) {
                addProcessedId(postId);
                return;
            }
            
            // First try to find the social actions toolbar
            const actionSelectors = [
                '.feed-shared-social-actions', 
                '.social-details-social-actions',
                '.update-v2-social-actions',
                '.feed-shared-social-action-bar',
                '.artdeco-card__actions',
                '.feed-shared-social-counts'
            ];
            
            let actionBar = null;
            for (const selector of actionSelectors) {
                const actionBars = post.querySelectorAll(selector);
                if (actionBars.length > 0) {
                    for (const bar of actionBars) {
                        // Look for any visible action bar
                        if (bar.offsetParent !== null) {
                            actionBar = bar;
                            break;
                        }
                    }
                    if (actionBar) break;
                }
            }
            
            if (actionBar) {
                // Try to find a good placement
                let buttonAdded = false;
                
                // First try: Look for the comment button
                const commentBtn = actionBar.querySelector('button[aria-label*="comment" i], .comment-button, [role="button"]');
                if (commentBtn) {
                    // Find a parent element that might be a list item
                    let commentItem = commentBtn;
                    for (let i = 0; i < 3; i++) { // Look up to 3 levels up
                        if (commentItem.tagName === 'LI' || commentItem.getAttribute('role') === 'listitem') {
                            break;
                        }
                        if (commentItem.parentNode) {
                            commentItem = commentItem.parentNode;
                        } else {
                            break;
                        }
                    }
                    
                    if (commentItem && commentItem.parentNode) {
                        // Create a container similar to other action buttons
                        const buttonContainer = document.createElement('li');
                        buttonContainer.className = 'linkedin-comment-generator-container';
                        buttonContainer.setAttribute('data-lcg-post-id', postId);
                        buttonContainer.style.cssText = `
                            display: inline-flex;
                            align-items: center;
                            margin: 0 4px;
                        `;
                        
                        // Create the button
                        const button = createGenerateButton();
                        
                        // Add click handler
                        button.addEventListener('click', (e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            
                            // Remove any existing comment UI
                            if (activeCommentUI) {
                                activeCommentUI.remove();
                                activeCommentUI = null;
                            }
                            
                            // Hide the generate button
                            button.style.display = 'none';
                            
                            // Create and add comment UI - add it after the action bar
                            const commentUI = createCommentUI(post, button);
                            actionBar.parentNode.insertBefore(commentUI, actionBar.nextSibling);
                            activeCommentUI = commentUI;
                            
                            // Auto-generate initial comment
                            const regenerateBtn = commentUI.querySelector('.lcg-generate-btn');
                            if (regenerateBtn) {
                                regenerateBtn.click();
                            }
                        });
                        
                        // Add button to container
                        buttonContainer.appendChild(button);
                        
                        // Add container next to the comment button
                        const parentElement = commentItem.parentNode;
                        parentElement.appendChild(buttonContainer);
                        
                        addProcessedId(postId);
                        buttonAdded = true;
                        buttonsAdded++;
                        debug.log(`Added button to post ${postId} next to comment button`);
                    }
                }
                
                // Second try: Just append to the action bar
                if (!buttonAdded) {
                    // Create a direct button container
                    const buttonContainer = document.createElement('div');
                    buttonContainer.className = 'linkedin-comment-generator-container';
                    buttonContainer.setAttribute('data-lcg-post-id', postId);
                    buttonContainer.style.cssText = `
                        display: inline-flex;
                        align-items: center;
                        margin: 0 8px;
                    `;
                    
                    // Create the button
                    const button = createGenerateButton();
                    
                    // Add click handler
                    button.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        
                        // Remove any existing comment UI
                        if (activeCommentUI) {
                            activeCommentUI.remove();
                            activeCommentUI = null;
                        }
                        
                        // Hide the generate button
                        button.style.display = 'none';
                        
                        // Create and add comment UI
                        const commentUI = createCommentUI(post, button);
                        actionBar.parentNode.insertBefore(commentUI, actionBar.nextSibling);
                        activeCommentUI = commentUI;
                        
                        // Auto-generate initial comment
                        const regenerateBtn = commentUI.querySelector('.lcg-generate-btn');
                        if (regenerateBtn) {
                            regenerateBtn.click();
                        }
                    });
                    
                    // Add button to container
                    buttonContainer.appendChild(button);
                    
                    // Append to action bar
                    actionBar.appendChild(buttonContainer);
                    
                    addProcessedId(postId);
                    buttonAdded = true;
                    buttonsAdded++;
                    debug.log(`Added button to post ${postId} directly to action bar`);
                }
                
                if (buttonAdded) {
                    // Skip the fallback button placement
                    addProcessedId(postId);
                    return;
                }
            }
            
            // Fallback placement: Add to the bottom of the post
            const button = createGenerateButton();
            
            // Make it full width for the fallback case
            button.style.display = 'block';
            button.style.width = 'calc(100% - 32px)';
            button.style.margin = '12px auto';
            button.style.padding = '8px 16px';
            
            // Add click handler
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                // Remove any existing comment UI
                if (activeCommentUI) {
                    activeCommentUI.remove();
                    activeCommentUI = null;
                }
                
                // Hide the generate button
                button.style.display = 'none';
                
                // Create and add comment UI
                const commentUI = createCommentUI(post, button);
                button.parentNode.insertBefore(commentUI, button.nextSibling);
                activeCommentUI = commentUI;
                
                // Auto-generate initial comment
                const regenerateBtn = commentUI.querySelector('.lcg-generate-btn');
                if (regenerateBtn) {
                    regenerateBtn.click();
                }
            });
            
            // Create a container for our fallback button
            const container = document.createElement('div');
            container.className = 'linkedin-comment-generator-fallback';
            container.setAttribute('data-lcg-post-id', postId);
            container.style.cssText = `
                padding: 0 16px;
                margin: 8px 0;
            `;
            container.appendChild(button);
            
            // Add to the post
            post.appendChild(container);
            addProcessedId(postId);
            buttonsAdded++;
            debug.log(`Added fallback button to post ${postId}`);
        });
        
        debug.log(`Added ${buttonsAdded} buttons in total`);
    } catch (error) {
        debug.error('Error adding buttons', error);
    }
}

// Clean up any duplicate buttons
function cleanupDuplicateButtons() {
    try {
        // Get all buttons
        const buttons = document.querySelectorAll('.linkedin-comment-generator-button');
        debug.log(`Found ${buttons.length} total buttons during cleanup`);
        
        const buttonsByPost = new Map();
        
        // Group buttons by their parent post
        buttons.forEach(button => {
            const post = button.closest('.feed-shared-update-v2, .occludable-update, [data-urn], .feed-shared-update, .artdeco-card');
            if (!post) return;
            
            const postId = getPostId(post);
            if (!buttonsByPost.has(postId)) {
                buttonsByPost.set(postId, []);
            }
            buttonsByPost.get(postId).push(button);
        });
        
        // For each post, keep only the first button
        buttonsByPost.forEach((buttonsArray, postId) => {
            if (buttonsArray.length > 1) {
                debug.log(`Found ${buttonsArray.length} buttons for post ${postId}, removing duplicates`);
                // Keep the first button, remove the rest
                for (let i = 1; i < buttonsArray.length; i++) {
                    // Remove the parent container if it has our class
                    const container = buttonsArray[i].closest('.linkedin-comment-generator-container, .linkedin-comment-generator-fallback');
                    if (container) {
                        container.remove();
                    } else {
                        buttonsArray[i].remove();
                    }
                }
            }
        });
        
        // Remove buttons from non-commentable or content-less posts
        const allButtons = document.querySelectorAll('.linkedin-comment-generator-button');
        allButtons.forEach(button => {
            const post = button.closest('.feed-shared-update-v2, .occludable-update, [data-urn], .feed-shared-update, .artdeco-card');
            if (post) {
                if (!isCommentable(post)) {
                    const container = button.closest('.linkedin-comment-generator-container, .linkedin-comment-generator-fallback');
                    if (container) {
                        container.remove();
                    } else {
                        button.remove();
                    }
                    debug.log(`Removed button from non-commentable post`);
                }
                else if (!hasContent(post)) {
                    const container = button.closest('.linkedin-comment-generator-container, .linkedin-comment-generator-fallback');
                    if (container) {
                        container.remove();
                    } else {
                        button.remove();
                    }
                    debug.log(`Removed button from post without meaningful content`);
                }
            }
        });
    } catch (error) {
        debug.error('Error cleaning up duplicate buttons', error);
    }
}

// Function to paste comment into LinkedIn's comment box
async function pasteComment(comment) {
    debug.log('Attempting to paste comment');
    if (debug.isDebugMode) debug.showVisualFeedback('Starting comment paste process', null, 'info');
    
    try {
        // Find and click the comment button first
        const commentButtonSelectors = [
            'button[aria-label*="comment"]',
            'button.comment-button',
            '.comment-button',
            '[aria-label*="Comment"]',
            '[data-control-name="comment"]',
            'button[aria-label*="Add a comment"]',
            '[role="button"][aria-label*="comment"]'
        ];
        
        let commentButton = null;
        for (const selector of commentButtonSelectors) {
            const buttons = document.querySelectorAll(selector);
            for (const button of buttons) {
                // Check if button is visible
                if (button.offsetParent !== null) {
                    commentButton = button;
                    if (debug.isDebugMode) debug.showVisualFeedback(`Found comment button with selector: ${selector}`, button, 'success');
                    break;
                }
            }
            if (commentButton) break;
        }
        
        if (commentButton) {
            debug.log('Found comment button, clicking it');
            commentButton.click();
            // Wait longer for comment box to appear, LinkedIn can be slow
            await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
            if (debug.isDebugMode) debug.showVisualFeedback('No comment button found!', null, 'error');
        }
        
        // Try to find the comment box
        const commentBoxSelectors = [
            'div[contenteditable="true"]',
            'div[role="textbox"]',
            'div.comments-comment-box-comment__text-editor',
            'div.ql-editor',
            'div[data-placeholder="Add a comment…"]',
            '[aria-label*="comment" i][contenteditable="true"]',
            '[aria-label*="Comment" i][role="textbox"]',
            'div.comments-comment-box__content-editor',
            'div.editor-content',
            'p[data-placeholder="Add a comment…"]',
            '[data-test-id*="comment-box"]'
        ];
        
        let commentBox = null;
        let usedSelector = '';
        for (const selector of commentBoxSelectors) {
            const elements = document.querySelectorAll(selector);
            
            for (const element of elements) {
                if (element.offsetParent !== null) { // Check if element is visible
                    commentBox = element;
                    usedSelector = selector;
                    debug.log('Found comment box', element);
                    if (debug.isDebugMode) debug.showVisualFeedback(`Found comment box with selector: ${selector}`, element, 'success');
                    break;
                }
            }
            if (commentBox) break;
        }
        
        if (!commentBox) {
            debug.error('Could not find comment box');
            if (debug.isDebugMode) debug.showVisualFeedback('Comment box not found!', null, 'error');
            
            // One more attempt: Look for any editable elements that appeared after clicking comment
            const editableElements = document.querySelectorAll('[contenteditable="true"], [role="textbox"]');
            for (const element of editableElements) {
                if (element.offsetParent !== null) {
                    commentBox = element;
                    debug.log('Found potential comment box via editable element search', element);
                    if (debug.isDebugMode) debug.showVisualFeedback('Found potential comment box via fallback search', element, 'warning');
                    break;
                }
            }
            
            if (!commentBox) {
            return false;
            }
        }
        
        debug.log('Comment box details', {
            tagName: commentBox.tagName,
            className: commentBox.className,
            id: commentBox.id,
            contentEditable: commentBox.contentEditable,
            role: commentBox.getAttribute('role'),
            selector: usedSelector
        });
        
        // Focus on the comment box multiple times to ensure LinkedIn registers it
        commentBox.focus();
        commentBox.click();
        await new Promise(resolve => setTimeout(resolve, 300));
        commentBox.focus();
        
        // Clear any existing content
        commentBox.innerHTML = '';
        
        // Log the browser info
        debug.log('Browser info', {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            vendor: navigator.vendor
        });
        
        // === APPROACH 1: Clipboard API ===
        let success = false;
        
        try {
            // Try clipboard approach first
            debug.log('Trying clipboard paste approach');
            if (debug.isDebugMode) debug.showVisualFeedback('Trying clipboard paste approach', commentBox, 'info');
            
            await navigator.clipboard.writeText(comment);
            
            // Use keyboard shortcut to paste (Cmd+V or Ctrl+V)
            const isMac = navigator.platform.indexOf('Mac') !== -1;
            const metaKey = isMac ? true : false;
            const ctrlKey = !isMac;
            
            commentBox.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'v',
                code: 'KeyV',
                ctrlKey: ctrlKey,
                metaKey: metaKey,
                bubbles: true
            }));
            
            // Also try execCommand as backup
            document.execCommand('paste');
            
            await new Promise(resolve => setTimeout(resolve, 300));
            debug.log('Tried clipboard paste approach');
            
            // Check if paste worked
            if (commentBox.textContent || commentBox.innerText) {
                success = true;
                if (debug.isDebugMode) debug.showVisualFeedback('Clipboard paste successful!', commentBox, 'success');
            } else {
                if (debug.isDebugMode) debug.showVisualFeedback('Clipboard paste failed', commentBox, 'error');
            }
        } catch (clipboardError) {
            debug.error('Clipboard paste failed', clipboardError);
            if (debug.isDebugMode) debug.showVisualFeedback(`Clipboard error: ${clipboardError.message}`, null, 'error');
        }
        
        // === APPROACH 2: Direct text insertion ===
        if (!success) {
            try {
                debug.log('Trying direct text insertion');
                if (debug.isDebugMode) debug.showVisualFeedback('Trying direct text insertion', commentBox, 'info');
                
        commentBox.textContent = comment;
        
                if (!commentBox.textContent) {
                    commentBox.innerText = comment;
                }
                
                if (!commentBox.textContent && !commentBox.innerText) {
                    const textNode = document.createTextNode(comment);
                    commentBox.appendChild(textNode);
                }
                
                // Check if direct insertion worked
                if (commentBox.textContent || commentBox.innerText) {
                    success = true;
                    if (debug.isDebugMode) debug.showVisualFeedback('Direct text insertion successful!', commentBox, 'success');
                } else {
                    if (debug.isDebugMode) debug.showVisualFeedback('Direct text insertion failed', commentBox, 'error');
                }
            } catch (textError) {
                debug.error('Direct text insertion failed', textError);
                if (debug.isDebugMode) debug.showVisualFeedback(`Text insertion error: ${textError.message}`, null, 'error');
            }
        }
        
        // === APPROACH 3: InputEvent simulation ===
        if (!success) {
            try {
                debug.log('Trying InputEvent simulation');
                if (debug.isDebugMode) debug.showVisualFeedback('Trying InputEvent simulation', commentBox, 'info');
                
                // Clear content again to be safe
                commentBox.innerHTML = '';
                
                // Use modern InputEvent to simulate typing
                commentBox.dispatchEvent(new InputEvent('input', {
                    inputType: 'insertText',
                    data: comment,
                    bubbles: true,
                    cancelable: true
                }));
                
                // Check if input event approach worked
                if (commentBox.textContent || commentBox.innerText) {
                    success = true;
                    if (debug.isDebugMode) debug.showVisualFeedback('InputEvent simulation successful!', commentBox, 'success');
                } else {
                    // Try execCommand as last resort
                    document.execCommand('insertText', false, comment);
                    
                    if (commentBox.textContent || commentBox.innerText) {
                        success = true;
                        if (debug.isDebugMode) debug.showVisualFeedback('execCommand insertText successful!', commentBox, 'success');
                    } else {
                        if (debug.isDebugMode) debug.showVisualFeedback('InputEvent and execCommand failed', commentBox, 'error');
                    }
                }
            } catch (inputError) {
                debug.error('InputEvent simulation failed', inputError);
                if (debug.isDebugMode) debug.showVisualFeedback(`InputEvent error: ${inputError.message}`, null, 'error');
            }
        }
        
        // === APPROACH 4: Character-by-character simulation ===
        if (!success) {
            try {
                debug.log('Trying character-by-character typing');
                if (debug.isDebugMode) debug.showVisualFeedback('Trying character-by-character typing', commentBox, 'info');
                
                // Clear content again
                commentBox.innerHTML = '';
                commentBox.focus();
                
                // Simulate typing character by character
                for (let i = 0; i < comment.length; i++) {
                    const char = comment.charAt(i);
                    
                    // Dispatch events for each character
                    commentBox.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
                    commentBox.dispatchEvent(new InputEvent('beforeinput', { 
                        inputType: 'insertText',
                        data: char,
                        bubbles: true
                    }));
                    
                    // Actually insert the character
                    document.execCommand('insertText', false, char);
                    
                    commentBox.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
                    commentBox.dispatchEvent(new InputEvent('input', { 
                        inputType: 'insertText',
                        data: char,
                        bubbles: true
                    }));
                    
                    // Small delay to simulate realistic typing
                    if (i % 5 === 0 && i > 0) {
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }
                }
                
                // Check if character simulation worked
                if (commentBox.textContent || commentBox.innerText) {
                    success = true;
                    if (debug.isDebugMode) debug.showVisualFeedback('Character-by-character typing successful!', commentBox, 'success');
                } else {
                    if (debug.isDebugMode) debug.showVisualFeedback('Character-by-character typing failed', commentBox, 'error');
                }
            } catch (charError) {
                debug.error('Character simulation failed', charError);
                if (debug.isDebugMode) debug.showVisualFeedback(`Character simulation error: ${charError.message}`, null, 'error');
            }
        }
        
        // Dispatch necessary events to trigger LinkedIn's UI update
        const events = ['input', 'change', 'blur', 'focus'];
        events.forEach(eventType => {
            commentBox.dispatchEvent(new Event(eventType, { bubbles: true }));
        });
        
        // Log what's in the comment box
        debug.log('Comment box content after insertion attempts', {
            textContent: commentBox.textContent,
            innerText: commentBox.innerText,
            innerHTML: commentBox.innerHTML.substring(0, 100) + (commentBox.innerHTML.length > 100 ? '...' : '')
        });
        
        // Try to find a "post" or "submit" button if pasting succeeded
        if (success) {
            debug.log('Comment insertion succeeded, looking for post button');
            if (debug.isDebugMode) debug.showVisualFeedback('Text inserted successfully! Looking for post button...', null, 'success');
            
            // Short wait to ensure LinkedIn's UI has processed the input
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Try to find and click the post button
            const postButtonSelectors = [
                'button[aria-label*="Post"]',
                'button[aria-label*="post"]',
                'button.comments-comment-box__submit-button',
                'button.artdeco-button--primary',
                'button.comments-comment-box-comment__submit-button',
                'button.artdeco-button[type="submit"]'
            ];
            
            let postButton = null;
            let postButtonSelector = '';
            for (const selector of postButtonSelectors) {
                const buttons = document.querySelectorAll(selector);
                for (const button of buttons) {
                    if (button.offsetParent !== null && 
                        (button.textContent.includes('Post') || 
                         button.getAttribute('aria-label')?.includes('Post'))) {
                        postButton = button;
                        postButtonSelector = selector;
                        break;
                    }
                }
                if (postButton) break;
            }
            
            if (postButton && !postButton.disabled) {
                debug.log('Found post button, clicking it');
                if (debug.isDebugMode) debug.showVisualFeedback(`Found post button with selector: ${postButtonSelector}`, postButton, 'success');
                postButton.click();
                await new Promise(resolve => setTimeout(resolve, 500));
            } else {
                debug.log('No post button found or button is disabled');
                if (debug.isDebugMode) debug.showVisualFeedback('No post button found or button is disabled', null, 'warning');
            }
        } else {
            if (debug.isDebugMode) debug.showVisualFeedback('All text insertion methods failed!', null, 'error');
        }
        
        return success;
    } catch (error) {
        debug.error('Error in pasteComment', error);
        if (debug.isDebugMode) debug.showVisualFeedback(`Paste comment error: ${error.message}`, null, 'error');
        return false;
    }
}

// Alternative approach to insert comments directly
async function directCommentInsertion(comment, post) {
    debug.log('Attempting direct comment insertion approach');
    
    try {
        // Try to find the closest comment section to the post
        const commentSections = document.querySelectorAll('.comments-comment-box, .comments-comments-list, [data-test-id*="comments-section"]');
        let closestCommentSection = null;
        let minDistance = Infinity;
        
        // Find comment section closest to the post
        const postRect = post.getBoundingClientRect();
        for (const section of commentSections) {
            const sectionRect = section.getBoundingClientRect();
            const distance = Math.abs(sectionRect.top - postRect.bottom);
            if (distance < minDistance) {
                minDistance = distance;
                closestCommentSection = section;
            }
        }
        
        if (!closestCommentSection) {
            debug.log('No comment section found near post, looking for any comment section');
            // Try to find any comment section that's visible
            for (const section of commentSections) {
                if (section.offsetParent !== null) {
                    closestCommentSection = section;
                    break;
                }
            }
        }
        
        if (!closestCommentSection) {
            debug.error('Could not find any comment section');
            return false;
        }
        
        debug.log('Found comment section', closestCommentSection);
        
        // First try: Look for existing comment button and click it
        const commentBtns = post.querySelectorAll('button[aria-label*="comment" i], [data-control-name="comment"]');
        for (const btn of commentBtns) {
            if (btn.offsetParent !== null) {
                debug.log('Clicking comment button in post');
                btn.click();
                await new Promise(resolve => setTimeout(resolve, 2000));
                break;
            }
        }
        
        // Look for the comment box within the comment section
        const commentBoxSelectors = [
            'div[contenteditable="true"]', 
            'div[role="textbox"]',
            '[data-placeholder="Add a comment…"]',
            '.comments-comment-texteditor',
            'p[contenteditable="true"]'
        ];
        
        let commentBox = null;
        
        // First try in the comment section
        for (const selector of commentBoxSelectors) {
            const boxes = closestCommentSection.querySelectorAll(selector);
            for (const box of boxes) {
                if (box.offsetParent !== null) {
                    commentBox = box;
                    break;
                }
            }
            if (commentBox) break;
        }
        
        // If not found, try in the entire document but within view
        if (!commentBox) {
            for (const selector of commentBoxSelectors) {
                const boxes = document.querySelectorAll(selector);
                for (const box of boxes) {
                    if (box.offsetParent !== null) {
                        const rect = box.getBoundingClientRect();
                        // Check if visible in viewport
                        if (rect.top >= 0 && rect.left >= 0 && 
                            rect.bottom <= window.innerHeight && 
                            rect.right <= window.innerWidth) {
                            commentBox = box;
                            break;
                        }
                    }
                }
                if (commentBox) break;
            }
        }
        
        if (!commentBox) {
            debug.error('Could not find comment box in direct insertion approach');
            return false;
        }
        
        debug.log('Found comment box in direct approach', commentBox);
        
        // Focus the comment box multiple times
        commentBox.focus();
        await new Promise(resolve => setTimeout(resolve, 300));
        commentBox.click();
        await new Promise(resolve => setTimeout(resolve, 300));
        commentBox.focus();
        
        // Try different insertion methods
        let success = false;
        
        // Method 1: Set innerHTML
        try {
            commentBox.innerHTML = '';
            commentBox.innerHTML = comment;
            await new Promise(resolve => setTimeout(resolve, 300));
            
            if (commentBox.textContent.includes(comment)) {
                success = true;
            }
        } catch (err) {
            debug.error('innerHTML insertion failed', err);
        }
        
        // Method 2: Direct property assignment
        if (!success) {
            try {
                commentBox.textContent = comment;
                await new Promise(resolve => setTimeout(resolve, 300));
                
                if (commentBox.textContent.includes(comment)) {
                    success = true;
                }
            } catch (err) {
                debug.error('textContent insertion failed', err);
            }
        }
        
        // Method 3: Word-by-word insertion
        if (!success) {
            try {
                commentBox.innerHTML = '';
                const words = comment.split(' ');
                
                for (const word of words) {
                    // Type word
                    document.execCommand('insertText', false, word + ' ');
                    commentBox.dispatchEvent(new Event('input', { bubbles: true }));
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                
                if (commentBox.textContent.includes(comment.substring(0, 20))) {
                    success = true;
                }
            } catch (err) {
                debug.error('Word-by-word insertion failed', err);
            }
        }
        
        // Method 4: Selection-based insertion
        if (!success) {
            try {
                // Create a text selection in the comment box
                const range = document.createRange();
                range.selectNodeContents(commentBox);
                
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                
                // Delete any existing content
                document.execCommand('delete');
                
                // Insert the new text
                document.execCommand('insertText', false, comment);
                
                if (commentBox.textContent.includes(comment.substring(0, 20))) {
                    success = true;
                }
            } catch (err) {
                debug.error('Selection-based insertion failed', err);
            }
        }
        
        if (success) {
            debug.log('Successfully inserted comment text, looking for post button');
            
            // Trigger necessary events
            ['input', 'change', 'keyup', 'blur', 'focus'].forEach(evt => {
                commentBox.dispatchEvent(new Event(evt, { bubbles: true }));
            });
            
            // Look for a post/submit button
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const postButtonSelectors = [
                'button[aria-label*="Post"]',
                'button[aria-label*="post"]',
                'button.comments-comment-box__submit-button',
                'button.artdeco-button--primary',
                'button.comments-comment-box-comment__submit-button',
                'button.artdeco-button[type="submit"]'
            ];
            
            let postButton = null;
            // First look near the comment box
            const commentBoxParent = commentBox.closest('form, div.comments-comment-box, div.comments-comment-texteditor');
            
            if (commentBoxParent) {
                for (const selector of postButtonSelectors) {
                    const buttons = commentBoxParent.querySelectorAll(selector);
                    for (const button of buttons) {
                        if (button.offsetParent !== null && 
                            !button.disabled &&
                            (!button.hasAttribute('disabled') || button.getAttribute('disabled') !== 'true')) {
                            postButton = button;
                            break;
                        }
                    }
                    if (postButton) break;
                }
            }
            
            // If not found, look within a reasonable distance from the comment box
            if (!postButton) {
                for (const selector of postButtonSelectors) {
                    const buttons = document.querySelectorAll(selector);
                    for (const button of buttons) {
                        if (button.offsetParent !== null && 
                            !button.disabled &&
                            (!button.hasAttribute('disabled') || button.getAttribute('disabled') !== 'true')) {
                            const buttonRect = button.getBoundingClientRect();
                            const commentBoxRect = commentBox.getBoundingClientRect();
                            const distance = Math.sqrt(
                                Math.pow(buttonRect.left - commentBoxRect.right, 2) + 
                                Math.pow(buttonRect.top - commentBoxRect.bottom, 2)
                            );
                            
                            // Only consider buttons that are reasonably close to the comment box
                            if (distance < 300) {
                                postButton = button;
                                break;
                            }
                        }
                    }
                    if (postButton) break;
                }
            }
            
            if (postButton) {
                debug.log('Found post button, clicking it', postButton);
                postButton.click();
                return true;
            } else {
                debug.log('Comment text inserted, but no post button found. User may need to press Enter to submit.');
                
                // As a last resort, try simulating Enter key press
                commentBox.dispatchEvent(new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true
                }));
                
                return true;
            }
        }
        
        return false;
    } catch (error) {
        debug.error('Error in direct comment insertion', error);
        return false;
    }
}

// Add this new function below the existing directCommentInsertion function
async function simpleTypeComment(comment) {
    debug.log('Attempting enhanced simple type approach for comment insertion');
    
    try {
        // First, try to find and click the comment button
        const commentButtonSelectors = [
            'button[aria-label*="comment" i]',
            '[data-control-name="comment"]',
            '[role="button"][aria-label*="comment" i]',
            'button.comment-button',
            '.comment-button',
            'button[aria-label*="Add a comment"]',
            'button[aria-label*="Reply"]',
            '[data-control-name="reply"]'
        ];
        
        let foundButton = false;
        for (const selector of commentButtonSelectors) {
            const buttons = document.querySelectorAll(selector);
            for (const btn of buttons) {
                if (btn.offsetParent !== null) {
                    debug.log('Clicking comment button:', selector);
                    btn.click();
                    foundButton = true;
                    // Wait for comment box to appear
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    break;
                }
            }
            if (foundButton) break;
        }
        
        if (!foundButton) {
            debug.error('No comment button found');
            return false;
        }
        
        // Now find the comment box with enhanced selectors
        const commentBoxSelectors = [
            '[contenteditable="true"]',
            '[role="textbox"]',
            '[data-placeholder="Add a comment…"]',
            '[data-placeholder="Reply…"]',
            '[aria-label*="Add a comment" i]',
            '[aria-label*="Write a comment" i]',
            '[aria-label*="Add your comment" i]',
            '.ql-editor',
            '.editor-content',
            'div.comments-comment-box__content-editor',
            // Add more modern LinkedIn comment box selectors
            'div.comments-comment-texteditor__content',
            'div.comments-comment-box-comment__text-editor',
            'div[role="textbox"][data-test-id*="comment-box"]'
        ];
        
        let commentBox = null;
        for (const selector of commentBoxSelectors) {
            const boxes = document.querySelectorAll(selector);
            for (const box of boxes) {
                if (box.offsetParent !== null) {
                    commentBox = box;
                    debug.log('Found comment box:', selector);
                    break;
                }
            }
            if (commentBox) break;
        }
        
        if (!commentBox) {
            debug.error('No comment box found after clicking comment button');
            return false;
        }
        
        // Focus and prepare the comment box
        commentBox.focus();
        commentBox.click();
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Clear existing content
        commentBox.innerHTML = '';
        
        // Enhanced character typing with multiple fallback methods
        const typeCharacter = async (char) => {
            return new Promise(resolve => {
                setTimeout(async () => {
                    try {
                        // Method 1: Use execCommand
                        document.execCommand('insertText', false, char);
                        
                        // Method 2: Create and insert text node if needed
                        if (!commentBox.textContent.includes(char)) {
                            const range = document.createRange();
                            const sel = window.getSelection();
                            range.selectNodeContents(commentBox);
                            range.collapse(false);
                            sel.removeAllRanges();
                            sel.addRange(range);
                            
                            const textNode = document.createTextNode(char);
                            range.insertNode(textNode);
                            
                            // Move selection to end
                            range.setStartAfter(textNode);
                            range.collapse(true);
                            sel.removeAllRanges();
                            sel.addRange(range);
                        }
                        
                        // Method 3: Simulate keyboard events
                        commentBox.dispatchEvent(new KeyboardEvent('keydown', {
                            key: char,
                            code: `Key${char.toUpperCase()}`,
                            bubbles: true
                        }));
                        
                        commentBox.dispatchEvent(new InputEvent('beforeinput', {
                            inputType: 'insertText',
                            data: char,
                            bubbles: true
                        }));
                        
                        commentBox.dispatchEvent(new InputEvent('input', {
                            inputType: 'insertText',
                            data: char,
                            bubbles: true
                        }));
                        
                        commentBox.dispatchEvent(new KeyboardEvent('keyup', {
                            key: char,
                            code: `Key${char.toUpperCase()}`,
                            bubbles: true
                        }));
                        
                        // Fire input event to notify LinkedIn
                        commentBox.dispatchEvent(new Event('input', { bubbles: true }));
                        commentBox.dispatchEvent(new Event('change', { bubbles: true }));
                        
                        resolve();
                    } catch (err) {
                        debug.error(`Error typing character: ${char}`, err);
                        resolve();
                    }
                }, 50); // Small delay between characters
            });
        };
        
        // Type each character with enhanced error handling
        for (let i = 0; i < comment.length; i++) {
            await typeCharacter(comment[i]);
        }
        
        debug.log('Comment typing completed');
        
        // Wait for LinkedIn to process the input
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Enhanced post button detection
        const postButtonSelectors = [
            'button[aria-label*="Post" i]',
            'button[aria-label*="post" i]',
            'button[aria-label*="Reply" i]',
            'button[aria-label*="reply" i]',
            'button.comments-comment-box__submit-button',
            'button.artdeco-button[type="submit"]',
            'button.artdeco-button--primary',
            // Modern LinkedIn post button selectors
            'button.comments-comment-box-comment__submit-button',
            'button.comments-comment-texteditor__button',
            'button.artdeco-button--4',
            'button.artdeco-button--1',
            'button.ml2',
            'button.comments-comment-box__submit'
        ];
        
        let postButton = null;
        for (const selector of postButtonSelectors) {
            const buttons = document.querySelectorAll(selector);
            for (const button of buttons) {
                // Check if button is visible and enabled
                if (button.offsetParent !== null && !button.disabled) {
                    // Check if it's near our comment box (in the same container or close by)
                    const buttonRect = button.getBoundingClientRect();
                    const commentBoxRect = commentBox.getBoundingClientRect();
                    
                    // Button should be below or to the right of the comment box and within reasonable distance
                    const isRelated = (
                        buttonRect.top >= commentBoxRect.top - 50 && 
                        buttonRect.bottom <= commentBoxRect.bottom + 100 && 
                        buttonRect.left >= commentBoxRect.left - 50
                    ) || button.closest('form') === commentBox.closest('form');
                    
                    if (isRelated) {
                        postButton = button;
                        debug.log('Found related post button:', button);
                        break;
                    }
                }
            }
            if (postButton) break;
        }
        
        // Step 6: Click the post button or simulate Enter key
        if (postButton) {
            debug.log('Clicking post button');
            postButton.click();
            return true;
        } else {
            debug.log('No post button found, trying Enter key');
            // Simulate pressing Enter key
            commentBox.focus();
            commentBox.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true
            }));
            
            // Also try both ctrl+Enter and shift+Enter as some platforms use these
            await new Promise(resolve => setTimeout(resolve, 300));
            commentBox.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                ctrlKey: true,
                bubbles: true
            }));
            
            await new Promise(resolve => setTimeout(resolve, 300));
            commentBox.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                shiftKey: true,
                bubbles: true
            }));
            
            return true;
        }
    } catch (error) {
        debug.error('Error in enhanced simple type approach', error);
        return false;
    }
}

// Add this new function for a reliable direct method of comment insertion
async function forceCommentInsertion(comment) {
    debug.log('Attempting FORCE comment insertion method');
    
    try {
        // Step 1: Find and click any visible comment button
        const allCommentButtons = document.querySelectorAll([
            'button[aria-label*="comment" i]', 
            'button.comment-button',
            '[role="button"][aria-label*="comment" i]',
            '[data-control-name="comment"]',
            'button[aria-label*="Add a comment"]',
            'button[aria-label*="Reply"]',
            '.comment-button',
            // Add modern LinkedIn comment button selectors
            'button.comments-post-meta__comment-button',
            'button.social-actions-button[aria-label*="comment" i]',
            'button[type="button"][aria-label*="comment" i]',
            'div[role="button"][aria-label*="comment" i]'
        ].join(','));
        
        let commentButtonClicked = false;
        debug.log(`Found ${allCommentButtons.length} potential comment buttons`);
        
        for (const btn of allCommentButtons) {
            if (btn.offsetParent !== null) {
                debug.log('Clicking visible comment button:', btn);
                btn.click();
                commentButtonClicked = true;
                // Wait for comment box to appear
                await new Promise(resolve => setTimeout(resolve, 1500));
                break;
            }
        }
        
        if (!commentButtonClicked) {
            debug.error('No visible comment button found');
            return false;
        }
        
        // Step 2: Find the comment box that appeared
        const potentialCommentBoxes = document.querySelectorAll([
            '[contenteditable="true"]',
            '[role="textbox"]',
            '[data-placeholder="Add a comment…"]',
            '[data-placeholder="Reply…"]',
            '[aria-label*="Add a comment" i]',
            '[aria-label*="Write a comment" i]',
            '[aria-label*="Add your comment" i]',
            '.ql-editor',
            '.editor-content',
            'div.comments-comment-box__content-editor',
            // Add more modern LinkedIn comment box selectors
            'div.comments-comment-texteditor__content',
            'div.comments-comment-box-comment__text-editor',
            'div[role="textbox"][data-test-id*="comment-box"]'
        ].join(','));
        
        let commentBox = null;
        debug.log(`Found ${potentialCommentBoxes.length} potential comment boxes`);
        
        for (const box of potentialCommentBoxes) {
            // Check if the element is visible and editable
            if (box.offsetParent !== null) {
                // Check if it's actually a comment box by testing if we can focus it
                box.focus();
                if (document.activeElement === box) {
                    commentBox = box;
                    debug.log('Found usable comment box:', box);
                    break;
                }
            }
        }
        
        if (!commentBox) {
            debug.error('No usable comment box found');
            return false;
        }
        
        // Step 3: Focus and clear the comment box
        commentBox.focus();
        commentBox.click();
        
        // Wait for focus to take effect
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Clear existing content
        commentBox.textContent = '';
        commentBox.innerHTML = '';
        
        // Step 4: Insert the comment text (using multiple methods)
        debug.log('Inserting comment text using multiple methods');
        
        // Method 1: Simple text assignment with events
        commentBox.textContent = comment;
        commentBox.dispatchEvent(new Event('input', { bubbles: true }));
        commentBox.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Check if it worked
        if (!commentBox.textContent.includes(comment.substring(0, 10))) {
            debug.log('Method 1 failed, trying Method 2');
            
            // Method 2: execCommand approach
            commentBox.focus();
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
            document.execCommand('insertText', false, comment);
            
            // Check if it worked
            if (!commentBox.textContent.includes(comment.substring(0, 10))) {
                debug.log('Method 2 failed, trying Method 3');
                
                // Method 3: Character by character typing
                commentBox.innerHTML = '';
                for (let i = 0; i < comment.length; i++) {
                    document.execCommand('insertText', false, comment[i]);
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
            }
        }
        
        // Give LinkedIn time to process the text
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Step 5: Look for post/reply button with enhanced selectors
        const postButtonSelectors = [
            'button[aria-label*="Post" i]',
            'button[aria-label*="post" i]',
            'button[aria-label*="Reply" i]',
            'button[aria-label*="reply" i]',
            'button.comments-comment-box__submit-button',
            'button.artdeco-button[type="submit"]',
            'button.artdeco-button--primary',
            // Modern LinkedIn post button selectors
            'button.comments-comment-box-comment__submit-button',
            'button.comments-comment-texteditor__button',
            'button.artdeco-button--4',
            'button.artdeco-button--1',
            'button.ml2',
            'button.comments-comment-box__submit'
        ];
        
        let postButton = null;
        for (const selector of postButtonSelectors) {
            const buttons = document.querySelectorAll(selector);
            for (const button of buttons) {
                // Check if button is visible and enabled
                if (button.offsetParent !== null && !button.disabled) {
                    // Check if it's near our comment box (in the same container or close by)
                    const buttonRect = button.getBoundingClientRect();
                    const commentBoxRect = commentBox.getBoundingClientRect();
                    
                    // Button should be below or to the right of the comment box and within reasonable distance
                    const isRelated = (
                        buttonRect.top >= commentBoxRect.top - 50 && 
                        buttonRect.bottom <= commentBoxRect.bottom + 100 && 
                        buttonRect.left >= commentBoxRect.left - 50
                    ) || button.closest('form') === commentBox.closest('form');
                    
                    if (isRelated) {
                        postButton = button;
                        debug.log('Found related post button:', button);
                        break;
                    }
                }
            }
            if (postButton) break;
        }
        
        // Step 6: Click the post button or simulate Enter key
        if (postButton) {
            debug.log('Clicking post button');
            postButton.click();
            return true;
        } else {
            debug.log('No post button found, trying Enter key');
            // Simulate pressing Enter key
            commentBox.focus();
            commentBox.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true
            }));
            
            // Also try both ctrl+Enter and shift+Enter as some platforms use these
            await new Promise(resolve => setTimeout(resolve, 300));
            commentBox.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                ctrlKey: true,
                bubbles: true
            }));
            
            await new Promise(resolve => setTimeout(resolve, 300));
            commentBox.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                shiftKey: true,
                bubbles: true
            }));
            
            return true;
        }
    } catch (error) {
        debug.error('Force comment insertion failed:', error);
        return false;
    }
}

// Add this new function for an ultra-aggressive comment insertion method
async function ultraForceCommentInsertion(comment) {
    debug.log('Attempting ULTRA-FORCE comment insertion - using all available techniques');
    
    try {
        // STEP 1: Find and click the comment button using ALL possible methods
        let commentButtonClicked = false;
        
        // Method 1: Direct query and click
        const commentButtonSelectors = [
            'button[aria-label*="comment" i]',
            'button.comment-button',
            '[role="button"][aria-label*="comment" i]',
            '[data-control-name="comment"]',
            'button[aria-label*="Add a comment"]',
            'button[aria-label*="Reply"]',
            '.comment-button',
            'button.comments-post-meta__comment-button',
            'button.social-actions-button[aria-label*="comment" i]',
            'button[type="button"][aria-label*="comment" i]',
            'div[role="button"][aria-label*="comment" i]',
            // Most recent LinkedIn selectors
            'button.social-actions__button[aria-label*="comment" i]',
            'div.social-action-button[aria-label*="comment" i]',
            'button.comment-button[type="button"]'
        ];
        
        for (const selector of commentButtonSelectors) {
            if (commentButtonClicked) break;
            
            const buttons = document.querySelectorAll(selector);
            debug.log(`Found ${buttons.length} buttons with selector: ${selector}`);
            
            for (const btn of buttons) {
                if (btn.offsetParent !== null) {
                    // Try multiple ways to click the button
                    try {
                        debug.log('Clicking comment button with direct click', btn);
                        btn.click();
                        
                        // Also try MouseEvent simulation
                        btn.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
                        btn.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
                        btn.dispatchEvent(new MouseEvent('click', {bubbles: true}));
                        
                        commentButtonClicked = true;
                        
                        // Wait for comment box to appear with a slightly randomized delay
                        await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 500));
                        break;
                    } catch (e) {
                        debug.error('Error clicking button', e);
                    }
                }
            }
        }
        
        // Method 2: Use document.evaluate to find comment buttons by text content
        if (!commentButtonClicked) {
            debug.log('Trying XPath to find comment buttons by text');
            const xpathSelectors = [
                "//button[contains(translate(., 'COMMENT', 'comment'), 'comment')]",
                "//div[@role='button' and contains(translate(., 'COMMENT', 'comment'), 'comment')]",
                "//button[contains(@aria-label, 'comment') or contains(@aria-label, 'Comment')]"
            ];
            
            for (const xpath of xpathSelectors) {
                if (commentButtonClicked) break;
                
                try {
                    const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
                    debug.log(`Found ${result.snapshotLength} buttons with XPath: ${xpath}`);
                    
                    for (let i = 0; i < result.snapshotLength; i++) {
                        const btn = result.snapshotItem(i);
                        if (btn && btn.offsetParent !== null) {
                            debug.log('Clicking button found via XPath', btn);
                            btn.click();
                            commentButtonClicked = true;
                            
                            // Wait for comment box to appear
                            await new Promise(resolve => setTimeout(resolve, 1800));
                            break;
                        }
                    }
                } catch (e) {
                    debug.error('XPath error', e);
                }
            }
        }
        
        if (!commentButtonClicked) {
            debug.error('Failed to click any comment button');
            // Continue anyway - the comment box might already be open
        }
        
        // STEP 2: Find the comment box using ALL possible methods
        let commentBox = null;
        
        // Method 1: Try standard selectors
        const commentBoxSelectors = [
            '[contenteditable="true"]',
            '[role="textbox"]',
            '[data-placeholder="Add a comment…"]',
            '[data-placeholder="Reply…"]',
            '[aria-label*="Add a comment" i]',
            '[aria-label*="Write a comment" i]',
            '[aria-label*="Add your comment" i]',
            '.ql-editor',
            '.editor-content',
            'div.comments-comment-box__content-editor',
            'div.comments-comment-texteditor__content',
            'div.comments-comment-box-comment__text-editor',
            'div[role="textbox"][data-test-id*="comment-box"]',
            // Most recent LinkedIn selectors
            'div.editor-container [contenteditable="true"]',
            'div.comments-comment-box-comment__text-editor div[contenteditable="true"]',
            'div.comments-comment-texteditor [contenteditable="true"]'
        ];
        
        for (const selector of commentBoxSelectors) {
            if (commentBox) break;
            
            const boxes = document.querySelectorAll(selector);
            debug.log(`Found ${boxes.length} possible comment boxes with selector: ${selector}`);
            
            for (const box of boxes) {
                if (box.offsetParent !== null) {
                    try {
                        // Test if we can actually focus and write to this element
                        box.focus();
                        if (document.activeElement === box || box.isContentEditable) {
                            commentBox = box;
                            debug.log('Found usable comment box', box);
                            break;
                        }
                    } catch (e) {
                        debug.error('Error testing comment box', e);
                    }
                }
            }
        }
        
        // Method 2: Find visible contenteditable elements that appeared after clicking comment
        if (!commentBox) {
            debug.log('Looking for recently appeared contenteditable elements');
            const editableElements = document.querySelectorAll('[contenteditable="true"], [role="textbox"]');
            
            for (const el of editableElements) {
                if (el.offsetParent !== null) {
                    try {
                        el.focus();
                        await new Promise(resolve => setTimeout(resolve, 200));
                        
                        if (document.activeElement === el) {
                            commentBox = el;
                            debug.log('Found comment box via contenteditable search', el);
                            break;
                        }
                    } catch (e) {
                        debug.error('Error testing editable element', e);
                    }
                }
            }
        }
        
        if (!commentBox) {
            debug.error('Could not find any usable comment box');
            return false;
        }
        
        // STEP 3: Focus and clear the comment box using multiple methods
        debug.log('Preparing comment box for text insertion');
        
        // Method 1: Standard focus and clear
        commentBox.focus();
        commentBox.click();
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Clear content using multiple approaches
        commentBox.textContent = '';
        commentBox.innerHTML = '';
        
        try {
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(commentBox);
            selection.removeAllRanges();
            selection.addRange(range);
            document.execCommand('delete', false, null);
        } catch (e) {
            debug.error('Error clearing comment box with selection', e);
        }
        
        // STEP 4: Insert the comment text using ALL possible methods
        debug.log('Inserting comment text using multiple aggressive methods');
        
        let textInserted = false;
        
        // Method 1: Direct clipboard manipulation
        try {
            debug.log('Attempting clipboard method');
            await navigator.clipboard.writeText(comment);
            
            // Try both Ctrl+V and Command+V for cross-platform
            const isMac = navigator.userAgent.indexOf('Mac') !== -1;
            
            commentBox.focus();
            commentBox.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'v',
                code: 'KeyV',
                ctrlKey: !isMac,
                metaKey: isMac,
                bubbles: true
            }));
            
            // Also try execCommand
            document.execCommand('paste');
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            if (commentBox.textContent.includes(comment.substring(0, 10))) {
                textInserted = true;
                debug.log('Clipboard method successful');
            }
        } catch (e) {
            debug.error('Clipboard method failed', e);
        }
        
        // Method 2: Direct property assignment with events
        if (!textInserted) {
            try {
                debug.log('Attempting direct text assignment');
                commentBox.textContent = comment;
                commentBox.dispatchEvent(new Event('input', { bubbles: true }));
                commentBox.dispatchEvent(new Event('change', { bubbles: true }));
                
                await new Promise(resolve => setTimeout(resolve, 300));
                
                if (commentBox.textContent.includes(comment.substring(0, 10))) {
                    textInserted = true;
                    debug.log('Direct text assignment successful');
                }
            } catch (e) {
                debug.error('Direct text assignment failed', e);
            }
        }
        
        // Method 3: execCommand with selection
        if (!textInserted) {
            try {
                debug.log('Attempting execCommand insertText');
                commentBox.focus();
                document.execCommand('selectAll', false, null);
                document.execCommand('delete', false, null);
                document.execCommand('insertText', false, comment);
                
                await new Promise(resolve => setTimeout(resolve, 300));
                
                if (commentBox.textContent.includes(comment.substring(0, 10))) {
                    textInserted = true;
                    debug.log('execCommand insertText successful');
                }
            } catch (e) {
                debug.error('execCommand insertText failed', e);
            }
        }
        
        // Method 4: Ultra-slow character by character typing with randomized delays
        if (!textInserted) {
            try {
                debug.log('Attempting character-by-character typing');
                commentBox.innerHTML = '';
                commentBox.focus();
                
                // Type character by character with randomized delays
                for (let i = 0; i < comment.length; i++) {
                    // Wait a random amount of time between keypresses
                    await new Promise(resolve => setTimeout(resolve, 10 + Math.random() * 20));
                    
                    // Combine multiple approaches for each character
                    try {
                        // 1. execCommand
                        document.execCommand('insertText', false, comment[i]);
                        
                        // 2. Dispatch events
                        const charCode = comment.charCodeAt(i);
                        commentBox.dispatchEvent(new KeyboardEvent('keydown', {
                            key: comment[i],
                            keyCode: charCode,
                            which: charCode,
                            bubbles: true
                        }));
                        
                        commentBox.dispatchEvent(new InputEvent('beforeinput', {
                            inputType: 'insertText',
                            data: comment[i],
                            bubbles: true
                        }));
                        
                        commentBox.dispatchEvent(new InputEvent('input', {
                            inputType: 'insertText',
                            data: comment[i],
                            bubbles: true
                        }));
                        
                        commentBox.dispatchEvent(new KeyboardEvent('keyup', {
                            key: comment[i],
                            keyCode: charCode,
                            which: charCode,
                            bubbles: true
                        }));
                    } catch (e) {
                        debug.error(`Error typing character ${comment[i]}`, e);
                    }
                }
                
                await new Promise(resolve => setTimeout(resolve, 300));
                
                if (commentBox.textContent.includes(comment.substring(0, 10))) {
                    textInserted = true;
                    debug.log('Character-by-character typing successful');
                }
            } catch (e) {
                debug.error('Character-by-character typing failed', e);
            }
        }
        
        // Method 5: Node insertion as absolute last resort
        if (!textInserted) {
            try {
                debug.log('Attempting text node insertion');
                // Clear existing content
                while (commentBox.firstChild) {
                    commentBox.removeChild(commentBox.firstChild);
                }
                
                // Create a text node and insert it
                const textNode = document.createTextNode(comment);
                commentBox.appendChild(textNode);
                
                // Fire events
                commentBox.dispatchEvent(new Event('input', { bubbles: true }));
                commentBox.dispatchEvent(new Event('change', { bubbles: true }));
                
                await new Promise(resolve => setTimeout(resolve, 300));
                
                if (commentBox.textContent.includes(comment.substring(0, 10))) {
                    textInserted = true;
                    debug.log('Text node insertion successful');
                }
            } catch (e) {
                debug.error('Text node insertion failed', e);
            }
        }
        
        if (!textInserted) {
            debug.error('All text insertion methods failed');
            return false;
        }
        
        // STEP 5: Find the post button using ALL possible methods
        debug.log('Giving LinkedIn time to enable post button');
        // Wait longer to ensure LinkedIn processes the input and enables the Post button
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        let postButton = null;
        
        // Method 1: Use standard selectors and spatial relationship
        const postButtonSelectors = [
            'button[aria-label*="Post" i]',
            'button[aria-label*="post" i]',
            'button[aria-label*="Reply" i]',
            'button[aria-label*="reply" i]',
            'button.comments-comment-box__submit-button',
            'button.artdeco-button[type="submit"]',
            'button.artdeco-button--primary',
            'button.comments-comment-box-comment__submit-button',
            'button.comments-comment-texteditor__button',
            'button.artdeco-button--4',
            'button.artdeco-button--1',
            'button.ml2',
            'button.comments-comment-box__submit',
            // Most recent LinkedIn selectors
            'button.comments-comment-texteditor__controlButton--submit',
            'button.artdeco-button.artdeco-button--4[type="submit"]',
            'button.artdeco-button.artdeco-button--1[type="submit"]'
        ];
        
        for (const selector of postButtonSelectors) {
            if (postButton) break;
            
            const buttons = document.querySelectorAll(selector);
            debug.log(`Found ${buttons.length} possible post buttons with selector: ${selector}`);
            
            for (const button of buttons) {
                // Check if button is visible and enabled
                if (button.offsetParent !== null && !button.disabled) {
                    try {
                        // Check if it's near our comment box or in the same form
                        let isRelated = false;
                        
                        // Method 1: Check for buttons nearby using coordinates
                        const buttonRect = button.getBoundingClientRect();
                        const commentBoxRect = commentBox.getBoundingClientRect();
                        
                        // Should be below or to the right of the comment box and within reasonable distance
                        if (
                            buttonRect.top >= commentBoxRect.top - 100 && 
                            buttonRect.bottom <= commentBoxRect.bottom + 100 && 
                            Math.abs(buttonRect.left - commentBoxRect.right) < 300
                        ) {
                            isRelated = true;
                        }
                        
                        // Method 2: Check ancestor relationships
                        if (!isRelated) {
                            // Find a common container that might be a form or comment component
                            let commentParent = commentBox.parentElement;
                            while (commentParent && !isRelated) {
                                if (commentParent.contains(button)) {
                                    isRelated = true;
                                    break;
                                }
                                commentParent = commentParent.parentElement;
                                
                                // Avoid going too far up
                                if (!commentParent || commentParent === document.body) break;
                            }
                        }
                        
                        // Method 3: Button is in a form with the comment box
                        if (!isRelated && button.closest('form') === commentBox.closest('form')) {
                            isRelated = true;
                        }
                        
                        if (isRelated) {
                            postButton = button;
                            debug.log('Found related post button', button);
                            break;
                        }
                    } catch (e) {
                        debug.error('Error checking post button relationship', e);
                    }
                }
            }
        }
        
        // Method 2: Look for buttons with "Post" or "Reply" text
        if (!postButton) {
            debug.log('Looking for buttons with Post/Reply text');
            const allButtons = document.querySelectorAll('button');
            
            for (const button of allButtons) {
                if (button.offsetParent !== null && !button.disabled) {
                    const buttonText = button.textContent.toLowerCase().trim();
                    if (buttonText === 'post' || buttonText === 'reply') {
                        // Check if it's reasonably close to our comment box
                        const buttonRect = button.getBoundingClientRect();
                        const commentBoxRect = commentBox.getBoundingClientRect();
                        
                        if (Math.abs(buttonRect.left - commentBoxRect.right) < 300 &&
                            Math.abs(buttonRect.top - commentBoxRect.bottom) < 300) {
                            postButton = button;
                            debug.log('Found post button by text content', button);
                            break;
                        }
                    }
                }
            }
        }
        
        // Method 3: Look for any enabled, visible button near the comment box that appeared recently
        if (!postButton) {
            debug.log('Looking for any enabled button near comment box');
            const allButtons = document.querySelectorAll('button');
            
            for (const button of allButtons) {
                if (button.offsetParent !== null && !button.disabled) {
                    // Check if it's close to our comment box
                    const buttonRect = button.getBoundingClientRect();
                    const commentBoxRect = commentBox.getBoundingClientRect();
                    
                    if (buttonRect.bottom >= commentBoxRect.bottom - 50 &&
                        buttonRect.bottom <= commentBoxRect.bottom + 100 &&
                        Math.abs(buttonRect.left - commentBoxRect.right) < 300) {
                        
                        // Check button styles for clues - post buttons are often primary color
                        const style = window.getComputedStyle(button);
                        const backgroundColor = style.backgroundColor.toLowerCase();
                        
                        // LinkedIn's primary button color is often blue or has a solid color
                        if (backgroundColor !== 'transparent' && backgroundColor !== 'rgba(0, 0, 0, 0)') {
                            postButton = button;
                            debug.log('Found possible post button by position and styling', button);
                            break;
                        }
                    }
                }
            }
        }
        
        // STEP 6: Try to submit the comment
        if (postButton) {
            debug.log('Clicking post button using multiple methods');
            
            try {
                // Method 1: Native click
                postButton.click();
                
                // Method 2: MouseEvent simulation
                postButton.dispatchEvent(new MouseEvent('mousedown', {bubbles: true}));
                postButton.dispatchEvent(new MouseEvent('mouseup', {bubbles: true}));
                postButton.dispatchEvent(new MouseEvent('click', {bubbles: true}));
                
                // Wait to see if the comment was posted
                await new Promise(resolve => setTimeout(resolve, 2000));
                return true;
            } catch (e) {
                debug.error('Error clicking post button', e);
            }
        }
        
        // Fallback: Try pressing Enter key in multiple ways
        debug.log('No post button found or button click failed, trying Enter key combinations');
        
        // Ensure comment box is still focused
        commentBox.focus();
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Method 1: Standard Enter
        commentBox.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            bubbles: true
        }));
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Method 2: Ctrl+Enter
        commentBox.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            ctrlKey: true,
            bubbles: true
        }));
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Method 3: Shift+Enter
        commentBox.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            shiftKey: true,
            bubbles: true
        }));
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Method 4: Meta+Enter (Cmd+Enter on Mac)
        commentBox.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Enter',
            code: 'Enter',
            keyCode: 13,
            which: 13,
            metaKey: true,
            bubbles: true
        }));
        
        return true;
    } catch (error) {
        debug.error('Ultra-force comment insertion failed:', error);
        return false;
    }
}

/**
 * Initializes the LinkedIn Comment Generator extension
 * Sets up observers, keyboard shortcuts, and initial button placement
 */
function initialize() {
    debug.log('LinkedIn Comment Generator initializing');
    
    try {
        // Add keyboard shortcut for debug mode
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+D to toggle debug mode
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                debug.toggleDebugMode();
            }
        });
        
        // Initial run with a longer delay to ensure LinkedIn has fully loaded
        setTimeout(() => {
            // Verify API configuration
            if (!API_CONFIG.URL) {
                debug.error('API endpoint not configured. Comment generation will not work.');
            }
            
            // Add comment generator buttons to posts
            addButtonsToPosts();
            
            // Insert a marker to indicate the extension is active
            const marker = document.createElement('div');
            marker.id = 'linkedin-comment-generator-active';
            marker.style.display = 'none';
            document.body.appendChild(marker);
            
            // Add debug indicator if in debug mode
            if (debug.isDebugMode) {
                const debugIndicator = document.createElement('div');
                debugIndicator.textContent = 'Debug Mode';
                debugIndicator.style.cssText = `
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: #f44336;
                    color: white;
                    padding: 5px 10px;
                    border-radius: 4px;
                    z-index: 10000;
                    font-family: Arial, sans-serif;
                    font-size: 12px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                `;
                document.body.appendChild(debugIndicator);
            }
        }, 2000);
        
        // Set up observer for DOM changes to detect new posts
        setupMutationObserver();
        
        // Add diagnostic click handler to help debug issues (only in debug mode)
        document.addEventListener('click', (e) => {
            // Check if user clicked with Alt key pressed (diagnostic mode)
            if (debug.isDebugMode && e.altKey && e.target) {
                const target = e.target;
                debug.log('Diagnostic click on element:', target);
                debug.log('Element classes:', target.className);
                debug.log('Element ID:', target.id);
                debug.log('Element attributes:', Array.from(target.attributes).map(attr => `${attr.name}="${attr.value}"`).join(', '));
            }
        }, true);
    } catch (error) {
        debug.error('Error during initialization', error);
    }
}

/**
 * Sets up mutation observer to detect new posts in the LinkedIn feed
 */
function setupMutationObserver() {
    try {
        // Set up observer for DOM changes
        const observer = new MutationObserver((mutations) => {
            // Only process if we have meaningful DOM changes
            const hasRelevantChanges = mutations.some(mutation => {
                return mutation.addedNodes.length > 0 || 
                      (mutation.target.classList && 
                       (mutation.target.classList.contains('feed-shared-update-v2') || 
                        mutation.target.classList.contains('occludable-update')));
            });
            
            if (hasRelevantChanges) {
                setTimeout(() => {
                    addButtonsToPosts();
                }, 500);
            }
        });
        
        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Also check periodically (LinkedIn loads content dynamically)
        const intervalId = setInterval(() => {
            addButtonsToPosts();
        }, 3000);
        
        // Store interval ID for potential cleanup
        window._linkedInCommentGenerator = window._linkedInCommentGenerator || {};
        window._linkedInCommentGenerator.intervalId = intervalId;
        
        debug.log('Mutation observer and interval set up successfully');
    } catch (error) {
        debug.error('Error setting up mutation observer', error);
    }
}

/**
 * Handles messages from popup or background scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    debug.log('Received message', request);
    
    try {
        if (request.action === 'pasteComment') {
            // No longer used but kept for backward compatibility
            sendResponse({ success: false, error: 'Direct comment pasting is not supported' });
        } else if (request.action === 'diagnose') {
            // Diagnostic information
            const diagnosticInfo = {
                userAgent: navigator.userAgent,
                url: window.location.href,
                extensionActive: !!document.getElementById('linkedin-comment-generator-active'),
                apiConfigured: !!API_CONFIG.URL,
                commentablePostsFound: document.querySelectorAll('[data-lcg-post-id]').length,
                buttonsAdded: document.querySelectorAll('.linkedin-comment-generator-button').length,
                commentBoxesFound: document.querySelectorAll('div[contenteditable="true"], div[role="textbox"]').length
            };
            
            debug.log('Diagnostic info collected', diagnosticInfo);
            sendResponse({ success: true, diagnosticInfo });
        } else if (request.action === 'generateComment') {
            // Called from popup to generate a comment for given content
            const { content, hint, tone } = request;
            if (!content) {
                sendResponse({ success: false, error: 'No content provided' });
            } else {
                generateCommentAPI(content, hint || '', tone || 'professional', 'nemotron-super')
                    .then(comment => sendResponse({ success: true, comment }))
                    .catch(err => sendResponse({ success: false, error: err.message }));
            }
            return true; // async
        } else if (request.action === 'getSelectedPost') {
            // Get the currently viewed post content
            const post = findCurrentPost();
            if (post) {
                const content = extractPostContent(post);
                sendResponse({ success: true, content });
            } else {
                sendResponse({ success: false, error: 'No post found' });
            }
        }
    } catch (error) {
        debug.error('Error handling message', error);
        sendResponse({ success: false, error: error.message });
    }
    
    return true; // Keep the message channel open for async response
});

// Start the extension
initialize(); 