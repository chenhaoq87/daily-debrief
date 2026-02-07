#!/usr/bin/env node
/**
 * Tool: Fetch articles from Food Safety News RSS feed
 * Usage: node fetch_food_safety_news.js [--days N] [--since YYYY-MM-DD]
 * Returns: JSON array of standardized media items to stdout
 */

const https = require('https');
const { parseString } = require('xml2js');

const RSS_URL = 'https://www.foodsafetynews.com/rss/';

// Common pathogens for extraction
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
      // Normalize the name
      if (p === 'e. coli' || p === 'e.coli' || p === 'escherichia coli') return 'E. coli';
      return p.charAt(0).toUpperCase() + p.slice(1);
    }
  }
  return null;
}

function categorizeArticle(title, description, categories) {
  const text = `${title} ${description} ${(categories || []).join(' ')}`.toLowerCase();
  if (text.includes('recall') || text.includes('recalled')) return 'Recall';
  if (text.includes('outbreak') || text.includes('illness') || text.includes('sick') || text.includes('hospitalized')) return 'Outbreak';
  if (text.includes('policy') || text.includes('regulation') || text.includes('law') || text.includes('bill') || text.includes('fda') || text.includes('usda')) return 'Policy';
  if (text.includes('study') || text.includes('research') || text.includes('findings') || text.includes('report')) return 'Research';
  if (text.includes('alert') || text.includes('warning') || text.includes('advisory')) return 'Alert';
  return 'Research';
}

function determineSeverity(title, description, category) {
  const text = `${title} ${description}`.toLowerCase();
  if (text.includes('death') || text.includes('died') || text.includes('fatal') || text.includes('class i')) return 'high';
  if (text.includes('hospitalized') || text.includes('outbreak') || text.includes('recall') || text.includes('contaminated')) return 'medium';
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

function fetchRSS(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'ResearchAgent/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

async function fetchFoodSafetyNews(options = {}) {
  const { days = 7, since = null } = options;

  const cutoffDate = since
    ? new Date(since + 'T00:00:00Z')
    : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  try {
    const xml = await fetchRSS(RSS_URL);

    return new Promise((resolve, reject) => {
      parseString(xml, { explicitArray: false, trim: true }, (err, result) => {
        if (err) return reject(new Error(`XML parse error: ${err.message}`));

        const items = result?.rss?.channel?.item;
        if (!items) return resolve([]);

        const articles = (Array.isArray(items) ? items : [items])
          .map(item => {
            const pubDate = new Date(item.pubDate);
            if (isNaN(pubDate.getTime()) || pubDate < cutoffDate) return null;

            const title = stripHtml(item.title || '');
            const description = stripHtml(item.description || '');
            const categories = item.category
              ? (Array.isArray(item.category) ? item.category : [item.category])
              : [];
            const category = categorizeArticle(title, description, categories);

            return {
              source_type: 'media',
              sources: ['Food Safety News'],
              source_urls: [item.link],
              title,
              summary: description,
              date: pubDate.toISOString().split('T')[0],
              category,
              severity: determineSeverity(title, description, category),
              pathogen: extractPathogen(`${title} ${description}`),
              product: null,
              states: null,
              tags: categories,
              _dedup_key: title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 60)
            };
          })
          .filter(Boolean);

        resolve(articles);
      });
    });
  } catch (err) {
    console.error(`[Food Safety News] Error: ${err.message}`);
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
  }

  fetchFoodSafetyNews(options)
    .then(items => console.log(JSON.stringify(items, null, 2)))
    .catch(err => {
      console.error(err.message);
      process.exit(1);
    });
}

module.exports = { fetchFoodSafetyNews };
