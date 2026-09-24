const express = require('express');
const cors = require('cors');
const axios = require('axios');
const xml2js = require('xml2js');
const cheerio = require('cheerio');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec, execSync } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const app = express();
const DEFAULT_PORT = 3000;

// Azure TTS Configuration
const AZURE_TTS_KEY = process.env.AZURE_TTS_KEY || 'YOUR_AZURE_TTS_KEY';
const AZURE_TTS_REGION = process.env.AZURE_TTS_REGION || 'eastasia';

// Video Cutter Configuration
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'cuts');
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const MERGED_DIR = path.join(__dirname, 'uploads', 'merged');

// Create directories if not exist
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
if (!fs.existsSync(MERGED_DIR)) fs.mkdirSync(MERGED_DIR, { recursive: true });

// Multer config for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-matroska'];
        if (allowedTypes.includes(file.mimetype) || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only video files are allowed.'));
        }
    }
});

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());
app.use(express.static('.'));
app.use('/cuts', express.static(OUTPUT_DIR));
app.use('/templates', express.static(TEMPLATES_DIR));
app.use('/uploads', express.static(UPLOAD_DIR));

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
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n\n')
            .trim();
        
        // Extract images from article
        let images = [];
        const imageSelectors = selectors[sourceId] || '.content, .article-content, article';
        
        $(imageSelectors).find('img').each((i, elem) => {
            const src = $(elem).attr('src') || $(elem).attr('data-src');
            if (src) {
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
                if (i < 5) {
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
    const getValue = (field) => {
        if (!field) return '';
        if (Array.isArray(field)) {
            return field[0] || '';
        }
        return String(field);
    };
    
    const rawTitle = getValue(item.title);
    const rawLink = getValue(item.link);
    const rawDescription = getValue(item.description);
    const rawPubDate = getValue(item.pubDate);
    
    const decodeHTML = (text) => {
        if (!text) return '';
        return text
            .replace(/<[^>]*>/g, '')
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
    
    const shortSummary = fullContent.substring(0, 200) + (fullContent.length > 200 ? '...' : '');
    const url = rawLink;
    const publishedAt = rawPubDate ? new Date(rawPubDate).toLocaleString('vi-VN') : new Date().toLocaleString('vi-VN');
    
    return {
        id: `${sourceId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        source: sourceName,
        sourceId: sourceId,
        title: title,
        summary: shortSummary,
        url: url,
        publishedAt: publishedAt,
        content: fullContent,
        images: []
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
                    
                    if (fetchFull && article.url) {
                        const fullData = await fetchFullArticle(article.url, sourceId);
                        if (fullData.content && fullData.content.length > article.content.length) {
                            article.content = fullData.content;
                            article.summary = fullData.content.substring(0, 500) + (fullData.content.length > 500 ? '...' : '');
                            article.images = fullData.images;
                        }
                    }
                    
                    return article;
                })
            );
            
            return articles;
        });
        
        const results = await Promise.all(fetchPromises);
        const allArticles = results.flat();
        
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

// Text-to-Speech endpoint using Azure Cognitive Services
app.get('/api/tts', async (req, res) => {
    try {
        const { text, lang = 'vi-VN' } = req.query;
        
        if (!text) {
            return res.status(400).json({ error: 'Missing text parameter' });
        }
        
        console.log(`TTS request: ${text.substring(0, 50)}...`);
        console.log(`Language: ${lang}`);
        
        if (AZURE_TTS_KEY === 'YOUR_AZURE_TTS_KEY') {
            console.error('Azure TTS not configured. Please set AZURE_TTS_KEY environment variable.');
            return res.status(500).json({ 
                error: 'TTS service not configured',
                message: 'Azure TTS API key not set. Please configure AZURE_TTS_KEY environment variable.',
                setup: 'See HOW_TO_RUN.md for Azure TTS setup instructions'
            });
        }
        
        const azureTtsUrl = `https://${AZURE_TTS_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`;
        
        const voiceLang = lang || 'vi-VN';
        const voiceName = voiceLang === 'vi-VN' ? 'vi-VN-HoaiAnNeural' : 'en-US-JennyNeural';
        
        const ssml = `
            <speak version='1.0' xml:lang='${voiceLang}'>
                <voice xml:lang='${voiceLang}' xml:gender='Female' name='${voiceName}'>
                    <prosody rate="0%" pitch="0%">
                        ${text.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>')}
                    </prosody>
                </voice>
            </speak>
        `;
        
        console.log(`Calling Azure TTS: ${azureTtsUrl}`);
        
        const response = await axios.post(azureTtsUrl, ssml, {
            headers: {
                'Ocp-Apim-Subscription-Key': AZURE_TTS_KEY,
                'Content-Type': 'application/ssml+xml',
                'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
                'User-Agent': 'MKT-Software-TTS/1.0'
            },
            responseType: 'arraybuffer',
            timeout: 30000
        });
        
        console.log(`Azure TTS response status: ${response.status}`);
        console.log(`Azure TTS response size: ${response.data.length} bytes`);
        
        if (response.data.length < 100) {
            console.error('Azure TTS returned very small file:', response.data.length, 'bytes');
            return res.status(500).json({ 
                error: 'TTS returned empty or invalid audio',
                size: response.data.length
            });
        }
        
        res.set('Content-Type', 'audio/mpeg');
        res.set('Content-Disposition', 'attachment; filename=speech.mp3');
        res.set('Content-Length', response.data.length);
        res.send(response.data);
        
    } catch (error) {
        console.error('Azure TTS error:', error.message);
        if (error.response) {
            console.error('Azure TTS error response status:', error.response.status);
            console.error('Azure TTS error response data:', error.response.data?.toString().substring(0, 200));
        }
        res.status(500).json({ 
            error: 'TTS failed', 
            message: error.message,
            details: error.response?.status || 'no response',
            provider: 'Azure Cognitive Services'
        });
    }
});

// Video Cutter API
app.post('/api/cut-video', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            console.error('No video file uploaded');
            return res.status(400).json({ error: 'No video file uploaded' });
        }

        const { mode, outputFolder, segmentCount, customSegments, intervalSeconds } = req.body;
        const videoPath = req.file.path;
        const outputPath = path.join(OUTPUT_DIR, outputFolder || 'cuts');
        
        console.log(`\n=== Video Cut Request ===`);
        console.log(`Input: ${videoPath}`);
        console.log(`Mode: ${mode}`);
        console.log(`Output: ${outputPath}`);
        console.log(`File size: ${req.file.size} bytes`);

        // Create output folder if not exists
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
            console.log(`Created output folder: ${outputPath}`);
        }

        // Get video duration using FFprobe
        console.log('Getting video duration...');
        const duration = await getVideoDuration(videoPath);
        console.log(`Video duration: ${duration}s`);

        let cuts = [];

        if (mode === 'equal') {
            // Cut into equal segments
            const count = parseInt(segmentCount) || 3;
            const segmentDuration = duration / count;
            
            for (let i = 0; i < count; i++) {
                const startTime = i * segmentDuration;
                const endTime = (i === count - 1) ? duration : (i + 1) * segmentDuration;
                const outputFile = path.join(outputPath, `segment_${i + 1}.mp4`);
                
                await cutVideoSegment(videoPath, outputFile, startTime, endTime);
                
                const fileStats = fs.statSync(outputFile);
                cuts.push({
                    filename: `segment_${i + 1}.mp4`,
                    duration: endTime - startTime,
                    size: fileStats.size,
                    startTime: startTime,
                    endTime: endTime
                });
            }
        } else if (mode === 'custom') {
            // Cut custom segments
            const segments = customSegments.split('\n').filter(line => line.trim());
            
            for (let i = 0; i < segments.length; i++) {
                const [start, end] = segments[i].split('-').map(t => parseTimeToSeconds(t.trim()));
                const outputFile = path.join(outputPath, `segment_${i + 1}.mp4`);
                
                await cutVideoSegment(videoPath, outputFile, start, end);
                
                const fileStats = fs.statSync(outputFile);
                cuts.push({
                    filename: `segment_${i + 1}.mp4`,
                    duration: end - start,
                    size: fileStats.size,
                    startTime: start,
                    endTime: end
                });
            }
        } else if (mode === 'interval') {
            // Cut by interval
            const interval = parseInt(intervalSeconds) || 30;
            let startTime = 0;
            let index = 1;
            
            while (startTime < duration) {
                const endTime = Math.min(startTime + interval, duration);
                const outputFile = path.join(outputPath, `segment_${index}.mp4`);
                
                await cutVideoSegment(videoPath, outputFile, startTime, endTime);
                
                const fileStats = fs.statSync(outputFile);
                cuts.push({
                    filename: `segment_${index}.mp4`,
                    duration: endTime - startTime,
                    size: fileStats.size,
                    startTime: startTime,
                    endTime: endTime
                });
                
                startTime = endTime;
                index++;
            }
        }

        // Clean up uploaded file
        try {
            fs.unlinkSync(videoPath);
            console.log(`Cleaned up uploaded file: ${videoPath}`);
        } catch (e) {
            console.error('Error cleaning up file:', e);
        }

        console.log(`✅ Successfully cut video into ${cuts.length} segments`);
        console.log(`=== End Video Cut ===\n`);

        res.json({
            success: true,
            cuts: cuts,
            outputFolder: outputFolder
        });

    } catch (error) {
        console.error('Error cutting video:', error);
        console.error('Error stack:', error.stack);
        
        // Clean up uploaded file on error
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (e) {
                console.error('Error cleaning up file:', e);
            }
        }
        
        res.status(500).json({ 
            error: 'Failed to cut video',
            message: error.message,
            details: error.stack
        });
    }
});

