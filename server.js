const express = require('express');
const cors = require('cors');
const axios = require('axios');
const xml2js = require('xml2js');
const cheerio = require('cheerio');
const app = express();
const DEFAULT_PORT = 3000;

// Middleware
app.use(cors({
    origin: true, // Allow all origins including 'null'
    credentials: true
}));
app.use(express.json());
app.use(express.static('.'));

// Helper function to fetch full article content from URL
async function fetchFullArticle(url, sourceId) {
    try {
        console.log(`Fetching full article from: ${url}`);
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            timeout: 10000
        });
        
        const $ = cheerio.load(response.data);
        
        // Different selectors for different news sources
        let content = '';
        const selectors = {
            vnexpress: '.fck_detail',
            tuoitre: '.detail-content',
            thanhnien: '#detail-body',
            dantri: '.dt-news__content',
            vietnamnet: '.ArticleBody',
            nguoilaodong: '.detail-content',
            tienphong: '.detail-content',
            nhandan: '.detail-content',
            kenh14: '.k14-custom-body',
            soha: '.detail-content'
        };
        
        const selector = selectors[sourceId] || '.content, .article-content, .post-content, article';
        content = $(selector).text().trim();
        
        // If no content found with specific selector, try generic
        if (!content || content.length < 100) {
            content = $('article').text().trim() || 
                      $('.content').text().trim() || 
                      $('.article-body').text().trim() ||
                      $('.post-body').text().trim();
        }
        
        // Clean up the content
        content = content
            .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
            .replace(/\n\s*\n/g, '\n\n')  // Clean up newlines
            .trim();
        
        // Extract images from article
        let images = [];
        const imageSelectors = selectors[sourceId] || '.content, .article-content, article';
        
        $(imageSelectors).find('img').each((i, elem) => {
            const src = $(elem).attr('src') || $(elem).attr('data-src');
            if (src) {
                // Convert relative URL to absolute
                try {
                    const absoluteUrl = new URL(src, url).href;
                    images.push(absoluteUrl);
                } catch (e) {
                    // Invalid URL, skip
                }
            }
        });
        
        // If no images found in content, try to find in page
        if (images.length === 0) {
            $('img').each((i, elem) => {
                if (i < 5) {  // Max 5 images from page
                    const src = $(elem).attr('src') || $(elem).attr('data-src');
                    if (src && !src.includes('icon') && !src.includes('logo')) {
                        try {
                            const absoluteUrl = new URL(src, url).href;
                            images.push(absoluteUrl);
                        } catch (e) {
                            // Invalid URL, skip
                        }
                    }
                }
            });
        }
        
        console.log(`Fetched ${content.length} chars and ${images.length} images from ${url}`);
        
        return {
            content: content,
            images: images
        };
    } catch (error) {
        console.error(`Error fetching full article from ${url}:`, error.message);
        return { content: '', images: [] };
    }
}

// News sources configuration
const NEWS_SOURCES = {
    vnexpress: {
        name: 'VnExpress',
        rss: 'https://vnexpress.net/rss/tin-moi-nhat.rss',
        baseUrl: 'https://vnexpress.net'
    },
    tuoitre: {
        name: 'Tuổi Trẻ',
        rss: 'https://tuoitre.vn/rss/tin-moi-nhat.rss',
        baseUrl: 'https://tuoitre.vn'
    },
    thanhnien: {
        name: 'Thanh Niên',
        rss: 'https://thanhnien.vn/rss/home.rss',
        baseUrl: 'https://thanhnien.vn'
    },
    dantri: {
        name: 'Dân Trí',
        rss: 'https://dantri.com.vn/rss/home.rss',
        baseUrl: 'https://dantri.com.vn'
    },
    vietnamnet: {
        name: 'VietnamNet',
        rss: 'https://vietnamnet.vn/rss/home.rss',
        baseUrl: 'https://vietnamnet.vn'
    }
};

