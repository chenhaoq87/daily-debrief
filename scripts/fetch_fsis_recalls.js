#!/usr/bin/env node
/**
 * Tool: Fetch USDA FSIS meat/poultry/egg recalls
 * Usage: node fetch_fsis_recalls.js [--days N] [--since YYYY-MM-DD]
 * Returns: JSON array of standardized media items to stdout
 *
 * Strategy:
 * 1. Try FSIS recalls page scrape (https://www.fsis.usda.gov/recalls-alerts)
 * 2. Fallback: openFDA food enforcement filtered for FSIS-regulated products 
 *    (meat, poultry, eggs — since FDA covers most food and FSIS handles USDA-regulated products)
 * 3. Fallback: Return empty array with warning
 */

const https = require('https');
const http = require('http');
const { parseString } = require('xml2js');

const PATHOGENS = [
  'salmonella', 'e. coli', 'e.coli', 'escherichia coli', 'listeria',
  'campylobacter', 'norovirus', 'clostridium', 'botulism', 'vibrio',
  'staphylococcus', 'shigella', 'hepatitis a', 'cyclospora', 'cronobacter'
];

const FSIS_PRODUCTS = [
  'meat', 'beef', 'pork', 'chicken', 'turkey', 'poultry', 'egg',
  'sausage', 'bacon', 'ham', 'deli', 'hot dog', 'ground beef',
  'ground turkey', 'ground chicken', 'jerky', 'lamb', 'veal',
  'duck', 'goose', 'bison', 'venison', 'rabbit'
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

function isFSISProduct(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return FSIS_PRODUCTS.some(p => lower.includes(p));
}

function formatDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return null;
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
}

function classificationToSeverity(classification) {
  if (!classification) return 'medium';
  if (classification.includes('I') && !classification.includes('II') && !classification.includes('III')) return 'high';
  if (classification.includes('II') && !classification.includes('III')) return 'medium';
  if (classification.includes('III')) return 'low';
  return 'medium';
}

function fetchURL(url, timeoutMs = 15000) {
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: timeoutMs
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchURL(res.headers.location, timeoutMs).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
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
 * Strategy 1: Try scraping FSIS recalls page
 * The FSIS page is JS-heavy (Drupal), so this may not work with simple fetch.
 * We try to find structured data or embedded JSON.
 */
async function tryScrapeFSIS(cutoffDate) {
  try {
    const html = await fetchURL('https://www.fsis.usda.gov/recalls-alerts');

    // Look for embedded JSON data (Drupal often embeds data in script tags)
    const jsonMatch = html.match(/drupalSettings["\s]*[:,=]\s*({[\s\S]*?})\s*[;<]/);
    if (jsonMatch) {
      try {
        const settings = JSON.parse(jsonMatch[1]);
        // Parse recalls from settings if available
        if (settings.recalls) {
          return parseEmbeddedRecalls(settings.recalls, cutoffDate);
        }
      } catch (e) { /* not valid JSON, continue */ }
    }

    // Try parsing HTML table of recalls
    const recalls = [];
    const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    for (const row of rows) {
      const cells = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || [];
      if (cells.length >= 3) {
        const linkMatch = row.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
        const dateMatch = row.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);

        if (linkMatch && dateMatch) {
          const recallDate = new Date(dateMatch[1]);
          if (recallDate >= cutoffDate) {
            const title = linkMatch[2].replace(/<[^>]*>/g, '').trim();
            const url = linkMatch[1].startsWith('http')
              ? linkMatch[1]
              : `https://www.fsis.usda.gov${linkMatch[1]}`;

            recalls.push({
              source_type: 'media',
              sources: ['USDA FSIS'],
              source_urls: [url],
              title,
              summary: title,
              date: recallDate.toISOString().split('T')[0],
              category: 'Recall',
              severity: 'medium',
              pathogen: extractPathogen(title),
              product: null,
              states: null,
              _dedup_key: title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60)
            });
          }
        }
      }
    }

    if (recalls.length > 0) return recalls;
    return null; // Signal to try fallback
  } catch (err) {
    console.error(`[FSIS] Scrape failed: ${err.message}`);
    return null;
  }
}

/**
 * Strategy 2: Use openFDA to find FSIS-type recalls
 * Filter for products containing meat/poultry/egg keywords
 */
async function tryOpenFDAFallback(cutoffDate, limit = 100) {
  const fromDate = cutoffDate.toISOString().split('T')[0].replace(/-/g, '');
  const toDate = new Date().toISOString().split('T')[0].replace(/-/g, '');

  const url = `https://api.fda.gov/food/enforcement.json?search=report_date:[${fromDate}+TO+${toDate}]&limit=${limit}&sort=report_date:desc`;

  try {
    const data = await fetchURL(url);
    const response = JSON.parse(data);
    const results = response.results || [];

    // Filter for FSIS-regulated products (meat, poultry, eggs)
    return results
      .filter(r => isFSISProduct(r.product_description) || isFSISProduct(r.reason_for_recall))
      .map(recall => {
        const reportDate = formatDate(recall.report_date);
        const product = recall.product_description?.split(';')[0]?.split(',')[0]?.trim() || 'Unknown Product';
        const reason = recall.reason_for_recall || '';
        const firm = recall.recalling_firm || 'Unknown Firm';

        return {
          source_type: 'media',
          sources: ['USDA FSIS', 'FDA'],
          source_urls: [
            'https://www.fsis.usda.gov/recalls-alerts',
            `https://api.fda.gov/food/enforcement.json?search=recall_number:"${recall.recall_number}"`
          ],
          title: `${firm} Recalls ${product.substring(0, 80)} (${recall.classification || 'Unclassified'})`,
          summary: `${reason} | Distribution: ${recall.distribution_pattern || 'Unknown'}`,
          date: reportDate || new Date().toISOString().split('T')[0],
          category: 'Recall',
          severity: classificationToSeverity(recall.classification),
          pathogen: extractPathogen(reason),
          product: product.substring(0, 100),
          states: extractStates(recall.distribution_pattern),
          recall_number: recall.recall_number,
          classification: recall.classification,
          recalling_firm: firm,
          _dedup_key: (recall.recall_number || '').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60)
        };
      });
  } catch (err) {
    if (err.message.includes('404')) {
      console.error('[FSIS] No FDA recalls found for date range');
      return [];
    }
    console.error(`[FSIS] openFDA fallback failed: ${err.message}`);
    return [];
  }
}

async function fetchFSISRecalls(options = {}) {
  const { days = 7, since = null } = options;

  const cutoffDate = since
    ? new Date(since + 'T00:00:00Z')
    : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Strategy 1: Try scraping FSIS directly
  const scrapeResult = await tryScrapeFSIS(cutoffDate);
  if (scrapeResult && scrapeResult.length > 0) {
    console.error(`[FSIS] Found ${scrapeResult.length} recalls from FSIS scrape`);
    return scrapeResult;
  }

  // Strategy 2: Fallback to openFDA filtered for FSIS products
  console.error('[FSIS] Using openFDA fallback for meat/poultry/egg recalls');
  const fdaResult = await tryOpenFDAFallback(cutoffDate);
  console.error(`[FSIS] Found ${fdaResult.length} FSIS-type recalls from openFDA`);
  return fdaResult;
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) options.days = parseInt(args[++i]);
    if (args[i] === '--since' && args[i + 1]) options.since = args[++i];
  }

  fetchFSISRecalls(options)
    .then(items => console.log(JSON.stringify(items, null, 2)))
    .catch(err => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { fetchFSISRecalls };
