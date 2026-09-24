/**
 * Test cho feature-converter.html
 * - Syntax-check tất cả inline <script> trong file tool
 * - Trích core converter và chạy thật với DOM shim dựa trên cheerio
 * - Assert output khớp cấu trúc depart-feature mong muốn
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Polyfill cho Node 18: undici (nạp qua cheerio) cần global File
if (typeof globalThis.File === 'undefined' && typeof require('buffer').File !== 'undefined') {
    globalThis.File = require('buffer').File;
}

const cheerio = require('cheerio');

const TOOL_FILE = path.join(__dirname, 'feature-converter.html');
const file = fs.readFileSync(TOOL_FILE, 'utf8');

// ============ 1. Trích tất cả <script> và syntax-check ============
const scripts = [];
const scriptRe = /<script>([\s\S]*?)<\/script>/g;
let m;
while ((m = scriptRe.exec(file)) !== null) scripts.push(m[1]);

assert.ok(scripts.length >= 3, `Số script block phải >= 3 (thực tế ${scripts.length})`);
scripts.forEach(function (code, i) {
    try { new Function(code); }
    catch (e) { throw new Error(`Syntax error ở script block #${i}: ${e.message}`); }
});
console.log(`OK: syntax OK cho ${scripts.length} inline <script> block`);

const coreBlock = scripts.find(function (s) { return s.indexOf('Core converter') !== -1; });
assert.ok(coreBlock, 'Không tìm thấy core converter script');
// ============ 2. DOM shim (chạy core converter thật trong Node) ============
class FakeNode {
    constructor($, el) { this._$ = $; this._el = el; }
    _qAll(sel) {
        const $ = this._$;
        const el = this._el;
        if (sel.startsWith(':scope > ')) {
            const sub = sel.slice(':scope > '.length);
            return $(el).children(sub).toArray().map(function (n) { return new FakeNode($, n); });
        }
        if (sel === 'parsererror') return [];
        return $(el).find(sel).toArray().map(function (n) { return new FakeNode($, n); });
    }
    querySelector(sel) { const all = this._qAll(sel); return all.length ? all[0] : null; }
    querySelectorAll(sel) { return this._qAll(sel); }
    get textContent() { return this._$(this._el).text(); }
    get innerHTML() { return this._$(this._el).html() || ''; }
    get outerHTML() { return this._$.html(this._el) || ''; }
}

class FakeDocument extends FakeNode {
    constructor($) {
        const root = $.root();
        const bodyEl = root.find('body').get(0) || root.get(0);
        super($, bodyEl);
    }
    get body() { return new FakeNode(this._$, this._el); }
    querySelector(sel) {
        if (sel === 'parsererror') return null;
        const node = this._$(sel).first();
        return node.length ? new FakeNode(this._$, node.get(0)) : null;
    }
}

class FakeDOMParser {
    parseFromString(html) {
        const $ = cheerio.load(html, { decodeEntities: false });
        return new FakeDocument($);
    }
}

const factory = new Function('DOMParser', coreBlock + '\nreturn convertFeatures;');
const convertReal = factory.call(null, FakeDOMParser);

const sampleBlock = scripts.find(function (s) { return s.indexOf('const SAMPLE = `') !== -1; });
assert.ok(sampleBlock, 'Không tìm thấy SAMPLE');
const sample = sampleBlock.match(/const SAMPLE = `([\s\S]*?)`;/)[1];
assert.ok(sample.indexOf('diff_cont') !== -1, 'SAMPLE phải chứa diff_cont');

// ============ 3. Assert kết quả chuyển đổi chính (mặc định 3/3) ============
const res = convertReal(sample, { rowCount: 3, keepColImg: false, withView: true });
assert.strictEqual(res.total, 6, 'Tổng features = 6');
assert.strictEqual(res.row, 3, 'feature-row có 3 item');
assert.strictEqual(res.col, 3, 'feature-column có 3 item');

assert.ok(res.html.startsWith('<div class="depart-feature">\n'), 'Bắt đầu bằng <div class="depart-feature">');
assert.ok(res.html.trimEnd().endsWith('</div>'), 'Kết thúc bằng </div>');
assert.ok(!/diff_cont|aos-init|data-aos|thumb_img|dot_list|<dl\b|<dt\b|<dd\b/.test(res.html),
    'Không còn tag/class của định dạng cũ');

const $o = cheerio.load(res.html, { decodeEntities: false });
assert.strictEqual($o('.feature-row').length, 1, 'Có đúng 1 feature-row');
assert.strictEqual($o('.feature-column').length, 1, 'Có đúng 1 feature-column');
assert.strictEqual($o('.feature-row > ul > li').length, 3, 'feature-row có 3 <li>');
assert.strictEqual($o('.feature-column > ul > li').length, 3, 'feature-column có 3 <li>');

const rowLabels = $o('.feature-row > ul > li > p.label').map(function () { return $o(this).text(); }).get();
const colLabels = $o('.feature-column > ul > li > p.label').map(function () { return $o(this).text(); }).get();
assert.deepStrictEqual(rowLabels, ['Features 01', 'Features 02', 'Features 03'], 'Label feature-row');
assert.deepStrictEqual(colLabels, ['Features 04', 'Features 05', 'Features 06'], 'Label feature-column');

$o('.feature-row > ul > li').each(function (i) {
    const img = $o(this).find('.img img').attr('src');
    assert.ok(img === `/_res/sjcu/ko/img/dept/fire_administration_intro_diff_img_${i + 1}.jpg`,
        `Row img #${i + 1} đúng src`);
});
$o('.feature-column > ul > li').each(function () {
    assert.strictEqual($o(this).find('.img').length, 0, 'Column (mặc định) không có .img');
});

$o('.feature-row > ul > li, .feature-column > ul > li').each(function () {
    assert.strictEqual($o(this).find('p.txt01').length, 1, 'có p.txt01');
    assert.strictEqual($o(this).find('.txt02 ul.ul-dot.cir').length, 1, 'có ul.ul-dot.cir');
    const view = $o(this).find('a.view');
    assert.strictEqual(view.length, 1, 'có a.view');
    assert.strictEqual(view.attr('title'), '펼쳐보기/접기', 'title a.view');
    assert.strictEqual(view.find('span').length, 2, 'a.view có 2 span');
});

function normHtmlText(t) { return (t || '').replace(/\s+/g, ' ').trim(); }
const $s = cheerio.load(sample, { decodeEntities: false });
$s('.diff_cont > dl').each(function (i) {
    const srcTitle = normHtmlText($s(this).find('dt > p').text());
    const srcLiTexts = $s(this).find('ul.dot_list > li').map(function () {
        return normHtmlText($s(this).text());
    }).get();
    const srcImg = $s(this).find('.thumb_img img').attr('src') || null;

    const section = i < 3 ? '.feature-row' : '.feature-column';
    const outLi = $o(`${section} > ul > li`).eq(i < 3 ? i : i - 3);

    assert.strictEqual(normHtmlText(outLi.find('p.txt01').text()), srcTitle, `txt01 feature #${i + 1}`);
    const outLiTexts = outLi.find('ul.ul-dot.cir > li').map(function () {
        return normHtmlText($o(this).text());
    }).get();
    assert.deepStrictEqual(outLiTexts, srcLiTexts, `List items feature #${i + 1}`);

    if (i < 3) {
        assert.strictEqual(outLi.find('.img img').attr('src'), srcImg, `Ảnh feature #${i + 1}`);
    }
});

const srcBr = $s('.diff_cont > dl').eq(2).find('ul.dot_list > li').eq(1).find('br').length;
const outBr = $o('.feature-row > ul > li').eq(2).find('ul.ul-dot.cir > li').eq(1).find('br').length;
assert.strictEqual(outBr, srcBr, 'Số thẻ <br> được giữ nguyên');

// Indent hợp lý: mọi dòng <li> phải có đúng 7 tabs (bên trong ul-dot cir) hoặc 3 tabs (li cấp section)
res.html.split('\n').forEach(function (line) {
    if (/^\t*<li>/.test(line)) {
        const ind = (line.match(/^\t*/) || [''])[0].length;
        assert.ok(ind === 7 || ind === 3,
            'dòng <li> phải có 3 hoặc 7 tabs, thực tế ' + ind + ': ' + line.slice(0, 40));
    }
});
// Format feature 01 (chuẩn theo mẫu)
const feature01Snippet =
    '<p class="label">Features 01</p>\n' +
    '\t\t\t\t<div class="img"><img src="/_res/sjcu/ko/img/dept/fire_administration_intro_diff_img_1.jpg" alt=""></div>\n' +
    '\t\t\t\t<div class="txt">\n' +
    '\t\t\t\t\t<p class="txt01">공무원 준비를 위한 맞춤형 교과 운영</p>\n' +
    '\t\t\t\t\t<div class="txt02">\n' +
    '\t\t\t\t\t\t<ul class="ul-dot cir">\n' +
    '\t\t\t\t\t\t\t<li>공무원 수험 준비 어려우시죠?<br>소방공무원 관련 필수 교과 및 방재직렬공무원 관련 교과를 풍부한 실전 경험과 강의 경력이 있는 교수님들과 학점 이수와 수험 준비에 최적화된 맞춤형 학습으로 한 발 앞서가세요~</li>\n' +
    '\t\t\t\t\t\t</ul>\n' +
    '\t\t\t\t\t</div><a class="view" href="#a" title="펼쳐보기/접기"><span>펼쳐보기</span><span>접기</span></a></div>';
