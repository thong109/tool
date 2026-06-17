#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Đọc file CSS và làm gọn nội dung:
 * - Các thuộc tính trong cùng 1 selector được đưa lên 1 dòng
 * - Mỗi selector nằm trên 1 dòng riêng biệt
 *
 * Input:
 *   .slide-close {
 *       display: none;
 *       position: absolute;
 *   }
 *
 * Output:
 *   .slide-close{display:none;position:absolute;}
 */

function minifyCSS(content) {
    let result = '';
    let i = 0;
    let braceDepth = 0;
    let insideBlock = false;

    while (i < content.length) {
        const ch = content[i];

        if (ch === '{') {
            braceDepth++;
            insideBlock = true;
            // Xoá space thừa trước dấu {
            if (result.endsWith(' ')) {
                result = result.slice(0, -1);
            }
            result += '{';
            i++;
        } else if (ch === '}') {
            braceDepth--;
            // Xoá space hoặc ; thừa trước dấu }
            if (result.endsWith(' ')) {
                result = result.slice(0, -1);
            }
            if (result.endsWith(';')) {
                // Giữ nguyên
            }
            result += '}';
            // Xuống dòng sau mỗi selector
            result += '\n';
            i++;
            if (braceDepth === 0) {
                insideBlock = false;
            }
        } else if (insideBlock && braceDepth > 0) {
            // Bên trong block: bỏ newline, tab
            if (ch === '\n' || ch === '\r' || ch === '\t') {
                i++;
                continue;
            }
            if (ch === ' ') {
                // Xử lý space bên trong block
                const last = result.length > 0 ? result[result.length - 1] : '';
                if (last === ' ' || last === '{' || last === ';') {
                    i++;
                    continue;
                }
                // Nhìn trước: nếu space đó đứng trước : hoặc ; hoặc } thì bỏ
                let j = i + 1;
                while (j < content.length && (content[j] === ' ' || content[j] === '\n' || content[j] === '\r' || content[j] === '\t')) {
                    j++;
                }
                if (j < content.length && (content[j] === ':' || content[j] === ';' || content[j] === '}')) {
                    i = j;
                    continue;
                }
                result += ' ';
                i++;
            } else {
                result += ch;
                i++;
            }
        } else {
            // Bên ngoài block: xử lý whitespace, comment, v.v.
            if (ch === '\n' || ch === '\r' || ch === '\t') {
                i++;
                continue;
            }
            if (ch === ' ' && result.endsWith(' ')) {
                i++;
                continue;
            }
            result += ch;
            i++;
        }
    }

    // Xoá dòng trống thừa
    return result.replace(/\n+/g, '\n').trim();
}

function processFile(inputPath, outputPath) {
    try {
        const content = fs.readFileSync(inputPath, 'utf8');
        const minified = minifyCSS(content);
        
        if (outputPath) {
            fs.writeFileSync(outputPath, minified, 'utf8');
            console.log(`✅ Đã ghi file: ${outputPath}`);
            console.log(`   Kích thước gốc: ${Buffer.byteLength(content, 'utf8')} bytes`);
            console.log(`   Kích thước sau: ${Buffer.byteLength(minified, 'utf8')} bytes`);
        } else {
            console.log(minified);
        }
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        process.exit(1);
    }
}

// CLI
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
CSS Minify Tool - Làm gọn file CSS

Cách dùng:
  node css-minify.js <input.css> [output.css]

Nếu không cung cấp output.css, kết quả sẽ được in ra terminal.

Ví dụ:
  node css-minify.js style.css style.min.css
  node css-minify.js style.css
`);
    process.exit(0);
}

const inputFile = args[0];
const outputFile = args[1] || null;

if (!fs.existsSync(inputFile)) {
    console.error(`❌ Không tìm thấy file: ${inputFile}`);
    process.exit(1);
}

processFile(inputFile, outputFile);