// Fetch and parse RSS feed
async function fetchRSSFeed(url) {
    try {
        console.log(`Fetching RSS from: ${url}`);
        
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            timeout: 15000,
            maxRedirects: 5
        });
        
        console.log(`Response status: ${response.status}`);
        console.log(`Response length: ${response.data.length} chars`);
        
        const parser = new xml2js.Parser({
            explicitArray: false,
            mergeAttrs: true,
            trim: true
        });
        
        const result = await parser.parseStringPromise(response.data);
        const items = result.rss?.channel?.item || [];
        
        console.log(`Parsed ${items.length} items from RSS`);
        
        return Array.isArray(items) ? items : (items ? [items] : []);
    } catch (error) {
        console.error(`Error fetching RSS from ${url}:`, error.message);
        if (error.response) {
            console.error(`Response status: ${error.response.status}`);
            console.error(`Response data:`, error.response.data?.substring(0, 200));
        }
        return [];
    }
}

// Extract article info from RSS item
function extractArticle(item, sourceId, sourceName) {
    // Helper to get value from either array or direct value
    const getValue = (field) => {
        if (!field) return '';
        // If it's an array, get first element
        if (Array.isArray(field)) {
            return field[0] || '';
        }
        // Otherwise return as is
        return String(field);
    };
    
    const rawTitle = getValue(item.title);
    const rawLink = getValue(item.link);
    const rawDescription = getValue(item.description);
    const rawPubDate = getValue(item.pubDate);
    
    // Clean and decode HTML entities
    const decodeHTML = (text) => {
        if (!text) return '';
        return text
            .replace(/<[^>]*>/g, '')  // Remove HTML tags
            .replace(/&nbsp;/g, ' ')
            .replace(/</g, '<')
            .replace(/>/g, '>')
            .replace(/&/g, '&')
            .replace(/"/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/'/g, "'")
            .trim();
    };
    
    const title = decodeHTML(rawTitle);
    const fullContent = decodeHTML(rawDescription);
    
    // Use FULL content for video (no truncation for content field)
    // Only truncate the short summary for display
    const shortSummary = fullContent.substring(0, 200) + (fullContent.length > 200 ? '...' : '');
    const url = rawLink;
    const publishedAt = rawPubDate ? new Date(rawPubDate).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN');
    
    return {
        id: `${sourceId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        source: sourceName,
        sourceId: sourceId,
        title: title,
        summary: shortSummary,  // Short version for list view
        url: url,
        publishedAt: publishedAt,
        content: fullContent,  // FULL content for AI summary/video
        images: []  // Will be populated if fullContent=true
    };
}

// API endpoint to fetch articles from multiple sources
app.get('/api/articles', async (req, res) => {
    try {
        const { sources, count = 3, fullContent = 'false' } = req.query;
        
        console.log(`\n=== API Request ===`);
        console.log(`Sources: ${sources}`);
        console.log(`Count: ${count}`);
        console.log(`Full Content: ${fullContent}`);
        
        if (!sources) {
            return res.status(400).json({ error: 'Missing sources parameter' });
        }
        
        const sourceArray = sources.split(',').map(s => s.trim());
        const countPerSource = parseInt(count) || 3;
        const fetchFull = fullContent === 'true';
        
        console.log(`Fetching articles from ${sourceArray.join(', ')}...`);
        
        // Fetch articles from all selected sources
        const fetchPromises = sourceArray.map(async (sourceId) => {
            const source = NEWS_SOURCES[sourceId];
            if (!source) {
                console.log(`Unknown source: ${sourceId}, skipping...`);
                return [];
            }
            
            console.log(`\nFetching from ${source.name}...`);
            const items = await fetchRSSFeed(source.rss);
            console.log(`Got ${items.length} items from ${source.name}`);
            
            const articles = await Promise.all(
                items.slice(0, countPerSource).map(async (item) => {
                    const article = extractArticle(item, sourceId, source.name);
                    
                    // Fetch full content if requested
                    if (fetchFull && article.url) {
                        const fullData = await fetchFullArticle(article.url, sourceId);
                        if (fullData.content && fullData.content.length > article.content.length) {
                            article.content = fullData.content;
                            article.summary = fullData.content.substring(0, 500) + (fullData.content.length > 500 ? '...' : '');
                            article.images = fullData.images;  // Add images to article
                        }
                    }
                    
                    return article;
                })
            );
            
            return articles;
        });
        
        const results = await Promise.all(fetchPromises);
        const allArticles = results.flat();
        
        // Sort by published date (newest first)
        allArticles.sort((a, b) => {
            const dateA = new Date(a.publishedAt);
            const dateB = new Date(b.publishedAt);
            return dateB - dateA;
        });
        
        console.log(`\nTotal fetched: ${allArticles.length} articles`);
        console.log(`=== End API Request ===\n`);
        
        res.json({
            success: true,
            count: allArticles.length,
            articles: allArticles
        });
        
    } catch (error) {
        console.error('Error in /api/articles:', error);
        res.status(500).json({ 
            error: 'Failed to fetch articles',
            message: error.message,
            stack: error.stack
        });
    }
});

// API endpoint to get available sources
app.get('/api/sources', (req, res) => {
    const sources = Object.entries(NEWS_SOURCES).map(([id, data]) => ({
        id,
        name: data.name,
        rss: data.rss
    }));
    
    res.json({
        success: true,
        sources
    });
});

// Text-to-Speech endpoint using Google TTS (free)
app.get('/api/tts', async (req, res) => {
    try {
        const { text, lang = 'vi-VN' } = req.query;
        
        if (!text) {
            return res.status(400).json({ error: 'Missing text parameter' });
        }
        
        console.log(`TTS request: ${text.substring(0, 50)}...`);
        
        // Use Google Translate TTS (free, no API key needed)
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
        
        const response = await axios.get(ttsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://translate.google.com/'
            },
            responseType: 'arraybuffer'
        });
        
        res.set('Content-Type', 'audio/mpeg');
        res.set('Content-Disposition', 'attachment; filename=speech.mp3');
        res.send(response.data);
        
    } catch (error) {
        console.error('TTS error:', error.message);
        res.status(500).json({ error: 'TTS failed', message: error.message });
    }
});

// Create video endpoint
app.post('/api/create-video', async (req, res) => {
    try {
        const { articles, voiceType = 'female' } = req.body;
        
        console.log(`\n=== Video Creation Request ===`);
        console.log(`Articles: ${articles.length}`);
        console.log(`Voice: ${voiceType}`);
        
        // This is a placeholder - actual video creation requires FFmpeg
        // For now, return the data needed for video creation
        
        const videoData = {
            success: true,
            message: 'Video data prepared',
            data: {
                articles: articles.map(article => ({
                    title: article.title,
                    content: article.content,
                    images: article.images || [],
                    audioUrl: `/api/tts?text=${encodeURIComponent(article.content.substring(0, 200))}&lang=vi-VN`
                })),
                totalDuration: articles.length * 30,  // Estimate 30s per article
                voiceType: voiceType
            }
        };
        
        res.json(videoData);
        
    } catch (error) {
        console.error('Video creation error:', error);
        res.status(500).json({ error: 'Failed to create video', message: error.message });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server with auto port selection
function startServer(port) {
    const server = app.listen(port, () => {
        console.log(`\n🚀 Server running at http://localhost:${port}`);
        console.log(`📰 News API available at http://localhost:${port}/api/articles`);
        console.log(`📋 Sources list at http://localhost:${port}/api/sources\n`);
    });

    server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
            console.log(`⚠️  Port ${port} is busy, trying port ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error('Server error:', e);
        }
    });
}

startServer(DEFAULT_PORT);
