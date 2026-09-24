/**
 * Test cho swiper-converter.html
 * - Syntax-check tất cả inline <script> trong file tool
 * - Trích core converter và chạy thật với DOM shim dựa trên cheerio
 * - Assert output khớp định format swiper mong muốn
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Polyfill cho Node 18: undici (nạp qua cheerio) cần global File
if (typeof globalThis.File === 'undefined' && typeof require('buffer').File !== 'undefined') {
    globalThis.File = require('buffer').File;
}

const cheerio = require('cheerio');

const TOOL_FILE = path.join(__dirname, 'swiper-converter.html');
const file = fs.readFileSync(TOOL_FILE, 'utf8');

// ============ 1. Trích tất cả <script> và syntax-check ============
const scripts = [];
const scriptRe = /<script>([\s\S]*?)<\/script>/g;
let m;
while ((m = scriptRe.exec(file)) !== null) scripts.push(m[1]);

assert.ok(scripts.length >= 2, `Số script block phải >= 2 (thực tế ${scripts.length})`);
scripts.forEach(function (code, i) {
    try { new Function(code); }
    catch (e) { throw new Error(`Syntax error ở script block #${i}: ${e.message}`); }
});
console.log(`OK: syntax OK cho ${scripts.length} inline <script> block`);

const coreBlock = scripts.find(function (s) { return s.indexOf('Core converter') !== -1; });
assert.ok(coreBlock, 'Không tìm thấy core converter script');
assert.ok(coreBlock.indexOf('SAMPLE_HTML') !== -1, 'Core phải chứa SAMPLE_HTML');

// Trích SAMPLE_HTML
const sampleMatch = coreBlock.match(/const SAMPLE_HTML = `([\s\S]*?)`;/);
assert.ok(sampleMatch && sampleMatch[1].indexOf('swiper-slide') !== -1, 'SAMPLE phải chứa swiper-slide');
const SAMPLE = sampleMatch[1];

// ============ 2. DOM shim (chạy core converter thật trong Node) ============
// Chỉ trích các hàm thuần (bỏ DOM refs / event listeners)
const coreFn =
    coreBlock.slice(coreBlock.indexOf('function cleanText'),
        coreBlock.indexOf('function updateStats'));

class FakeNode {
    constructor($, el) { this._$ = $; this._el = el; }
    _qAll(sel) {
        const $ = this._$;
        const el = this._el;
        return $(el).find(sel).toArray().map(function (n) { return new FakeNode($, n); });
    }
    querySelector(sel) { const all = this._qAll(sel); return all.length ? all[0] : null; }
    querySelectorAll(sel) { return this._qAll(sel); }
    getAttribute(name) { return this._$(this._el).attr(name); }
    get textContent() { return this._$(this._el).text(); }
}

class FakeDocument extends FakeNode {
    constructor($) {
        const root = $.root();
        super($, root.get(0));
    }
    querySelector(sel) {
        if (sel === 'parsererror') return null;
        const node = this._$(sel).first();
        return node.length ? new FakeNode(this._$, node.get(0)) : null;
    }
}

class FakeDOMParser {
    // decodeEntities mặc dòng true -> attr/text già decode (giống browser DOMParser)
    parseFromString(html) {
        const $ = cheerio.load(html);
        return new FakeDocument($);
    }
}

const factory = new Function('DOMParser', coreFn + '\nreturn convertSwiper;');
const convertReal = factory.call(null, FakeDOMParser);

// ============ 3. Assert chuyển đổi mặc định ============
const html = convertReal(SAMPLE, { altFromTit: true, more: true });
assert.ok(/^<div class="swiper-wrapper">/.test(html), 'Output bắt đầu với swiper-wrapper');
assert.ok(!html.includes('style='), 'Output không được còn inline style');
assert.ok(!html.includes('swiper-slide-active'), 'Class swiper-slide-active bỏ');
assert.ok(!html.includes('swiper-slide-next'), 'Class swiper-slide-next bỏ');
assert.ok(!html.includes('썸네일'), 'alt 썸네일 thay bằng text tit');

const $out = cheerio.load(html);
assert.strictEqual($out('div.swiper-wrapper > div.swiper-slide').length, 5, 'SAMPLE có 5 slides');

// Slide đầu đầy
const first = $out('div.swiper-wrapper > div.swiper-slide').first();
assert.strictEqual(first.attr('class'), 'swiper-slide', 'slide chỉ giữ class swiper-slide');
const a1 = first.children('a');
assert.ok(!a1.attr('style'), 'a không có style');
assert.ok(html.includes('href="/fire02/news/activities.do?mode=view&amp;articleNo=138394"'), 'href giữ với &amp; trong source');
assert.strictEqual(a1.attr('rel'), 'noopener');
assert.strictEqual(a1.attr('target'), '_blank');
assert.strictEqual(a1.attr('title'), '새 창으로 열기');
const img1 = a1.find('img');
assert.strictEqual(img1.attr('alt'), '2026학년도 한마음축제_2026.9.19.(토)', 'img alt = text tit');
assert.strictEqual(img1.attr('src'), '/app/board/attach/image/47590_1790148822937.do', 'img src giữ');
assert.strictEqual(a1.find('p.tit').text(), '2026학년도 한마음축제_2026.9.19.(토)');
assert.strictEqual(a1.find('p.more span').text(), 'View more', 'Thêm p.more > span');

// Indent: dòng slide 6 tabs, dòng bên trong 7 tabs, </div> cuối 5 tabs
const lines = html.split('\n');
const slideLine = lines.find(function (l) { return l.includes('<div class="swiper-slide">'); });
const innerLine = lines.find(function (l) { return l.includes('<p class="tit">'); });
assert.ok(/^\t{6}<div class="swiper-slide">/.test(slideLine), 'slide 6 tabs: ' + slideLine.slice(0, 30));
assert.ok(/^\t{7}<p class="tit">/.test(innerLine), 'inner 7 tabs: ' + innerLine.slice(0, 30));
assert.ok(/^\t{5}<\/div>$/.test(lines[lines.length - 1]), '</div> cuối 5 tabs');

// ============ 4. Tuỳ chọn ============
const htmlNoMore = convertReal(SAMPLE, { altFromTit: true, more: false });
assert.ok(!htmlNoMore.includes('class="more"'), 'more=false -> không có p.more');

const htmlNoAlt = convertReal(SAMPLE, { altFromTit: false, more: true });
assert.ok(htmlNoAlt.includes('alt="썸네일"'), 'altFromTit=false -> giữ alt 썸네일');

// ============ 5. Lỗi ============
assert.throws(function () {
    convertReal('<div>không có slide</div>', {});
}, /Không tìm thấy/, 'Không có .swiper-slide phải throw');

console.log('🎉 Tất cả assertion PASS — logic swiper-converter hoạt động đúng.');