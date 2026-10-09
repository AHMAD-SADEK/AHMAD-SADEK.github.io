"use strict";

const assert = require("node:assert/strict");
global.window = {};
require("../assets/js/markdown.js");

const markdown = global.window.ArchiveMarkdown;
assert.ok(markdown, "renderer should register on window");

const hostile = markdown.render('<script>alert("xss")</script>\n\n<img src=x onerror=alert(1)>');
assert.equal(hostile.includes("<script>"), false, "raw script tags must not be emitted");
assert.equal(hostile.includes("<img src=x"), false, "raw image HTML must not be emitted");
assert.equal(hostile.includes("</script>"), false, "script closing tags must remain inert");

const unsafeLink = markdown.render("[click](javascript:alert(1))");
assert.equal(/<a\b[^>]*href=["']javascript:/i.test(unsafeLink), false);

const unsafeImage = markdown.render("![pixel](data:image/svg+xml,<svg onload=alert(1)>)");
assert.equal(/<img\b[^>]*src=["']data:/i.test(unsafeImage), false);

const safe = markdown.render(
  "# Heading\n\n**bold** and *italic*.\n\n- one\n- two\n\n[official](https://example.com)"
);
assert.match(safe, /<h[2-4]>Heading<\/h[2-4]>/);
assert.match(safe, /<strong>bold<\/strong>/);
assert.match(safe, /<em>italic<\/em>/);
assert.match(safe, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
assert.match(safe, /href="https:\/\/example\.com\/"/);
assert.match(safe, /rel="noopener noreferrer"/);

assert.equal(markdown.safeURL("javascript:alert(1)", "link"), "");
assert.equal(markdown.safeURL("//evil.example", "link"), "");
assert.equal(markdown.safeURL("https://example.com/path", "link"), "https://example.com/path");
assert.equal(markdown.safeURL("https://user:pass@example.com/", "link"), "");
assert.equal(markdown.safeURL("http://example.com/pixel.png", "image"), "");
assert.equal(markdown.safeURL("https://example.com/pixel.png", "image"), "https://example.com/pixel.png");

console.log("Markdown safety and rendering tests passed.");
