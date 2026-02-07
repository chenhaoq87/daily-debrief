#!/usr/bin/env node
/**
 * Tool: Fetch CDC outbreak investigations
 * Usage: node fetch_cdc_outbreaks.js [--days N] [--since YYYY-MM-DD]
 * Returns: JSON array of standardized media items to stdout
 *
 * Strategy (CDC restructured their site in 2024-2025):
 * 1. Try CDC Media Library API for food safety content
 * 2. Try scraping current outbreak investigation pages  
 * 3. Try CDC RSS feeds for food safety
 * 4. Fallback: Return empty with warning
 */

const https = require('https');
const { parseString } = require('xml2js');

const PATHOGENS = [
  'salmonella', 'e. coli', 'e.coli', 'escherichia coli', 'listeria',
  'campylobacter', 'norovirus', 'clostridium', 'botulism', 'vibrio',
  'staphylococcus', 'shigella', 'hepatitis a', 'cyclospora', 'cronobacter',
  'bacillus cereus', 'yersinia'
];

function extractPathogen(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const p of PATHOGENS) {
    if (lower.includes(p)) {
      if (p === 'e. coli' || p === 'e.coli' || p === 'escherichia coli') return 'E. coli';
      return p.charAt(0).toUpperCase() + p.slice(1);
    }
  }
  return null;
}

function extractStates(text) {
  if (!text) return null;
  const statePattern = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/g;
  const states = [...new Set((text.match(statePattern) || []))];
  return states.length > 0 ? states : null;
}

function extractCaseCount(text) {
  if (!text) return null;
  const match = text.match(/(\d+)\s*(case|ill|sick|infected|people|person)/i);
  return match ? parseInt(match[1]) : null;
}

function determineSeverity(text) {
  if (!text) return 'medium';
  const lower = text.toLowerCase();
  if (lower.includes('death') || lower.includes('died') || lower.includes('fatal')) return 'high';
  if (lower.includes('hospitalized') || lower.includes('hospital')) return 'high';
  if (lower.includes('outbreak') || lower.includes('investigation')) return 'medium';
  return 'low';
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#xA0;/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fetchURL(url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'ResearchAgent/1.0',
        'Accept': 'application/json,text/html,application/xml;q=0.9'
      },
      timeout: timeoutMs
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchURL(res.headers.location, timeoutMs).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ data, contentType: res.headers['content-type'] || '' });
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

/**
 * Strategy 1: CDC Content Syndication API
 * Search for food safety outbreak content
 */
async function tryCDCMediaAPI(cutoffDate) {
  const urls = [
    'https://tools.cdc.gov/api/v2/resources/media?topic=food%20safety&mediatype=html&max=25&sort=-datePublished',
    'https://tools.cdc.gov/api/v2/resources/media?q=foodborne+outbreak&mediatype=html&max=25&sort=-datePublished',
    'https://tools.cdc.gov/api/v2/resources/media?q=food+recall+outbreak&mediatype=html&max=25&sort=-datePublished'
  ];

  const allItems = [];
  const seenIds = new Set();

  for (const url of urls) {
    try {
      const { data } = await fetchURL(url);
      const response = JSON.parse(data);
      const results = response.results || [];

      for (const item of results) {
        if (seenIds.has(item.id)) continue;
        seenIds.add(item.id);

        const pubDate = item.datePublished ? new Date(item.datePublished) : null;
        const modDate = item.dateModified ? new Date(item.dateModified) : null;
        const bestDate = modDate || pubDate;

        if (!bestDate || bestDate < cutoffDate) continue;

        const title = stripHtml(item.name || '');
        const description = stripHtml(item.description || '');
        const text = `${title} ${description}`;

        // Only keep food-safety/outbreak relevant items
        const isRelevant = /outbreak|recall|foodborne|food.?safety|investigation|illness|contamina/i.test(text);
        if (!isRelevant) continue;

        allItems.push({
          source_type: 'media',
          sources: ['CDC'],
          source_urls: [item.sourceUrl || item.targetUrl || `https://www.cdc.gov/`],
          title,
          summary: description,
          date: bestDate.toISOString().split('T')[0],
          category: 'Outbreak',
          severity: determineSeverity(text),
          pathogen: extractPathogen(text),
          product: null,
          states: extractStates(text),
          case_count: extractCaseCount(text),
          _dedup_key: title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60)
        });
      }
    } catch (err) {
      console.error(`[CDC] Media API query failed: ${err.message}`);
    }
  }

  return allItems;
}

/**
 * Strategy 2: Try known CDC outbreak page URLs
 * CDC has moved pages around multiple times; try several paths
 */
