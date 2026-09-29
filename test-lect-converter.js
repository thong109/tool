/**
 * Test suite cho lect-converter.html
 * Kiểm tra việc chuyển đổi .pre_lect / .lect_cont thành swiper-wrapper (video -> data-video)
 */
const { File } = require('node:buffer');
if (!globalThis.File) {
    globalThis.File = File;
}

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const cheerio = require('cheerio');

class FakeNode {
    constructor($, el) {
        this.$ = $;
        this.el = el;
    }
    querySelector(selector) {
        const found = this.$(this.el).find(selector).first();
        if (!found || !found.length) return null;
        return new FakeNode(this.$, found[0]);
    }
    querySelectorAll(selector) {
        const found = this.$(this.el).find(selector);
        const result = [];
        const self = this;
        found.each(function () {
            result.push(new FakeNode(self.$, this));
        });
        return result;
    }
    getAttribute(name) {
        const val = this.$(this.el).attr(name);
        return val === undefined ? null : val;
    }
    get textContent() {
        return this.$(this.el).text();
    }
}

class FakeDoc {
    constructor(html) {
        this.$ = cheerio.load(html, { xmlMode: false });
    }
    querySelector(selector) {
        const found = this.$(selector).first();
        if (!found || !found.length) return null;
        return new FakeNode(this.$, found[0]);
    }
    querySelectorAll(selector) {
        const found = this.$(selector);
        const result = [];
        const self = this;
        found.each(function () {
            result.push(new FakeNode(self.$, this));
        });
        return result;
    }
}

class FakeDOMParser {
    parseFromString(str, type) {
        return new FakeDoc(str);
    }
}

global.DOMParser = FakeDOMParser;

// Đọc logic từ lect-converter.html
const htmlSource = fs.readFileSync(path.join(__dirname, 'lect-converter.html'), 'utf8');

const scriptMatch = htmlSource.match(/<script>([\s\S]*?)<\/script>[\s\S]*?<script>([\s\S]*?)<\/script>/);
const mainScript = scriptMatch ? scriptMatch[2] : '';

const extractFnMatch = mainScript.match(/function extractLectures[\s\S]*?\n {8}\}/);
const cleanTextMatch = mainScript.match(/function cleanText[\s\S]*?\n {8}\}/);
const escapeAttrMatch = mainScript.match(/function escapeAttr[\s\S]*?\n {8}\}/);
const escapeHtmlMatch = mainScript.match(/function escapeHtml[\s\S]*?\n {8}\}/);
const ytIdMatch = mainScript.match(/function extractYoutubeId[\s\S]*?\n {8}\}/);
const buildSlideMatch = mainScript.match(/function buildSlide[\s\S]*?\n {8}\}/);
const convertMatch = mainScript.match(/function convertLectures[\s\S]*?\n {8}\}/);
const sampleMatch = mainScript.match(/const SAMPLE_HTML = `([\s\S]*?)`;/);

assert(extractFnMatch, 'Tìm thấy function extractLectures');
assert(cleanTextMatch, 'Tìm thấy function cleanText');
assert(escapeAttrMatch, 'Tìm thấy function escapeAttr');
assert(escapeHtmlMatch, 'Tìm thấy function escapeHtml');
assert(ytIdMatch, 'Tìm thấy function extractYoutubeId');
assert(buildSlideMatch, 'Tìm thấy function buildSlide');
assert(convertMatch, 'Tìm thấy function convertLectures');
assert(sampleMatch, 'Tìm thấy SAMPLE_HTML');

const sandbox = {};
const fnCode = `
${cleanTextMatch[0]}
${escapeAttrMatch[0]}
${escapeHtmlMatch[0]}
${ytIdMatch[0]}
${extractFnMatch[0]}
${buildSlideMatch[0]}
${convertMatch[0]}
return { cleanText, escapeAttr, escapeHtml, extractYoutubeId, extractLectures, buildSlide, convertLectures };
`;

const fns = new Function(fnCode)();
const sampleHtml = sampleMatch[1];

const DEFAULT_OPTS = {
    dataVideo: true,
    keepThumb: false,
    dataGtm: true,
    iframeTitle: true,
    keepImgStyle: true
};

console.log('--- TEST 1: Chuyển đổi SAMPLE_HTML sang form data-video ---');
const out = fns.convertLectures(sampleHtml, DEFAULT_OPTS);

assert(out.startsWith('<div class="swiper-wrapper">\n'), 'Output bắt đầu bằng swiper-wrapper');
assert(out.endsWith('\n</div>'), 'Output kết thúc bằng </div>');
assert(!out.includes('<iframe'), 'Mặc định không còn iframe (đã thay bằng data-video)');
assert(!out.includes('sandbox'), 'Không còn sandbox');
assert(!out.includes('fr-video'), 'Không còn span fr-video');
assert(out.includes('\t\t\t<div class="img video-container" data-video="FK_Gvz0q_yI">\n\t\t\t</div>'), 'Đúng form mẫu: thẻ mở/đóng 2 dòng, indent 3 tab');

