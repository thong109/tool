/**
 * Test cho career-converter.html
 * - Syntax-check tất cả inline <script> trong file tool
 * - Trích core converter và chạy thật với DOM shim dựa trên cheerio
 * - Assert output khớp định format swiper-slide mong muốn
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Polyfill cho Node 18: undici (nạp qua cheerio) cần global File
if (typeof globalThis.File === 'undefined' && typeof require('buffer').File !== 'undefined') {
    globalThis.File = require('buffer').File;
}

const cheerio = require('cheerio');

const TOOL_FILE = path.join(__dirname, 'career-converter.html');
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
assert.ok(sampleMatch && sampleMatch[1].indexOf('career_box') !== -1, 'SAMPLE phải chứa career_box');
const SAMPLE = sampleMatch[1];

// ============ 2. DOM shim (chạy core converter thật trong Node) ============
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
    getAttribute(name) {
        if (name === 'style') return this._$(this._el).attr('style');
        return this._$(this._el).attr(name);
    }
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
    parseFromString(html) {
        const $ = cheerio.load(html);
        return new FakeDocument($);
    }
}

const factory = new Function('DOMParser', coreFn + '\nreturn convertCareers;');
const convertReal = factory.call(null, FakeDOMParser);

// Opts mặc đòng
const DEFAULT_OPTS = {
    fromPath: '/ko/img/main/',
    toPath: '/krsjcu/img/content/',
    dotDash: true,
    middot: true,
    withLabel: true,
    labelText: 'Meta tag'
};

// ============ 3. Assert chuyển đổi mặc đòng ============
const html = convertReal(SAMPLE, DEFAULT_OPTS);
assert.ok(/^<div class="swiper-wrapper">/.test(html), 'Output bắt đầu với swiper-wrapper');
assert.ok(/\t{5}<\/div>$/.test(html), '</div> cuối 5 tabs');

const $out = cheerio.load(html);
assert.strictEqual($out('div.swiper-wrapper > div.swiper-slide').length, 7, 'SAMPLE có 7 kart');
assert.strictEqual($out('div.swiper-slide > p.label').length, 7, 'Mọi slide có p.label');
assert.strictEqual($out('div.swiper-slide > p.label').first().text(), 'Meta tag');

// Slide đầu
const s1 = $out('div.swiper-slide').first();
assert.strictEqual(s1.find('p.tit').text(), 'AI 콘텐츠 크리에이터');
assert.ok(s1.find('p.txt').text().indexOf('AI 기반 스토리텔링') === 0, 'txt z dd');
const img1 = s1.find('div.img > img');
assert.strictEqual(img1.attr('src'), '/_res/sjcu/krsjcu/img/content/ai-creation_work-01.png', 'path đổi + .01 -> -01');
assert.strictEqual(img1.attr('alt'), 'AI 콘텐츠 크리에이터', 'alt = tit');

// · -> &middot; w treści
assert.ok(html.includes('영화&middot;엔터테인먼트 산업 전문가'), 'tit · -> &middot;');
assert.ok(html.includes('웹툰&middot;애니메이션 제작과 광고홍보/마케팅'), 'txt · -> &middot;');

// ============ 4. Tuỳ chọn ============
// Bez label
const noLabel = convertReal(SAMPLE, Object.assign({}, DEFAULT_OPTS, { withLabel: false }));
assert.strictEqual(cheerio.load(noLabel)('div.swiper-slide > p.label').length, 0, 'withLabel=false -> nie ma p.label');

// Bez · -> &middot;
const noMiddot = convertReal(SAMPLE, Object.assign({}, DEFAULT_OPTS, { middot: false }));
assert.ok(noMiddot.includes('영화·엔터테인먼트 산업 전문가'), 'middot=false -> giữ ·');

// Bez dot->dash i path replacement
const rawPath = convertReal(SAMPLE, Object.assign({}, DEFAULT_OPTS, { fromPath: '', toPath: '', dotDash: false }));
assert.ok(rawPath.includes('/_res/sjcu/ko/img/main/ai-creation_work.01.png'), 'bez path-config giữ oryginał src');

// Label tuỳ chỉny
const customLabel = convertReal(SAMPLE, Object.assign({}, DEFAULT_OPTS, { labelText: 'Job' }));
assert.ok(customLabel.includes('<p class="label">Job</p>'), 'Label tuỳ chọn');

// ============ 5. Lỗi ============
assert.throws(function () {
    convertReal('<div>không ma dl</div>', DEFAULT_OPTS);
}, /Không tìm thấy <dl>/, 'Không ma <dl> phải throw');

assert.throws(function () {
    convertReal('<dl><dt></dt><dd>x</dd></dl>', DEFAULT_OPTS);
}, /Không tìm thấy <dt>/, 'Không ma <dt> phải throw');

console.log('🎉 Tất cả assertion PASS — logic career-converter hoạt động đúng.');