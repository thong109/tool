/**
 * Test cho image-converter.html
 * - Syntax-check tat ca inline <script> trong file tool
 * - Trich core converter (pure helpers + pipeline canvas) va chay that voi mock
 * - Assert bao dam chat luong: giu w/h goc, PNG lossless, JPG quality mac dinh 1.0
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

if (typeof globalThis.File === 'undefined' && typeof require('buffer').File !== 'undefined') {
    globalThis.File = require('buffer').File;
}

const cheerio = require('cheerio');

const TOOL_FILE = path.join(__dirname, 'image-converter.html');
const file = fs.readFileSync(TOOL_FILE, 'utf8');

// ============ 1. Trich tat ca <script> va syntax-check ============
const scripts = [];
const scriptRe = /<script>([\s\S]*?)<\/script>/g;
let m;
while ((m = scriptRe.exec(file)) !== null) scripts.push(m[1]);

assert.ok(scripts.length >= 3, `So script block phai >= 3 (thuc te ${scripts.length})`);
scripts.forEach(function (code, i) {
    try { new Function(code); }
    catch (e) { throw new Error(`Syntax error o script block #${i}: ${e.message}`); }
});
console.log(`OK: syntax OK cho ${scripts.length} inline <script> block`);

const coreBlock = scripts.find(function (s) { return s.indexOf('Core converter') !== -1; });
assert.ok(coreBlock, 'Khong tim thay core converter script');
assert.ok(coreBlock.indexOf('convertImageFile') !== -1, 'Core phai co convertImageFile');
assert.ok(coreBlock.indexOf("imageSmoothingQuality = 'high'") !== -1, 'Phai ve smoothing high de giu net');
assert.ok(coreBlock.indexOf('drawImage(img, 0, 0, w, h)') !== -1, 'Phai ve dung kich thuoc goc (khong resize)');
assert.ok(coreBlock.indexOf('canvas.width = w') !== -1, 'Canvas width = w goc');
assert.ok(coreBlock.indexOf('canvas.height = h') !== -1, 'Canvas height = h goc');
assert.ok(coreBlock.indexOf("toBlob(done, mime, quality)") !== -1, 'JPG xuat voi quality param');
assert.ok(coreBlock.indexOf('quality != null ? opts.quality : 1') !== -1 || coreBlock.indexOf('opts.quality : 1') !== -1, 'Quality mac dinh 1.0 (100%)');

// ============ 2. Nap core pure helpers vao Node ============
const pureSrc = coreBlock.slice(coreBlock.indexOf('const ACCEPTED_TYPES'), coreBlock.indexOf('// Đọc File/Blob'));
const pureFactory = new Function(pureSrc + '\nreturn { formatBytes, extForFormat, mimeForFormat, clampQuality, outFileName, isAcceptedFile, parseHexColor, cssForBg };');
const P = pureFactory();

assert.strictEqual(P.extForFormat('png'), 'png');
assert.strictEqual(P.extForFormat('jpeg'), 'jpg');
assert.strictEqual(P.mimeForFormat('png'), 'image/png');
assert.strictEqual(P.mimeForFormat('jpeg'), 'image/jpeg');
assert.strictEqual(P.clampQuality(1), 1);
assert.strictEqual(P.clampQuality(5), 1);
assert.strictEqual(P.clampQuality(0), 0.01);
assert.strictEqual(P.clampQuality(NaN), 1);
assert.strictEqual(P.outFileName('photo.PNG', 'jpeg'), 'photo.jpg');
assert.strictEqual(P.outFileName('anh.webq.webp', 'png'), 'anh.webq.png');
assert.strictEqual(P.outFileName('khong-duoi', 'jpeg'), 'khong-duoi.jpg');
assert.ok(P.isAcceptedFile({ name: 'a.png', type: 'image/png' }));
assert.ok(P.isAcceptedFile({ name: 'b.JPG', type: '' }));
assert.ok(!P.isAcceptedFile({ name: 'c.gif', type: 'image/gif' }));
assert.ok(!P.isAcceptedFile({ name: 'c.txt', type: 'text/plain' }));
assert.deepStrictEqual(P.parseHexColor('#fff'), { r: 255, g: 255, b: 255 });
assert.deepStrictEqual(P.parseHexColor('#123456'), { r: 18, g: 52, b: 86 });
assert.strictEqual(P.parseHexColor('xyz'), null);
assert.strictEqual(P.cssForBg({ r: 1, g: 2, b: 3 }), 'rgb(1,2,3)');
assert.strictEqual(P.cssForBg(null, '#000000'), '#000000');
assert.strictEqual(P.formatBytes(0), '0 B');
assert.ok(P.formatBytes(2048).indexOf('KB') !== -1);
console.log('OK: pure helpers (ten file, quality, mau nen, dinh dang)');

/**
 * Mock pipeline de verify hanh vi canvas giu chat luong
 * (khong can encode anh that — chi can bat dung tham so goi)
 */
