"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, (route) => route.abort());

    await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const host = document.querySelector("#featuredList");
      return host && !host.textContent.includes("Loading");
    }, { timeout: 15000 });

    const initialArchive = await page.evaluate(async () => (await fetch("/archive.json")).json());
    if (initialArchive.items.length) {
      const firstItem = initialArchive.items[0];
      const featuredLink = page.locator("#featuredList .feature").first();
      assert.equal(await featuredLink.getAttribute("href"), "/articles/" + firstItem.id + "/", "featured card should use the standalone permalink");
      await featuredLink.click();
      await page.waitForURL("**/articles/" + firstItem.id + "/");
      await page.locator("#articleTitle").waitFor({ state: "visible" });
      assert.equal(await page.locator("#articleTitle").innerText(), firstItem.title);
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://ahmad-sadek.github.io/articles/" + firstItem.id + "/");

      const articleData = JSON.parse(await page.locator("#articleData").textContent());
      await page.locator('[data-lang="ar"]').click();
      assert.equal(new URL(page.url()).searchParams.get("lang"), "ar", "switching an article to Arabic should persist the language in its URL");
      assert.equal(await page.locator("html").getAttribute("dir"), "rtl", "Arabic interface should use RTL direction");
      if (String(articleData.secondLanguage || "").trim()) {
        assert.equal(await page.locator("#articleContent").getAttribute("lang"), "ar", "a manually supplied second-language manuscript should declare Arabic");
      } else {
        assert.match(await page.locator("#articleContent").innerText(), /لا تتوفر نسخة مترجمة ومراجعة/);
      }
      await page.locator('[data-lang="en"]').click();
      assert.equal(await page.locator("html").getAttribute("dir"), "ltr");
      await page.locator(".article-back").click();
      await page.waitForURL("**/#archive");
      await page.locator("#archiveSearch").waitFor({ state: "visible" });
      await page.locator("#archiveSearch").fill(String(firstItem.title));
      assert.ok(await page.locator("#archiveList .entry").count() >= 1, "archive search should find a published item");
      await page.locator("#archiveSearch").fill("definitely-not-a-real-title");
      assert.match(await page.locator("#archiveList").innerText(), /No entries match your search/);
      await page.locator("#archiveSearch").fill("");
    } else {
      assert.equal(await page.locator("#featuredList .feature").count(), 0, "an empty archive should not render phantom articles");
    }

    const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
    mobile.on("pageerror", (error) => pageErrors.push(error.message));
    await mobile.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, (route) => route.abort());
    await mobile.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
    await mobile.waitForFunction(() => {
      const host = document.querySelector("#featuredList");
      return host && !host.textContent.includes("Loading");
    }, { timeout: 15000 });
    const menuButton = mobile.locator("#menuButton");
    await menuButton.waitFor({ state: "visible" });
    await menuButton.click();
    assert.equal(await menuButton.getAttribute("aria-expanded"), "true", "mobile menu button should expose its expanded state");
    await mobile.locator('#mobileNav a[href="#archive"]').click();
    await mobile.waitForURL("**/#archive");
    assert.equal(await menuButton.getAttribute("aria-expanded"), "false", "navigating should close the mobile menu");


    const arabic = await browser.newPage({ viewport: { width: 375, height: 812 } });
    arabic.on("pageerror", (error) => pageErrors.push(error.message));
    await arabic.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, (route) => route.abort());
    await arabic.goto("http://127.0.0.1:4173/ar/", { waitUntil: "domcontentloaded" });
    await arabic.waitForFunction(() => {
      const host = document.querySelector("#featuredList");
      return host && !host.textContent.includes("Loading");
    }, { timeout: 15000 });
    assert.equal(await arabic.locator("html").getAttribute("lang"), "ar", "the Arabic landing URL should declare Arabic");
    assert.equal(await arabic.locator("html").getAttribute("dir"), "rtl", "the Arabic landing URL should use RTL direction");
    assert.equal(await arabic.locator('link[rel="canonical"]').getAttribute("href"), "https://ahmad-sadek.github.io/ar/");
    assert.equal(await arabic.locator("#homeTitle").getAttribute("aria-label"), "أحمد صادق");
    assert.equal(await arabic.locator("#homeTitle .first-name").innerText(), "أحمد");
    assert.equal(await arabic.locator("#homeTitle .last-name").innerText(), "صادق");
    assert.doesNotMatch(await arabic.locator("#homeTitle").innerText(), /صادق\./, "the Arabic name should not carry an awkward trailing Latin period");
    const arabicArchive = await arabic.evaluate(async () => (await fetch("/archive.json")).json());
    assert.equal(await arabic.locator("#featuredList .feature").count(), arabicArchive.items.length,
      "the Arabic landing page should render exactly the published archive entries");
    await arabic.locator('[data-lang="en"]').click();
    await arabic.waitForURL((url) => url.pathname === "/", { timeout: 10000 });
    assert.equal(await arabic.locator("html").getAttribute("lang"), "en", "switching to English should use the English canonical route");
    await arabic.locator('[data-lang="ar"]').click();
    await arabic.waitForURL((url) => url.pathname === "/ar/", { timeout: 10000 });
    assert.equal(await arabic.locator("html").getAttribute("lang"), "ar", "switching to Arabic should use the Arabic canonical route");

    await arabic.setViewportSize({ width: 1365, height: 900 });
    const desktopHero = await arabic.locator("#homeTitle").evaluate((el) => {
      const titleStyle = getComputedStyle(el);
      const gridStyle = getComputedStyle(el.closest(".hero-grid"));
      const spans = [...el.querySelectorAll("span")];
      return {
        display: titleStyle.display,
        whiteSpace: titleStyle.whiteSpace,
        gridAlignment: gridStyle.alignItems,
        columnCount: gridStyle.gridTemplateColumns.trim().split(/\s+/).length,
        fits: el.scrollWidth <= el.clientWidth,
        spanTopDifference: Math.abs(spans[0].getBoundingClientRect().top - spans[1].getBoundingClientRect().top)
      };
    });
    assert.equal(desktopHero.display, "flex", "the Arabic name should be composed horizontally");
    assert.equal(desktopHero.whiteSpace, "nowrap", "the Arabic name should stay on one line");
    assert.equal(desktopHero.columnCount, 2, "the desktop Arabic hero should balance name and intro in two columns");
    assert.equal(desktopHero.gridAlignment, "center", "the name and intro should share a visual center");
    assert.equal(desktopHero.fits, true, "the one-line Arabic name should fit its desktop column");
    assert.ok(desktopHero.spanTopDifference < 2, "both parts of the Arabic name should sit on the same line");

    await arabic.setViewportSize({ width: 375, height: 812 });
    const mobileHero = await arabic.locator("#homeTitle").evaluate((el) => {
      const titleStyle = getComputedStyle(el);
      const gridStyle = getComputedStyle(el.closest(".hero-grid"));
      return {
        display: titleStyle.display,
        whiteSpace: titleStyle.whiteSpace,
        columnCount: gridStyle.gridTemplateColumns.trim().split(/\s+/).length,
        fits: el.scrollWidth <= el.clientWidth
      };
    });
    assert.equal(mobileHero.display, "flex", "the Arabic name should remain composed horizontally on mobile");
    assert.equal(mobileHero.whiteSpace, "nowrap", "the Arabic name should not wrap on mobile");
    assert.equal(mobileHero.columnCount, 1, "mobile hero content should be stacked in one column");
    assert.equal(mobileHero.fits, true, "the Arabic name should fit without horizontal overflow on mobile");
    if (arabicArchive.items.length) {
      const arabicArticleLink = arabic.locator("#featuredList .feature").first();
      assert.match(await arabicArticleLink.getAttribute("href"), /[?]lang=ar$/, "Arabic archive links should carry an explicit language");
      await arabicArticleLink.click();
      await arabic.waitForURL(new RegExp("/articles/" + arabicArchive.items[0].id + "/\\\\?lang=ar$"));
      await arabic.locator("#articleTitle").waitFor({ state: "visible" });
      assert.equal(await arabic.locator("html").getAttribute("lang"), "ar", "article opened from Arabic archive should render in Arabic");
    }
    await arabic.close();

    const studio = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    studio.on("pageerror", (error) => pageErrors.push(error.message));
    await studio.goto("http://127.0.0.1:4173/studio/", { waitUntil: "domcontentloaded" });
    await studio.locator("#login").waitFor({ state: "visible", timeout: 15000 });
    assert.equal(await studio.locator("html").getAttribute("dir"), "rtl", "the publishing studio should open in Arabic RTL");
    assert.match(await studio.locator("h1").innerText(), /مساحة الكتابة والنشر/, "the studio should render its publishing heading");
    await studio.locator("#connect").click();
    assert.match(await studio.locator("#loginStatus").innerText(), /أدخل رمز الوصول أولاً/, "the studio should validate an empty token without attempting an API write");
    assert.equal(await studio.locator("#workspace").isHidden(), true, "the publishing workspace should remain locked before authentication");
    assert.equal(await studio.evaluate(() => window.__archiveStudioRetryInstalled === true), true, "the studio should install its automatic fast-forward retry handler");

    const manager = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    manager.on("pageerror", (error) => pageErrors.push(error.message));
    await manager.goto("http://127.0.0.1:4173/studio/manage.html", { waitUntil: "domcontentloaded" });
    await manager.waitForFunction(() => {
      const host = document.querySelector("#publishedPosts");
      return host && !host.textContent.includes("يجري تحميل");
    }, { timeout: 15000 });
    assert.equal(await manager.locator("#publishedPosts .post-row").count(), initialArchive.items.length,
      "publication management should show the same published items as the public archive");
    await manager.locator("#connect").click();
    assert.match(await manager.locator("#manageStatus").innerText(), /أدخل رمز الوصول أولاً/);
    await manager.close();

    let patchCalls = 0;
    const treeCalls = [];
    const commitCalls = [];
    await studio.route("https://api.github.com/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      const corsHeaders = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "Authorization, Content-Type, Accept, X-GitHub-Api-Version",
        "access-control-allow-methods": "GET, POST, PATCH, OPTIONS"
      };
      if (method === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      const body = method === "GET" ? null : request.postDataJSON();
      if (url.pathname.endsWith("/git/trees") && method === "POST") {
        treeCalls.push(body);
        await route.fulfill({ status: 201, headers: corsHeaders, contentType: "application/json", body: JSON.stringify({ sha: treeCalls.length === 1 ? "first-tree" : "rebased-tree" }) });
        return;
      }
      if (url.pathname.endsWith("/git/commits") && method === "POST") {
        commitCalls.push(body);
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ sha: commitCalls.length === 1 ? "first-commit" : "rebased-commit" }) });
        return;
      }
      if (url.pathname.endsWith("/git/ref/heads/main") && method === "GET") {
        await route.fulfill({ status: 200, headers: corsHeaders, contentType: "application/json", body: JSON.stringify({ object: { sha: "new-main-head" } }) });
        return;
      }
      if (url.pathname.endsWith("/git/commits/new-main-head") && method === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ tree: { sha: "new-main-tree" } }) });
        return;
      }
      if (url.pathname.endsWith("/git/refs/heads/main") && method === "PATCH") {
        patchCalls += 1;
        if (patchCalls === 1) {
          await route.fulfill({ status: 422, headers: corsHeaders, contentType: "application/json", body: JSON.stringify({ message: "Update is not a fast forward" }) });
        } else {
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ref: "refs/heads/main", object: { sha: "rebased-commit" } }) });
        }
        return;
      }
      await route.fulfill({ status: 404, headers: corsHeaders, contentType: "application/json", body: JSON.stringify({ message: "Unexpected mocked API request: " + method + " " + url.pathname }) });
    });
    const retrySucceeded = await studio.evaluate(async () => {
      const base = "https://api.github.com/repos/AHMAD-SADEK/AHMAD-SADEK.github.io";
      const headers = { "Content-Type": "application/json", "Authorization": "Bearer test-token" };
      await fetch(base + "/git/trees", { method: "POST", headers, body: JSON.stringify({ base_tree: "old-tree", tree: [{ path: "content/writing/test/content.md", mode: "100644", type: "blob", sha: "content-blob" }] }) });
      await fetch(base + "/git/commits", { method: "POST", headers, body: JSON.stringify({ message: "Save draft: Retry test", tree: "first-tree", parents: ["old-head"] }) });
      const result = await fetch(base + "/git/refs/heads/main", { method: "PATCH", headers, body: JSON.stringify({ sha: "first-commit", force: false }) });
      return result.ok;
    });
    assert.equal(retrySucceeded, true, "a non-fast-forward update should be rebased and retried automatically");
    assert.equal(patchCalls, 2, "the ref update should be retried after a simulated race");
    assert.equal(treeCalls.length, 2, "the retry should rebuild a Git tree on the latest main tree");
    assert.equal(treeCalls[1].base_tree, "new-main-tree", "the retry should preserve intervening main-branch updates");
    assert.deepEqual(treeCalls[1].tree, treeCalls[0].tree, "the retry should reapply the exact saved file changes");
    assert.equal(commitCalls.length, 2, "the retry should create a new commit");
    assert.deepEqual(commitCalls[1].parents, ["new-main-head"], "the retry commit should use the newest main commit as its parent");
    await studio.close();

    assert.deepEqual(pageErrors, [], "the main, article, and Arabic landing pages should not throw uncaught JavaScript errors");
    console.log("Browser regression tests passed: archive, article, language direction, Arabic SEO landing page, search, filtering, and mobile navigation.");
    await mobile.close();
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