assert.ok(res.html.includes(feature01Snippet), 'Format feature 01 khớp mẫu');

// ============ 4. Tuỳ chọn ============
const resKeepImg = convertReal(sample, { rowCount: 3, keepColImg: true, withView: true });
const $k = cheerio.load(resKeepImg.html, { decodeEntities: false });
assert.strictEqual($k('.feature-column > ul > li .img img').length, 3, 'keepColImg=true -> column giữ ảnh');

const resRow4 = convertReal(sample, { rowCount: 4, keepColImg: false, withView: true });
assert.strictEqual(resRow4.row, 4, 'rowCount=4 -> row có 4 item');
assert.strictEqual(resRow4.col, 2, 'rowCount=4 -> column có 2 item');

const resNoView = convertReal(sample, { rowCount: 3, keepColImg: false, withView: false });
assert.ok(!resNoView.html.includes('class="view"'), 'withView=false -> không có a.view');

// ============ 5. Fallback: không có .diff_cont nhưng có <dl> ============
const bareDls =
    '<dl><dt><span>Features. 01</span><p>Title A</p></dt><dd><ul class="dot_list"><li>Item 1</li></ul></dd></dl>' +
    '<dl><dt><span>Features. 02</span><p>Title B</p></dt><dd><ul class="dot_list"><li>Item 2</li></ul></dd></dl>' +
    '<dl><dt><span>Features. 03</span><p>Title C</p></dt><dd><ul class="dot_list"><li>Item 3</li></ul></dd></dl>' +
    '<dl><dt><span>Features. 04</span><p>Title D</p></dt><dd><ul class="dot_list"><li>Item 4</li></ul></dd></dl>';
