// playwright-helpers.js
// Reusable utility functions for Playwright automation

const { chromium, firefox, webkit } = require('playwright');

/**
 * Parse extra HTTP headers from environment variables.
 * Supports two formats:
 * - PW_HEADER_NAME + PW_HEADER_VALUE: Single header (simple, common case)
 * - PW_EXTRA_HEADERS: JSON object for multiple headers (advanced)
 * Single header format takes precedence if both are set.
 * @returns {Object|null} Headers object or null if none configured
 */
function getExtraHeadersFromEnv() {
  const headerName = process.env.PW_HEADER_NAME;
  const headerValue = process.env.PW_HEADER_VALUE;

  if (headerName && headerValue) {
    return { [headerName]: headerValue };
  }

  const headersJson = process.env.PW_EXTRA_HEADERS;
  if (headersJson) {
    try {
      const parsed = JSON.parse(headersJson);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed;
      }
      console.warn('PW_EXTRA_HEADERS must be a JSON object, ignoring...');
    } catch (e) {
      console.warn('Failed to parse PW_EXTRA_HEADERS as JSON:', e.message);
    }
  }

  return null;
}

/**
 * Launch browser with standard configuration
 * @param {string} browserType - 'chromium', 'firefox', or 'webkit'
 * @param {Object} options - Additional launch options
 */
async function launchBrowser(browserType = 'chromium', options = {}) {
  const defaultOptions = {
    headless: process.env.HEADLESS !== 'false',
    slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : 0,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  };
  
  const browsers = { chromium, firefox, webkit };
  const browser = browsers[browserType];
  
  if (!browser) {
    throw new Error(`Invalid browser type: ${browserType}`);
  }
  
  return await browser.launch({ ...defaultOptions, ...options });
}

/**
 * Create a new page with viewport and user agent
 * @param {Object} context - Browser context
 * @param {Object} options - Page options
 */
async function createPage(context, options = {}) {
  const page = await context.newPage();
  
  if (options.viewport) {
    await page.setViewportSize(options.viewport);
  }
  
  if (options.userAgent) {
    await page.setExtraHTTPHeaders({
      'User-Agent': options.userAgent
    });
  }
  
  // Set default timeout
  page.setDefaultTimeout(options.timeout || 30000);
  
  return page;
}

/**
 * Smart wait for page to be ready
 * @param {Object} page - Playwright page
 * @param {Object} options - Wait options
 */
async function waitForPageReady(page, options = {}) {
  const waitOptions = {
    waitUntil: options.waitUntil || 'networkidle',
    timeout: options.timeout || 30000
  };
  
  try {
    await page.waitForLoadState(waitOptions.waitUntil, { 
      timeout: waitOptions.timeout 
    });
  } catch (e) {
    console.warn('Page load timeout, continuing...');
  }
  
  // Additional wait for dynamic content if selector provided
  if (options.waitForSelector) {
    await page.waitForSelector(options.waitForSelector, { 
      timeout: options.timeout 
    });
  }
}

/**
 * Safe click with retry logic
 * @param {Object} page - Playwright page
 * @param {string} selector - Element selector
 * @param {Object} options - Click options
 */
async function safeClick(page, selector, options = {}) {
  const maxRetries = options.retries || 3;
  const retryDelay = options.retryDelay || 1000;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      await page.waitForSelector(selector, { 
        state: 'visible',
        timeout: options.timeout || 5000 
      });
      await page.click(selector, {
        force: options.force || false,
        timeout: options.timeout || 5000
      });
      return true;
    } catch (e) {
      if (i === maxRetries - 1) {
        console.error(`Failed to click ${selector} after ${maxRetries} attempts`);
        throw e;
      }
      console.log(`Retry ${i + 1}/${maxRetries} for clicking ${selector}`);
      await page.waitForTimeout(retryDelay);
    }
  }
}

/**
 * Safe text input with clear before type
 * @param {Object} page - Playwright page
 * @param {string} selector - Input selector
 * @param {string} text - Text to type
 * @param {Object} options - Type options
 */
