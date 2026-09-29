/**
 * Test cho certificate.html
 * - Syntax-check tất cả inline <script> trong file tool
 * - Trích core converter (div.js_tab_cont / nhiều div.tab_cont -> div.swiper-wrapper) và chạy thật
 *   với DOM shim dựa trên cheerio
 * - Assert output khớp CHÍNH XÁC template: div.swiper-wrapper / div.swiper-slide / p.cat /
 *   div.img > img / div.txt > p.txt01 + p.txt02 + a.view.popup-click
 * - Kiểm tra tuỳ chọn: p.cat, bỏ hậu tố "소개", alt = tiêu đề, href/id/tab/text của a.view,
 *   bỏ tab rỗng, bỏ p.txt02 rỗng
 * - Kiểm tra fallback (tab_cont trần, js_tab_cont không có tab_cont, cả trang HTML) + lỗi throw
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
assert.ok(sampleMatch && sampleMatch[1].indexOf('js_tab_cont') !== -1, 'SAMPLE phải là khối .js_tab_cont');
assert.ok(sampleMatch[1].indexOf('class="tab_cont on"') !== -1, 'SAMPLE phải có <div class="tab_cont on">');
assert.ok(sampleMatch[1].indexOf('master_intro_col') !== -1, 'SAMPLE phải có master_intro_col');
assert.ok(sampleMatch[1].indexOf('조경기사/조경산업기사 자격증 소개') !== -1, 'SAMPLE phải có tiêu đề tab 1');
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
    '\nreturn { cleanText, escapeHtml, elementText, stripIntroSuffix, viewLink, extractTabs, buildSlide, buildWrapper, convertCertificate };');
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
const SMALL_INPUT = `<div class="js_tab_cont">
\t<div class="tab_cont on">
\t\t<div class="dept_section master_intro_col">
\t\t\t<div class="thumb_wrap"><img src="/_res/sjcu/krsjcu/img/content/cert01.jpg" alt=""></div>
\t\t\t<div class="text_wrap">
\t\t\t\t<p class="tit">바리스타 자격증 소개</p>
\t\t\t\t<div class="text_box">
\t\t\t\t\t<p class="desc">커피의 원두 선택, 로스팅, 추출, 품질 평가 등 커피에 관한 전문지식과 능력에 대해 인증하는 민간자격증</p>
\t\t\t\t</div>
\t\t\t</div>
\t\t</div>
\t</div>
\t<div class="tab_cont">
\t\t<div class="dept_section master_intro_col">
\t\t\t<div class="thumb_wrap"><img src="/_res/sjcu/krsjcu/img/content/cert02.jpg" alt="소믈리에 자격증"></div>
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
assert.strictEqual(smallOut.slides, 2, 'SMALL_INPUT có 2 tab -> 2 slide');
assert.strictEqual(smallOut.skipped, 0, 'Không tab nào rỗng');
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
assert.strictEqual($small('div.txt').eq(1).find('p.txt02').text(), '', 'Tab 2 không có desc -> p.txt02 rỗng nhưng vẫn đủ cấu trúc');
assert.ok(!smallOut.html.includes('\u00a0'), 'Output không chứa nbsp');
assert.strictEqual($small('div.swiper-slide').first().find('div.img > img').attr('alt'), '바리스타 자격증', 'alt = txt01 (không lấy alt rỗng gốc)');
console.log('OK: input nhỏ khớp chính xác template div.swiper-wrapper / div.swiper-slide');

// ============ 4. Ví dụ thật (2 tab 자격증) ============
const realOut = convert(SAMPLE, DEFAULT_OPTS);
const $real = cheerio.load(realOut.html);
assert.strictEqual($real('div.swiper-wrapper > div.swiper-slide').length, 2, 'SAMPLE có 2 tab -> 2 slide');
assert.deepStrictEqual(realOut.titles, ['조경기사/조경산업기사 자격증', '골프코스관리사 자격증'], 'txt01 bỏ " 소개" nhưng giữ "자격증"');
assert.deepStrictEqual(realOut.tabs, [1, 2], 'tab = 1, 2');

const rs1 = $real('div.swiper-slide').first();
assert.strictEqual(rs1.find('p.cat').text(), '국가자격증', 'p.cat mặc định');
assert.strictEqual(rs1.find('p.txt01').text(), '조경기사/조경산업기사 자격증');
assert.strictEqual(rs1.find('div.img > img').attr('src'), '/_res/sjcu/ko/img/dept/A_horizontal_image_of_a_modern_park_with_tall_ligh.jpg');
assert.strictEqual(rs1.find('div.img > img').attr('alt'), '조경기사/조경산업기사 자격증', 'alt = txt01');
assert.ok(rs1.find('p.txt02').text().indexOf('조경을 다루는 기술은 도시,국토건설분야의 한 분야으로서') === 0, 'txt02 = p.desc của tab 1');

const rs2 = $real('div.swiper-slide').last();
assert.strictEqual(rs2.find('div.img > img').attr('src'), '/_res/sjcu/ko/img/dept/environmen_landscaping_certificate_intro_bg_4.jpg');
assert.ok(rs2.find('p.txt02').text().indexOf('골프장을 비롯한 공원, 소포츠 필드') === 0, 'txt02 = p.desc của tab 2');

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

// Chỉ lấy phần intro: bỏ STEP / 체험강의 / 활동분야 / iframe / comment / nbsp
['응시자격 확인', '체험강의', '취득 후 활동분야', 'circle_numbox', 'iframe', '<!--', 'tab_cont', 'js_tab_cont', '\u00a0'].forEach(function (needle) {
    assert.strictEqual(realOut.html.indexOf(needle), -1, 'Output không được chứa: ' + needle);
});
console.log('OK: ví dụ thật 2 tab -> 2 slide (cat / img / txt01 / txt02 / a.view)');

// ============ 5. Tuỳ chọn ============
// (a) p.cat tuỳ chỉnh
const catOut = convert(SMALL_INPUT, { cat: '민간자격증' });
assert.deepStrictEqual(catOut.cats, ['민간자격증', '민간자격증'], 'cats theo ô nhập');
assert.strictEqual((catOut.html.match(/<p class="cat">민간자격증<\/p>/g) || []).length, 2, 'p.cat xuất 2 lần');
assert.strictEqual(cheerio.load(convert(SMALL_INPUT, { cat: '   ' }).html)('p.cat').first().text(), '국가자격증', 'cat rỗng -> mặc định');

// (b) stripIntro = false -> giữ nguyên "소개"
const keepIntro = convert(SMALL_INPUT, { stripIntro: false });
assert.deepStrictEqual(keepIntro.titles, ['바리스타 자격증 소개', '소믈리에 자격증'], 'stripIntro=false -> giữ hậu tố');
assert.strictEqual(cheerio.load(keepIntro.html)('p.txt01').first().text(), '바리스타 자격증 소개');

// (c) altFromTit = false -> giữ alt gốc của <img>
const rawAlt = convert(SMALL_INPUT, { altFromTit: false });
assert.strictEqual(cheerio.load(rawAlt.html)('div.img > img').first().attr('alt'), '', 'alt gốc rỗng được giữ');
assert.strictEqual(cheerio.load(rawAlt.html)('div.img > img').last().attr('alt'), '소믈리에 자격증', 'alt gốc của tab 2');

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

// (f) dropEmptyDesc -> bỏ <p class="txt02"></p> của tab không có desc
const dropDesc = convert(SMALL_INPUT, { dropEmptyDesc: true });
assert.strictEqual(dropDesc.html.indexOf('<p class="txt02"></p>'), -1, 'dropEmptyDesc -> không còn p.txt02 rỗng');
assert.ok(dropDesc.html.indexOf('<p class="txt02">커피의 원두 선택') !== -1, 'Tab có desc vẫn giữ p.txt02');
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
console.log('OK: tuỳ chọn cat / stripIntro / altFromTit / href / id / tab / viewText / dropEmptyDesc');

// ============ 6. Trường hợp biên ============
const tabA = '<div class="tab_cont"><div class="dept_section master_intro_col"><div class="thumb_wrap"><img src="/a.jpg" alt=""></div><div class="text_wrap"><p class="tit">A 자격증 소개</p></div></div></div>';
const tabB = '<div class="tab_cont"><div class="dept_section master_intro_col"><div class="thumb_wrap"><img src="/b.jpg" alt=""></div><div class="text_wrap"><p class="tit">B 자격증</p></div></div></div>';

// (a) Không có .master_intro_col -> lấy div.dept_section đầu tiên
const noIntroOut = convert('<div class="tab_cont"><div class="dept_section other"><p class="tit">Tiêu đề A</p><p class="desc">Mô tả A</p></div></div>', DEFAULT_OPTS);
assert.strictEqual(cheerio.load(noIntroOut.html)('p.txt01').text(), 'Tiêu đề A', 'Fallback div.dept_section');
assert.strictEqual(cheerio.load(noIntroOut.html)('p.txt02').text(), 'Mô tả A');

// (b) Tab trần, không có dept_section -> lấy ngay trong tab
const bareTabOut = convert('<div class="tab_cont"><p class="tit">X</p><p class="desc">Y</p></div>', DEFAULT_OPTS);
assert.strictEqual(cheerio.load(bareTabOut.html)('p.txt01').text(), 'X', 'Fallback tab');
assert.strictEqual(cheerio.load(bareTabOut.html)('p.txt02').text(), 'Y');
assert.strictEqual(cheerio.load(bareTabOut.html)('div.img > img').attr('src'), '', 'Không có ảnh -> src rỗng');

// (c) &nbsp; + <br> trong tiêu đề -> gộp khoảng trắng; desc chỉ có <br> -> p.txt02 rỗng nhưng vẫn có
const brOut = convert('<div class="tab_cont"><div class="dept_section master_intro_col"><div class="thumb_wrap"><img src="/a.jpg" alt="ALT"></div><div class="text_wrap"><p class="tit">A&nbsp;B<br>C</p><div class="text_box"><p class="desc"><br></p></div></div></div></div>', DEFAULT_OPTS);
assert.strictEqual(cheerio.load(brOut.html)('p.txt01').text(), 'A B C', 'nbsp + <br> -> khoảng trắng');
assert.strictEqual(cheerio.load(brOut.html)('p.txt02').text(), '', 'desc chỉ có <br> -> rỗng');
assert.ok(brOut.html.indexOf('<p class="txt02"></p>') !== -1, 'Vẫn giữ đủ cấu trúc p.txt02');
assert.strictEqual(cheerio.load(brOut.html)('div.img > img').attr('alt'), 'A B C', 'alt = txt01 đã chuẩn hoá');

// (d) Ảnh trong dept_lect KHÔNG được dùng làm ảnh slide
const lectImgOut = convert('<div class="tab_cont"><div class="dept_section master_intro_col"><div class="text_wrap"><p class="tit">T</p></div></div><div class="dept_section gray dept_lect"><div class="lect_cont"><img src="/lecture.jpg" alt=""><p class="tit">L</p></div></div></div>', DEFAULT_OPTS);
assert.strictEqual(cheerio.load(lectImgOut.html)('div.img > img').attr('src'), '', 'Chỉ lấy ảnh trong .thumb_wrap');
assert.strictEqual(lectImgOut.html.indexOf('/lecture.jpg'), -1, 'Ảnh 체험강의 không lọt vào output');

// (e) Escape ký tự đặc biệt trong txt01 / txt02 / src
const escOut = convert('<div class="tab_cont"><div class="dept_section master_intro_col"><div class="thumb_wrap"><img src="/a.php?x=1&amp;y=2" alt=""></div><div class="text_wrap"><p class="tit">T &amp; "q" &lt;tag&gt;</p><div class="text_box"><p class="desc">D &lt;b&gt;</p></div></div></div></div>', DEFAULT_OPTS);
assert.ok(escOut.html.indexOf('<p class="txt01">T &amp; &quot;q&quot; &lt;tag&gt;</p>') !== -1, 'Escape &, ", <, > trong txt01');
assert.ok(escOut.html.indexOf('<p class="txt02">D &lt;b&gt;</p>') !== -1, 'Escape < > trong txt02');
assert.ok(escOut.html.indexOf('src="/a.php?x=1&amp;y=2"') !== -1, 'Giữ nguyên entity trong src');
assert.strictEqual(cheerio.load(escOut.html)('p.txt01').text(), 'T & "q" <tag>', 'Text hiển thị đúng sau khi unescape');

// (f) Input chỉ có .tab_cont trần (không có div.js_tab_cont)
const bareTabsOut = convert(tabA + tabB, DEFAULT_OPTS);
assert.strictEqual(bareTabsOut.slides, 2, 'Fallback .tab_cont trần');
assert.deepStrictEqual(bareTabsOut.tabs, [1, 2], 'tab vẫn tự tăng 1, 2');
console.log('OK: biên phần 1 (fallback intro / ảnh lecture / escape / tab_cont trần)');

// (g) Chỉ có div.js_tab_cont (không có .tab_cont) -> coi cả block là 1 tab
const jsOnly = '<div class="js_tab_cont"><div class="dept_section master_intro_col"><div class="thumb_wrap"><img src="/solo.jpg" alt=""></div><div class="text_wrap"><p class="tit">Solo 자격증 소개</p></div></div></div>';
const jsOnlyOut = convert(jsOnly, DEFAULT_OPTS);
assert.strictEqual(jsOnlyOut.slides, 1, 'js_tab_cont không có tab_cont -> 1 slide');
assert.strictEqual(jsOnlyOut.tabCount, 1, 'tabCount = 1');
assert.deepStrictEqual(jsOnlyOut.titles, ['Solo 자격증'], 'txt01 = Solo 자격증');

// (h) Input là cả trang HTML -> vẫn chỉ lấy 2 tab
const pageOut = convert('<!DOCTYPE html><html><head><title>x</title></head><body><div class="wrap">' + tabA + tabB + '</div></body></html>', DEFAULT_OPTS);
assert.strictEqual(pageOut.slides, 2, 'Trích tab trong trang HTML đầy đủ');
assert.strictEqual(pageOut.html.indexOf('<div class="wrap">'), -1, 'Không mang wrapper ngoài vào output');
assert.strictEqual(pageOut.html.indexOf('<title>'), -1, 'Không mang <head> vào output');

// (i) Tab rỗng nằm giữa -> mặc định bỏ, số tab liên tục; tắt skipEmpty thì vẫn xuất
const withEmpty = '<div class="js_tab_cont">' + tabA + '<div class="tab_cont">   </div>' + tabB + '</div>';
const skipOut = convert(withEmpty, DEFAULT_OPTS);
assert.strictEqual(skipOut.slides, 2, 'Tab rỗng bị bỏ');
assert.strictEqual(skipOut.skipped, 1, 'skipped = 1');
assert.strictEqual(skipOut.tabCount, 3, 'tabCount = 3 (đếm cả tab rỗng)');
assert.deepStrictEqual(skipOut.tabs, [1, 2], 'tab đánh liên tục cho slide thật');
assert.deepStrictEqual(skipOut.titles, ['A 자격증', 'B 자격증'], 'Giữ đúng thứ tự tab thật');

const keepEmpty = convert(withEmpty, { skipEmpty: false });
assert.strictEqual(keepEmpty.slides, 3, 'skipEmpty=false -> xuất cả tab rỗng');
assert.strictEqual(keepEmpty.skipped, 0, 'skipped = 0');
assert.deepStrictEqual(keepEmpty.tabs, [1, 2, 3], 'tab 1, 2, 3');
assert.ok(keepEmpty.html.indexOf('<div class="img"><img src="" alt=""></div>') !== -1, 'Slide rỗng vẫn đủ div.img');
assert.ok(keepEmpty.html.indexOf('<p class="txt01"></p>') !== -1, 'Slide rỗng có p.txt01 rỗng');
assert.ok(keepEmpty.html.indexOf('<p class="txt02"></p>') !== -1, 'Slide rỗng có p.txt02 rỗng');
assert.strictEqual((keepEmpty.html.match(/<a class="view popup-click"/g) || []).length, 3, 'Mỗi slide 1 a.view');
console.log('OK: biên phần 2 (js_tab_cont đơn / trang HTML / tab rỗng)');

// ============ 7. Hàm phụ + lỗi ============
assert.strictEqual(core.cleanText('  a\u00a0  b  '), 'a b', 'cleanText gộp khoảng trắng + bỏ nbsp');
assert.strictEqual(core.stripIntroSuffix('X 자격증 소개'), 'X 자격증', 'stripIntroSuffix bỏ " 소개"');
assert.strictEqual(core.stripIntroSuffix('자격증   소개  '), '자격증', 'stripIntroSuffix trim');
assert.strictEqual(core.stripIntroSuffix('소개'), '', 'stripIntroSuffix chỉ còn "소개" -> rỗng');
assert.strictEqual(core.stripIntroSuffix('X 자격증'), 'X 자격증', 'Không có hậu tố -> giữ nguyên');

assert.throws(function () { convert('', DEFAULT_OPTS); }, /Chưa có input/, 'Input trống phải throw');
assert.throws(function () { convert('   \n  ', DEFAULT_OPTS); }, /Chưa có input/, 'Input toàn khoảng trắng phải throw');
assert.throws(function () { convert('<div>không có tab nào</div>', DEFAULT_OPTS); }, /Không tìm thấy/, 'Input không có .tab_cont phải throw');
assert.throws(function () { core.extractTabs('<p></p>'); }, /Không tìm thấy/, 'extractTabs throw đúng thông báo');
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
['id="optCat" class="wide" value="국가자격증"', 'id="optStripIntro" checked', 'id="optDropEmptyDesc">',
    'id="optAltFromTit" checked', 'id="optViewHref" value="#a"', 'id="optPopupId" value="detail-1000"',
    'id="optTabStart" value="1"', 'id="optTabInc" checked', 'id="optViewText" class="wide" value="취득과정 전체보기"',
    'id="optSkipEmpty" checked', 'id="optAutoRun">'].forEach(function (markup) {
        assert.ok(file.indexOf(markup) !== -1, 'HTML phải có ' + markup);
    });

const FORM_DEFAULTS = {
    cat: '국가자격증', stripIntro: true, dropEmptyDesc: false, altFromTit: true,
    href: '#a', popupId: 'detail-1000', tabStart: '1', tabInc: true,
    viewText: '취득과정 전체보기', skipEmpty: true
};

form.value = SAMPLE;
registry.optCat.value = FORM_DEFAULTS.cat;
registry.optStripIntro.checked = FORM_DEFAULTS.stripIntro;
registry.optDropEmptyDesc.checked = FORM_DEFAULTS.dropEmptyDesc;
registry.optAltFromTit.checked = FORM_DEFAULTS.altFromTit;
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
assert.strictEqual(handleOut, realOut.html, 'Output qua form trùng kết quả core với option mặc định');
assert.ok(handleOut.indexOf(T(7) + '<p class="cat">국가자격증</p>') !== -1, 'Có p.cat 7 tab');
assert.ok(handleOut.indexOf(T(8) + '<p class="txt01">조경기사/조경산업기사 자격증</p>') !== -1, 'Có p.txt01 đã bỏ 소개');
assert.deepStrictEqual(tool.stat(), { tabs: '2', slides: '2', empty: '0' }, 'Stats đúng (2 tab / 2 slide / 0 rỗng)');
assert.ok(tool.toast().indexOf('✅') === 0, 'Toast báo thành công: ' + tool.toast());
assert.strictEqual(fakeDocument.getElementById('inputCount').textContent, '(' + SAMPLE.length + ' ký tự)', 'inputCount cập nhật');
assert.strictEqual(fakeDocument.getElementById('outputCount').textContent, '(' + handleOut.length + ' ký tự)', 'outputCount cập nhật');

// Đổi option trên form -> output đổi theo
registry.optCat.value = '민간자격증';
registry.optStripIntro.checked = false;
registry.optTabStart.value = '3';
registry.optPopupId.value = '7777';
registry.optViewHref.value = '/ko/dept/cert.do';
registry.optViewText.value = '자세히보기';
tool.handleConvert();
const out2 = fakeDocument.getElementById('outputText').value;
assert.ok(out2.indexOf('<p class="cat">민간자격증</p>') !== -1, 'cat lấy từ ô optCat');
assert.strictEqual((out2.match(/<p class="cat">민간자격증<\/p>/g) || []).length, 2, 'cat áp cho cả 2 slide');
assert.ok(out2.indexOf(T(8) + '<p class="txt01">조경기사/조경산업기사 자격증 소개</p>') !== -1, 'stripIntro=false -> giữ 소개');
assert.ok(out2.indexOf('href="/ko/dept/cert.do"') !== -1, 'href lấy từ ô optViewHref');
assert.ok(out2.indexOf('id="7777"') !== -1, 'id lấy từ ô optPopupId');
assert.ok(out2.indexOf('title="자세히보기"') !== -1, 'title lấy từ ô optViewText');
assert.deepStrictEqual(out2.match(/tab="\d+"/g), ['tab="3"', 'tab="4"'], 'optTabStart=3 -> tab 3, 4');
assert.strictEqual(out2, convert(SAMPLE, {
    cat: '민간자격증', stripIntro: false, dropEmptyDesc: false, altFromTit: true,
    href: '/ko/dept/cert.do', popupId: '7777', tabStart: '3', tabInc: true,
    viewText: '자세히보기', skipEmpty: true
}).html, 'handleConvert() khớp core khi đổi option');

// tabInc=false -> mọi slide cùng 1 tab
registry.optTabInc.checked = false;
registry.optTabStart.value = '7';
tool.handleConvert();
assert.deepStrictEqual(fakeDocument.getElementById('outputText').value.match(/tab="\d+"/g), ['tab="7"', 'tab="7"'], 'tabInc=false -> tab giữ nguyên');

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
assert.strictEqual(fakeDocument.getElementById('outputText').value.indexOf('<p class="txt02"></p>'), -1, 'dropEmptyDesc: SAMPLE 2 tab đều có desc nên không có txt02 rỗng');

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
assert.strictEqual(uniqueRefs.length, 28, 'Số id JS dùng (thực tế ' + uniqueRefs.length + ')');
assert.strictEqual(markupIds.length, 28, 'Số id trong markup (thực tế ' + markupIds.length + ')');

assert.strictEqual($page('title').text(), 'Certificate Converter - Chuyển js_tab_cont thành div.swiper-wrapper');
assert.strictEqual($page('h1 span').text(), 'js_tab_cont → div.swiper-wrapper');
assert.strictEqual($page('.options .option-group').length, 6, '6 nhóm tuỳ chọn');
assert.strictEqual($page('input[type="checkbox"]').length, 6, '6 checkbox');
assert.strictEqual($page('input[type="text"]').length, 4, '4 ô text');
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
console.log('🎉 Tất cả assertion PASS — logic certificate (js_tab_cont -> div.swiper-wrapper) hoạt động đúng.');
