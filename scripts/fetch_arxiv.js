#!/usr/bin/env node
/**
 * Tool: Fetch papers from arXiv API
 * Usage: node fetch_arxiv.js <date> <categories> <keywords>
 * Returns: JSON array of papers
 */

const https = require('https');

async function fetchArxiv(date, categories, keywords) {
    // arXiv categories like cs.LG, cs.CV, cs.AI
    const catQuery = categories.map(c => `cat:${c}`).join('+OR+');
    
    // Build keyword query
    const kwQuery = keywords.map(k => `all:"${k}"`).join('+OR+');
    
    const searchQuery = `(${catQuery})+AND+(${kwQuery})`;
    const url = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(searchQuery)}&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`;
    
    return new Promise((resolve, reject) => {
        https.get(url.replace('https:', 'http:'), (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                const papers = parseArxivXML(data, date);
                resolve(papers);
            });
        }).on('error', reject);
    });
}

function parseArxivXML(xml, targetDate) {
    const papers = [];
    const entries = xml.split('<entry>').slice(1);
    
    for (const entry of entries) {
        const published = entry.match(/<published>(.*?)<\/published>/)?.[1] || '';
        const pubDate = published.split('T')[0];
        
        // Only return papers from target date
        if (pubDate !== targetDate) continue;
        
        const title = entry.match(/<title>(.*?)<\/title>/)?.[1]?.trim().replace(/\s+/g, ' ');
        const summary = entry.match(/<summary>(.*?)<\/summary>/s)?.[1]?.trim().replace(/\s+/g, ' ');
        const id = entry.match(/<id>(.*?)<\/id>/)?.[1];
        const arxivId = id?.split('/abs/')?.[1];
        
        const authorMatches = entry.match(/<author>.*?<name>(.*?)<\/name>.*?<\/author>/gs) || [];
        const authors = authorMatches.map(a => ({
            name: a.match(/<name>(.*?)<\/name>/)?.[1]
        }));
        
        papers.push({
            source: 'arXiv',
            id: arxivId,
            doi: null,
            title: title,
            abstract: summary,
            authors: authors,
            venue: 'arXiv preprint',
            citationCount: 0,
            publicationDate: pubDate,
            openAccess: true,
            url: `https://arxiv.org/abs/${arxivId}`
        });
    }
    
    return papers;
}

// CLI usage
if (require.main === module) {
    const date = process.argv[2];
    const categories = process.argv[3]?.split(',') || [];
    const keywords = process.argv[4]?.split(',') || [];
    
    if (!date || categories.length === 0 || keywords.length === 0) {
        console.error('Usage: node fetch_arxiv.js <date> <cat1,cat2,...> <kw1,kw2,...>');
        process.exit(1);
    }
    
    fetchArxiv(date, categories, keywords)
        .then(papers => console.log(JSON.stringify(papers, null, 2)))
        .catch(err => {
            console.error(err.message);
            process.exit(1);
        });
}

module.exports = { fetchArxiv };