async function safeType(page, selector, text, options = {}) {
  await page.waitForSelector(selector, { 
    state: 'visible',
    timeout: options.timeout || 10000 
  });
  
  if (options.clear !== false) {
    await page.fill(selector, '');
  }
  
  if (options.slow) {
    await page.type(selector, text, { delay: options.delay || 100 });
  } else {
    await page.fill(selector, text);
  }
}

/**
 * Extract text from multiple elements
 * @param {Object} page - Playwright page
 * @param {string} selector - Elements selector
 */
async function extractTexts(page, selector) {
  await page.waitForSelector(selector, { timeout: 10000 });
  return await page.$$eval(selector, elements => 
    elements.map(el => el.textContent?.trim()).filter(Boolean)
  );
}

/**
 * Take screenshot with timestamp
 * @param {Object} page - Playwright page
 * @param {string} name - Screenshot name
 * @param {Object} options - Screenshot options
 */
async function takeScreenshot(page, name, options = {}) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${name}-${timestamp}.png`;
  
  await page.screenshot({
    path: filename,
    fullPage: options.fullPage !== false,
    ...options
  });
  
  console.log(`Screenshot saved: ${filename}`);
  return filename;
}

/**
 * Handle authentication
 * @param {Object} page - Playwright page
 * @param {Object} credentials - Username and password
 * @param {Object} selectors - Login form selectors
 */
async function authenticate(page, credentials, selectors = {}) {
  const defaultSelectors = {
    username: 'input[name="username"], input[name="email"], #username, #email',
    password: 'input[name="password"], #password',
    submit: 'button[type="submit"], input[type="submit"], button:has-text("Login"), button:has-text("Sign in")'
  };
  
  const finalSelectors = { ...defaultSelectors, ...selectors };
  
  await safeType(page, finalSelectors.username, credentials.username);
  await safeType(page, finalSelectors.password, credentials.password);
  await safeClick(page, finalSelectors.submit);
  
  // Wait for navigation or success indicator
  await Promise.race([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.waitForSelector(selectors.successIndicator || '.dashboard, .user-menu, .logout', { timeout: 10000 })
  ]).catch(() => {
    console.log('Login might have completed without navigation');
  });
}

/**
 * Scroll page
 * @param {Object} page - Playwright page
 * @param {string} direction - 'down', 'up', 'top', 'bottom'
 * @param {number} distance - Pixels to scroll (for up/down)
 */
async function scrollPage(page, direction = 'down', distance = 500) {
  switch (direction) {
    case 'down':
      await page.evaluate(d => window.scrollBy(0, d), distance);
      break;
    case 'up':
      await page.evaluate(d => window.scrollBy(0, -d), distance);
      break;
    case 'top':
      await page.evaluate(() => window.scrollTo(0, 0));
      break;
    case 'bottom':
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      break;
  }
  await page.waitForTimeout(500); // Wait for scroll animation
}

/**
 * Extract table data
 * @param {Object} page - Playwright page
 * @param {string} tableSelector - Table selector
 */
async function extractTableData(page, tableSelector) {
  await page.waitForSelector(tableSelector);
  
  return await page.evaluate((selector) => {
    const table = document.querySelector(selector);
    if (!table) return null;
    
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => 
      th.textContent?.trim()
    );
    
    const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => {
      const cells = Array.from(tr.querySelectorAll('td'));
      if (headers.length > 0) {
        return cells.reduce((obj, cell, index) => {
          obj[headers[index] || `column_${index}`] = cell.textContent?.trim();
          return obj;
        }, {});
      } else {
        return cells.map(cell => cell.textContent?.trim());
      }
    });
    
    return { headers, rows };
  }, tableSelector);
}

/**
 * Wait for and dismiss cookie banners
 * @param {Object} page - Playwright page
 * @param {number} timeout - Max time to wait
 */
async function handleCookieBanner(page, timeout = 3000) {
  const commonSelectors = [
    'button:has-text("Accept")',
    'button:has-text("Accept all")',
    'button:has-text("OK")',
    'button:has-text("Got it")',
    'button:has-text("I agree")',
    '.cookie-accept',
    '#cookie-accept',
    '[data-testid="cookie-accept"]'
  ];
  
  for (const selector of commonSelectors) {
    try {
      const element = await page.waitForSelector(selector, { 
        timeout: timeout / commonSelectors.length,
        state: 'visible'
      });
      if (element) {
        await element.click();
        console.log('Cookie banner dismissed');
        return true;
      }
    } catch (e) {
      // Continue to next selector
    }
  }
  
  return false;
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} initialDelay - Initial delay in ms
 */
async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 1000) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const delay = initialDelay * Math.pow(2, i);
      console.log(`Attempt ${i + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Create browser context with common settings
 * @param {Object} browser - Browser instance
 * @param {Object} options - Context options
 */
async function createContext(browser, options = {}) {
  const envHeaders = getExtraHeadersFromEnv();

  // Merge environment headers with any passed in options
  const mergedHeaders = {
    ...envHeaders,
    ...options.extraHTTPHeaders
  };

  const defaultOptions = {
    viewport: { width: 1280, height: 720 },
    userAgent: options.mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
      : undefined,
    permissions: options.permissions || [],
    geolocation: options.geolocation,
    locale: options.locale || 'en-US',
    timezoneId: options.timezoneId || 'America/New_York',
    // Only include extraHTTPHeaders if we have any
    ...(Object.keys(mergedHeaders).length > 0 && { extraHTTPHeaders: mergedHeaders })
  };

  return await browser.newContext({ ...defaultOptions, ...options });
}

/**
 * Detect running dev servers on common ports
 * @param {Array<number>} customPorts - Additional ports to check
 * @returns {Promise<Array>} Array of detected server URLs
 */
async function detectDevServers(customPorts = []) {
  const http = require('http');

  // Common dev server ports
  const commonPorts = [3000, 3001, 3002, 5173, 8080, 8000, 4200, 5000, 9000, 1234];
  const allPorts = [...new Set([...commonPorts, ...customPorts])];

  const detectedServers = [];

  console.log('🔍 Checking for running dev servers...');

  for (const port of allPorts) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: 'localhost',
          port: port,
          path: '/',
          method: 'HEAD',
          timeout: 500
        }, (res) => {
          if (res.statusCode < 500) {
            detectedServers.push(`http://localhost:${port}`);
            console.log(`  ✅ Found server on port ${port}`);
          }
          resolve();
        });

        req.on('error', () => resolve());
        req.on('timeout', () => {
          req.destroy();
          resolve();
        });

        req.end();
      });
    } catch (e) {
      // Port not available, continue
    }
  }

  if (detectedServers.length === 0) {
    console.log('  ❌ No dev servers detected');
  }

  return detectedServers;
}