async function tryCDCOutbreakPages(cutoffDate) {
  const pageUrls = [
    'https://www.cdc.gov/food-safety/investigation/index.html',
    'https://www.cdc.gov/food-safety/outbreaks/index.html',
    'https://www.cdc.gov/foodsafety/outbreaks/multistate-outbreaks/outbreaks-list.html',
    'https://www.cdc.gov/foodborne-outbreaks/index.html'
  ];

  for (const url of pageUrls) {
    try {
      const { data } = await fetchURL(url, 10000);

      // Extract outbreak links from the page
      const outbreaks = [];
      const linkPattern = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      let match;

      while ((match = linkPattern.exec(data)) !== null) {
        const href = match[1];
        const text = stripHtml(match[2]);

        // Look for outbreak investigation links
        if (/outbreak|investigation|salmonella|listeria|e\.\s*coli/i.test(text) && text.length > 15) {
          const fullUrl = href.startsWith('http') ? href : `https://www.cdc.gov${href}`;

          outbreaks.push({
            source_type: 'media',
            sources: ['CDC'],
            source_urls: [fullUrl],
            title: text,
            summary: text,
            date: null, // Unknown from list page
            date_estimated: true,
            category: 'Outbreak',
            severity: determineSeverity(text),
            pathogen: extractPathogen(text),
            product: null,
            states: extractStates(text),
            _dedup_key: text.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60)
          });
        }
      }

      if (outbreaks.length > 0) return outbreaks;
    } catch (err) {
      // Try next URL
    }
  }

  return [];
}

/**
 * Strategy 3: Try CDC food safety RSS feed
 */
async function tryCDCRSS(cutoffDate) {
  const rssUrls = [
    'https://tools.cdc.gov/api/v2/resources/media/316422.rss',  // Food safety RSS if it exists
    'https://www2c.cdc.gov/podcasts/feed.asp?feedid=395'  // CDC food safety podcast feed
  ];

  for (const url of rssUrls) {
    try {
      const { data } = await fetchURL(url, 10000);

      return new Promise((resolve) => {
        parseString(data, { explicitArray: false, trim: true }, (err, result) => {
          if (err) return resolve([]);

          const items = result?.rss?.channel?.item;
          if (!items) return resolve([]);

          const parsed = (Array.isArray(items) ? items : [items])
            .map(item => {
              const pubDate = new Date(item.pubDate);
              if (isNaN(pubDate.getTime()) || pubDate < cutoffDate) return null;

              const title = stripHtml(item.title || '');
              const description = stripHtml(item.description || '');
              const text = `${title} ${description}`;

              if (!/outbreak|recall|foodborne|food.?safety|investigation|illness/i.test(text)) return null;

              return {
                source_type: 'media',
                sources: ['CDC'],
                source_urls: [item.link],
                title,
                summary: description,
                date: pubDate.toISOString().split('T')[0],
                category: 'Outbreak',
                severity: determineSeverity(text),
                pathogen: extractPathogen(text),
                product: null,
                states: extractStates(text),
                _dedup_key: title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60)
              };
            })
            .filter(Boolean);

          resolve(parsed);
        });
      });
    } catch (err) {
      // Try next feed
    }
  }

  return [];
}

async function fetchCDCOutbreaks(options = {}) {
  const { days = 1, since = null } = options;

  const cutoffDate = since
    ? new Date(since + 'T00:00:00Z')
    : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Try all strategies and combine
  const [mediaItems, pageItems, rssItems] = await Promise.all([
    tryCDCMediaAPI(cutoffDate),
    tryCDCOutbreakPages(cutoffDate),
    tryCDCRSS(cutoffDate)
  ]);

  // Combine and deduplicate
  // If running a 1-day window without explicit 'since', drop items with unknown dates
  const filteredPageItems = (!since && days <= 1)
    ? pageItems.filter(i => i.date)
    : pageItems;
  const allItems = [...mediaItems, ...filteredPageItems, ...rssItems];
  const seen = new Set();
  const unique = [];

  for (const item of allItems) {
    if (!seen.has(item._dedup_key)) {
      seen.add(item._dedup_key);
      unique.push(item);
    }
  }

  if (unique.length === 0) {
    console.error('[CDC] No outbreak items found via any strategy. CDC may have restructured again.');
  } else {
    console.error(`[CDC] Found ${unique.length} outbreak items`);
  }

  return unique;
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) options.days = parseInt(args[++i]);
    if (args[i] === '--since' && args[i + 1]) options.since = args[++i];
  }

  fetchCDCOutbreaks(options)
    .then(items => console.log(JSON.stringify(items, null, 2)))
    .catch(err => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { fetchCDCOutbreaks };
