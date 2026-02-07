#!/usr/bin/env node
/**
 * Tool: Fetch food recalls from openFDA API
 * Usage: node fetch_fda_recalls.js [--days N] [--since YYYY-MM-DD] [--limit N]
 * Returns: JSON array of standardized media items to stdout
 * 
 * Uses: https://api.fda.gov/food/enforcement.json
 * Docs: https://open.fda.gov/apis/food/enforcement/
 */

const https = require('https');

const PATHOGENS = [
  'salmonella', 'e. coli', 'e.coli', 'escherichia coli', 'listeria',
  'campylobacter', 'norovirus', 'clostridium', 'botulism', 'vibrio',
  'staphylococcus', 'shigella', 'hepatitis a', 'cyclospora', 'cronobacter',
  'bacillus cereus', 'yersinia'
];

const ALLERGENS = [
  'milk', 'egg', 'peanut', 'tree nut', 'almond', 'cashew', 'walnut',
  'wheat', 'soy', 'fish', 'shellfish', 'sesame', 'gluten', 'sulfite'
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

function extractProduct(description) {
  if (!description) return null;
  // Try to extract the product name from product_description
  // Often format: "Brand Name Product; size; UPC..."
  const cleaned = description.split(';')[0].split(',')[0].trim();
  // Remove brand-like prefixes (often in quotes or all caps)
  return cleaned.length > 100 ? cleaned.substring(0, 100) + '...' : cleaned;
}

function extractStates(distribution) {
  if (!distribution) return null;
  // Match US state abbreviations
  const statePattern = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/g;
  const states = [...new Set((distribution.match(statePattern) || []))];
  return states.length > 0 ? states : null;
}

function classificationToSeverity(classification) {
  if (!classification) return 'medium';
  if (classification.includes('I') && !classification.includes('II') && !classification.includes('III')) return 'high';
  if (classification.includes('II') && !classification.includes('III')) return 'medium';
  if (classification.includes('III')) return 'low';
  return 'medium';
}

function categorizeRecall(reason) {
  if (!reason) return 'Recall';
  const lower = reason.toLowerCase();
  for (const a of ALLERGENS) {
    if (lower.includes(a) && (lower.includes('undeclared') || lower.includes('allergen'))) return 'Recall';
  }
  if (lower.includes('contaminated') || lower.includes('pathogen')) return 'Recall';
  return 'Recall';
}

function formatDate(dateStr) {
  // openFDA dates are in YYYYMMDD format
  if (!dateStr || dateStr.length !== 8) return null;
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ResearchAgent/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

async function fetchFDARecalls(options = {}) {
  const { days = 7, since = null, limit = 50 } = options;

  const cutoffDate = since
    ? new Date(since + 'T00:00:00Z')
    : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Format date range for openFDA filter
  const fromDate = cutoffDate.toISOString().split('T')[0].replace(/-/g, '');
  const toDate = new Date().toISOString().split('T')[0].replace(/-/g, '');

  const url = `https://api.fda.gov/food/enforcement.json?search=report_date:[${fromDate}+TO+${toDate}]&limit=${limit}&sort=report_date:desc`;

  try {
    const response = await fetchJSON(url);
    const results = response.results || [];

    return results.map(recall => {
      const reportDate = formatDate(recall.report_date);
      const recallDate = formatDate(recall.recall_initiation_date);
      const reason = recall.reason_for_recall || '';
      const product = extractProduct(recall.product_description);
      const pathogen = extractPathogen(reason);
      const states = extractStates(recall.distribution_pattern);
      const severity = classificationToSeverity(recall.classification);

      // Build a meaningful title
      const firm = recall.recalling_firm || 'Unknown Firm';
      const classLabel = recall.classification || '';
      const title = `${firm} Recalls ${product || 'Product'} (${classLabel})`;

      // Build summary
      const summaryParts = [reason];
      if (recall.distribution_pattern) summaryParts.push(`Distribution: ${recall.distribution_pattern}`);
      if (recall.product_quantity) summaryParts.push(`Quantity: ${recall.product_quantity}`);

      return {
        source_type: 'media',
        sources: ['FDA'],
        source_urls: [`https://api.fda.gov/food/enforcement.json?search=recall_number:"${recall.recall_number}"`],
        title,
        summary: summaryParts.join(' | '),
        date: reportDate || recallDate || new Date().toISOString().split('T')[0],
        category: 'Recall',
        severity,
        pathogen,
        product,
        states,
        recall_number: recall.recall_number,
        classification: recall.classification,
        recalling_firm: firm,
        status: recall.status,
        _dedup_key: (recall.recall_number || title).toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60)
      };
    });
  } catch (err) {
    // openFDA returns 404 when no results match the search
    if (err.message.includes('404')) {
      console.error('[FDA Recalls] No recalls found for date range');
      return [];
    }
    console.error(`[FDA Recalls] Error: ${err.message}`);
    return [];
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) options.days = parseInt(args[++i]);
    if (args[i] === '--since' && args[i + 1]) options.since = args[++i];
    if (args[i] === '--limit' && args[i + 1]) options.limit = parseInt(args[++i]);
  }

  fetchFDARecalls(options)
    .then(items => console.log(JSON.stringify(items, null, 2)))
    .catch(err => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { fetchFDARecalls };
