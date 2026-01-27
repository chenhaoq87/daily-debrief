#!/usr/bin/env node
/**
 * Tool: Fetch papers from OpenAlex API
 * Usage: node fetch_openalex.js <date> <keywords> [perPage]
 * Returns: JSON array of papers
 */

const https = require('https');

async function fetchOpenAlex(date, keywords, perPage = 50) {
    const domainKeywords = keywords.map(k => `"${k}"`).join('|');
    const filterParam = `publication_date:${date},default.search:${encodeURIComponent(domainKeywords)}`;
    const url = `https://api.openalex.org/works?filter=${filterParam}&per-page=${perPage}&select=title,doi,id,abstract_inverted_index,primary_location,concepts,cited_by_count,publication_date,open_access,authorships`;
    
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    const response = JSON.parse(data);
                    const papers = response.results.map(p => ({
                        source: 'OpenAlex',
                        id: p.id,
                        doi: p.doi,
                        title: p.title,
                        abstract: reconstructAbstract(p.abstract_inverted_index),
                        authors: p.authorships?.map(a => ({
                            name: a.author?.display_name,
                            id: a.author?.id
                        })) || [],
                        venue: p.primary_location?.source?.display_name,
                        citationCount: p.cited_by_count || 0,
                        publicationDate: p.publication_date,
                        openAccess: p.open_access?.is_oa || false,
                        url: p.doi ? `https://doi.org/${p.doi}` : p.id
                    }));
                    resolve(papers);
                } else {
                    reject(new Error(`OpenAlex API error: ${res.statusCode}`));
                }
            });
        }).on('error', reject);
    });
}

function reconstructAbstract(invertedIndex) {
    if (!invertedIndex) return '';
    const words = [];
    for (const [word, positions] of Object.entries(invertedIndex)) {
        for (const pos of positions) {
            words[pos] = word;
        }
    }
    return words.filter(w => w).join(' ');
}

// CLI usage
if (require.main === module) {
    const date = process.argv[2];
    const keywords = process.argv[3]?.split(',') || [];
    const perPage = parseInt(process.argv[4]) || 50;
    
    if (!date || keywords.length === 0) {
        console.error('Usage: node fetch_openalex.js <date> <keyword1,keyword2,...> [perPage]');
        process.exit(1);
    }
    
    fetchOpenAlex(date, keywords, perPage)
        .then(papers => console.log(JSON.stringify(papers, null, 2)))
        .catch(err => {
            console.error(err.message);
            process.exit(1);
        });
}

module.exports = { fetchOpenAlex };
