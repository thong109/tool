/**
 * Test cho course02.html
 * - Syntax-check tất cả inline <script> trong file tool
 * - Trích core converter (div.subj_cont -> div.box) và chạy thật với DOM shim dựa trên cheerio
 * - Assert output khớp cấu trúc div.box mong muốn (top / bot01 ul.course / bot02 ul.area / btn)
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Polyfill cho Node 18: undici (nạp qua cheerio) cần global File
if (typeof globalThis.File === 'undefined' && typeof require('buffer').File !== 'undefined') {
    globalThis.File = require('buffer').File;
}

const cheerio = require('cheerio');

const TOOL_FILE = path.join(__dirname, 'course02.html');
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
assert.ok(sampleMatch && sampleMatch[1].indexOf('subj_cont') !== -1, 'SAMPLE phải là khối .subj_cont');
const SAMPLE = sampleMatch[1];

// ============ 2. DOM shim (chạy core converter thật trong Node) ============
// Chỉ trích các hàm thuần (bỏ DOM refs / event listeners)
const coreStart = coreBlock.indexOf('function cleanText');
const coreEnd = coreBlock.indexOf('function updateStats');
assert.ok(coreStart !== -1 && coreEnd > coreStart, 'Phải tìm thấy dải hàm thuần của core');
const coreFn = coreBlock.slice(coreStart, coreEnd);

const T = n => '\t'.repeat(n);

class FakeNode {
    constructor($, el) { this._$ = $; this._el = el; }
    _qAll(sel) {
        const $ = this._$;
        const el = this._el;
        return $(el).find(sel).toArray().map(n => new FakeNode($, n));
    }
    querySelector(sel) { const all = this._qAll(sel); return all.length ? all[0] : null; }
    querySelectorAll(sel) { return this._qAll(sel); }
    getAttribute(name) {
        const val = this._$(this._el).attr(name);
        return val === undefined ? null : val;
    }
    get textContent() { return this._$(this._el).text(); }
    // childNodes: cần cho titleText() (bỏ <a>/<br> khỏi p.tit)
    get childNodes() {
        const $ = this._$;
        return $(this._el).contents().toArray().map(n => new FakeChild($, n));
    }
}

class FakeChild extends FakeNode {
    get nodeType() {
        const type = this._el.type;
        if (type === 'text') return 3;
        if (type === 'comment') return 8;
        return 1;
    }
    get tagName() { return this._el.tagName || this._el.name || ''; }
    get nodeValue() { return this._el.data === undefined ? '' : this._el.data; }
}

class FakeDocument extends FakeNode {
    constructor($) { super($, $.root().get(0)); }
    querySelector(sel) {
        if (sel === 'parsererror') return null;
        const node = this._$(sel).first();
        return node.length ? new FakeNode(this._$, node.get(0)) : null;
    }
    querySelectorAll(sel) {
        return this._$(sel).toArray().map(n => new FakeNode(this._$, n));
    }
    get body() {
        const body = this._$('body').first();
        return body.length ? new FakeNode(this._$, body.get(0)) : null;
    }
}

class FakeDOMParser {
    parseFromString(html) {
        const $ = cheerio.load(html, { decodeEntities: true });
        return new FakeDocument($);
    }
}

const factory = new Function('DOMParser', coreFn +
    '\nreturn { cleanText, escapeHtml, titleText, labelsFromDd, extractMajorTab, pad2, extractBlocks, buildBox, convertBoxes };');
const core = factory.call(null, FakeDOMParser);
const convert = core.convertBoxes;

const DEFAULT_OPTS = { courseNo: '03', detailBase: '888', incrementId: false, popupId: '5627', tab: 'auto', href: '#a' };

// ============ 3. Input nhỏ -> so khớp CHÍNH XÁC từng dòng ============
const SMALL_INPUT = `<div class="subj_cont on" style="background-image: url(/_res/sjcu/ko/img/dept/x_bg.jpg);">
	<p class="tit"><br>스마트팜 전문가 과정 <a class="btn01 detail_ic first" href="/ko/dept/smart-farm.do?major_tab=2"><span>과정 상세보기</span></a></p>
	<dl>
		<dt>교과목 안내</dt>
		<dd><span class="label">스마트팜개론</span><span class="label">&nbsp;농업데이터분석&nbsp;</span></dd>
	</dl>
	<dl>
		<dt>취득 자격증</dt>
		<dd><a href="/ko/dept/smart-farm.do?major_tab=2" class="last"><span class="label">스마트팜전문가</span></a></dd>
	</dl>
</div>`;

const expectedSmall = [
    '<div class="box">',
    T(8) + '<div class="top">',
    T(9) + '<p class="cat">Course 03</p>',
    T(9) + '<p class="txt01">스마트팜 전문가 과정</p>',
    T(8) + '</div>',
    T(8) + '<div class="bot">',
    T(9) + '<div class="bot01">',
    T(10) + '<p class="tit">교과목 안내</p>',
    T(10) + '<ul class="course">',
    T(11) + '<li><a class="popup-click" href="#a" id="detail-888" title="스마트팜개론">스마트팜개론</a></li>',
    T(11) + '<li><a class="popup-click" href="#a" id="detail-888" title="농업데이터분석">농업데이터분석</a></li>',
    T(10) + '</ul>',
    T(9) + '</div>',
    T(9) + '<div class="bot02">',
    T(10) + '<p class="tit">취득 자격증</p>',
    T(10) + '<ul class="area">',
    T(11) + '<li><a href="#a" title="스마트팜전문가">스마트팜전문가</a></li>',
    T(10) + '</ul>',
    T(9) + '</div>',
    T(8) + '</div>',
    T(8) + '<div class="btn">',
    T(9) + '<div class="pc"><a class="more popup-click" href="#a" id="5627" tab="2" title="View More"><span>View more</span></a></div>',
    T(9) + '<div class="mo"><a class="view" href="#a" title="펼쳐보기/접기"><span>펼쳐보기</span><span>접기</span></a><a class="detail popup-click" href="#a" id="5627" tab="2" title="자세히보기">자세히보기</a></div>',
    T(8) + '</div>',
    '</div>'
].join('\n');

const small = convert(SMALL_INPUT, DEFAULT_OPTS);
assert.strictEqual(small.html, expectedSmall, 'Output phải khớp chính xác template div.box');
assert.strictEqual(small.boxCount, 1, '1 block -> 1 box');
assert.strictEqual(small.courseCount, 2, 'Đếm đúng 2 môn học trong ul.course');
assert.strictEqual(small.areaCount, 1, 'Đếm đúng 1 mục trong ul.area');
assert.deepStrictEqual(small.titles, ['스마트팜 전문가 과정'], 'txt01 = tiêu đề p.tit (bỏ nút 상세보기)');
console.log('OK: chuyển đổi chính xác template div.box (top/bot01/bot02/btn)');

// ============ 4. Input thật (경ㆍ공매투자 전문가 과정) ============
const real = convert(SAMPLE, DEFAULT_OPTS);
const $real = cheerio.load(real.html, { decodeEntities: false });

assert.strictEqual(real.boxCount, 1, 'SAMPLE -> 1 box');
assert.strictEqual(real.courseCount, 14, 'SAMPLE có 14 môn học');
assert.strictEqual(real.areaCount, 1, 'SAMPLE có 1 mục 취득 수료증');
assert.strictEqual($real('div.box > div.top > p.cat').text(), 'Course 03', 'p.cat = Course + số thứ tự');
assert.strictEqual($real('p.txt01').text(), '경ㆍ공매투자 전문가 과정', 'txt01 bỏ <br> và nút 과정 상세보기');
assert.strictEqual($real('div.bot01 > p.tit').text(), '전문가가 되기 위한 교과목 안내', 'bot01 tit = dt thứ nhất');
assert.strictEqual($real('div.bot02 > p.tit').text(), '취득 수료증', 'bot02 tit = dt thứ hai');
assert.strictEqual($real('ul.course > li').length, 14, 'ul.course có 14 <li>');
assert.strictEqual($real('ul.area > li').length, 1, 'ul.area có 1 <li>');

$real('ul.course > li > a').each(function (i, el) {
    const $a = $real(el);
    assert.strictEqual($a.attr('class'), 'popup-click', 'a trong ul.course phải có class popup-click');
    assert.strictEqual($a.attr('href'), '#a', 'href mặc định #a');
    assert.strictEqual($a.attr('id'), 'detail-888', 'id mặc định detail-888');
    assert.strictEqual($a.attr('title'), $a.text(), 'title trùng nội dung text');
    assert.strictEqual($a.attr('title'), core.cleanText($a.attr('title')), 'label được trim');
});
assert.strictEqual($real('ul.course > li > a').first().attr('title'), '현대부동산학의이해');
assert.strictEqual($real('ul.course > li > a').eq(2).attr('title'), '경매와부실채권(NPL)투자실무', 'giữ nguyên dấu ngoặc');
assert.strictEqual($real('ul.course > li > a').last().attr('title'), 'AI를활용한놀라운부동산투자분석');

const $areaA = $real('ul.area > li > a');
assert.strictEqual($areaA.attr('href'), '#a', 'ul.area href mặc định #a');
assert.strictEqual($areaA.attr('title'), '경ㆍ공매투자 전문가', 'ul.area title = text label');
assert.strictEqual($areaA.text(), '경ㆍ공매투자 전문가', 'ul.area text = label');
assert.strictEqual($areaA.attr('class'), undefined, 'ul.area không dùng popup-click');

// tab tự lấy từ ?major_tab=1, id popup mặc định 5627
const $btn = $real('div.box > div.btn');
assert.strictEqual($btn.find('a.more').attr('id'), '5627', 'a.more id = 5627');
assert.strictEqual($btn.find('a.more').attr('tab'), '1', 'tab tự lấy major_tab từ p.tit');
assert.strictEqual($btn.find('a.more').attr('title'), 'View More');
assert.strictEqual($btn.find('a.more span').text(), 'View more');
assert.strictEqual($btn.find('div.mo a.detail').attr('tab'), '1', 'a.detail cùng tab');
assert.strictEqual($btn.find('div.mo a.detail').text(), '자세히보기');
assert.strictEqual($btn.find('div.mo a.view span').first().text(), '펼쳐보기');

// Không giữ href gốc / background-image
assert.ok(real.html.indexOf('real-estate-asset-expert.do') === -1, 'Không mang href gốc của CMS vào output');
assert.ok(real.html.indexOf('background-image') === -1, 'Bỏ inline style background-image');
assert.ok(real.html.indexOf('과정 상세보기') === -1, 'Bỏ nút 과정 상세보기 khỏi txt01');
console.log('OK: input thật (14 môn + 수료증) chuyển đúng sang div.box');

// ============ 5. Tuỳ chọn ============
// id tăng dần
const inc = convert(SAMPLE, { ...DEFAULT_OPTS, detailBase: '900', incrementId: true });
const $inc = cheerio.load(inc.html);
assert.strictEqual($inc('ul.course > li > a').first().attr('id'), 'detail-900');
assert.strictEqual($inc('ul.course > li > a').last().attr('id'), 'detail-913', 'id cuối = 900 + 13');

// href tuỳ chỉnh cho tất cả link (14 môn + 1 area + 3 a trong .btn)
const custom = convert(SAMPLE, { ...DEFAULT_OPTS, href: '#popup1' });
assert.strictEqual((custom.html.match(/href="#popup1"/g) || []).length, 18, 'Mọi link dùng href tuỳ chỉnh');

// tab cố định + id popup + Course số
const opt2 = convert(SAMPLE, { courseNo: '12', detailBase: '777', popupId: '1234', tab: '7', href: '#a' });
const $opt2 = cheerio.load(opt2.html);
assert.strictEqual($opt2('p.cat').text(), 'Course 12', 'Course số theo tuỳ chọn');
assert.strictEqual($opt2('a.more').attr('tab'), '7', 'tab cố định khi nhập số');
assert.strictEqual($opt2('a.more').attr('id'), '1234', 'id popup tuỳ chỉnh');
assert.strictEqual($opt2('a.detail').attr('id'), '1234', 'a.detail cùng id popup');
assert.strictEqual($opt2('ul.course > li > a').first().attr('id'), 'detail-777', 'detail base tuỳ chỉnh');
console.log('OK: các tuỳ chọn (id, href, popup, tab, Course số) áp dụng đúng');

// ============ 6. Nhiều block .subj_cont -> nhiều box ============
const two = convert(SMALL_INPUT + '\n' + SMALL_INPUT, DEFAULT_OPTS);
const $two = cheerio.load(two.html);
assert.strictEqual(two.boxCount, 2, '2 block -> 2 box');
assert.deepStrictEqual($two('p.cat').toArray().map(el => $two(el).text()), ['Course 03', 'Course 04'], 'Course số tự tăng');
assert.strictEqual($two('div.box').length, 2, 'Output có 2 div.box');
assert.strictEqual(two.courseCount, 4, 'Tổng môn học của cả 2 box');

const twoFlat = convert(SMALL_INPUT + '\n' + SMALL_INPUT, { ...DEFAULT_OPTS, autoCourseNo: false });
const $twoFlat = cheerio.load(twoFlat.html);
assert.strictEqual($twoFlat('p.cat').first().text(), 'Course 03', 'Tắt tự tăng: box 1 giữ số gốc');
assert.strictEqual($twoFlat('p.cat').last().text(), 'Course 03', 'Tắt tự tăng: box 2 giữ số gốc');

// Course số >= 3 chữ số
assert.strictEqual(cheerio.load(convert(SMALL_INPUT, { ...DEFAULT_OPTS, courseNo: '100' }).html)('p.cat').text(), 'Course 100', 'Không pad khi đã >= 2 chữ số');
console.log('OK: nhiều block -> nhiều div.box, Course số tự tăng');

// ============ 7. Input không có wrapper .subj_cont / chỉ 1 <dl> ============
const loose = `<p class="tit">과정 B <a href="/ko/dept/b.do?major_tab=3"><span>보기</span></a></p>
<dl><dt>교과목</dt><dd><span class="label">과목A</span><span class="label">과목B</span></dd></dl>`;
const looseOut = convert(loose, DEFAULT_OPTS);
const $loose = cheerio.load(looseOut.html, { decodeEntities: false });
assert.strictEqual(looseOut.boxCount, 1, 'Fallback: input không có .subj_cont vẫn chuyển được');
assert.strictEqual($loose('p.txt01').text(), '과정 B', 'txt01 lấy từ p.tit');
assert.strictEqual($loose('a.more').attr('tab'), '3', 'tab lấy từ link trong p.tit');
assert.strictEqual($loose('div.bot02').length, 0, 'Chỉ có 1 <dl> -> không sinh bot02');
assert.strictEqual($loose('ul.course > li').length, 2, '2 label -> 2 <li>');
console.log('OK: fallback không có .subj_cont + trường hợp chỉ 1 <dl>');

// ============ 8. <a> ở cả 2 <dl> + escape ký tự đặc biệt ============
const anchorsInput = `<div class="subj_cont">
	<p class="tit">과정 C</p>
	<dl><dt>교과목</dt><dd><a href="/ko/dept/c.do?major_tab=1"><span class="label">과목1</span></a><a href="/ko/dept/c.do?major_tab=2"><span class="label">과목&amp;2</span></a></dd></dl>
	<dl><dt>자격증</dt><dd><span class="label">자격증A</span><span class="label">자격증B</span></dd></dl>
</div>`;
const aOut = convert(anchorsInput, DEFAULT_OPTS);
const $aOut = cheerio.load(aOut.html);
assert.strictEqual($aOut('ul.course > li').length, 2, 'dl đầu dùng <a> vẫn ra ul.course');
assert.strictEqual($aOut('ul.area > li').length, 2, 'dl sau dùng span vẫn ra ul.area');
assert.strictEqual($aOut('ul.area > li > a').first().text(), '자격증A', 'ul.area lấy text label');
assert.strictEqual($aOut('ul.course > li > a').eq(1).attr('title'), '과목&2', 'title decode entity đúng');
assert.ok(aOut.html.indexOf('과목&amp;2') !== -1, 'Escape & trong attribute/text');
assert.ok(aOut.html.indexOf('/ko/dept/c.do') === -1, 'Không giữ href gốc của CMS');
assert.strictEqual($aOut('a.more').attr('tab'), '1', 'tab lấy từ link trong <dl> khi p.tit không có link');
assert.strictEqual($aOut('p.cat').text(), 'Course 03', 'vẫn pad Course 03');
console.log('OK: input dùng <a> ở cả 2 <dl> + escape ký tự đặc biệt');

// ============ 9. Lỗi ============
assert.throws(function () { convert('', {}); }, /Chưa có input/, 'Input trống phải throw');
assert.throws(function () { convert('   \n  ', {}); }, /Chưa có input/, 'Input toàn khoảng trắng phải throw');
assert.throws(function () { convert('<br><p>không có gì</p>', {}); }, /Không tìm thấy/, 'Input không có .subj_cont/<dl> phải throw');
console.log('OK: các trường hợp lỗi throw đúng thông báo');

console.log('');
console.log('🎉 Tất cả assertion PASS — logic course02 (subj_cont -> div.box) hoạt động đúng.');
