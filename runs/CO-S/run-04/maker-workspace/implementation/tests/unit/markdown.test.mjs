import { test } from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown, escapeHtml } from "../../public/markdown.mjs";

test("escapes HTML before formatting (no injection)", () => {
  const out = renderMarkdown('<script>alert(1)</script>');
  assert.ok(!out.includes("<script>"));
  assert.ok(out.includes("&lt;script&gt;"));
});

test("bold and italic", () => {
  assert.ok(renderMarkdown("**key**").includes("<strong>key</strong>"));
  assert.ok(renderMarkdown("an *idea* here").includes("<em>idea</em>"));
});

test("inline code", () => {
  assert.ok(renderMarkdown("use `npm start`").includes("<code>npm start</code>"));
});

test("bullet list", () => {
  const out = renderMarkdown("- one\n- two");
  assert.ok(out.includes("<ul>"));
  assert.equal((out.match(/<li>/g) || []).length, 2);
});

test("links render with safe attributes and only http(s)", () => {
  const out = renderMarkdown("see [site](https://example.com/x)");
  assert.ok(out.includes('href="https://example.com/x"'));
  assert.ok(out.includes('rel="noopener noreferrer"'));
  // javascript: scheme is not a supported link pattern -> left as escaped text
  const bad = renderMarkdown("[x](javascript:alert(1))");
  assert.ok(!/href="javascript:/i.test(bad));
});

test("escapeHtml helper", () => {
  assert.equal(escapeHtml('a & b <c>'), "a &amp; b &lt;c&gt;");
});