// Download cut video
app.get('/api/download-cut', (req, res) => {
    try {
        const { folder, filename } = req.query;
        const filePath = path.join(OUTPUT_DIR, folder, filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }
        
        res.download(filePath, filename, (err) => {
            if (err) {
                console.error('Download error:', err);
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Download failed', message: error.message });
    }
});

// Get available templates
app.get('/api/templates', (req, res) => {
    try {
        if (!fs.existsSync(TEMPLATES_DIR)) {
            return res.json({ success: true, templates: [] });
        }

        const files = fs.readdirSync(TEMPLATES_DIR).filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.mp4', '.webm', '.avi', '.mov', '.mkv'].includes(ext);
        });

        const templates = files.map(file => {
            const filePath = path.join(TEMPLATES_DIR, file);
            const stats = fs.statSync(filePath);
            const url = `/templates/${file}`;
            
            return {
                name: file,
                path: url,
                size: stats.size,
                sizeFormatted: formatFileSize(stats.size)
            };
        });

        res.json({ success: true, templates });
    } catch (error) {
        console.error('Error fetching templates:', error);
        res.json({ success: true, templates: [] });
    }
});

// Merge video with voice endpoint
app.post('/api/merge-video', upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'voice', maxCount: 1 }
]), async (req, res) => {
    try {
        if (!req.files || (!req.files['video'] && !req.body.videoPath)) {
            return res.status(400).json({ error: 'No video file provided' });
        }
        if (!req.files || !req.files['voice']) {
            return res.status(400).json({ error: 'No voice file provided' });
        }

        const videoFile = req.files['video'] ? req.files['video'][0] : null;
        const voiceFile = req.files['voice'][0];
        const videoPath = req.body.videoPath || (videoFile ? videoFile.path : null);

        if (!videoPath && !videoFile) {
            return res.status(400).json({ error: 'No video file provided' });
        }

        console.log(`\n=== Video Merge Request ===`);
        console.log(`Video: ${videoPath || videoFile.path}`);
        console.log(`Voice: ${voiceFile.path}`);

        const outputFilename = `merged_${Date.now()}.mp4`;
        const outputPath = path.join(MERGED_DIR, outputFilename);

        // Get video duration
        const videoDuration = await getVideoDuration(videoPath || videoFile.path);
        console.log(`Video duration: ${videoDuration}s`);

        // Get voice duration
        const voiceDuration = await getVideoDuration(voiceFile.path);
        console.log(`Voice duration: ${voiceDuration}s`);

        // Calculate repeat count
        const repeatCount = Math.ceil(voiceDuration / videoDuration);
        console.log(`Repeating video ${repeatCount} times`);

        // Create concat file
        const concatPath = path.join(MERGED_DIR, `concat_${Date.now()}.txt`);
        let concatContent = '';
        const actualVideoPath = videoPath || videoFile.path;

        for (let i = 0; i < repeatCount; i++) {
            concatContent += `file '${actualVideoPath}'\n`;
        }
        fs.writeFileSync(concatPath, concatContent);

        // Step 1: Loop video to match voice duration
        const loopedPath = path.join(MERGED_DIR, `looped_${Date.now()}.mp4`);
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(concatPath)
                .inputOptions(['-f', 'concat', '-safe', '0'])
                .outputOptions([
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '23',
                    '-t', String(voiceDuration),
                    '-c:a', 'aac',
                    '-b:a', '128k'
                ])
                .output(loopedPath)
                .on('start', (cmd) => console.log('Looping video:', cmd))
                .on('progress', (p) => {
                    console.log(`Looping: ${Math.round(p.percent || 0)}%`);
                })
                .on('end', () => {
                    console.log('Video looping completed');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('Error looping video:', err);
                    reject(err);
                })
                .run();
        });

        // Step 2: Merge looped video with voice
        await new Promise((resolve, reject) => {
            ffmpeg(loopedPath)
                .input(voiceFile.path)
                .outputOptions([
                    '-c:v', 'libx264',
                    '-preset', 'fast',
                    '-crf', '23',
                    '-c:a', 'aac',
                    '-b:a', '192k',
                    '-map', '0:v:0',
                    '-map', '1:a:0',
                    '-shortest'
                ])
                .output(outputPath)
                .on('start', (cmd) => console.log('Merging:', cmd))
                .on('progress', (p) => {
                    console.log(`Merging: ${Math.round(p.percent || 0)}%`);
                })
                .on('end', () => {
                    console.log('Merge completed');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('Error merging:', err);
                    reject(err);
                })
                .run();
        });

        // Get output file info
        const outputStats = fs.statSync(outputPath);
        const downloadUrl = `/uploads/merged/${outputFilename}`;

        // Cleanup temporary files
        try {
            if (videoFile) fs.unlinkSync(videoFile.path);
            fs.unlinkSync(voiceFile.path);
            fs.unlinkSync(concatPath);
            fs.unlinkSync(loopedPath);
        } catch (e) {
            console.error('Cleanup error:', e);
        }

        console.log(`✅ Merge complete: ${outputFilename}`);
        console.log(`=== End Video Merge ===\n`);

        res.json({
            success: true,
            message: 'Video merged successfully',
            data: {
                filename: outputFilename,
                url: downloadUrl,
                size: outputStats.size,
                sizeFormatted: formatFileSize(outputStats.size),
                duration: voiceDuration
            }
        });

    } catch (error) {
        console.error('Merge error:', error);
        
        // Cleanup on error
        try {
            if (req.files) {
                Object.values(req.files).forEach(files => {
                    files.forEach(file => {
                        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                    });
                });
            }
        } catch (e) { /* ignore */ }

        res.status(500).json({ 
            error: 'Failed to merge video',
            message: error.message,
            details: error.stack
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        ffmpeg: checkFFmpegInstalled(),
        azureTTS: AZURE_TTS_KEY !== 'YOUR_AZURE_TTS_KEY'
    });
});