const $res = cheerio.load(out);
const slides = $res('.swiper-slide');
console.log('Tổng số slide:', slides.length);
assert.strictEqual(slides.length, 3, 'Phải có đúng 3 slide');

console.log('--- TEST 2: Slide 1 - iframe embed YouTube -> data-video ---');
const slide1 = slides.eq(0);
const box1 = slide1.find('.img.video-container');
assert.strictEqual(box1.length, 1, 'Slide 1 phải có .img.video-container');
assert.strictEqual(box1.attr('data-video'), 'FK_Gvz0q_yI', 'ID tách từ iframe embed (bỏ ?si=...)');
assert.strictEqual(box1.children().length, 0, 'Container rỗng khi keepThumb = false');
assert.strictEqual(slide1.find('.txt .txt01').text(), 'AI로 만든 뮤직비디오(사용 AI: SUNO + ChatGPT + Vrew)');

console.log('--- TEST 3: Slide 2 - href youtube.com/shorts + ảnh -> data-video ---');
const slide2 = slides.eq(1);
const box2 = slide2.find('.img.video-container');
assert.strictEqual(box2.length, 1, 'Slide 2 phải thành video-container');
assert.strictEqual(box2.attr('data-video'), 'CN7-U-O3T-Q', 'ID tách từ href shorts');
assert.strictEqual(box2.children().length, 0, 'Ảnh thumb bị bỏ mặc định');
assert.strictEqual(slide2.find('.txt .txt01').text(), 'AI로 만든 쇼츠(사용 AI: 클로드+브루)');

console.log('--- TEST 4: Slide 3 - href www.youtube.com/shorts ---');
const slide3 = slides.eq(2);
assert.strictEqual(slide3.find('.img.video-container').attr('data-video'), 'kaFrvk8harA');
assert.strictEqual(slide3.find('.txt .txt01').text(), 'AI로 만든 외국어로 말하기 영상(사용 AI: D-ID)');

console.log('--- TEST 5: optKeepThumb giữ <a><img> trong .video-container ---');
const $thumb = cheerio.load(fns.convertLectures(sampleHtml, Object.assign({}, DEFAULT_OPTS, { keepThumb: true })));
const box2t = $thumb('.swiper-slide').eq(1).find('.img.video-container');
assert.strictEqual(box2t.attr('data-video'), 'CN7-U-O3T-Q', 'Vẫn giữ data-video');
const a2t = box2t.find('a');
assert.strictEqual(a2t.attr('href'), 'https://youtube.com/shorts/CN7-U-O3T-Q');
assert.strictEqual(a2t.attr('target'), '_blank');
assert.strictEqual(a2t.attr('rel'), 'noopener');
assert(a2t.find('img').attr('src').includes('ai%EC%8B%A4%EB%AC%B4%ED%99%9C%EC%9A%A9%ED%95%99%EA%B3%BC_%EC%88%8F%EC%B8%A0.jpg'));
assert($thumb('.swiper-slide').eq(2).find('img').attr('style').includes('height: 255px'), 'Giữ style ảnh thumb');
assert.strictEqual($thumb('.swiper-slide').eq(0).find('.video-container').children().length, 0, 'Slide iframe không có thumb để giữ');

console.log('--- TEST 6: tắt data-video -> giữ iframe (legacy) ---');
const $if = cheerio.load(fns.convertLectures(sampleHtml, Object.assign({}, DEFAULT_OPTS, { dataVideo: false })));
const slide1if = $if('.swiper-slide').eq(0);
assert.strictEqual(slide1if.find('.img.video-container').length, 1);
const iframe1 = slide1if.find('iframe');
assert.strictEqual(iframe1.length, 1, 'Slide 1 vẫn là iframe khi tắt data-video');
assert.strictEqual(iframe1.attr('src'), 'https://www.youtube.com/embed/FK_Gvz0q_yI?si=ehUPFbLq3QwWDRDu');
assert.strictEqual(iframe1.attr('title'), 'AI로 만든 뮤직비디오(사용 AI: SUNO + ChatGPT + Vrew)');
assert.strictEqual(iframe1.attr('data-gtm-yt-inspected-10'), 'true');
assert.strictEqual(iframe1.attr('sandbox'), undefined, 'Iframe không được có thuộc tính sandbox');
assert.strictEqual($if('.swiper-slide').eq(1).find('.img a img').length, 1, 'Slide link giữ <a><img>');
assert($if('.swiper-slide').eq(2).find('img').attr('style').includes('height: 255px'), 'Giữ nguyên style của ảnh');

console.log('--- TEST 7: tuỳ chọn tắt data-gtm (legacy iframe) ---');
const outNoGtm = fns.convertLectures(sampleHtml, Object.assign({}, DEFAULT_OPTS, { dataVideo: false, dataGtm: false }));
assert(!outNoGtm.includes('data-gtm-yt-inspected-10'), 'Không được có data-gtm khi bị tắt');