/**
 * Monitor Server-Sent Events (SSE) on a page
 * @param {Object} page - Playwright page
 * @param {string|RegExp} urlPattern - URL pattern to match for SSE streams
 * @param {Function} onEvent - Callback for each SSE event
 * @returns {Object} - { stop: Function, events: Array }
 */
function monitorSSE(page, urlPattern, onEvent) {
  const events = [];
  let stopped = false;

  page.on('response', async (response) => {
    if (stopped) return;
    const url = response.url();
    const match = urlPattern instanceof RegExp ? urlPattern.test(url) : url.includes(urlPattern);

    if (match && response.headers()['content-type']?.includes('text/event-stream')) {
      try {
        const body = await response.text();
        const lines = body.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              events.push(parsed);
              onEvent(parsed, url);
            } catch {
              events.push({ raw: data });
              onEvent({ raw: data }, url);
            }
          }
        }
      } catch (e) {
        // SSE body read may fail if stream is still open
      }
    }
  });

  return {
    events,
    stop: () => { stopped = true; },
    isMonitoring: () => !stopped
  };
}

/**
 * Capture session data from SSE stream by intercepting fetch/XHR
 * @param {Object} page - Playwright page
 * @param {string} sessionEndpoint - Session API endpoint pattern (e.g., '/api/session/')
 * @returns {Object} - { sessionId, captured: [], stop: Function }
 */
