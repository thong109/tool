/**
 * Test cho course-converter.html
 * - Syntax-check tất cả inline <script> trong file tool
 * - Trích core converter và chạy thật với DOM shim dựa trên cheerio
 * - Assert output khớp cấu trúc ul.course mong muốn
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Polyfill cho Node 18: undici (nạp qua cheerio) cần global File
if (typeof globalThis.File === 'undefined' && typeof require('buffer').File !== 'undefined') {
    globalThis.File = require('buffer').File;
}

const cheerio = require('cheerio');

const TOOL_FILE = path.join(__dirname, 'course-converter.html');
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
assert.ok(sampleMatch && sampleMatch[1].indexOf('span class="label"') !== -1, 'SAMPLE phải chứa span.label');
const SAMPLE = sampleMatch[1];

// ============ 2. DOM shim (chạy core converter thật trong Node) ============
// Chỉ trích các hàm thuần (bỏ DOM refs / event listeners)
const coreStart = coreBlock.indexOf('function cleanLabel');
const coreEnd = coreBlock.indexOf('function updateStats');
assert.ok(coreStart !== -1 && coreEnd > coreStart, 'Phải tìm thấy dải hàm thuần của core');
const coreFn = coreBlock.slice(coreStart, coreEnd);

class FakeNode {
    constructor($, el) { this._$ = $; this._el = el; }
    _qAll(sel) {
        const $ = this._$;
        const el = this._el;
        return $(el).find(sel).toArray().map(function (n) { return new FakeNode($, n); });
    }
    querySelector(sel) { const all = this._qAll(sel); return all.length ? all[0] : null; }
    querySelectorAll(sel) { return this._qAll(sel); }
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
    querySelectorAll(sel) {
        const nodes = this._$(sel).toArray();
        return nodes.map(function (n) { return new FakeNode(this._$, n); }, this);
    }
}

class FakeDOMParser {
    parseFromString(html) {
        const $ = cheerio.load(html, { decodeEntities: false });
        return new FakeDocument($);
    }
}

const factory = new Function('DOMParser', coreFn + '\nreturn convertCourses;');
const convertReal = factory.call(null, FakeDOMParser);

// ============ 3. Assert chuyển đổi mặc định (id cố định 888) ============
const html = convertReal(SAMPLE, { detailBase: 888, incrementId: false, href: '#a' });
assert.ok(/^<ul class="course">/.test(html), 'Output phải bắt đầu bằng <ul class="course">');
assert.ok(/<\/ul>$/.test(html), 'Output phải kết thúc bằng </ul>');

const $out = cheerio.load(html, { decodeEntities: false });
assert.strictEqual($out('ul.course > li').length, 15, 'SAMPLE có 15 môn học');
assert.strictEqual($out('ul.course > li a.popup-click').length, 15, 'Mỗi li chứa a.popup-click');
assert.ok(!html.includes('\u00a0'), 'Output không được còn nbsp');

$out('ul.course > li a').each(function (i, el) {
    const $el = $out(el);
    assert.strictEqual($el.attr('class'), 'popup-click', 'a phải có class popup-click');
    assert.strictEqual($el.attr('href'), '#a', 'href mặc định #a');
    assert.strictEqual($el.attr('id'), 'detail-888', 'id mặc định không tăng dần');
    assert.strictEqual($el.attr('title'), $el.text(), 'title trùng nội dung text');
});

assert.strictEqual($out('ul.course > li a').first().attr('title'), '소방학개론');
assert.strictEqual($out('ul.course > li a').eq(2).attr('title'), '재난관계법규', '&nbsp; bị trim');
assert.strictEqual($out('ul.course > li a').eq(10).attr('title'), '재난대응사례론', '&nbsp; bị trim ở môn 11');
assert.strictEqual($out('ul.course > li a').eq(14).attr('title'), '화재폭발조사실무');

// ============ 4. Tuỳ chọn ============
// Tăng dần id
const htmlInc = convertReal(SAMPLE, { detailBase: 900, incrementId: true, href: '#a' });
const $inc = cheerio.load(htmlInc);
assert.strictEqual($inc('ul.course > li a').first().attr('id'), 'detail-900');
assert.strictEqual($inc('ul.course > li a').eq(14).attr('id'), 'detail-914');

// href tuỳ chỉnh
const htmlHref = convertReal(SAMPLE, { detailBase: 888, incrementId: false, href: '#popup1' });
assert.ok(htmlHref.includes('href="#popup1"'), 'href tuỳ chỉnh được áp dụng');

// Text thuần (mỗi dòng một môn học)
const plain = ['소방학개론', '소방법규해설', '행정법'].join('\n');
const htmlPlain = convertReal(plain, { detailBase: 888, incrementId: false, href: '#a' });
assert.strictEqual(cheerio.load(htmlPlain)('ul.course > li').length, 3, 'Text thuần chuyển được');

// Text thuần có dòng trống -> bỏ qua
const htmlBlank = convertReal('소방학개론\n\n행정법\n', { detailBase: 888, incrementId: false, href: '#a' });
assert.strictEqual(cheerio.load(htmlBlank)('ul.course > li').length, 2, 'Bỏ dòng trống');

// ============ 5. Lỗi ============
assert.throws(function () {
    convertReal('', {});
}, /Không tìm thấy/, 'Input trống phải throw');

assert.throws(function () {
    convertReal('<br>', {});
}, /Không tìm thấy/, 'HTML không còn label sau khi strip phải throw');

console.log('🎉 Tất cả assertion PASS — logic course-converter hoạt động đúng.');