console.log('--- TEST 8: ảnh / link không phải YouTube -> giữ <a><img> ---');
const OTHER_SAMPLE = '<div class="pre_lect">' +
    '<div class="lect_cont"><a href="https://example.com/page" target="_blank" rel="noopener"><img src="/_res/sjcu/ko/img/banner.png" style="width: 100%; border-radius: 10px"></a>' +
    '<div class="text_wrap"><p class="tit">Ảnh banner thường</p></div></div>' +
    '<div class="lect_cont"><img src="/_res/sjcu/ko/img/no-link.jpg">' +
    '<div class="text_wrap"><p class="tit">Ảnh không có link</p></div></div>' +
    '</div>';
const $other = cheerio.load(fns.convertLectures(OTHER_SAMPLE, DEFAULT_OPTS));
assert.strictEqual($other('.swiper-slide').length, 2, 'Có 2 slide');
const other0 = $other('.swiper-slide').eq(0);
assert.strictEqual(other0.find('.video-container').length, 0, 'Link thường -> không tạo .video-container');
assert.strictEqual(other0.find('.img a').attr('href'), 'https://example.com/page');
assert.strictEqual(other0.find('.img a img').attr('style'), 'width: 100%; border-radius: 10px');
assert.strictEqual(other0.find('.txt01').text(), 'Ảnh banner thường');
const other1 = $other('.swiper-slide').eq(1);
assert.strictEqual(other1.find('.img a').length, 0, 'Ảnh không link -> không bọc <a>');
assert.strictEqual(other1.find('.img img').attr('src'), '/_res/sjcu/ko/img/no-link.jpg');
assert.strictEqual(other1.find('.txt01').text(), 'Ảnh không có link');
assert(!fns.convertLectures(OTHER_SAMPLE, Object.assign({}, DEFAULT_OPTS, { keepImgStyle: false })).includes('border-radius'), 'Tắt keepImgStyle -> bỏ style ảnh');

console.log('--- TEST 9: iframe không phải YouTube -> giữ iframe ---');
const VIMEO_SAMPLE = '<div class="pre_lect"><div class="lect_cont"><span class="fr-video fr-fvc fr-dvi fr-draggable">' +
    '<iframe src="https://player.vimeo.com/video/123456789" frameborder="0" class="fr-draggable" title="외부 콘텐츠 프레임"></iframe></span>' +
    '<div class="text_wrap"><p class="tit">Vimeo clip</p></div></div></div>';
const $vimeo = cheerio.load(fns.convertLectures(VIMEO_SAMPLE, DEFAULT_OPTS));
assert.strictEqual($vimeo('iframe').length, 1, 'Iframe không phải YouTube vẫn giữ');
assert.strictEqual($vimeo('iframe').attr('src'), 'https://player.vimeo.com/video/123456789');
assert.strictEqual($vimeo('iframe').attr('title'), 'Vimeo clip', 'title = text p.tit');
assert.strictEqual($vimeo('.video-container').length, 1);
assert.strictEqual($vimeo('.video-container').attr('data-video'), undefined, 'Không có data-video với iframe ngoài YouTube');

console.log('--- TEST 10: input đã ở form data-video (convert lại vẫn đúng) ---');
const ALREADY = '<div class="pre_lect"><div class="lect_cont">' +
    '<div class="img video-container" data-video="abc123XYZ45"></div>' +
    '<div class="text_wrap"><p class="tit">Đã convert</p></div></div></div>';
const $already = cheerio.load(fns.convertLectures(ALREADY, DEFAULT_OPTS));
assert.strictEqual($already('.img.video-container').attr('data-video'), 'abc123XYZ45');
assert.strictEqual($already('.txt01').text(), 'Đã convert');

console.log('--- TEST 11: extractYoutubeId với các dạng URL ---');
assert.strictEqual(fns.extractYoutubeId('https://www.youtube.com/embed/FK_Gvz0q_yI?si=ehUPFbLq3QwWDRDu'), 'FK_Gvz0q_yI');
assert.strictEqual(fns.extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s'), 'dQw4w9WgXcQ');
assert.strictEqual(fns.extractYoutubeId('https://youtu.be/dQw4w9WgXcQ?si=abc'), 'dQw4w9WgXcQ');
assert.strictEqual(fns.extractYoutubeId('https://youtube.com/shorts/CN7-U-O3T-Q?feature=share'), 'CN7-U-O3T-Q');
assert.strictEqual(fns.extractYoutubeId('https://player.vimeo.com/video/123456789'), '', 'Không phải YouTube -> rỗng');
assert.strictEqual(fns.extractYoutubeId(''), '');
assert.strictEqual(fns.extractYoutubeId(null), '');

console.log('\n🎉 TẤT CẢ TEST ĐÃ PASS THÀNH CÔNG!');