// Check FFmpeg installation
function checkFFmpegInstalled() {
    try {
        const result = execSync('ffmpeg -version', { encoding: 'utf-8' });
        const version = result.split('\n')[0];
        return { installed: true, version: version };
    } catch (error) {
        return { installed: false, error: error.message };
    }
}

// FFmpeg diagnostic endpoint
app.get('/api/diagnostic', (req, res) => {
    try {
        const ffmpegCheck = checkFFmpegInstalled();
        const ffprobeCheck = checkFFmpegInstalled();
        
        res.json({
            ffmpeg: ffmpegCheck,
            ffprobe: ffprobeCheck,
            uploadDir: fs.existsSync(UPLOAD_DIR) ? 'exists' : 'missing',
            outputDir: fs.existsSync(OUTPUT_DIR) ? 'exists' : 'missing',
            templatesDir: fs.existsSync(TEMPLATES_DIR) ? 'exists' : 'missing',
            mergedDir: fs.existsSync(MERGED_DIR) ? 'exists' : 'missing',
            azureTTS: {
                configured: AZURE_TTS_KEY !== 'YOUR_AZURE_TTS_KEY',
                region: AZURE_TTS_REGION
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper function to format file size
function formatFileSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Helper function to get video duration
function getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
        console.log(`Running ffprobe on: ${videoPath}`);
        exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`, (error, stdout, stderr) => {
            if (error) {
                console.error('FFprobe error:', error.message);
                console.error('FFprobe stderr:', stderr);
                reject(new Error(`FFprobe failed: ${error.message}. Make sure FFmpeg is installed and in PATH.`));
                return;
            }
            const duration = parseFloat(stdout.trim());
            console.log(`Video duration: ${duration}s`);
            resolve(duration);
        });
    });
}

// Helper function to cut video segment
function cutVideoSegment(inputPath, outputPath, startTime, endTime) {
    return new Promise((resolve, reject) => {
        const duration = endTime - startTime;
        console.log(`Cutting segment: ${startTime}s - ${endTime}s (duration: ${duration}s)`);
        console.log(`Output: ${outputPath}`);
        
        exec(`ffmpeg -ss ${startTime} -i "${inputPath}" -t ${duration} -c copy "${outputPath}" -y`, (error, stdout, stderr) => {
            if (error) {
                console.error('FFmpeg error:', error.message);
                console.error('FFmpeg stderr:', stderr);
                reject(new Error(`FFmpeg error: ${error.message}`));
                return;
            }
            console.log(`Successfully created: ${outputPath}`);
            resolve();
        });
    });
}

// Helper function to parse time string to seconds
function parseTimeToSeconds(timeStr) {
    const parts = timeStr.split(':').map(Number);
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return parseInt(timeStr) || 0;
}

// Create video endpoint
app.post('/api/create-video', async (req, res) => {
    try {
        const { articles, voiceType = 'female' } = req.body;
        
        console.log(`\n=== Video Creation Request ===`);
        console.log(`Articles: ${articles.length}`);
        console.log(`Voice: ${voiceType}`);
        
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
                totalDuration: articles.length * 30,
                voiceType: voiceType
            }
        };
        
        res.json(videoData);
        
    } catch (error) {
        console.error('Video creation error:', error);
        res.status(500).json({ error: 'Failed to create video', message: error.message });
    }
});

// Start server with auto port selection
function startServer(port) {
    const server = app.listen(port, () => {
        console.log(`\n🚀 Server running at http://localhost:${port}`);
        console.log(`📰 News API available at http://localhost:${port}/api/articles`);
        console.log(`📋 Sources list at http://localhost:${port}/api/sources`);
        console.log(`✂️ Video Cutter API available at http://localhost:${port}/api/cut-video`);
        console.log(`🎬 Video Merge API available at http://localhost:${port}/api/merge-video`);
        console.log(`📁 Templates available at http://localhost:${port}/templates/\n`);
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