const pipeSrc = coreBlock.slice(coreBlock.indexOf('function loadImageBitmap'), coreBlock.indexOf('    </scr') !== -1 ? coreBlock.indexOf('    </scr') : coreBlock.length);

function makeHarness(opts) {
    opts = opts || {};
    const calls = { fillRect: 0, clearRect: 0, drawImageArgs: null, toBlobArgs: null, fillStyle: null, ctxOpts: null };
    const fakeImg = { __w: 800, __h: 600 };
    const fakeCanvas = {
        width: 0,
        height: 0,
        getContext: function (type, cOpts) {
            calls.ctxOpts = { type, cOpts };
            const ctx = {
                set fillStyle(v) { calls.fillStyle = v; },
                get fillStyle() { return calls.fillStyle; },
                imageSmoothingEnabled: false,
                imageSmoothingQuality: 'default',
                fillRect: function () { calls.fillRect++; },
                clearRect: function () { calls.clearRect++; },
                drawImage: function () { calls.drawImageArgs = Array.from(arguments); }
            };
            return ctx;
        },
        toBlob: function (cb, mime, q) {
            calls.toBlobArgs = { mime, q };
            cb({ size: 12345 });
        }
    };
    const sandbox = {
        document: { createElement: () => fakeCanvas },
        URL: { createObjectURL: () => 'blob:fake', revokeObjectURL: () => {} },
        Image: function () {},
        createImageBitmap: opts.noBitmap ? undefined : () => Promise.resolve({ width: 800, height: 600, close: () => {} })
    };
    if (opts.noBitmap) delete sandbox.createImageBitmap;
    const factory = new Function('document', 'URL', 'createImageBitmap', 'Image', 'parseHexColor', 'cssForBg', 'clampQuality', 'mimeForFormat', pipeSrc + '\nreturn { convertImageFile, renderToCanvas };');
    const api = factory.call(null, sandbox.document, sandbox.URL, sandbox.createImageBitmap, sandbox.Image, P.parseHexColor, P.cssForBg, P.clampQuality, P.mimeForFormat);
    return { api, calls };
}

