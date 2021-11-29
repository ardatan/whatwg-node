"use strict";
/**
 * Multipart Parser (Finite State Machine)
 * usage:
 * const multipart = require('./multipart.js');
 * const body = multipart.DemoData(); 							   // raw body
 * const body = Buffer.from(event['body-json'].toString(),'base64'); // AWS case
 * const boundary = multipart.getBoundary(event.params.header['content-type']);
 * const parts = multipart.Parse(body,boundary);
 * each part is:
 * { filename: 'A.txt', type: 'text/plain', data: <Buffer 41 41 41 41 42 42 42 42> }
 *  or { name: 'key', data: <Buffer 41 41 41 41 42 42 42 42> }
 */
Object.defineProperty(exports, "__esModule", { value: true });
function parse(multipartBodyBuffer, boundary) {
    var lastline = '';
    var header = '';
    var info = '';
    var state = 0;
    var buffer = [];
    var allParts = [];
    for (var i = 0; i < multipartBodyBuffer.length; i++) {
        var oneByte = multipartBodyBuffer[i];
        var prevByte = i > 0 ? multipartBodyBuffer[i - 1] : null;
        var newLineDetected = oneByte === 0x0a && prevByte === 0x0d ? true : false;
        var newLineChar = oneByte === 0x0a || oneByte === 0x0d ? true : false;
        if (!newLineChar)
            lastline += String.fromCharCode(oneByte);
        if (0 === state && newLineDetected) {
            if ('--' + boundary === lastline) {
                state = 1;
            }
            lastline = '';
        }
        else if (1 === state && newLineDetected) {
            header = lastline;
            state = 2;
            if (header.indexOf('filename') === -1) {
                state = 3;
            }
            lastline = '';
        }
        else if (2 === state && newLineDetected) {
            info = lastline;
            state = 3;
            lastline = '';
        }
        else if (3 === state && newLineDetected) {
            state = 4;
            buffer = [];
            lastline = '';
        }
        else if (4 === state) {
            if (lastline.length > boundary.length + 4)
                lastline = ''; // mem save
            if ('--' + boundary === lastline) {
                var j = buffer.length - lastline.length;
                var part = buffer.slice(0, j - 1);
                var p = { header: header, info: info, part: part };
                allParts.push(process(p));
                buffer = [];
                lastline = '';
                state = 5;
                header = '';
                info = '';
            }
            else {
                buffer.push(oneByte);
            }
            if (newLineDetected)
                lastline = '';
        }
        else if (5 === state) {
            if (newLineDetected)
                state = 1;
        }
    }
    return allParts;
}
exports.parse = parse;
//  read the boundary from the content-type header sent by the http client
//  this value may be similar to:
//  'multipart/form-data; boundary=----WebKitFormBoundaryvm5A9tzU1ONaGP5B',
function getBoundary(header) {
    var items = header.split(';');
    if (items) {
        for (var i = 0; i < items.length; i++) {
            var item = new String(items[i]).trim();
            if (item.indexOf('boundary') >= 0) {
                var k = item.split('=');
                return new String(k[1]).trim();
            }
        }
    }
    return '';
}
exports.getBoundary = getBoundary;
function DemoData() {
    var body = 'trash1\r\n';
    body += '------WebKitFormBoundaryvef1fLxmoUdYZWXp\r\n';
    body +=
        'Content-Disposition: form-data; name="uploads[]"; filename="A.txt"\r\n';
    body += 'Content-Type: text/plain\r\n';
    body += '\r\n';
    body += '@11X';
    body += '111Y\r\n';
    body += '111Z\rCCCC\nCCCC\r\nCCCCC@\r\n\r\n';
    body += '------WebKitFormBoundaryvef1fLxmoUdYZWXp\r\n';
    body +=
        'Content-Disposition: form-data; name="uploads[]"; filename="B.txt"\r\n';
    body += 'Content-Type: text/plain\r\n';
    body += '\r\n';
    body += '@22X';
    body += '222Y\r\n';
    body += '222Z\r222W\n2220\r\n666@\r\n';
    body += '------WebKitFormBoundaryvef1fLxmoUdYZWXp\r\n';
    body += 'Content-Disposition: form-data; name="input1"\r\n';
    body += '\r\n';
    body += 'value1\r\n';
    body += '------WebKitFormBoundaryvef1fLxmoUdYZWXp--\r\n';
    return {
        body: Buffer.from(body),
        boundary: '----WebKitFormBoundaryvef1fLxmoUdYZWXp'
    };
}
exports.DemoData = DemoData;
function process(part) {
    // will transform this object:
    // { header: 'Content-Disposition: form-data; name="uploads[]"; filename="A.txt"',
    // info: 'Content-Type: text/plain',
    // part: 'AAAABBBB' }
    // into this one:
    // { filename: 'A.txt', type: 'text/plain', data: <Buffer 41 41 41 41 42 42 42 42> }
    var obj = function (str) {
        var k = str.split('=');
        var a = k[0].trim();
        var b = JSON.parse(k[1].trim());
        var o = {};
        Object.defineProperty(o, a, {
            value: b,
            writable: true,
            enumerable: true,
            configurable: true
        });
        return o;
    };
    var [,nameData, filenameData] = part.header.split(';');
    var input = {};
        Object.defineProperty(input, 'name', {
            value: nameData.split('=')[1].replace(/"/g, ''),
            writable: true,
            enumerable: true,
            configurable: true
        });
        // Needed to modify here to have name for files
        if (filenameData) {
            Object.defineProperty(input, 'filename', {
                value: filenameData.split('=')[1].replace(/"/g, ''),
                writable: true,
                enumerable: true,
                configurable: true
            });
            var contentType = part.info.split(':')[1].trim();
            Object.defineProperty(input, 'type', {
                value: contentType,
                writable: true,
                enumerable: true,
                configurable: true
            });
        }
    Object.defineProperty(input, 'data', {
        value: Buffer.from(part.part),
        writable: true,
        enumerable: true,
        configurable: true
    });
    return input;
}