function captureSessionStream(page, sessionEndpoint = '/api/session/') {
  const captured = [];
  let sessionId = null;
  let stopped = false;

  page.on('response', async (response) => {
    if (stopped) return;
    const url = response.url();
    if (url.includes(sessionEndpoint)) {
      try {
        const body = await response.json().catch(() => null);
        if (body) {
          if (body.sessionId) sessionId = body.sessionId;
          captured.push({ url, body, timestamp: Date.now() });
        }
      } catch {}
    }
  });

  return {
    sessionId: () => sessionId,
    captured,
    stop: () => { stopped = true; },
    isCapturing: () => !stopped
  };
}

/**
 * Monitor WebSocket messages
 * @param {Object} page - Playwright page
 * @param {Function} onMessage - Callback for each WebSocket message
 * @returns {Object} - { stop: Function }
 */
function monitorWebSocket(page, onMessage) {
  const messages = [];
  let stopped = false;

  page.on('websocket', ws => {
    if (stopped) return;
    messages.push({ type: 'open', url: ws.url(), timestamp: Date.now() });
    onMessage({ type: 'open', url: ws.url() }, ws);

    ws.on('framesent', event => {
      if (stopped) return;
      try {
        const data = JSON.parse(event.payload);
        messages.push({ type: 'sent', data, timestamp: Date.now() });
        onMessage({ type: 'sent', data }, ws);
      } catch {
        messages.push({ type: 'sent', raw: event.payload, timestamp: Date.now() });
        onMessage({ type: 'sent', raw: event.payload }, ws);
      }
    });

    ws.on('framereceived', event => {
      if (stopped) return;
      try {
        const data = JSON.parse(event.payload);
        messages.push({ type: 'received', data, timestamp: Date.now() });
        onMessage({ type: 'received', data }, ws);
      } catch {
        messages.push({ type: 'received', raw: event.payload, timestamp: Date.now() });
        onMessage({ type: 'received', raw: event.payload }, ws);
      }
    });

    ws.on('close', () => {
      messages.push({ type: 'close', url: ws.url(), timestamp: Date.now() });
      onMessage({ type: 'close', url: ws.url() }, ws);
    });
  });

  return {
    messages,
    stop: () => { stopped = true; },
    isMonitoring: () => !stopped
  };
}

/**
 * Intercept and capture streaming API responses (SSE/chunked)
 * @param {Object} page - Playwright page
 * @param {string} apiPattern - API endpoint pattern to monitor
 * @param {Function} onChunk - Callback for each chunk received
 * @returns {Object} - { chunks: [], stop: Function }
 */
function interceptStreamingResponse(page, apiPattern, onChunk) {
  const chunks = [];
  let stopped = false;
  let currentResponse = null;

  page.on('request', request => {
    if (stopped) return;
    const url = request.url();
    if (url.includes(apiPattern)) {
      currentResponse = { url, headers: request.headers(), timestamp: Date.now() };
    }
  });

  page.on('response', async response => {
    if (stopped) return;
    const url = response.url();
    if (url.includes(apiPattern)) {
      const contentType = response.headers()['content-type'] || '';
      const transferEncoding = response.headers()['transfer-encoding'] || '';

      if (contentType.includes('text/event-stream') || transferEncoding.includes('chunked')) {
        try {
          const body = await response.text();
          chunks.push({ url, body, complete: true, timestamp: Date.now() });
          onChunk({ url, body, complete: true }, currentResponse);
        } catch {}
      } else {
        try {
          const body = await response.json().catch(() => null);
          if (body) {
            chunks.push({ url, body, complete: true, timestamp: Date.now() });
            onChunk({ url, body, complete: true }, currentResponse);
          }
        } catch {}
      }
    }
  });

  return {
    chunks,
    stop: () => { stopped = true; },
    isCapturing: () => !stopped
  };
}

module.exports = {
  launchBrowser,
  createPage,
  waitForPageReady,
  safeClick,
  safeType,
  extractTexts,
  takeScreenshot,
  authenticate,
  scrollPage,
  extractTableData,
  handleCookieBanner,
  retryWithBackoff,
  createContext,
  detectDevServers,
  getExtraHeadersFromEnv,
  monitorSSE,
  captureSessionStream,
  monitorWebSocket,
  interceptStreamingResponse
};
