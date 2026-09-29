/**
 * Test cho features2.html
 * - Syntax-check tất cả inline <script> trong file tool
 * - Trích core converter (div.diff_cont -> ul.swiper-wrapper) và chạy thật với DOM shim dựa trên cheerio
 * - Assert output khớp CHÍNH XÁC template: <ul class="swiper-wrapper"> / <li class="swiper-slide">
 *   / p.label / div.img / div.txt > p.txt01 line1 / div.txt02 > ul.ul-dot.cir / a.view
 * - Kiểm tra tuỳ chọn: label (autoNum / prefix / startNo), mẫu src ảnh {NN}, line1, a.view,
 *   bỏ div.txt02 + a.view khi <dl> không có ul.dot_list, gộp / tách ul.swiper-wrapper
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Polyfill cho Node 18: undici (nạp qua cheerio) cần global File
if (typeof globalThis.File === 'undefined' && typeof require('buffer').File !== 'undefined') {
    globalThis.File = require('buffer').File;
}

const cheerio = require('cheerio');

const TOOL_FILE = path.join(__dirname, 'features2.html');
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

const sampleMatch = coreBlock.match(/const SAMPLE_HTML = `([\s\S]*?)`;/);
assert.ok(sampleMatch && sampleMatch[1].indexOf('diff_cont') !== -1, 'SAMPLE phải là khối .diff_cont');
assert.ok(sampleMatch[1].indexOf('Features. 01') !== -1, 'SAMPLE phải có label Features. 01');
assert.ok(sampleMatch[1].indexOf('class="no_dd"') !== -1, 'SAMPLE phải có <dl class="no_dd">');
const SAMPLE_RAW = sampleMatch[1];
// Giải mã escape trong template literal (\t -> tab thật) đúng như browser khi chạy tool
assert.strictEqual(SAMPLE_RAW.indexOf('`'), -1, 'SAMPLE_RAW không chứa backtick');
assert.strictEqual(SAMPLE_RAW.indexOf('${'), -1, 'SAMPLE_RAW không chứa ${');
const SAMPLE = new Function('return `' + SAMPLE_RAW + '`;')();
assert.ok(SAMPLE.indexOf('\t') !== -1, 'SAMPLE đã giải mã \\t thành tab thật');

// ============ 2. DOM shim (chạy core converter thật trong Node) ============
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
        if (sel.startsWith(':scope > ')) {
            const sub = sel.slice(':scope > '.length);
            return $(el).children(sub).toArray().map(n => new FakeNode($, n));
        }
        if (sel === 'parsererror') return [];
        return $(el).find(sel).toArray().map(n => new FakeNode($, n));
    }
    querySelector(sel) { const all = this._qAll(sel); return all.length ? all[0] : null; }
    querySelectorAll(sel) { return this._qAll(sel); }
    getAttribute(name) {
        const val = this._$(this._el).attr(name);
        return val === undefined ? null : val;
    }
    get textContent() { return this._$(this._el).text(); }
    get innerHTML() { return this._$(this._el).html() || ''; }
    // childNodes: cần cho elementText() (<br> -> khoảng trắng)
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
    '\nreturn { cleanText, escapeHtml, pad2, elementText, normalizeLabel, wordFrom, labelFromDt, makeLabel, viewLink, inlineHtml, pushLi, imgSrc, extractBlocks, buildSlide, buildWrapper, convertFeatures2 };');
const core = factory.call(null, FakeDOMParser);
const convert = core.convertFeatures2;
const DEFAULT_OPTS = {};

// ============ 2b. Template mong muốn (viết tay theo mẫu trang: 6/7/8/9/10 tab) ============
function expectSlide(label, src, alt, title, lis, opts) {
    const o = opts || {};
    const view = (o.withView === false || o.skipTxt02)
        ? ''
        : '<a class="view" href="' + (o.href || '#a') + '" title="펼쳐보기/접기"><span>펼쳐보기</span><span>접기</span></a>';
    const out = [];
    out.push(T(6) + '<li class="swiper-slide">');
    out.push(T(7) + '<p class="label">' + label + '</p>');
    out.push(T(7) + '<div class="img"><img src="' + src + '" alt="' + alt + '"></div>');
    out.push(T(7) + '<div class="txt">');
    out.push(T(8) + '<p class="' + (o.line1 === false ? 'txt01' : 'txt01 line1') + '">' + title + '</p>');
    if (!o.skipTxt02) {
        if (lis.length) {
            out.push(T(8) + '<div class="txt02">');
            out.push(T(9) + '<ul class="ul-dot cir">');
            lis.forEach(li => out.push(T(10) + '<li>' + li + '</li>'));
            out.push(T(9) + '</ul>');
        } else {
            out.push(T(8) + '<div class="txt02"></div>');
        }
    }
    out.push(T(8) + ((!o.skipTxt02 && lis.length) ? '</div>' : '') + view + '</div>');
    out.push(T(6) + '</li>');
    return out;
}

function expectWrapper(slides) {
    return ['<ul class="swiper-wrapper">'].concat(...slides, ['</ul>']).join('\n');
}

// ============ 3. Input nhỏ -> so khớp CHÍNH XÁC từng dòng ============
const SMALL_INPUT = `<div class="diff_cont">
\t<dl data-aos="fade-up" class="aos-init aos-animate">
\t\t<dt>Features. 01<p>식문화 스토리텔링 &amp; 큐레이션</p>
\t\t</dt>
\t\t<dd>
\t\t\t<ul class="dot_list">
\t\t\t\t<li>식재료의 역사, 글로벌 미식 트렌드, 인문학적 식문화를 탐구합니다</li>
\t\t\t\t<li>음식을 하나의 문화 콘텐츠로 다루고, 커피, 와인, 전통주 등과의 감각적인 페어링 능력을 키웁니다.</li>
\t\t\t</ul><a class="btn01 col03 more_ic" href="#" title="접힘">더보기</a>
\t\t\t<div class="thumb_img"><img src="/_res/sjcu/krsjcu/img/content/content02-img01.jpg" alt=""></div>
\t\t</dd>
\t</dl>
\t<dl data-aos="fade-up" class="aos-init">
\t\t<dt>Features. 02<p>F&amp;B 브랜딩 &amp; 공간 디렉팅</p>
\t\t</dt>
\t\t<dd>
\t\t\t<ul class="dot_list">
\t\t\t\t<li>콘셉트 기획부터 공간 연출, 메뉴 구성, 고객 경험 디자인까지 외식 브랜딩의 전 과정을 체계적으로 배웁니다.</li>
\t\t\t\t<li>고객의 마음을 사로잡는 서비스 오퍼레이션과 매장 경영 전략을 습득합니다.</li>
\t\t\t</ul><a class="btn01 col03 more_ic" href="#" title="접힘">더보기</a>
\t\t\t<div class="thumb_img"><img src="/_res/sjcu/krsjcu/img/content/content02-img02.jpg" alt="F&amp;B 브랜딩"></div>
\t\t</dd>
\t</dl>
\t<dl data-aos="fade-up">
\t\t<dt>Features. 03<p>온∙오프라인 하이브리드 교육</p>
\t\t</dt>
\t\t<dd>
\t\t\t<ul class="dot_list">
\t\t\t\t<li>온라인으로 언제 어디서나 이론과 실무적 체계를 학습합니다.</li>
\t\t\t\t<li>오프라인 현장 경험을 통해 완벽하게 체득합니다.</li>
\t\t\t</ul>
\t\t\t<div class="thumb_img"><img src="/_res/sjcu/krsjcu/img/content/content02-img03.jpg" alt=""></div>
\t\t</dd>
\t</dl>
</div>`;

const expectedSmall = expectWrapper([
    expectSlide('Features 01', '/_res/sjcu/krsjcu/img/content/content02-img01.jpg', '', '식문화 스토리텔링 &amp; 큐레이션', [
        '식재료의 역사, 글로벌 미식 트렌드, 인문학적 식문화를 탐구합니다',
        '음식을 하나의 문화 콘텐츠로 다루고, 커피, 와인, 전통주 등과의 감각적인 페어링 능력을 키웁니다.'
    ]),
    expectSlide('Features 02', '/_res/sjcu/krsjcu/img/content/content02-img02.jpg', 'F&amp;B 브랜딩', 'F&amp;B 브랜딩 &amp; 공간 디렉팅', [
        '콘셉트 기획부터 공간 연출, 메뉴 구성, 고객 경험 디자인까지 외식 브랜딩의 전 과정을 체계적으로 배웁니다.',
        '고객의 마음을 사로잡는 서비스 오퍼레이션과 매장 경영 전략을 습득합니다.'
    ]),
    expectSlide('Features 03', '/_res/sjcu/krsjcu/img/content/content02-img03.jpg', '', '온∙오프라인 하이브리드 교육', [
        '온라인으로 언제 어디서나 이론과 실무적 체계를 학습합니다.',
        '오프라인 현장 경험을 통해 완벽하게 체득합니다.'
    ])
]);

const small = convert(SMALL_INPUT, DEFAULT_OPTS);
assert.strictEqual(small.html, expectedSmall, 'Output phải khớp CHÍNH XÁC template ul.swiper-wrapper');
assert.strictEqual(small.wrapperCount, 1, '1 khối -> 1 ul.swiper-wrapper');
assert.strictEqual(small.slides, 3, '3 <dl> -> 3 slide');
assert.strictEqual(small.empty, 0, 'Không <dl> nào thiếu ul.dot_list');
assert.deepStrictEqual(small.labels, ['Features 01', 'Features 02', 'Features 03'], 'label bỏ dấu chấm, giữ 2 chữ số');
assert.deepStrictEqual(small.titles, ['식문화 스토리텔링 & 큐레이션', 'F&B 브랜딩 & 공간 디렉팅', '온∙오프라인 하이브리드 교육'], 'txt01 = text <dt><p>');
assert.strictEqual(small.html.split('\n')[0], '<ul class="swiper-wrapper">', 'Dòng đầu là ul.swiper-wrapper (0 tab)');
assert.strictEqual(small.html.split('\n').pop(), '</ul>', 'Dòng cuối là </ul> (0 tab)');
console.log('OK: chuyển đổi chính xác template ul.swiper-wrapper (khớp từng dòng)');

// ============ 4. Input thật: 4 <dl> (trong đó 1 <dl class="no_dd"> chỉ có ảnh) ============
const $src = cheerio.load(SAMPLE, { decodeEntities: false });
const srcDls = $src('div.diff_cont > dl');
assert.strictEqual(srcDls.length, 4, 'SAMPLE có 4 <dl>');

const srcInfo = srcDls.toArray().map(function (dl) {
    const $dl = $src(dl);
    const dt = $dl.children('dt').first();
    const img = $dl.children('dd').find('.thumb_img img').first();
    return {
        title: dt.children('p').first().text().trim(),
        lis: $dl.children('dd').find('ul.dot_list > li').toArray().map(li => $src(li).html().trim()),
        src: img.attr('src') || '',
        alt: img.attr('alt') || ''
    };
});
assert.strictEqual(srcInfo[2].lis.length, 0, '<dl class="no_dd"> không có ul.dot_list');

const expectedReal = expectWrapper(srcInfo.map(function (info, i) {
    return expectSlide('Features ' + String(i + 1).padStart(2, '0'), info.src, info.alt, info.title, info.lis);
}));

const real = convert(SAMPLE, DEFAULT_OPTS);
assert.strictEqual(real.html, expectedReal, 'Input thật -> khớp chính xác template swiper');
assert.strictEqual(real.wrapperCount, 1, 'SAMPLE -> 1 ul.swiper-wrapper');
assert.strictEqual(real.slides, 4, 'SAMPLE có 4 slide');
assert.strictEqual(real.empty, 1, 'SAMPLE có 1 slide thiếu ul.dot_list');
assert.deepStrictEqual(real.labels, ['Features 01', 'Features 02', 'Features 03', 'Features 04'], 'label liên tục 01..04');

const $real = cheerio.load(real.html, { decodeEntities: false });
const $slides = $real('ul.swiper-wrapper > li.swiper-slide');
assert.strictEqual($slides.length, 4, 'Output có 4 <li class="swiper-slide">');
assert.strictEqual($real('li.swiper-slide > div.img > img').length, 4, 'Mỗi slide 1 <div class="img"><img>');
assert.strictEqual($real('div.txt > p.txt01.line1').length, 4, 'p.txt01 luôn có class line1');
assert.strictEqual($real('div.txt02 > ul.ul-dot.cir').length, 3, '3 slide có ul.ul-dot.cir');
assert.strictEqual($real('ul.ul-dot.cir > li').length, 3, 'Tổng 3 <li> trong ul.ul-dot.cir');
assert.strictEqual($real('a.view').length, 4, 'Mỗi slide 1 a.view');
assert.strictEqual($real('a.view span').length, 8, 'a.view có 2 <span> (펼쳐보기 / 접기)');
assert.deepStrictEqual($real('a.view').toArray().map(a => $real(a).attr('href')), ['#a', '#a', '#a', '#a'], 'href mặc định #a');
assert.deepStrictEqual($real('a.view').toArray().map(a => $real(a).attr('title')), ['펼쳐보기/접기', '펼쳐보기/접기', '펼쳐보기/접기', '펼쳐보기/접기']);
assert.deepStrictEqual($real('a.view').first().find('span').toArray().map(s => $real(s).text()), ['펼쳐보기', '접기']);
assert.deepStrictEqual($slides.toArray().map(el => $real(el).find('ul.ul-dot.cir > li').length), [1, 1, 0, 1], 'Số <li> từng slide');
assert.deepStrictEqual($real('li.swiper-slide > div.img > img').toArray().map(img => $real(img).attr('src')), [
    '/_res/sjcu/ko/img/dept/environmen_landscaping_intro_diff_img_1.jpg',
    '/_res/sjcu/ko/img/dept/environmen_landscaping_intro_diff_img_2.jpg',
    '/_res/sjcu/ko/img/dept/environmen_landscaping_intro_diff_img_3.jpg',
    '/_res/sjcu/ko/img/dept/environmen_landscaping_intro_diff_img_4.jpg'
], 'Giữ nguyên src ảnh gốc theo từng slide');

// <dl class="no_dd"> (Features 03): txt02 rỗng nhưng vẫn đủ cấu trúc
const slideNoDd = $slides.eq(2);
assert.strictEqual(slideNoDd.find('div.txt02').length, 1, 'Slide no_dd vẫn có div.txt02');
assert.strictEqual(slideNoDd.find('div.txt02').children().length, 0, 'div.txt02 rỗng, không có <ul>');
assert.strictEqual(slideNoDd.find('div.txt02').text(), '', 'div.txt02 không có nội dung');
assert.strictEqual(slideNoDd.find('a.view').length, 1, 'Vẫn giữ a.view cho slide no_dd');
assert.strictEqual(slideNoDd.find('p.txt01').text(), srcInfo[2].title, 'txt01 lấy từ <dt><p> của <dl class="no_dd">');

// Bỏ sạch: data-aos, a.btn01…더보기, div.thumb_img, ul.dot_list, href gốc
['data-aos', 'aos-init', 'thumb_img', 'dot_list', 'btn01', '더보기', 'col03', 'diff_cont', 'no_dd'].forEach(function (junk) {
    assert.strictEqual(real.html.indexOf(junk), -1, 'Output không còn "' + junk + '"');
});

// Thụt lề đúng cấp cho mọi dòng
real.html.split('\n').forEach(function (line) {
    if (/^\t*<li class="swiper-slide">$/.test(line)) assert.ok(/^\t{6}<li class="swiper-slide">$/.test(line), 'slide = 6 tab: ' + line.slice(0, 30));
    else if (line.indexOf('<p class="label">') !== -1) assert.ok(/^\t{7}<p class="label">/.test(line), 'label = 7 tab: ' + line.slice(0, 30));
    else if (line.indexOf('<div class="img">') !== -1) assert.ok(/^\t{7}<div class="img">/.test(line), 'img = 7 tab');
    else if (line.indexOf('<p class="txt01') !== -1) assert.ok(/^\t{8}<p class="txt01/.test(line), 'txt01 = 8 tab');
    else if (/^\t*<div class="txt02">$/.test(line)) assert.ok(/^\t{8}<div class="txt02">$/.test(line), 'txt02 = 8 tab');
    else if (line.indexOf('<ul class="ul-dot cir">') !== -1) assert.ok(/^\t{9}<ul class="ul-dot cir">$/.test(line), 'ul = 9 tab');
    else if (/^\t*<li>/.test(line)) assert.ok(/^\t{10}<li>/.test(line), 'li trong ul-dot = 10 tab');
    else if (/^\t*<\/div><a class="view"/.test(line)) assert.ok(/^\t{8}<\/div><a class="view"/.test(line), 'dòng đóng txt02 + a.view = 8 tab');
});
console.log('OK: input thật (4 <dl>, 1 no_dd) chuyển đúng template swiper');

// ============ 5. Tuỳ chọn ============
// (a) Tắt tự đánh số -> giữ số có sẵn trong input
const noAuto = convert(SAMPLE.replace('Features. 03', 'Features. 07'), { autoNum: false });
assert.deepStrictEqual(noAuto.labels, ['Features 01', 'Features 02', 'Features 07', 'Features 04'], 'autoNum:false giữ số trong input');

// (b) Tiền tố + số bắt đầu
const prefix = convert(SMALL_INPUT, { prefix: 'Point', startNo: 9 });
assert.deepStrictEqual(prefix.labels, ['Point 09', 'Point 10', 'Point 11'], 'prefix + startNo -> Point 09/10/11');
assert.ok(prefix.html.indexOf(T(7) + '<p class="label">Point 09</p>') !== -1, 'label vẫn ở 7 tab');
assert.strictEqual(convert(SMALL_INPUT, { startNo: 100 }).labels[0], 'Features 100', 'startNo >= 3 chữ số không pad');

// (c) Tiền tố rỗng -> lấy chữ từ input
assert.strictEqual(convert(SMALL_INPUT, { prefix: '' }).labels[0], 'Features 01', 'prefix rỗng -> dùng chữ "Features" từ input');

// (d) Mẫu src ảnh {NN} / {N}
const pattern = convert(SAMPLE, { imgPattern: '/_res/sjcu/krsjcu/img/content/content02-img{NN}.jpg' });
const $pat = cheerio.load(pattern.html, { decodeEntities: false });
assert.deepStrictEqual($pat('li.swiper-slide > div.img > img').toArray().map(img => $pat(img).attr('src')), [
    '/_res/sjcu/krsjcu/img/content/content02-img01.jpg',
    '/_res/sjcu/krsjcu/img/content/content02-img02.jpg',
    '/_res/sjcu/krsjcu/img/content/content02-img03.jpg',
    '/_res/sjcu/krsjcu/img/content/content02-img04.jpg'
], 'imgPattern {NN} thay src theo số slide');
assert.strictEqual($pat('li.swiper-slide').first().find('img').attr('alt'), '', 'alt vẫn lấy từ ảnh gốc');
assert.strictEqual(
    cheerio.load(convert(SAMPLE, { imgPattern: '/x/img{N}.jpg', startNo: 5 }).html)('li.swiper-slide').first().find('img').attr('src'),
    '/x/img5.jpg',
    '{N} không pad 0'
);

// (e) Bỏ class line1 của p.txt01
const noLine1 = convert(SMALL_INPUT, { line1: false });
assert.ok(noLine1.html.indexOf(T(8) + '<p class="txt01">식문화 스토리텔링 &amp; 큐레이션</p>') !== -1, 'line1:false -> class txt01');
assert.strictEqual(cheerio.load(noLine1.html)('p.txt01.line1').length, 0, 'Không còn class line1');

// (f) Bỏ a.view
const noView = convert(SMALL_INPUT, { withView: false });
assert.strictEqual(cheerio.load(noView.html)('a.view').length, 0, 'withView:false -> không có a.view');
assert.ok(noView.html.indexOf(T(8) + '</div></div>') !== -1, 'Dòng đóng: </div> của txt02 + </div> của txt');
assert.strictEqual(noView.slides, 3, 'Vẫn đủ 3 slide');

// (g) <dl> không có ul.dot_list: mặc định giữ cấu trúc, bật optSkipEmpty thì bỏ txt02 + a.view
const NO_LIST_INPUT = `<div class="diff_cont">
\t<dl class="no_dd">
\t\t<dt>Features. 01<p>Chỉ có ảnh và tiêu đề</p></dt>
\t\t<dd>
\t\t\t<div class="thumb_img"><img src="/_res/sjcu/ko/img/dept/a.jpg" alt=""></div>
\t\t</dd>
\t</dl>
</div>`;
const keepStruct = convert(NO_LIST_INPUT, DEFAULT_OPTS);
assert.strictEqual(keepStruct.html, expectWrapper([
    expectSlide('Features 01', '/_res/sjcu/ko/img/dept/a.jpg', '', 'Chỉ có ảnh và tiêu đề', [])
]), 'Mặc định: vẫn đủ cấu trúc div.txt02 rỗng + a.view');
assert.strictEqual(keepStruct.empty, 1, 'Đếm 1 slide không có ul.dot_list');

const slimStruct = convert(NO_LIST_INPUT, { skipEmpty: true });
assert.strictEqual(slimStruct.html, expectWrapper([
    expectSlide('Features 01', '/_res/sjcu/ko/img/dept/a.jpg', '', 'Chỉ có ảnh và tiêu đề', [], { skipTxt02: true })
]), 'skipEmpty:true -> chỉ còn div.img + p.txt01');
assert.strictEqual(slimStruct.html.indexOf('txt02'), -1, 'Không còn div.txt02');
assert.strictEqual(slimStruct.html.indexOf('a.view'), -1, 'Không còn a.view');
assert.strictEqual(slimStruct.empty, 1);

// (h) href tuỳ chỉnh cho a.view
assert.ok(
    convert(NO_LIST_INPUT, { href: 'javascript:;' }).html.indexOf('<a class="view" href="javascript:;" title="펼쳐보기/접기">') !== -1,
    'href tuỳ chỉnh được đưa vào a.view'
);

// (i) multiWrap: mặc định gộp, bật thì mỗi khối 1 ul.swiper-wrapper
const twoBlocks = SMALL_INPUT + '\n' + NO_LIST_INPUT;
const merged = convert(twoBlocks, DEFAULT_OPTS);
assert.strictEqual(merged.wrapperCount, 1, 'Mặc định: gộp tất cả <dl> của mọi khối vào 1 wrapper');
assert.strictEqual(merged.slides, 4, '3 + 1 = 4 slide');
assert.strictEqual(cheerio.load(merged.html)('ul.swiper-wrapper').length, 1);

const split = convert(twoBlocks, { multiWrap: true });
assert.strictEqual(split.wrapperCount, 2, 'multiWrap: 2 khối -> 2 wrapper');
const $split = cheerio.load(split.html);
assert.strictEqual($split('ul.swiper-wrapper').length, 2, 'Output có 2 ul.swiper-wrapper');
assert.deepStrictEqual($split('p.label').toArray().map(el => $split(el).text()), [
    'Features 01', 'Features 02', 'Features 03', 'Features 04'
], 'Số label liên tục qua các wrapper');
assert.strictEqual($split('ul.swiper-wrapper').eq(1).find('p.label').text(), 'Features 04', 'Wrapper 2 tiếp tục số 04');
assert.ok(split.html.indexOf('</ul>\n<ul class="swiper-wrapper">') !== -1, 'Giữa 2 wrapper chỉ xuống dòng, không có dòng trống');
console.log('OK: tuỳ chọn label / ảnh / line1 / a.view / skipEmpty / multiWrap');

// ============ 6. Trường hợp biên ============
// (a) <dl> không có <dd> (chỉ <dt>)
const onlyDt = '<div class="diff_cont"><dl class="no_dd"><dt>Features. 01<p>Only title</p></dt></dl></div>';
const onlyDtOut = convert(onlyDt, DEFAULT_OPTS);
assert.strictEqual(onlyDtOut.titles[0], 'Only title', 'txt01 vẫn lấy từ <dt><p>');
assert.strictEqual(onlyDtOut.empty, 1, 'Không có <dd> -> tính là slide thiếu ul.dot_list');
assert.ok(onlyDtOut.html.indexOf('<div class="img"><img src="" alt=""></div>') !== -1, 'Không có ảnh -> src="" alt=""');

// (b) <dd> có <ul> nhưng không có class dot_list
const plainUl = '<div class="diff_cont"><dl><dt>Features. 01<p>T</p></dt><dd><ul><li>x</li></ul></dd></dl></div>';
assert.strictEqual(cheerio.load(convert(plainUl, DEFAULT_OPTS).html)('ul.ul-dot.cir > li').length, 1, 'Vẫn nhận <ul> không có class dot_list');

// (c) Ảnh nằm ngay trong <dl> (ngoài <dd>) vẫn lấy được
const imgInDl = '<div class="diff_cont"><dl><dt>Features. 01<p>T</p></dt><dd><ul class="dot_list"><li>x</li></ul></dd><div class="thumb_img"><img src="/z.jpg" alt=""></div></dl></div>';
assert.ok(convert(imgInDl, DEFAULT_OPTS).html.indexOf('src="/z.jpg"') !== -1, 'Ảnh ngoài <dd> vẫn lấy được');

// (d) <li> chứa block con -> xuống dòng, thụt lề thêm 1 cấp
const nestedInput = '<div class="diff_cont"><dl><dt>Features. 01<p>T</p></dt><dd><ul class="dot_list"><li>a<ul class="sub"><li>b</li></ul></li><li>c</li></ul></dd></dl></div>';
const nestedOut = convert(nestedInput, DEFAULT_OPTS);
const nestedLines = nestedOut.html.split('\n');
assert.strictEqual(nestedLines.filter(l => l === T(10) + '<li>c</li>').length, 1, '<li> text thuần gộp 1 dòng ở 10 tab');
assert.strictEqual(nestedLines.filter(l => l === T(10) + '<li>').length, 1, '<li> có block con mở ở dòng riêng (10 tab)');
assert.strictEqual(nestedLines.filter(l => /^\t{11}/.test(l)).length, 1, 'Nội dung block con thụt 11 tab');
const $nested = cheerio.load(nestedOut.html);
assert.strictEqual($nested('ul.ul-dot.cir > li').length, 2, 'Chỉ lấy <li> cấp 1 của ul.dot_list');
assert.strictEqual($nested('ul.ul-dot.cir > li').eq(0).find('ul.sub > li').text(), 'b', 'Giữ nguyên list con');

// (e) <br> trong <dt><p> -> khoảng trắng; <br> trong <li> -> gộp 1 dòng
const brTitle = '<div class="diff_cont"><dl><dt>Features. 01<p>Dòng 1<br>Dòng 2</p></dt><dd><ul class="dot_list"><li>x</li></ul></dd></dl></div>';
assert.strictEqual(convert(brTitle, DEFAULT_OPTS).titles[0], 'Dòng 1 Dòng 2', '<br> trong <dt><p> -> khoảng trắng');
const brLi = '<div class="diff_cont"><dl><dt>Features. 01<p>T</p></dt><dd><ul class="dot_list"><li>line 1\n<br>\nline 2</li></ul></dd></dl></div>';
assert.ok(convert(brLi, DEFAULT_OPTS).html.indexOf(T(10) + '<li>line 1<br>line 2</li>') !== -1, '<li> nhiều dòng -> gộp 1 dòng, chuẩn hoá <br>');

// (f) &nbsp; trong <li> giữ nguyên, trong <dt><p> thì trim + gộp
const nbspLi = '<div class="diff_cont"><dl><dt>Features. 01<p>T</p></dt><dd><ul class="dot_list"><li>&nbsp;가 나&nbsp;</li></ul></dd></dl></div>';
const nbspLine = convert(nbspLi, DEFAULT_OPTS).html.split('\n').find(l => l.indexOf('<li>') !== -1);
assert.ok(/\u00a0|&nbsp;/.test(nbspLine), 'nbsp trong <li> được giữ: ' + JSON.stringify(nbspLine));
const nbspTitle = '<div class="diff_cont"><dl><dt>Features. 01<p>\n  &nbsp;Tiêu   đề&nbsp;\n</p></dt><dd><ul class="dot_list"><li>x</li></ul></dd></dl></div>';
assert.strictEqual(convert(nbspTitle, DEFAULT_OPTS).titles[0], 'Tiêu đề', 'txt01 được trim + gộp khoảng trắng/&nbsp;');

// (g) Label nằm trong <span> (kiểu HTML cũ) vẫn đọc được
const spanLabel = '<div class="diff_cont"><dl><dt><span>Features. 09</span><p>T</p></dt><dd><ul class="dot_list"><li>x</li></ul></dd></dl></div>';
assert.deepStrictEqual(convert(spanLabel, { autoNum: false }).labels, ['Features 09'], 'label trong <span> đọc được khi tắt tự đánh số');
assert.deepStrictEqual(convert(spanLabel, DEFAULT_OPTS).labels, ['Features 01'], 'autoNum:true -> đánh số lại từ startNo');

// (h) Escape ký tự đặc biệt trong title / src / alt
const escapeInput = '<div class="diff_cont"><dl><dt>Features. 01<p>Title &amp; <em>em</em> "quote" &lt;tag&gt;</p></dt><dd><ul class="dot_list"><li>x</li></ul></dd></dl></div>';
const escapeOut = convert(escapeInput, DEFAULT_OPTS);
assert.ok(escapeOut.html.indexOf('<p class="txt01 line1">Title &amp; em &quot;quote&quot; &lt;tag&gt;</p>') !== -1, 'Escape &, ", <, > trong txt01');
assert.strictEqual(cheerio.load(escapeOut.html)('p.txt01').text(), 'Title & em "quote" <tag>', 'Text hiển thị đúng sau khi browser unescape');
const ampInput = '<div class="diff_cont"><dl><dt>Features. 01<p>T</p></dt><dd><ul class="dot_list"><li>x</li></ul><div class="thumb_img"><img src="/a.jpg?x=1&amp;y=2" alt="Alt &quot;q&quot;"></div></dd></dl></div>';
assert.ok(
    convert(ampInput, DEFAULT_OPTS).html.indexOf('<div class="img"><img src="/a.jpg?x=1&amp;y=2" alt="Alt &quot;q&quot;"></div>') !== -1,
    'Escape & và " trong src/alt'
);

// (i) Fallback: input chỉ có <dl> trần (không có div.diff_cont)
const bareDls = '<dl><dt>Features. 01<p>A</p></dt><dd><ul class="dot_list"><li>1</li></ul></dd></dl>' +
    '<dl><dt>Features. 02<p>B</p></dt><dd><ul class="dot_list"><li>2</li></ul></dd></dl>';
const bareOut = convert(bareDls, DEFAULT_OPTS);
assert.strictEqual(bareOut.slides, 2, 'Fallback: <dl> trần vẫn chuyển được');
assert.deepStrictEqual(bareOut.titles, ['A', 'B'], 'txt01 = A, B');

// (j) Input là cả trang HTML -> vẫn tìm đúng khối .diff_cont
const pageInput = '<!DOCTYPE html><html><head><title>x</title></head><body><div class="wrap">' + NO_LIST_INPUT + '</div></body></html>';
const pageOut = convert(pageInput, DEFAULT_OPTS);
assert.strictEqual(pageOut.slides, 1, 'Trích được .diff_cont trong trang HTML đầy đủ');
assert.strictEqual(pageOut.html.indexOf('<div class="wrap">'), -1, 'Không mang wrapper ngoài vào output');
console.log('OK: các trường hợp biên (no_dd, ul không class, list con, <br>, &nbsp;, escape, fallback)');

// ============ 7. Lỗi ============
assert.throws(function () { convert('', {}); }, /Chưa có input/, 'Input trống phải throw');
assert.throws(function () { convert('   \n  ', {}); }, /Chưa có input/, 'Input toàn khoảng trắng phải throw');
assert.throws(function () { convert('<div>không có dl</div>', {}); }, /Không tìm thấy/, 'Input không có .diff_cont/<dl> phải throw');
assert.throws(function () { convert('<div class="diff_cont"><p>rỗng</p></div>', {}); }, /Không tìm thấy <dl>/, 'diff_cont không có <dl> phải throw');
console.log('OK: các trường hợp lỗi throw đúng thông báo');

// ============ 8. Smoke test toàn bộ script với DOM giả (kiểm tra wiring id / handler) ============
function makeElement(id) {
    const el = {
        id: id,
        value: '',
        checked: false,
        innerHTML: '',
        classList: { add() {}, remove() {} },
        addEventListener() {},
        select() {},
        getAttribute() { return null; }
    };
    // textContent của DOM thật luôn là string
    let text = '';
    Object.defineProperty(el, 'textContent', {
        get() { return text; },
        set(v) { text = String(v); }
    });
    return el;
}

const registry = {};
const fakeDocument = {
    getElementById(id) {
        if (!registry[id]) registry[id] = makeElement(id);
        return registry[id];
    },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    createElement() { return makeElement('created'); },
    head: { appendChild() {} },
    execCommand() {}
};
function FakeBlob(parts) { this.size = Buffer.byteLength(parts.join(''), 'utf8'); }

const runTool = new Function('document', 'DOMParser', 'Blob', 'navigator',
    coreBlock + '\nreturn { handleConvert: handleConvert, sample: SAMPLE_HTML, out: () => outputText.value,' +
    ' stat: () => ({ slides: statSlides.textContent, empty: statEmpty.textContent, wrap: statWrap.textContent }),' +
    ' toast: () => registryToast() };\n' +
    'function registryToast() { return document.getElementById("toast").textContent; }');
const tool = runTool.call(null, fakeDocument, FakeDOMParser, FakeBlob, { clipboard: { writeText: () => Promise.resolve() } });

// Mặc định của form (giống giá trị trong HTML)
const form = fakeDocument.getElementById('inputText');
['id="optPrefix" value="Features"', 'id="optStartNo" value="1"', 'id="optViewHref" value="#a"',
    'id="optAutoNum" checked', 'id="optLine1" checked', 'id="optView" checked',
    'id="optSkipEmpty">', 'id="optMultiWrap">', 'id="optAutoRun">'].forEach(function (markup) {
    assert.ok(file.indexOf(markup) !== -1, 'HTML phải có ' + markup);
});
registry.optPrefix.value = 'Features';
registry.optAutoNum.checked = true;
registry.optStartNo.value = '1';
registry.optImgPattern.value = '';
registry.optLine1.checked = true;
registry.optView.checked = true;
registry.optViewHref.value = '#a';
registry.optSkipEmpty.checked = false;
registry.optMultiWrap.checked = false;

form.value = SAMPLE;
tool.handleConvert();
assert.strictEqual(fakeDocument.getElementById('outputText').value, expectedReal, 'handleConvert() xuất đúng output với form mặc định');
assert.deepStrictEqual(tool.stat(), { slides: '4', empty: '1', wrap: '1' }, 'Stats cập nhật đúng (4 slide / 1 rỗng / 1 wrapper)');
assert.ok(tool.toast().indexOf('✅') === 0, 'Toast báo thành công: ' + tool.toast());
assert.strictEqual(fakeDocument.getElementById('inputCount').textContent, '(' + SAMPLE.length + ' ký tự)', 'inputCount cập nhật');

// Đổi option trên form -> output đổi theo
registry.optSkipEmpty.checked = true;
registry.optMultiWrap.checked = true;
registry.optAutoNum.checked = false;
registry.optStartNo.value = '7';
registry.optViewHref.value = '/ko/dept/a.do';
tool.handleConvert();
const out2 = fakeDocument.getElementById('outputText').value;
const out2Slides = out2.split(T(6) + '<li class="swiper-slide">').slice(1);
assert.strictEqual(out2Slides.length, 4, '4 slide trong output sau khi đổi option');
assert.strictEqual(out2Slides[2].indexOf('txt02'), -1, 'optSkipEmpty=true -> slide <dl class="no_dd"> bỏ div.txt02');
assert.strictEqual(out2Slides[2].indexOf('a.view'), -1, 'optSkipEmpty=true -> slide <dl class="no_dd"> bỏ a.view');
assert.ok(out2Slides[0].indexOf('<div class="txt02">') !== -1, 'Slide có ul.dot_list vẫn giữ div.txt02');
assert.deepStrictEqual(tool.stat(), { slides: '4', empty: '1', wrap: '1' }, 'Stats vẫn đúng sau khi đổi option');
assert.deepStrictEqual(out2.match(/<p class="label">([^<]+)<\/p>/g), [
    '<p class="label">Features 01</p>',
    '<p class="label">Features 02</p>',
    '<p class="label">Features 03</p>',
    '<p class="label">Features 04</p>'
], 'optAutoNum=false -> giữ đúng số có sẵn trong input');
assert.ok(out2.indexOf('href="/ko/dept/a.do"') !== -1, 'href lấy từ ô optViewHref');

// Nhánh lỗi của handleConvert
form.value = '';
tool.handleConvert();
assert.ok(tool.toast().indexOf('⚠️') === 0, 'Toast cảnh báo khi input trống: ' + tool.toast());
assert.strictEqual(fakeDocument.getElementById('outputText').value, out2, 'Input trống -> giữ nguyên output cũ');

form.value = '   \n  ';
tool.handleConvert();
assert.ok(tool.toast().indexOf('⚠️') === 0, 'Toast cảnh báo khi input toàn khoảng trắng: ' + tool.toast());

form.value = '<div>không có dl</div>';
tool.handleConvert();
assert.ok(tool.toast().indexOf('❌') === 0, 'Toast báo lỗi khi input sai: ' + tool.toast());
assert.strictEqual(fakeDocument.getElementById('outputText').value, '', 'Lỗi -> output được xoá');
assert.deepStrictEqual(tool.stat(), { slides: '0', empty: '0', wrap: '0' }, 'Lỗi -> stats reset về 0');
console.log('OK: smoke test toàn bộ script (DOM giả) — wiring id + handler hoạt động');

console.log('');
console.log('🎉 Tất cả assertion PASS — logic features2 (diff_cont -> ul.swiper-wrapper) hoạt động đúng.');