const resBare = convertReal(bareDls, { rowCount: 3, keepColImg: false, withView: true });
assert.strictEqual(resBare.total, 4, 'Fallback parse được <dl> lẻ');
assert.strictEqual(resBare.row, 3, 'Fallback row = 3');
assert.strictEqual(resBare.col, 1, 'Fallback col = 1');

// ============ 6. HTML không có <dl> -> báo lỗi ============
assert.throws(function () {
    convertReal('<div>không có dl</div>', { rowCount: 3, keepColImg: false, withView: true });
}, /<dl>/, 'Phải throw khi không tìm thấy <dl>');

// ============ 7. Label không dấu chấm vẫn giữ nguyên ============
const plainLabelDl =
    '<div class="diff_cont"><dl><dt><span>Feature 01</span><p>Title</p></dt>' +
    '<dd><ul class="dot_list"><li>a</li></ul></dd></dl></div>';
const resPlain = convertReal(plainLabelDl, { rowCount: 3, keepColImg: false, withView: true });
const $p = cheerio.load(resPlain.html);
assert.strictEqual($p('p.label').text(), 'Feature 01', 'Label không dấu chấm giữ nguyên');

// Ghi output của SAMPLE ra file để đối chiếu trực quan
fs.writeFileSync(path.join(__dirname, 'sample-output.html'), res.html);
console.log('Đã ghi sample-output.html để đối chiếu.');

console.log('🎉 Tất cả assertion PASS — logic converter hoạt động đúng.');
