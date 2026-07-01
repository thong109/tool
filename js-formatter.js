#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Định dạng JavaScript code với indent 2 spaces
 *
 * Input:
 *   function hello(){const x=1;return x;}
 *
 * Output:
 *   function hello() {
 *     const x = 1;
 *     return x;
 *   }
 */

function formatJS(code) {
    // ===== SIMPLE TOKENIZER =====
    const tokens = [];
    let i = 0;

    while (i < code.length) {
        const ch = code[i];
        const next = code[i + 1] || '';

        // Skip whitespace, track newlines
        if (ch === ' ' || ch === '\t') { i++; continue; }
        if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && next === '\n') i += 2; else i++;
            tokens.push({ t: 'nl' });
            continue;
        }

        // Line comment
        if (ch === '/' && next === '/') {
            let comment = '';
            i += 2;
            while (i < code.length && code[i] !== '\n') { comment += code[i]; i++; }
            tokens.push({ t: 'lineComment', v: comment });
            continue;
        }

        // Block comment
        if (ch === '/' && next === '*') {
            let comment = '';
            i += 2;
            while (i < code.length - 1) {
                if (code[i] === '*' && code[i + 1] === '/') { i += 2; break; }
                comment += code[i];
                i++;
            }
            tokens.push({ t: 'blockComment', v: comment });
            continue;
        }

        // String
        if (ch === "'" || ch === '"' || ch === '`') {
            let str = ch;
            let quote = ch;
            i++;
            while (i < code.length) {
                if (ch === '`' && code[i] === '$' && code[i + 1] === '{') {
                    str += '${';
                    i += 2;
                    let depth = 1;
                    while (i < code.length && depth > 0) {
                        if (code[i] === '{') depth++;
                        if (code[i] === '}') depth--;
                        str += code[i];
                        i++;
                    }
                    continue;
                }
                if (code[i] === '\\' && code[i + 1]) { str += code[i] + code[i + 1]; i += 2; continue; }
                str += code[i];
                if (code[i] === quote) { i++; break; }
                i++;
            }
            tokens.push({ t: 'string', v: str });
            continue;
        }

        // Number
        if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(next) && (i === 0 || /[=(,+\-*/%!&|^?:[]/.test(code[i - 1])))) {
            let num = '';
            if (ch === '-') { num = '-'; i++; }
            while (i < code.length && /[0-9.Ee+\-]/.test(code[i])) {
                if ((code[i] === '+' || code[i] === '-') && i > 0 && code[i - 1] !== 'e' && code[i - 1] !== 'E') break;
                num += code[i];
                i++;
            }
            tokens.push({ t: 'word', v: num });
            continue;
        }

        // Word / identifier
        if (/[a-zA-Z0-9_$\u00C0-\u024F]/.test(ch)) {
            let word = '';
            while (i < code.length && /[a-zA-Z0-9_$\u00C0-\u024F]/.test(code[i])) { word += code[i]; i++; }
            tokens.push({ t: 'word', v: word });
            continue;
        }

        // Multi-char operators
        const ops = {
            '===': 'op', '!==': 'op', '==': 'op', '!=': 'op', '&&': 'op', '||': 'op',
            '>=': 'op', '<=': 'op', '=>': 'op', '++': 'inc', '--': 'dec',
            '+=': 'op', '-=': 'op', '*=': 'op', '/=': 'op', '%=': 'op', '**': 'op',
            '<<': 'op', '>>': 'op', '?.': 'op', '::': 'op'
        };
        let matched = false;
        for (const [op, type] of Object.entries(ops)) {
            if (code.substring(i, i + op.length) === op) {
                tokens.push({ t: type, v: op });
                i += op.length;
                matched = true;
                break;
            }
        }
        if (matched) continue;

        // Single char operators & punctuation
        if ('+-*/%=><!&|^~?:'.includes(ch)) { tokens.push({ t: 'op', v: ch }); i++; continue; }
        if (ch === '.') { tokens.push({ t: 'dot', v: '.' }); i++; continue; }
        if (ch === '{') { tokens.push({ t: '{' }); i++; continue; }
        if (ch === '}') { tokens.push({ t: '}' }); i++; continue; }
        if (ch === '(') { tokens.push({ t: '(' }); i++; continue; }
        if (ch === ')') { tokens.push({ t: ')' }); i++; continue; }
        if (ch === '[') { tokens.push({ t: '[' }); i++; continue; }
        if (ch === ']') { tokens.push({ t: ']' }); i++; continue; }
        if (ch === ';') { tokens.push({ t: ';' }); i++; continue; }
        if (ch === ',') { tokens.push({ t: ',' }); i++; continue; }

        // Fallback
        tokens.push({ t: 'char', v: ch });
        i++;
    }

    // ===== FORMATTER =====
    const keywords = new Set([
        'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
        'try', 'catch', 'finally', 'function', 'class', 'return', 'throw',
        'const', 'let', 'var', 'import', 'export', 'from', 'async', 'await',
        'yield', 'new', 'delete', 'typeof', 'instanceof', 'in', 'of',
        'break', 'continue', 'debugger', 'void', 'with', 'this', 'super',
        'extends', 'implements', 'interface', 'package', 'private', 'protected',
        'public', 'static', 'enum', 'get', 'set'
    ]);

    const controlFlow = new Set(['if', 'for', 'while', 'switch', 'catch']);

    // Step 1: Determine which ':' are object property colons vs ternary
    // A colon after a word/string and before a word/string/brace/bracket/paren is a property colon
    for (let t = 0; t < tokens.length; t++) {
        const tok = tokens[t];
        if (tok.v === ':' && tok.t === 'op') {
            const prev = tokens[t - 1];
            const next = tokens[t + 1];
            if (prev && next &&
                (prev.t === 'word' || prev.t === 'string' || prev.t === ']') &&
                (next.t === 'word' || next.t === 'string' || next.t === '{' || next.t === '[' || next.t === '(' || next.t === '-' || next.t === 'inc' || next.t === 'dec')) {
                tok.t = 'propColon';
            }
        }
    }

    // Step 2: Build formatted output
    let out = '';
    let indent = 0;
    let nlPending = false;
    let lastT = null;
    let lastV = '';
    let inFor = 0;

    function emitIndent() {
        out += '  '.repeat(indent);
    }

    function emitNewline() {
        if (!out.endsWith('\n')) out += '\n';
        nlPending = false;
    }

    function trimEnd() {
        while (out.endsWith(' ')) out = out.slice(0, -1);
    }

    function trimEndNewline() {
        while (out.endsWith(' ') || out.endsWith('\n')) out = out.slice(0, -1);
    }

    const keywordsAfterSpace = new Set(['return', 'throw', 'typeof', 'void', 'delete']);

    for (let t = 0; t < tokens.length; t++) {
        const tok = tokens[t];
        const nextTok = tokens[t + 1] || null;
        const nextT = nextTok ? nextTok.t : '';

        if (tok.t === 'nl') {
            if (out.length > 0 && !out.endsWith('\n')) out += '\n';
            nlPending = true;
            continue;
        }

        // Handle comments
        if (tok.t === 'lineComment') {
            if (!out.endsWith('\n')) out += '\n';
            emitIndent();
            out += '//' + tok.v + '\n';
            continue;
        }
        if (tok.t === 'blockComment') {
            if (!out.endsWith('\n')) out += '\n';
            const lines = tok.v.split('\n');
            const ind = '  '.repeat(indent);
            out += ind + '/*\n';
            for (const line of lines) {
                const trimmed = line.replace(/^\s*\*?\s?/, '');
                out += ind + ' * ' + trimmed + '\n';
            }
            out += ind + ' */\n';
            continue;
        }

        // Emit newline + indent if needed
        if (nlPending || out === '') {
            if (out !== '') emitNewline();
            emitIndent();
            nlPending = false;
        }

        const val = tok.v || '';
        const type = tok.t;

        // ---- BRACES ----
        if (type === '{') {
            trimEnd();
            out += ' {';
            indent++;
            out += '\n';
            nlPending = true;
            lastT = type; lastV = val;
            continue;
        }
        if (type === '}') {
            indent = Math.max(0, indent - 1);
            trimEndNewline();
            out += '\n';
            emitIndent();
            out += '}';
            // else/catch/finally/semicolon/comma on same line
            if (nextT === ',' || nextT === ';' || nextTok && (nextTok.v === 'else' || nextTok.v === 'catch' || nextTok.v === 'finally')) {
                // stay
            } else if (nextT && nextT !== 'nl' && nextT !== '}' && nextT !== ')') {
                out += ' ';
            } else if (nextT === ';' || nextT === 'nl' || nextT === '}' || nextT === ')') {
                out += '\n';
                nlPending = true;
            } else {
                out += '\n';
                nlPending = true;
            }
            lastT = type; lastV = val;
            continue;
        }

        // ---- SEMICOLON ----
        if (type === ';') {
            out += ';';
            if (inFor > 0) {
                out += ' ';
            } else {
                out += '\n';
                nlPending = true;
            }
            lastT = type; lastV = val;
            continue;
        }

        // ---- COMMA ----
        if (type === ',') {
            out += ',';
            if (nextT === ')' || nextT === ']' || nextT === 'nl' || nextT === ';') {
                // no space
            } else {
                out += ' ';
            }
            lastT = type; lastV = val;
            continue;
        }

        // ---- PAREN ----
        if (type === '(') {
            trimEnd();
            // Space before ( for control flow keywords
            if (lastT === 'word' && controlFlow.has(lastV)) {
                out += ' ';
            }
            // Remove space before (
            out += '(';
            if (lastV === 'for') inFor++;
            if (inFor > 0 && lastV !== 'for') inFor++;
            lastT = type; lastV = val;
            continue;
        }
        if (type === ')') {
            trimEnd();
            out += ')';
            if (inFor > 0) {
                inFor = Math.max(0, inFor - 1);
            }
            lastT = type; lastV = val;
            continue;
        }

        // ---- BRACKETS ----
        if (type === '[') { out += '['; lastT = type; lastV = val; continue; }
        if (type === ']') { trimEnd(); out += ']'; lastT = type; lastV = val; continue; }

        // ---- DOT ----
        if (type === 'dot') { trimEnd(); out += '.'; lastT = type; lastV = val; continue; }

        // ---- OPERATORS ----
        if (type === 'op' || type === 'inc' || type === 'dec' || type === 'propColon') {
            // Arrow function
            if (val === '=>') {
                trimEnd();
                out += ' => ';
                lastT = type; lastV = val;
                continue;
            }

            // Colon (property vs ternary)
            if (val === ':') {
                if (tok.t === 'propColon') {
                    trimEnd();
                    out += ': ';
                } else {
                    trimEnd();
                    out += ' : ';
                }
                lastT = type; lastV = val;
                continue;
            }

            // Ternary question mark
            if (val === '?') {
                trimEnd();
                out += ' ? ';
                lastT = type; lastV = val;
                continue;
            }

            // Increment/decrement
            if (val === '++' || val === '--') {
                if (lastT === 'word' || lastT === ')' || lastT === ']') {
                    // Postfix
                    trimEnd();
                    out += val;
                } else {
                    // Prefix
                    out += val;
                }
                lastT = type; lastV = val;
                continue;
            }

            // Unary operators
            const isUnary = (val === '!' || val === '~') || (
                (val === '+' || val === '-') && (
                    lastT === null || lastT === 'op' || lastT === ',' ||
                    lastT === '(' || lastT === '[' || lastT === '{' ||
                    lastT === ';' || lastT === 'nl' ||
                    (lastT === 'word' && keywordsAfterSpace.has(lastV)) ||
                    lastV === '=' || lastV === '?' || lastV === ':' ||
                    lastV === '!' || lastV === '&' || lastV === '|' || lastV === '^' ||
                    lastV === '*' || lastV === '/' || lastV === '%'
                )
            );

            if (isUnary) {
                if (val === '!' || val === '~') {
                    trimEnd();
                    out += val;
                } else {
                    trimEnd();
                    out += ' ' + val;
                }
            } else {
                // Binary
                trimEnd();
                out += ' ' + val + ' ';
            }
            lastT = type; lastV = val;
            continue;
        }

        // ---- WORDS / STRINGS ----
        if (type === 'word' || type === 'string' || type === 'char') {
            // Space before?
            if (lastT !== null && lastT !== '(' && lastT !== '[' && lastT !== '{' && lastT !== 'dot' &&
                lastT !== ';' && lastT !== ',' && lastT !== 'inc' && lastT !== 'dec' &&
                !(lastT === 'op' && (lastV === '!' || lastV === '~'))) {
                const lastChar = out[out.length - 1] || '';
                if (lastChar !== ' ' && lastChar !== '\n') {
                    // Check if last token already added space (e.g. after comma, semicolon, binary op)
                    const lastTokenAddedSpace = lastT === ',' || lastT === ';' || lastT === 'nl' ||
                        (lastT === 'op' && lastV !== '!' && lastV !== '~' && lastV !== '++' && lastV !== '--' && lastV !== '?');
                    if (!lastTokenAddedSpace) {
                        // Need space between identifiers/keywords
                        if ((lastT === 'word' || lastT === ')' || lastT === ']' || lastV === '}' || lastV === 'propColon') &&
                            (type === 'word' || type === 'string')) {
                            out += ' ';
                        }
                    }
                }
            }

            // else/catch/finally - space before
            if ((val === 'else' || val === 'catch' || val === 'finally') && !out.endsWith(' ') && !out.endsWith('\n')) {
                trimEnd();
                out += ' ' + val;
                lastT = type; lastV = val;
                continue;
            }

            // Keywords that need space after
            if (keywordsAfterSpace.has(val)) {
                out += val + ' ';
                lastT = type; lastV = val;
                continue;
            }

            out += val;
            lastT = type; lastV = val;
            continue;
        }
    }

    // Post-process
    let lines = out.split('\n');
    lines = lines.map(l => l.replace(/\s+$/, ''));
    const cleaned = [];
    let prevEmpty = false;
    for (const line of lines) {
        if (line === '') {
            if (!prevEmpty && cleaned.length > 0 && cleaned[cleaned.length - 1] !== '') {
                cleaned.push('');
                prevEmpty = true;
            }
        } else {
            cleaned.push(line);
            prevEmpty = false;
        }
    }

    return cleaned.join('\n').trim() + '\n';
}

function processFile(inputPath, outputPath) {
    try {
        const content = fs.readFileSync(inputPath, 'utf8');
        const formatted = formatJS(content);

        if (outputPath) {
            fs.writeFileSync(outputPath, formatted, 'utf8');
            console.log(`✅ Đã ghi file: ${outputPath}`);
            console.log(`   Kích thước gốc: ${Buffer.byteLength(content, 'utf8')} bytes`);
            console.log(`   Kích thước sau: ${Buffer.byteLength(formatted, 'utf8')} bytes`);
        } else {
            console.log(formatted);
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
JS Formatter Tool - Định dạng JavaScript với indent 2 spaces

Cách dùng:
  node js-formatter.js <input.js> [output.js]

Nếu không cung cấp output.js, kết quả sẽ được in ra terminal.

Ví dụ:
  node js-formatter.js app.js app.formatted.js
  node js-formatter.js app.js
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