// JPG: lot nen + ve dung 800x600 + toBlob image/jpeg quality 1.0
(async () => {
    const t1 = makeHarness();
    const res = await t1.api.convertImageFile({ name: 'a.png' }, { format: 'jpeg', quality: 1, bg: '#ffffff' });
    assert.strictEqual(res.w, 800, 'Giu width goc');
    assert.strictEqual(res.h, 600, 'Giu height goc');
    assert.strictEqual(res.mime, 'image/jpeg');
    assert.strictEqual(t1.calls.fillRect, 1, 'JPG phai lot nen (fillRect 1 lan)');
    assert.strictEqual(t1.calls.clearRect, 0);
    assert.strictEqual(t1.calls.fillStyle, 'rgb(255,255,255)', 'Nen mac dinh trang');
    assert.ok(t1.calls.drawImageArgs && t1.calls.drawImageArgs[1] === 0 && t1.calls.drawImageArgs[2] === 0 && t1.calls.drawImageArgs[3] === 800 && t1.calls.drawImageArgs[4] === 600, 'drawImage dung w/h goc');
    assert.strictEqual(t1.calls.toBlobArgs.mime, 'image/jpeg');
    assert.strictEqual(t1.calls.toBlobArgs.q, 1, 'JPG quality mac dinh 1.0');
    assert.strictEqual(t1.calls.ctxOpts.cOpts.alpha, false, 'JPG context alpha=false');
    console.log('OK: pipeline JPEG (lot nen trang, giu 800x600, quality 1.0)');

    // PNG: khong lot nen, giu alpha, khong truyen quality
    const t2 = makeHarness();
    await t2.api.convertImageFile({ name: 'b.jpg' }, { format: 'png', bg: '#000000' });
    assert.strictEqual(t2.calls.clearRect, 1, 'PNG clear (giu trong suot)');
    assert.strictEqual(t2.calls.fillRect, 0, 'PNG khong lot nen');
    assert.strictEqual(t2.calls.toBlobArgs.mime, 'image/png');
    assert.strictEqual(t2.calls.toBlobArgs.q, undefined, 'PNG lossless (khong quality)');
    assert.strictEqual(t2.calls.ctxOpts.cOpts.alpha, true, 'PNG context alpha=true');
    console.log('OK: pipeline PNG (giu alpha, lossless, khong lot nen)');

    // JPG nen do + quality tuy chinh
    const t3 = makeHarness();
    await t3.api.convertImageFile({ name: 'c.webp' }, { format: 'jpeg', quality: 0.92, bg: '#ff0000' });
    assert.strictEqual(t3.calls.fillStyle, 'rgb(255,0,0)');
    assert.strictEqual(t3.calls.toBlobArgs.q, 0.92);
    console.log('OK: pipeline JPEG (nen do tuy chinh, quality 0.92)');

    // Fallback Image path khi khong co createImageBitmap
    const t4 = makeHarness({ noBitmap: true });
    assert.ok(typeof t4.api.convertImageFile === 'function', 'Van co convertImageFile khi thieu createImageBitmap');
    console.log('OK: fallback Image khi thieu createImageBitmap');

    // ============ 4. Assert cau truc HTML tool ============
    const $page = cheerio.load(file);
    assert.strictEqual($page('#header-container').length, 1, 'Co cho nap header menu');
    assert.ok(file.indexOf("link.getAttribute('data-page') === 'image-converter'") !== -1, 'Header menu active theo data-page="image-converter"');
    assert.strictEqual($page('#dropzone').length, 1, 'Co dropzone');
    assert.strictEqual($page('#fileInput[multiple]').length, 1, 'input multiple');
    assert.strictEqual($page('input[name="outFormat"]').length, 2, '2 radio dinh dang');
    assert.strictEqual($page('#optQuality').attr('value'), '100', 'Quality mac dinh 100');
    assert.strictEqual($page('#optBg').attr('value'), '#ffffff', 'Nen mac dinh trang');
    assert.strictEqual($page('#btnConvert').length, 1, 'Nut convert');
    assert.strictEqual($page('.stat-item').length, 4, '4 o thong ke');

    const menuFile = fs.readFileSync(path.join(__dirname, 'header-menu.html'), 'utf8');
    assert.ok(menuFile.indexOf('data-page="image-converter"') !== -1, 'header-menu.html co link image-converter');
    assert.ok(menuFile.indexOf('image-converter.html') !== -1, 'header-menu.html tro dung file');
    console.log('OK: cau truc HTML + header menu link');

    console.log('\nPASS: test-image-converter.js (5 nhom)');
})().catch(e => { console.error('FAIL:', e.message); process.exit(1); });

