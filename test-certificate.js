/**
 * Test cho certificate.html
 * - Syntax-check tất cả inline <script> trong file tool
 * - Trích core converter (div.licn_box của dept_section.dept_licn -> div.swiper-wrapper)
 *   và chạy thật với DOM shim dựa trên cheerio
 * - Assert output khớp CHÍNH XÁC template: div.swiper-wrapper / div.swiper-slide / p.cat /
 *   div.img > img / div.txt > p.txt01 + p.txt02 + a.view.popup-click
 * - Kiểm tra tuỳ chọn: p.cat, chuẩn hoá tiêu đề (기사자격증 -> 기사/…산업기사 자격증, bỏ "소개"),
 *   alt = tiêu đề, mẫu ảnh mới {n}, href/id/tab/text của a.view, bỏ box rỗng, bỏ p.txt02 rỗng
 * - Kiểm tra fallback (box không có div.text_wrap / div.thumb_img, dept_licn không có licn_box con,
 *   cả trang HTML) + lỗi throw
 * - Smoke test toàn bộ script với DOM giả (wiring id / handler / stats / toast)
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Polyfill cho Node 18: undici (nạp qua cheerio) cần global File
if (typeof globalThis.File === 'undefined' && typeof require('buffer').File !== 'undefined') {
    globalThis.File = require('buffer').File;
}

const cheerio = require('cheerio');

const TOOL_FILE = path.join(__dirname, 'certificate.html');
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
assert.ok(sampleMatch && sampleMatch[1].indexOf('class="dept_section dept_licn"') !== -1, 'SAMPLE phải là khối .dept_section.dept_licn');
assert.ok(sampleMatch[1].indexOf('class="licn_wrap aos-init aos-animate"') !== -1, 'SAMPLE phải có <div class="licn_wrap">');
assert.ok(sampleMatch[1].indexOf('class="licn_box aos-init aos-animate"') !== -1, 'SAMPLE phải có <div class="licn_box">');
assert.ok(sampleMatch[1].indexOf('<p class="tit">조경기사자격증</p>') !== -1, 'SAMPLE phải có tiêu đề licn_box 1');
assert.ok(sampleMatch[1].indexOf('class="thumb_img"') !== -1, 'SAMPLE phải có div.thumb_img');
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
    '\nreturn { cleanText, escapeHtml, elementText, normalizeTitle, applyImgPattern, viewLink, hasClass, cleanHeading, extractUnits, buildSlide, buildWrapper, convertCertificate };');
const core = factory.call(null, FakeDOMParser);
const convert = core.convertCertificate;
const DEFAULT_OPTS = {};

// ============ 2b. Template mong muốn (viết tay theo mẫu trang: 6/7/8 tab, </div> cuối 5 tab) ============
function expectSlide(o) {
    const cat = o.cat === undefined ? '국가자격증' : o.cat;
    const viewText = o.viewText || '취득과정 전체보기';
    const view = '<a class="view popup-click" href="' + (o.href || '#a') +
        '" id="' + (o.id || 'detail-1000') +
        '" tab="' + o.tab + '" title="' + viewText + '">' + viewText + '</a>';
    const out = [];
    out.push(T(6) + '<div class="swiper-slide">');
    out.push(T(7) + '<p class="cat">' + cat + '</p>');
    out.push(T(7) + '<div class="img"><img src="' + o.src + '" alt="' + o.alt + '"></div>');
    out.push(T(7) + '<div class="txt">');
    out.push(T(8) + '<p class="txt01">' + o.txt01 + '</p>');
    if (o.dropDesc) {
        out.push(T(8) + view + '</div>');
    } else {
        out.push(T(8) + '<p class="txt02">' + o.txt02 + '</p>' + view + '</div>');
    }
    out.push(T(6) + '</div>');
    return out;
}

function expectWrapper(slides) {
    return ['<div class="swiper-wrapper">'].concat(...slides, [T(5) + '</div>']).join('\n');
}

// ============ 3. Input nhỏ -> so khớp CHÍNH XÁC từng dòng ============
const SMALL_INPUT = `<div class="dept_section dept_licn">
\t<p class="sec_subtit aos-init aos-animate" data-aos="fade-up">전문 교수진이 지원하는 자격증</p>
\t<div class="licn_wrap aos-init aos-animate" data-aos="fade-up">
\t\t<div class="licn_box aos-init aos-animate" data-aos="fade-up">
\t\t\t<div class="thumb_img"><img src="/_res/sjcu/krsjcu/img/content/cert01.jpg" alt=""></div>
\t\t\t<div class="text_wrap">
\t\t\t\t<p class="tit">바리스타 자격증 소개</p>
\t\t\t\t<p class="desc">커피의 원두 선택, 로스팅, 추출, 품질 평가 등 커피에 관한 전문지식과 능력에 대해 인증하는 민간자격증</p><a class="text_btn" href="/ko/dept/cert.do?major_tab=0">자격증 상세보기</a></div>
\t\t</div>
\t\t<div class="licn_box">
\t\t\t<div class="thumb_img"><img src="/_res/sjcu/krsjcu/img/content/cert02.jpg" alt="소믈리에 자격증"></div>
\t\t\t<div class="text_wrap"><p class="tit">소믈리에 자격증</p></div>
\t\t</div>
\t</div>
</div>`;

const expectedSmall = expectWrapper([
    expectSlide({
        src: '/_res/sjcu/krsjcu/img/content/cert01.jpg',
        alt: '바리스타 자격증',
        txt01: '바리스타 자격증',
        txt02: '커피의 원두 선택, 로스팅, 추출, 품질 평가 등 커피에 관한 전문지식과 능력에 대해 인증하는 민간자격증',
        tab: 1
    }),
    expectSlide({
        src: '/_res/sjcu/krsjcu/img/content/cert02.jpg',
        alt: '소믈리에 자격증',
        txt01: '소믈리에 자격증',
        txt02: '',
        tab: 2
    })
]);

const smallOut = convert(SMALL_INPUT, DEFAULT_OPTS);
assert.strictEqual(smallOut.html, expectedSmall, 'Output phải khớp CHÍNH XÁC template (từng dòng)');
assert.strictEqual(smallOut.slides, 2, 'SMALL_INPUT có 2 licn_box -> 2 slide');
assert.strictEqual(smallOut.skipped, 0, 'Không box nào rỗng');
assert.deepStrictEqual(smallOut.tabs, [1, 2], 'tab tự tăng 1, 2');
assert.deepStrictEqual(smallOut.titles, ['바리스타 자격증', '소믈리에 자격증'], 'txt01 đã bỏ hậu tố 소개');
assert.deepStrictEqual(smallOut.cats, ['국가자격증', '국가자격증'], 'p.cat mặc định 국가자격증');

// Thụt lề + thứ tự dòng như mẫu trang
const smallLines = smallOut.html.split('\n');
assert.strictEqual(smallLines[0], '<div class="swiper-wrapper">', 'Dòng 1 = wrapper, 0 tab');
assert.strictEqual(smallLines[1], T(6) + '<div class="swiper-slide">', 'Dòng 2 = slide, 6 tab');
assert.strictEqual(smallLines[2], T(7) + '<p class="cat">국가자격증</p>', 'Dòng 3 = p.cat, 7 tab');
assert.strictEqual(smallLines[4], T(7) + '<div class="txt">', 'Dòng 5 = div.txt, 7 tab');
assert.strictEqual(smallLines[5].indexOf(T(8) + '<p class="txt01">'), 0, 'p.txt01 = 8 tab');
assert.strictEqual(smallLines[6].indexOf(T(8) + '<p class="txt02">'), 0, 'p.txt02 = 8 tab');
assert.ok(smallLines[5].indexOf('a.view') === -1, 'a.view không nằm trên dòng p.txt01');
assert.ok(smallLines[6].indexOf('</p><a class="view popup-click" href="#a" id="detail-1000" tab="1" title="취득과정 전체보기">취득과정 전체보기</a></div>') !== -1,
    'a.view dính liền sau p.txt02 rồi đóng div.txt trên cùng dòng');
assert.strictEqual(smallLines[7], T(6) + '</div>', 'Đóng slide = 6 tab');
assert.strictEqual(smallLines[smallLines.length - 1], T(5) + '</div>', 'Đóng wrapper = 5 tab (theo mẫu trang)');

// Text hiển thị sau khi browser unescape
const $small = cheerio.load(smallOut.html);
assert.strictEqual($small('div.swiper-wrapper > div.swiper-slide').length, 2, 'cheerio thấy 2 slide');
assert.strictEqual($small('p.cat').first().text(), '국가자격증');
assert.strictEqual($small('a.view.popup-click').length, 2, 'Mỗi slide 1 a.view.popup-click');
assert.strictEqual($small('a.view').first().attr('id'), 'detail-1000');
assert.strictEqual($small('div.txt > p.txt02').first().text(), '커피의 원두 선택, 로스팅, 추출, 품질 평가 등 커피에 관한 전문지식과 능력에 대해 인증하는 민간자격증');
assert.strictEqual($small('div.txt').eq(1).find('p.txt02').text(), '', 'Box 2 không có desc -> p.txt02 rỗng nhưng vẫn đủ cấu trúc');
assert.ok(!smallOut.html.includes('\u00a0'), 'Output không chứa nbsp');
assert.strictEqual($small('div.swiper-slide').first().find('div.img > img').attr('alt'), '바리스타 자격증', 'alt = txt01 (không lấy alt rỗng gốc)');
console.log('OK: input nhỏ khớp chính xác template div.swiper-wrapper / div.swiper-slide');

// ============ 4. Ví dụ thật (dept_licn có 4 licn_box) ============
// Ảnh mới: {n} = số thứ tự slide (giống giá trị mặc định của ô optImgPattern)
const IMG_PATTERN = '/_res/sjcu/krsjcu/img/content/environmen_landscaping_certificate_intro_bg_{n}.jpg';

const realOut = convert(SAMPLE, DEFAULT_OPTS);
const $real = cheerio.load(realOut.html);
assert.strictEqual(realOut.slides, 4, 'SAMPLE có 4 licn_box -> 4 slide');
assert.strictEqual(realOut.boxCount, 4, 'boxCount = 4');
assert.strictEqual(realOut.skipped, 0, 'Không box nào rỗng');
assert.strictEqual($real('div.swiper-wrapper > div.swiper-slide').length, 4, 'cheerio thấy 4 slide');
assert.deepStrictEqual(realOut.titles, [
    '조경기사/조경산업기사 자격증',
    '자연생태복원기사/자연생태복원산업기사 자격증',
    '식물보호기사/식물보호산업기사 자격증',
    '골프코스관리사 자격증'
], 'txt01: 기사자격증 -> 기사/…산업기사 자격증, …사자격증 -> …사 자격증, thuần 국립기사 giữ nguyên');
assert.deepStrictEqual(realOut.tabs, [1, 2, 3, 4], 'tab = 1, 2, 3, 4');
assert.deepStrictEqual(realOut.cats, ['국가자격증', '국가자격증', '국가자격증', '국가자격증'], 'p.cat mặc định');

assert.deepStrictEqual($real('div.img > img').map(function () { return $real(this).attr('src'); }).get(), [
    '/_res/sjcu/ko/img/dept/A_horizontal_image_of_a_modern_park_with_tall_ligh.jpg',
    '/_res/sjcu/ko/img/dept/environmen_landscaping_intro_licn_img_2.jpg',
    '/_res/sjcu/ko/img/dept/environmen_landscaping_intro_licn_img_3.jpg',
    '/_res/sjcu/ko/img/dept/environmen_landscaping_intro_licn_img_4.jpg'
], 'Không có optImgPattern -> giữ src gốc của thumb_img theo đúng thứ tự box');
assert.deepStrictEqual($real('div.img > img').map(function () { return $real(this).attr('alt'); }).get(), realOut.titles, 'alt = txt01 từng slide');

const rs1 = $real('div.swiper-slide').first();
assert.strictEqual(rs1.find('p.cat').text(), '국가자격증', 'p.cat mặc định');
assert.strictEqual(rs1.find('p.txt01').text(), '조경기사/조경산업기사 자격증');
assert.strictEqual(rs1.find('div.img > img').attr('src'), '/_res/sjcu/ko/img/dept/A_horizontal_image_of_a_modern_park_with_tall_ligh.jpg');
assert.strictEqual(rs1.find('div.img > img').attr('alt'), '조경기사/조경산업기사 자격증', 'alt = txt01');
assert.ok(rs1.find('p.txt02').text().indexOf('작은 정원으로부터 도시나 국토공간에 이르는 대단위 공간을 대상으로') === 0, 'txt02 = p.desc của licn_box 1');

const rs4 = $real('div.swiper-slide').last();
assert.strictEqual(rs4.find('p.txt01').text(), '골프코스관리사 자격증');
assert.ok(rs4.find('p.txt02').text().indexOf('잔디 관리의 실무능력을 갖춘 자를 대상으로') === 0, 'txt02 = p.desc của licn_box 4 (민간자격)');

$real('a.view.popup-click').each(function (i) {
    const $a = $real(this);
    assert.strictEqual($a.attr('class'), 'view popup-click', 'a phải có class view popup-click');
    assert.strictEqual($a.attr('href'), '#a', 'href mặc định #a');
    assert.strictEqual($a.attr('id'), 'detail-1000', 'id mặc định detail-1000');
    assert.strictEqual($a.attr('tab'), String(i + 1), 'tab tự tăng theo slide');
    assert.strictEqual($a.attr('title'), '취득과정 전체보기', 'title = text link');
    assert.strictEqual($a.text(), '취득과정 전체보기', 'text link');
    assert.strictEqual($a.parent().attr('class'), 'txt', 'a.view nằm trong div.txt');
});

// Với pattern ảnh mới -> khớp CHÍNH XÁC template trang 자격증 (4 slide, ảnh bg_1..bg_4)
const patterned = convert(SAMPLE, { imgPattern: IMG_PATTERN });
const $pat = cheerio.load(patterned.html);
assert.deepStrictEqual($pat('div.img > img').map(function () { return $pat(this).attr('src'); }).get(), [
    '/_res/sjcu/krsjcu/img/content/environmen_landscaping_certificate_intro_bg_1.jpg',
    '/_res/sjcu/krsjcu/img/content/environmen_landscaping_certificate_intro_bg_2.jpg',
    '/_res/sjcu/krsjcu/img/content/environmen_landscaping_certificate_intro_bg_3.jpg',
    '/_res/sjcu/krsjcu/img/content/environmen_landscaping_certificate_intro_bg_4.jpg'
], 'optImgPattern: thay {n} bằng số thứ tự slide (1-based)');
assert.strictEqual(patterned.html, expectWrapper([
    expectSlide({
        src: '/_res/sjcu/krsjcu/img/content/environmen_landscaping_certificate_intro_bg_1.jpg',
        alt: '조경기사/조경산업기사 자격증', txt01: '조경기사/조경산업기사 자격증',
        txt02: '작은 정원으로부터 도시나 국토공간에 이르는 대단위 공간을 대상으로 식물이나 각종재료를 이용하여 미적, 기능적으로 계획, 설계, 시공, 관리하는 인력양성하고자 자격제도를 제정하였음',
        tab: 1
    }),
    expectSlide({
        src: '/_res/sjcu/krsjcu/img/content/environmen_landscaping_certificate_intro_bg_2.jpg',
        alt: '자연생태복원기사/자연생태복원산업기사 자격증', txt01: '자연생태복원기사/자연생태복원산업기사 자격증',
        txt02: '자연생태계의 체계적관리, 훼손된 생태계의 환경친화적복원, 생태계위해성평가 등을 할 수 있는 전문인력을 양성하기 위하여 자격제도를 제정하였음',
        tab: 2
    }),
    expectSlide({
        src: '/_res/sjcu/krsjcu/img/content/environmen_landscaping_certificate_intro_bg_3.jpg',
        alt: '식물보호기사/식물보호산업기사 자격증', txt01: '식물보호기사/식물보호산업기사 자격증',
        txt02: '기후변화와 재배 기술의 발달로 식물 병·해충의 발생 양상이 복잡해지고, 농약사용에 따른 환경오염 문제, 식품에 농약의 잔류독성 문제가 야기됨에 따라 효과적인 식물보호를 위한 전문적인 지식과 기능을 갖춘 고급 인력 양성을 위한 자격제도',
        tab: 3
    }),
    expectSlide({
        src: '/_res/sjcu/krsjcu/img/content/environmen_landscaping_certificate_intro_bg_4.jpg',
        alt: '골프코스관리사 자격증', txt01: '골프코스관리사 자격증',
        txt02: '잔디 관리의 실무능력을 갖춘 자를 대상으로 일정 수준의 이론 시험을 거쳐 골프장, 잔디 구장 등의 녹지를 과학적이고 친황경적으로 관리할 수 있는 전문가 양성을 위한 자격제도(민간자격)',
        tab: 4
    })
]), 'Output 4 slide khớp chính xác template (thụt lề 6/7/8 tab, tab 1..4)');

// Chỉ lấy phần giới thiệu của mỗi box: bỏ tiêu đề section / a.text_btn / class aos / comment / nbsp
['전문 교수진이 지원하는 자격증', 'aos-init', 'data-aos', 'dept_licn', 'licn_wrap', 'licn_box', 'text_btn', 'major_tab', 'sec_subtit', '<!--', '\u00a0'].forEach(function (needle) {
    assert.strictEqual(patterned.html.indexOf(needle), -1, 'Output không được chứa: ' + needle);
});
console.log('OK: ví dụ thật 4 licn_box -> 4 slide (cat / img / txt01 / txt02 / a.view)');

// ============ 5. Tuỳ chọn ============
// (a) p.cat tuỳ chỉnh
const catOut = convert(SMALL_INPUT, { cat: '민간자격증' });
assert.deepStrictEqual(catOut.cats, ['민간자격증', '민간자격증'], 'cats theo ô nhập');
assert.strictEqual((catOut.html.match(/<p class="cat">민간자격증<\/p>/g) || []).length, 2, 'p.cat xuất 2 lần');
assert.strictEqual(cheerio.load(convert(SMALL_INPUT, { cat: '   ' }).html)('p.cat').first().text(), '국가자격증', 'cat rỗng -> mặc định');

// (b) titleFix = false -> giữ nguyên tiêu đề gốc (không bỏ "소개", không mở rộng 기사자격증)
const keepIntro = convert(SMALL_INPUT, { titleFix: false });
assert.deepStrictEqual(keepIntro.titles, ['바리스타 자격증 소개', '소믈리에 자격증'], 'titleFix=false -> giữ nguyên tiêu đề');
assert.strictEqual(cheerio.load(keepIntro.html)('p.txt01').first().text(), '바리스타 자격증 소개');

// (c) altFromTit = false -> giữ alt gốc của <img>
const rawAlt = convert(SMALL_INPUT, { altFromTit: false });
assert.strictEqual(cheerio.load(rawAlt.html)('div.img > img').first().attr('alt'), '', 'alt gốc rỗng được giữ');
assert.strictEqual(cheerio.load(rawAlt.html)('div.img > img').last().attr('alt'), '소믈리에 자격증', 'alt gốc của box 2');

// (d) tabStart / tabInc
assert.deepStrictEqual(convert(SMALL_INPUT, { tabStart: 5 }).tabs, [5, 6], 'tabStart=5 -> 5, 6');
assert.deepStrictEqual(convert(SMALL_INPUT, { tabStart: 5, tabInc: false }).tabs, [5, 5], 'tabInc=false -> giữ nguyên 5');
assert.deepStrictEqual(convert(SMALL_INPUT, { tabStart: 'x' }).tabs, [1, 2], 'tabStart không phải số -> 1, 2');

// (e) href / id / text của a.view
const linkOut = convert(SMALL_INPUT, { href: '/ko/dept/cert.do', popupId: '7777', viewText: '자세히보기' });
const $link = cheerio.load(linkOut.html);
assert.strictEqual($link('a.view').first().attr('href'), '/ko/dept/cert.do', 'href tuỳ chỉnh');
assert.strictEqual($link('a.view').first().attr('id'), '7777', 'id tuỳ chỉnh');
assert.strictEqual($link('a.view').first().attr('title'), '자세히보기', 'title tuỳ chỉnh');
assert.strictEqual($link('a.view').first().text(), '자세히보기', 'text tuỳ chỉnh');
assert.strictEqual($link('a.view').first().attr('tab'), '1', 'tab vẫn giữ 1');
assert.ok(linkOut.html.indexOf('<a class="view popup-click" href="/ko/dept/cert.do" id="7777" tab="1" title="자세히보기">자세히보기</a>') !== -1, 'Thứ tự attr khớp mẫu');

// (f) dropEmptyDesc -> bỏ <p class="txt02"></p> của box không có desc
const dropDesc = convert(SMALL_INPUT, { dropEmptyDesc: true });
assert.strictEqual(dropDesc.html.indexOf('<p class="txt02"></p>'), -1, 'dropEmptyDesc -> không còn p.txt02 rỗng');
assert.ok(dropDesc.html.indexOf('<p class="txt02">커피의 원두 선택') !== -1, 'Box có desc vẫn giữ p.txt02');
assert.ok(dropDesc.html.indexOf(T(8) + '<a class="view popup-click"') !== -1, 'a.view đứng riêng dòng 8 tab khi bỏ txt02');

// (g) Kết hợp nhiều tuỳ chọn -> so khớp CHÍNH XÁC
const comboOut = convert(SMALL_INPUT, { cat: '민간자격증', tabStart: 3, href: '/a.do', popupId: '9', viewText: '보기', dropEmptyDesc: true });
assert.strictEqual(comboOut.html, expectWrapper([
    expectSlide({
        cat: '민간자격증', src: '/_res/sjcu/krsjcu/img/content/cert01.jpg', alt: '바리스타 자격증',
        txt01: '바리스타 자격증', txt02: '커피의 원두 선택, 로스팅, 추출, 품질 평가 등 커피에 관한 전문지식과 능력에 대해 인증하는 민간자격증',
        tab: 3, href: '/a.do', id: '9', viewText: '보기'
    }),
    expectSlide({
        cat: '민간자격증', src: '/_res/sjcu/krsjcu/img/content/cert02.jpg', alt: '소믈리에 자격증',
        txt01: '소믈리에 자격증', txt02: '', tab: 4, href: '/a.do', id: '9', viewText: '보기', dropDesc: true
    })
]), 'Output combo option khớp chính xác template');
console.log('OK: tuỳ chọn cat / titleFix / altFromTit / imgPattern / href / id / tab / viewText / dropEmptyDesc');

// ============ 6. Trường hợp biên ============
const boxA = '<div class="licn_box"><div class="thumb_img"><img src="/a.jpg" alt=""></div><div class="text_wrap"><p class="tit">A 자격증 소개</p></div></div>';
const boxB = '<div class="licn_box"><div class="thumb_img"><img src="/b.jpg" alt=""></div><div class="text_wrap"><p class="tit">B 자격증</p></div></div>';

// (a) Box không có div.text_wrap -> lấy p.tit / p.desc trực tiếp trong box
const noWrapOut = convert('<div class="licn_box"><div class="thumb_img"><img src="/a.jpg" alt=""></div><p class="tit">Tiêu đề A</p><p class="desc">Mô tả A</p></div>', DEFAULT_OPTS);
assert.strictEqual(cheerio.load(noWrapOut.html)('p.txt01').text(), 'Tiêu đề A', 'Fallback p.tit trong box');
assert.strictEqual(cheerio.load(noWrapOut.html)('p.txt02').text(), 'Mô tả A', 'Fallback p.desc trong box');

// (b) Box trần chỉ có tiêu đề (không ảnh, không desc)
const bareTabOut = convert('<div class="licn_box"><p class="tit">X</p></div>', DEFAULT_OPTS);
assert.strictEqual(cheerio.load(bareTabOut.html)('p.txt01').text(), 'X', 'Fallback box không text_wrap');
assert.strictEqual(cheerio.load(bareTabOut.html)('p.txt02').text(), '', 'Không có p.desc -> p.txt02 rỗng');
assert.strictEqual(cheerio.load(bareTabOut.html)('div.img > img').attr('src'), '', 'Không có ảnh -> src rỗng');

// (c) &nbsp; + <br> trong tiêu đề -> gộp khoảng trắng; desc chỉ có <br> -> p.txt02 rỗng nhưng vẫn có
const brOut = convert('<div class="licn_box"><div class="thumb_img"><img src="/a.jpg" alt="ALT"></div><div class="text_wrap"><p class="tit">A&nbsp;B<br>C</p><p class="desc"><br></p></div></div>', DEFAULT_OPTS);
assert.strictEqual(cheerio.load(brOut.html)('p.txt01').text(), 'A B C', 'nbsp + <br> -> khoảng trắng');
assert.strictEqual(cheerio.load(brOut.html)('p.txt02').text(), '', 'desc chỉ có <br> -> rỗng');
assert.ok(brOut.html.indexOf('<p class="txt02"></p>') !== -1, 'Vẫn giữ đủ cấu trúc p.txt02');
assert.strictEqual(cheerio.load(brOut.html)('div.img > img').attr('alt'), 'A B C', 'alt = txt01 đã chuẩn hoá');

// (d) Ảnh / chữ chỉ tìm trong phạm vi 1 box -> không lấy lẫn của box khác
const scopeOut = convert('<div class="dept_section dept_licn"><div class="licn_wrap"><div class="licn_box"><div class="text_wrap"><p class="tit">Box 1 자격증</p></div></div><div class="licn_box"><div class="thumb_img"><img src="/lecture.jpg" alt=""></div><div class="text_wrap"><p class="tit">Box 2 자격증</p></div></div></div></div>', DEFAULT_OPTS);
const $scope = cheerio.load(scopeOut.html);
assert.strictEqual($scope('div.swiper-slide').eq(0).find('div.img > img').attr('src'), '', 'Box 1 không có ảnh -> không lấy ảnh của box 2');
assert.strictEqual($scope('div.swiper-slide').eq(1).find('div.img > img').attr('src'), '/lecture.jpg', 'Box 2 lấy đúng ảnh của mình');
assert.deepStrictEqual(scopeOut.titles, ['Box 1 자격증', 'Box 2 자격증'], 'Tiêu đề đúng từng box');

// (e) Escape ký tự đặc biệt trong txt01 / txt02 / src
const escOut = convert('<div class="licn_box"><div class="thumb_img"><img src="/a.php?x=1&amp;y=2" alt=""></div><div class="text_wrap"><p class="tit">T &amp; "q" &lt;tag&gt;</p><p class="desc">D &lt;b&gt;</p></div></div>', DEFAULT_OPTS);
assert.ok(escOut.html.indexOf('<p class="txt01">T &amp; &quot;q&quot; &lt;tag&gt;</p>') !== -1, 'Escape &, ", <, > trong txt01');
assert.ok(escOut.html.indexOf('<p class="txt02">D &lt;b&gt;</p>') !== -1, 'Escape < > trong txt02');
assert.ok(escOut.html.indexOf('src="/a.php?x=1&amp;y=2"') !== -1, 'Giữ nguyên entity trong src');
assert.strictEqual(cheerio.load(escOut.html)('p.txt01').text(), 'T & "q" <tag>', 'Text hiển thị đúng sau khi unescape');

// (f) Input chỉ có các .licn_box trần (không có div.dept_licn bao ngoài)
const bareBoxesOut = convert(boxA + boxB, DEFAULT_OPTS);
assert.strictEqual(bareBoxesOut.slides, 2, 'Fallback .licn_box trần');
assert.deepStrictEqual(bareBoxesOut.tabs, [1, 2], 'tab vẫn tự tăng 1, 2');
console.log('OK: biên phần 1 (box không text_wrap / phạm vi ảnh từng box / escape / box trần)');

// (g) dept_licn có nhiều licn_wrap, mỗi wrap nhiều box -> lấy đủ mọi box theo thứ tự
const multiOut = convert('<div class="dept_section dept_licn"><div class="licn_wrap">' + boxA + '</div><div class="licn_wrap">' + boxB + boxB + '</div></div>', DEFAULT_OPTS);
assert.strictEqual(multiOut.slides, 3, '3 licn_box trong 2 licn_wrap -> 3 slide');
assert.strictEqual(multiOut.boxCount, 3, 'boxCount = 3');
assert.deepStrictEqual(multiOut.titles, ['A 자격증', 'B 자격증', 'B 자격증'], 'Giữ đúng thứ tự box');
assert.strictEqual(multiOut.html.indexOf('licn_wrap'), -1, 'Không mang licn_wrap vào output');
assert.deepStrictEqual(multiOut.cats, ['국가자격증', '국가자격증', '국가자격증'], 'Không có p.tit nhóm -> p.cat = ô Category (국가자격증)');

// (h) Input là cả trang HTML -> vẫn chỉ lấy 2 box
const pageOut = convert('<!DOCTYPE html><html><head><title>x</title></head><body><div class="wrap">' + boxA + boxB + '</div></body></html>', DEFAULT_OPTS);
assert.strictEqual(pageOut.slides, 2, 'Trích licn_box trong trang HTML đầy đủ');
assert.strictEqual(pageOut.html.indexOf('<div class="wrap">'), -1, 'Không mang wrapper ngoài vào output');
assert.strictEqual(pageOut.html.indexOf('<title>'), -1, 'Không mang <head> vào output');

// (i) Box rỗng nằm giữa -> mặc định bỏ, số tab liên tục; tắt skipEmpty thì vẫn xuất
const withEmpty = '<div class="dept_section dept_licn">' + boxA + '<div class="licn_box">   </div>' + boxB + '</div>';
const skipOut = convert(withEmpty, DEFAULT_OPTS);
assert.strictEqual(skipOut.slides, 2, 'Box rỗng bị bỏ');
assert.strictEqual(skipOut.skipped, 1, 'skipped = 1');
assert.strictEqual(skipOut.boxCount, 3, 'boxCount = 3 (đếm cả box rỗng)');
assert.deepStrictEqual(skipOut.tabs, [1, 2], 'tab đánh liên tục cho slide thật');
assert.deepStrictEqual(skipOut.titles, ['A 자격증', 'B 자격증'], 'Giữ đúng thứ tự box thật');

const keepEmpty = convert(withEmpty, { skipEmpty: false });
assert.strictEqual(keepEmpty.slides, 3, 'skipEmpty=false -> xuất cả box rỗng');
assert.strictEqual(keepEmpty.skipped, 0, 'skipped = 0');
assert.deepStrictEqual(keepEmpty.tabs, [1, 2, 3], 'tab 1, 2, 3');
assert.ok(keepEmpty.html.indexOf('<div class="img"><img src="" alt=""></div>') !== -1, 'Slide rỗng vẫn đủ div.img');
assert.ok(keepEmpty.html.indexOf('<p class="txt01"></p>') !== -1, 'Slide rỗng có p.txt01 rỗng');
assert.ok(keepEmpty.html.indexOf('<p class="txt02"></p>') !== -1, 'Slide rỗng có p.txt02 rỗng');
assert.strictEqual((keepEmpty.html.match(/<a class="view popup-click"/g) || []).length, 3, 'Mỗi slide 1 a.view');
console.log('OK: biên phần 2 (nhiều licn_wrap / trang HTML / box rỗng)');

// (j) div.licn_box: không có .thumb_img -> lấy img đầu tiên trong box
const licnNoThumb = convert('<div class="dept_section dept_licn"><div class="licn_box"><img src="/only.jpg" alt="ALT"><div class="text_wrap"><p class="tit">T 자격증</p><p class="desc">D</p></div></div></div>', DEFAULT_OPTS);
assert.strictEqual(cheerio.load(licnNoThumb.html)('div.img > img').attr('src'), '/only.jpg', 'Fallback img đầu tiên trong licn_box');
assert.strictEqual(cheerio.load(licnNoThumb.html)('p.txt01').text(), 'T 자격증');
assert.strictEqual(cheerio.load(licnNoThumb.html)('p.txt02').text(), 'D', 'p.desc nằm trong div.text_wrap vẫn được lấy');

// (k) Input có khối khác xen kẽ -> chỉ lấy các div.licn_box
const mixedOut = convert('<div class="banner"><p class="tit">Quảng cáo</p><img src="/ad.jpg" alt=""></div><div class="dept_section dept_licn"><div class="licn_box"><div class="thumb_img"><img src="/licn.jpg" alt=""></div><div class="text_wrap"><p class="tit">L 자격증</p></div></div></div>', DEFAULT_OPTS);
assert.strictEqual(mixedOut.slides, 1, 'Chỉ licn_box được chuyển -> 1 slide');
assert.strictEqual(mixedOut.boxCount, 1, 'boxCount = 1');
assert.strictEqual(cheerio.load(mixedOut.html)('div.img > img').attr('src'), '/licn.jpg', 'Lấy ảnh từ licn_box');
assert.strictEqual(mixedOut.html.indexOf('/ad.jpg'), -1, 'Không lẫn khối khác vào output');
assert.deepStrictEqual(mixedOut.cats, ['국가자격증'], 'p.tit của khối khác (ngoài dept_licn) không thành p.cat');

// (l) dept_licn không có licn_box con -> coi cả block là 1 box
const singleLicn = convert('<div class="dept_section dept_licn"><div class="thumb_img"><img src="/solo.jpg" alt=""></div><div class="text_wrap"><p class="tit">Solo 자격증</p></div></div>', DEFAULT_OPTS);
assert.strictEqual(singleLicn.slides, 1, 'Fallback dept_licn -> 1 slide');
assert.strictEqual(cheerio.load(singleLicn.html)('div.img > img').attr('src'), '/solo.jpg');
console.log('OK: biên licn_box (ảnh dự phòng / bỏ khối khác / dept_licn không có licn_box con)');

// ============ 6b. p.tit nhóm -> p.cat, mọi licn_box của mọi licn_wrap gộp 1 swiper-wrapper ============
const GROUP_INPUT = '<div class="dept_section dept_licn">\n' +
    '\t<p class="sec_subtit aos-init aos-animate" data-aos="fade-up">전문 교수진이 지원하는 자격증</p>\n' +
    '\t<p class="tit"><br></p>\n' +
    '\t<p class="tit"><span style="font-size: 24px"><strong>&lt;병영생활전문상담관&gt;</strong></span></p>\n' +
    '\t<div class="licn_wrap aos-init" data-aos="fade-up">\n' +
    '\t<div class="licn_box"><div class="thumb_img"><img src="/cer_4.jpg" alt="군상담심리사 이미지"></div>' +
    '<div class="text_wrap"><p class="tit">군상담심리사</p><p class="desc">Mô tả 1</p></div></div>\n' +
    '\t<div class="licn_box"><div class="thumb_img"><img src="/cer_5.jpg" alt="청소년상담사 이미지"></div>' +
    '<div class="text_wrap"><p class="tit">청소년상담사</p><p class="desc">Mô tả 2</p></div></div>\n' +
    '\t</div>\n' +
    '\t<p class="tit"><span style="font-size: 24px"><strong>&lt;드론 전문가&gt;</strong></span></p>\n' +
    '\t<div class="licn_wrap">\n' +
    '\t<div class="licn_box"><div class="thumb_img"><img src="/cer_6.jpg" alt="드론정비사 이미지"></div>' +
    '<div class="text_wrap"><p class="tit">드론정비사</p><p class="desc">Mô tả 3</p></div></div>\n' +
    '\t</div>\n' +
    '</div>';

assert.strictEqual(core.cleanHeading('<병영생활전문상담관>'), '병영생활전문상담관', 'cleanHeading bỏ dấu <> bao ngoài');
assert.strictEqual(core.cleanHeading('  <국방안보 및 리더십, 영상판독 자격>  '), '국방안보 및 리더십, 영상판독 자격', 'cleanHeading trim khoảng trắng');
assert.strictEqual(core.cleanHeading('국가자격증'), '국가자격증', 'cleanHeading không có <> -> giữ nguyên');
assert.strictEqual(core.cleanHeading('   '), '', 'cleanHeading rỗng');

const groupUnits = core.extractUnits(GROUP_INPUT);
assert.strictEqual(groupUnits.filter(u => u.box).length, 3, 'extractUnits: 3 box');
assert.deepStrictEqual(groupUnits.filter(u => u.cat !== undefined).map(u => u.cat), ['병영생활전문상담관', '드론 전문가'], 'extractUnits: 2 tiêu đề nhóm (bỏ p.tit rỗng)');

const groupOut = convert(GROUP_INPUT, DEFAULT_OPTS);
assert.strictEqual(groupOut.slides, 3, '3 box của 2 licn_wrap -> 3 slide');
assert.strictEqual(groupOut.boxCount, 3, 'boxCount = 3');
assert.strictEqual((groupOut.html.match(/<div class="swiper-wrapper">/g) || []).length, 1, 'Chỉ đúng 1 div.swiper-wrapper');
assert.strictEqual((groupOut.html.match(/<div class="swiper-slide">/g) || []).length, 3, '3 swiper-slide chung 1 wrapper');
assert.ok(groupOut.html.indexOf('licn_wrap') === -1, 'licn_wrap không lọt vào output');
assert.deepStrictEqual(groupOut.cats, ['병영생활전문상담관', '병영생활전문상담관', '드론 전문가'], 'p.cat = tiêu đề nhóm đứng trước box');
assert.deepStrictEqual(groupOut.titles, ['군상담심리사', '청소년상담사', '드론정비사'], 'Thứ tự box giữ nguyên giữa các nhóm');
assert.deepStrictEqual(groupOut.tabs, [1, 2, 3], 'tab đánh liên tục qua các nhóm');
assert.ok(groupOut.html.indexOf('<p class="cat">&lt;') === -1, 'p.cat không còn dấu <>');
assert.ok(groupOut.html.indexOf('전문 교수진이') === -1, 'p.sec_subtit không bị thành p.cat');
assert.strictEqual(cheerio.load(groupOut.html)('p.txt02').first().text(), 'Mô tả 1', 'p.txt02 vẫn lấy từ p.desc của box');
assert.strictEqual(cheerio.load(groupOut.html)('p.txt01').first().text(), '군상담심리사', 'p.txt01 lấy từ p.tit trong box (không phải nhóm)');
assert.ok(groupOut.html.indexOf(T(7) + '<p class="cat">병영생활전문상담관</p>') !== -1, 'p.cat nhóm thụt lề 7 tab');

const noGroup = convert(GROUP_INPUT, Object.assign({}, DEFAULT_OPTS, { groupCat: false }));
assert.deepStrictEqual(noGroup.cats, ['국가자격증', '국가자격증', '국가자격증'], 'groupCat=false -> mọi slide dùng ô Category');

// Box đứng trước mọi tiêu đề nhóm -> dùng opts.cat; p.tit trong box không bị coi là nhóm
const beforeHeading = '<div class="dept_section dept_licn"><div class="licn_wrap">' + boxA + '</div>' +
    '<p class="tit"><strong>&lt;Nhóm 2&gt;</strong></p><div class="licn_wrap">' + boxB + '</div></div>';
const mixedCats = convert(beforeHeading, DEFAULT_OPTS);
assert.deepStrictEqual(mixedCats.cats, ['국가자격증', 'Nhóm 2'], 'Box trước tiêu đề nhóm dùng opts.cat, box sau dùng tên nhóm');
assert.deepStrictEqual(mixedCats.titles, ['A 자격증', 'B 자격증'], 'p.tit bên trong licn_box không thành p.cat');

// 2 khối dept_licn dán liền nhau -> vẫn gộp chung 1 wrapper, cat theo nhóm của từng khối
const twoSections = '<div class="dept_section dept_licn"><p class="tit"><strong>Nhóm A</strong></p><div class="licn_wrap">' + boxA + '</div></div>' +
    '<div class="dept_section dept_licn"><p class="tit"><strong>Nhóm B</strong></p><div class="licn_wrap">' + boxB + '</div></div>';
const twoSecOut = convert(twoSections, DEFAULT_OPTS);
assert.strictEqual(twoSecOut.slides, 2, '2 khối dept_licn -> 2 slide');
assert.strictEqual((twoSecOut.html.match(/<div class="swiper-wrapper">/g) || []).length, 1, '2 khối vẫn gộp 1 swiper-wrapper');
assert.deepStrictEqual(twoSecOut.cats, ['Nhóm A', 'Nhóm B'], 'cat theo nhóm của từng khối');

// input chỉ có licn_box trần (không có dept_licn) -> không có nhóm, dùng opts.cat
const bareUnits = core.extractUnits(boxA + boxB);
assert.deepStrictEqual(bareUnits.filter(u => u.cat !== undefined), [], 'licn_box trần -> không có tiêu đề nhóm');
assert.deepStrictEqual(convert(boxA + boxB, DEFAULT_OPTS).cats, ['국가자격증', '국가자격증'], 'licn_box trần -> p.cat mặc định');
console.log('OK: p.tit nhóm -> p.cat, gộp mọi licn_wrap vào 1 swiper-wrapper');

// Input không có tiêu đề nhóm (chỉ có <p class="tit"><br></p> rỗng) -> mọi slide dùng Category mặc định
const noHeadingInput = '<div class="dept_section dept_licn">\n' +
    '\t<p class="sec_subtit aos-init" data-aos="fade-up">전문 교수진이 지원하는 자격증</p>\n' +
    '\t<p class="tit"><br></p>\n' +
    '\t<div class="licn_wrap">' + boxA + boxB + '</div>\n' +
    '\t<p class="tit"><br></p>\n' +
    '\t<div class="licn_wrap">' + boxB + '</div>\n' +
    '</div>';
assert.deepStrictEqual(core.extractUnits(noHeadingInput).filter(u => u.cat !== undefined), [], 'p.tit rỗng (<br>) không thành tiêu đề nhóm');
const noHeadingOut = convert(noHeadingInput, DEFAULT_OPTS);
assert.strictEqual((noHeadingOut.html.match(/<p class="cat">국가자격증<\/p>/g) || []).length, 3, 'Không có tiêu đề nhóm -> cả 3 slide p.cat = 국가자격증');
assert.ok(noHeadingOut.html.indexOf('<p class="cat">세종사이버</p>') === -1, 'Không có nhóm -> không có p.cat lạ');
assert.deepStrictEqual(noHeadingOut.cats, ['국가자격증', '국가자격증', '국가자격증'], 'cats mặc định khi input không có p.tit nhóm');
assert.deepStrictEqual(convert(noHeadingInput, { cat: '민간자격증' }).cats, ['민간자격증', '민간자격증', '민간자격증'], 'Không có nhóm -> p.cat theo ô Category tuỳ chỉnh');
assert.deepStrictEqual(convert(noHeadingInput, { cat: '', groupCat: true }).cats, ['국가자격증', '국가자격증', '국가자격증'], 'Ô Category rỗng -> vẫn 국가자격증');

// ============ 7. Hàm phụ + lỗi ============
assert.strictEqual(core.cleanText('  a\u00a0  b  '), 'a b', 'cleanText gộp khoảng trắng + bỏ nbsp');
assert.strictEqual(core.normalizeTitle('X 자격증 소개', true), 'X 자격증', 'normalizeTitle bỏ " 소개"');
assert.strictEqual(core.normalizeTitle('자격증   소개  ', true), '자격증', 'normalizeTitle trim');
assert.strictEqual(core.normalizeTitle('소개', true), '', 'normalizeTitle chỉ còn "소개" -> rỗng');
assert.strictEqual(core.normalizeTitle('X 자격증', true), 'X 자격증', 'Không có hậu tố -> giữ nguyên');
assert.strictEqual(core.normalizeTitle('조경기사자격증', true), '조경기사/조경산업기사 자격증', '기사자격증 -> 기사/…산업기사 자격증');
assert.strictEqual(core.normalizeTitle('자연생태복원기사자격증', true), '자연생태복원기사/자연생태복원산업기사 자격증');
assert.strictEqual(core.normalizeTitle('식물보호기사자격증', true), '식물보호기사/식물보호산업기사 자격증');
assert.strictEqual(core.normalizeTitle('골프코스관리사자격증', true), '골프코스관리사 자격증', 'Không phải 기사자격증 -> chỉ thêm dấu cách');
assert.strictEqual(core.normalizeTitle('조경산업기사자격증', true), '조경산업기사 자격증', 'Đã là 산업기사 -> không mở rộng thành 기사/산업기사');
assert.strictEqual(core.normalizeTitle('조경기사/조경산업기사 자격증 소개', true), '조경기사/조경산업기사 자격증', 'Có "/" -> chỉ bỏ 소개, không mở rộng');
assert.strictEqual(core.normalizeTitle('조경기사자격증', false), '조경기사자격증', 'titleFix=false -> giữ nguyên');

assert.strictEqual(core.applyImgPattern('/old.jpg', IMG_PATTERN, 3), '/_res/sjcu/krsjcu/img/content/environmen_landscaping_certificate_intro_bg_3.jpg', 'applyImgPattern thay {n}');
assert.strictEqual(core.applyImgPattern('/old.jpg', '   ', 3), '/old.jpg', 'Pattern rỗng -> giữ src gốc');
assert.strictEqual(core.applyImgPattern('/old.jpg', '/a/{n}/b/{n}.jpg', 2), '/a/2/b/2.jpg', 'Thay hết mọi {n} trong pattern');
assert.strictEqual(core.applyImgPattern('/old.jpg', '/fix.jpg', 9), '/fix.jpg', 'Pattern không có {n} -> dùng nguyên pattern');

assert.throws(function () { convert('', DEFAULT_OPTS); }, /Chưa có input/, 'Input trống phải throw');
assert.throws(function () { convert('   \n  ', DEFAULT_OPTS); }, /Chưa có input/, 'Input toàn khoảng trắng phải throw');
assert.throws(function () { convert('<div>không có box nào</div>', DEFAULT_OPTS); }, /Không tìm thấy/, 'Input không có .licn_box phải throw');
assert.throws(function () { core.extractUnits('<p></p>'); }, /Không tìm thấy/, 'extractUnits throw đúng thông báo');
console.log('OK: hàm phụ + các trường hợp lỗi throw đúng thông báo');

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
    ' stat: () => ({ tabs: statTabs.textContent, slides: statSlides.textContent, empty: statEmpty.textContent }),' +
    ' toast: () => document.getElementById("toast").textContent };');
const tool = runTool.call(null, fakeDocument, FakeDOMParser, FakeBlob, { clipboard: { writeText: () => Promise.resolve() } });

// Mặc định của form (giống giá trị trong HTML)
const form = fakeDocument.getElementById('inputText');
['id="optCat" class="wide" value="국가자격증"', 'id="optGroupCat" checked', 'id="optTitleFix" checked', 'id="optDropEmptyDesc">',
    'id="optAltFromTit" checked', 'id="optImgPattern" class="pattern" value="/_res/sjcu/krsjcu/img/content/environmen_landscaping_certificate_intro_bg_{n}.jpg"',
    'id="optViewHref" value="#a"', 'id="optPopupId" value="detail-1000"',
    'id="optTabStart" value="1"', 'id="optTabInc" checked', 'id="optViewText" class="wide" value="취득과정 전체보기"',
    'id="optSkipEmpty" checked', 'id="optAutoRun">'].forEach(function (markup) {
        assert.ok(file.indexOf(markup) !== -1, 'HTML phải có ' + markup);
    });

const FORM_DEFAULTS = {
    cat: '국가자격증', groupCat: true, titleFix: true, dropEmptyDesc: false, altFromTit: true,
    imgPattern: IMG_PATTERN,
    href: '#a', popupId: 'detail-1000', tabStart: '1', tabInc: true,
    viewText: '취득과정 전체보기', skipEmpty: true
};

form.value = SAMPLE;
registry.optCat.value = FORM_DEFAULTS.cat;
registry.optGroupCat.checked = FORM_DEFAULTS.groupCat;
registry.optTitleFix.checked = FORM_DEFAULTS.titleFix;
registry.optDropEmptyDesc.checked = FORM_DEFAULTS.dropEmptyDesc;
registry.optAltFromTit.checked = FORM_DEFAULTS.altFromTit;
registry.optImgPattern.value = FORM_DEFAULTS.imgPattern;
registry.optViewHref.value = FORM_DEFAULTS.href;
registry.optPopupId.value = FORM_DEFAULTS.popupId;
registry.optTabStart.value = FORM_DEFAULTS.tabStart;
registry.optTabInc.checked = FORM_DEFAULTS.tabInc;
registry.optViewText.value = FORM_DEFAULTS.viewText;
registry.optSkipEmpty.checked = FORM_DEFAULTS.skipEmpty;
registry.optAutoRun.checked = false;

tool.handleConvert();
const handleOut = fakeDocument.getElementById('outputText').value;
assert.strictEqual(handleOut, convert(SAMPLE, FORM_DEFAULTS).html, 'handleConvert() xuất đúng output với form mặc định');
assert.strictEqual(handleOut, patterned.html, 'Output qua form trùng output core với imgPattern mặc định');
assert.ok(handleOut.indexOf(T(7) + '<p class="cat">국가자격증</p>') !== -1, 'Có p.cat 7 tab');
assert.ok(handleOut.indexOf(T(8) + '<p class="txt01">조경기사/조경산업기사 자격증</p>') !== -1, 'Có p.txt01 đã chuẩn hoá');
assert.deepStrictEqual(tool.stat(), { tabs: '4', slides: '4', empty: '0' }, 'Stats đúng (4 box / 4 slide / 0 rỗng)');
assert.ok(tool.toast().indexOf('✅') === 0, 'Toast báo thành công: ' + tool.toast());
assert.strictEqual(fakeDocument.getElementById('inputCount').textContent, '(' + SAMPLE.length + ' ký tự)', 'inputCount cập nhật');
assert.strictEqual(fakeDocument.getElementById('outputCount').textContent, '(' + handleOut.length + ' ký tự)', 'outputCount cập nhật');

// Đổi option trên form -> output đổi theo
registry.optCat.value = '민간자격증';
registry.optTitleFix.checked = false;
registry.optImgPattern.value = '';
registry.optTabStart.value = '3';
registry.optPopupId.value = '7777';
registry.optViewHref.value = '/ko/dept/cert.do';
registry.optViewText.value = '자세히보기';
tool.handleConvert();
const out2 = fakeDocument.getElementById('outputText').value;
assert.ok(out2.indexOf('<p class="cat">민간자격증</p>') !== -1, 'cat lấy từ ô optCat');

assert.strictEqual((out2.match(/<p class="cat">민간자격증<\/p>/g) || []).length, 4, 'cat áp cho cả 4 slide');
assert.ok(out2.indexOf(T(8) + '<p class="txt01">조경기사자격증</p>') !== -1, 'titleFix=false -> giữ nguyên tiêu đề gốc');
assert.ok(out2.indexOf('src="/_res/sjcu/ko/img/dept/A_horizontal_image_of_a_modern_park_with_tall_ligh.jpg"') !== -1, 'optImgPattern rỗng -> giữ src gốc');
assert.ok(out2.indexOf('href="/ko/dept/cert.do"') !== -1, 'href lấy từ ô optViewHref');
assert.ok(out2.indexOf('id="7777"') !== -1, 'id lấy từ ô optPopupId');
assert.ok(out2.indexOf('title="자세히보기"') !== -1, 'title lấy từ ô optViewText');
assert.deepStrictEqual(out2.match(/tab="\d+"/g), ['tab="3"', 'tab="4"', 'tab="5"', 'tab="6"'], 'optTabStart=3 -> tab 3..6');
assert.strictEqual(out2, convert(SAMPLE, {
    cat: '민간자격증', titleFix: false, dropEmptyDesc: false, altFromTit: true, imgPattern: '',
    href: '/ko/dept/cert.do', popupId: '7777', tabStart: '3', tabInc: true,
    viewText: '자세히보기', skipEmpty: true
}).html, 'handleConvert() khớp core khi đổi option');

// tabInc=false -> mọi slide cùng 1 tab
registry.optTabInc.checked = false;
registry.optTabStart.value = '7';
tool.handleConvert();
assert.deepStrictEqual(fakeDocument.getElementById('outputText').value.match(/tab="\d+"/g), ['tab="7"', 'tab="7"', 'tab="7"', 'tab="7"'], 'tabInc=false -> tab giữ nguyên');

// skipEmpty bật/tắt với input có tab rỗng ở giữa
registry.optTabInc.checked = true;
form.value = withEmpty;
registry.optSkipEmpty.checked = false;
tool.handleConvert();
assert.deepStrictEqual(tool.stat(), { tabs: '3', slides: '3', empty: '0' }, 'skipEmpty=false -> 3 slide / 0 bỏ');
assert.ok(fakeDocument.getElementById('outputText').value.indexOf('<p class="txt01"></p>') !== -1, 'Có slide rỗng trong output');
registry.optSkipEmpty.checked = true;
tool.handleConvert();
assert.deepStrictEqual(tool.stat(), { tabs: '3', slides: '2', empty: '1' }, 'skipEmpty=true -> bỏ 1 tab rỗng');

// dropEmptyDesc trên form
registry.optDropEmptyDesc.checked = true;
form.value = SAMPLE;
tool.handleConvert();
assert.strictEqual(fakeDocument.getElementById('outputText').value.indexOf('<p class="txt02"></p>'), -1, 'dropEmptyDesc: SAMPLE 4 box đều có desc nên không có txt02 rỗng');

// p.cat = tiêu đề nhóm p.tit (optGroupCat) bật/tắt ngay trên form
form.value = GROUP_INPUT;
tool.handleConvert();
const formGroup = fakeDocument.getElementById('outputText').value;
assert.strictEqual((formGroup.match(/<p class="cat">병영생활전문상담관<\/p>/g) || []).length, 2, 'optGroupCat: 2 slide nhóm 1 dùng p.cat của nhóm');
assert.strictEqual((formGroup.match(/<p class="cat">드론 전문가<\/p>/g) || []).length, 1, 'optGroupCat: slide nhóm 2 dùng p.cat riêng');
assert.strictEqual(formGroup, convert(GROUP_INPUT, Object.assign({}, FORM_DEFAULTS, {
    cat: '민간자격증', titleFix: false, dropEmptyDesc: true, imgPattern: '',
    href: '/ko/dept/cert.do', popupId: '7777', tabStart: '7', viewText: '자세히보기'
})).html, 'Form + optGroupCat khớp core converter');
registry.optGroupCat.checked = false;
tool.handleConvert();
assert.strictEqual((fakeDocument.getElementById('outputText').value.match(/<p class="cat">민간자격증<\/p>/g) || []).length, 3, 'optGroupCat=false -> p.cat lấy từ ô Category');
registry.optGroupCat.checked = true;

// Nhánh lỗi của handleConvert
form.value = '';
tool.handleConvert();
assert.ok(tool.toast().indexOf('⚠️') === 0, 'Toast cảnh báo khi input trống: ' + tool.toast());
assert.ok(fakeDocument.getElementById('outputText').value.indexOf('<div class="swiper-wrapper">') === 0, 'Input trống -> giữ nguyên output cũ');

form.value = '   \n  ';
tool.handleConvert();
assert.ok(tool.toast().indexOf('⚠️') === 0, 'Toast cảnh báo khi input toàn khoảng trắng');

form.value = '<div>không có tab nào</div>';
tool.handleConvert();
assert.ok(tool.toast().indexOf('❌') === 0, 'Toast báo lỗi khi input sai: ' + tool.toast());
assert.strictEqual(fakeDocument.getElementById('outputText').value, '', 'Lỗi -> output được xoá');
assert.deepStrictEqual(tool.stat(), { tabs: '0', slides: '0', empty: '0' }, 'Lỗi -> stats reset về 0');
console.log('OK: smoke test toàn bộ script (DOM giả) — wiring id + handler hoạt động');

// ============ 9. Kiểm tra id + cấu trúc HTML của tool ============
const idRefs = [...file.matchAll(/getElementById\('([^']+)'\)/g)].map(x => x[1]);
const uniqueRefs = [...new Set(idRefs)];
uniqueRefs.forEach(function (id) {
    assert.ok(file.indexOf('id="' + id + '"') !== -1, 'id được getElementById phải tồn tại trong HTML: ' + id);
});
const $page = cheerio.load(file);
const markupIds = [...new Set($page('[id]').map(function () { return $page(this).attr('id'); }).get())];
markupIds.forEach(function (id) {
    assert.ok(uniqueRefs.indexOf(id) !== -1, 'id trong HTML phải được JS dùng tới: ' + id);
});
assert.strictEqual(uniqueRefs.length, 30, 'Số id JS dùng (thực tế ' + uniqueRefs.length + ')');
assert.strictEqual(markupIds.length, 30, 'Số id trong markup (thực tế ' + markupIds.length + ')');

assert.strictEqual($page('title').text(), 'Certificate Converter - Chuyển div.licn_box thành div.swiper-wrapper');
assert.strictEqual($page('h1 span').text(), 'div.licn_box → div.swiper-wrapper');
assert.strictEqual($page('.options .option-group').length, 6, '6 nhóm tuỳ chọn');
assert.strictEqual($page('input[type="checkbox"]').length, 7, '7 checkbox');
assert.strictEqual($page('input[type="text"]').length, 5, '5 ô text (gồm mẫu ảnh mới)');
assert.strictEqual($page('input[type="number"]').length, 1, '1 ô number');
assert.strictEqual($page('textarea').length, 2, '2 textarea (input / output)');
assert.strictEqual($page('button.btn').length, 6, '6 nút');
assert.strictEqual($page('.stat-item').length, 5, '5 ô thống kê');
assert.strictEqual($page('#header-container').length, 1, 'Có chỗ nạp header menu');
assert.ok(file.indexOf("link.getAttribute('data-page') === 'certificate'") !== -1, 'Header menu active theo data-page="certificate"');
assert.strictEqual(scripts.filter(s => s.indexOf('Core converter') !== -1).length, 1, 'Chỉ 1 core script');
assert.ok(file.indexOf('swiper-certificate.html') !== -1, 'Nút tải file dùng tên swiper-certificate.html');
console.log('OK: wiring id + cấu trúc HTML của tool');

console.log('');
console.log('🎉 Tất cả assertion PASS — logic certificate (div.licn_box -> div.swiper-wrapper) hoạt động đúng.');
