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
    await page.locator("#featuredList .feature").first().waitFor({ state: "visible", timeout: 15000 });

    const featuredText = await page.locator("#featuredList").innerText();
    assert.match(featuredText, /The Discipline of Curiosity/, "the published article should appear in featured content");

    const featuredLink = page.locator("#featuredList .feature").filter({ hasText: "The Discipline of Curiosity" }).first();
    assert.equal(await featuredLink.getAttribute("href"), "/articles/3/", "featured card should use the standalone permalink");
    await featuredLink.click();
    await page.waitForURL("**/articles/3/");
    await page.locator("#articleTitle").waitFor({ state: "visible" });
    assert.equal(await page.locator("#articleTitle").innerText(), "The Discipline of Curiosity");
    assert.match(await page.locator("#articleContent").innerText(), /Curiosity often begins/);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://ahmad-sadek.github.io/articles/3/");
    assert.equal(await page.locator("#articleTitle").getAttribute("dir"), "ltr");

    await page.locator('[data-lang="ar"]').click();
    assert.equal(await page.locator("html").getAttribute("dir"), "rtl", "Arabic interface should use RTL direction");
    assert.equal(await page.locator("#articleTitle").getAttribute("dir"), "ltr", "English manuscript direction should not flip with UI language");
    assert.match(await page.locator("#articleContent").innerText(), /Curiosity often begins/);
    await page.locator('[data-lang="en"]').click();
    assert.equal(await page.locator("html").getAttribute("dir"), "ltr");

    await page.locator(".article-back").click();
    await page.waitForURL("**/#archive");
    await page.locator("#archiveSearch").waitFor({ state: "visible" });

    const search = page.locator("#archiveSearch");
    await search.fill("Curiosity");
    assert.equal(await page.locator("#archiveList .entry").count(), 1, "archive search should find the article");
    await search.fill("definitely-not-a-real-title");
    assert.match(await page.locator("#archiveList").innerText(), /No entries match your search/);
    await search.fill("");
    await page.locator('[data-filter="book"]').click();
    assert.equal(await page.locator("#archiveList .entry").count(), 0, "type filtering should exclude articles from the book list");
    assert.match(await page.locator("#archiveList").innerText(), /No entries match your search/);

    const mobile = await browser.newPage({ viewport: { width: 375, height: 812 } });
    mobile.on("pageerror", (error) => pageErrors.push(error.message));
    await mobile.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, (route) => route.abort());
    await mobile.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });
    await mobile.locator("#featuredList .feature").first().waitFor({ state: "visible", timeout: 15000 });
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
    await arabic.locator("#featuredList .feature").first().waitFor({ state: "visible", timeout: 15000 });
    assert.equal(await arabic.locator("html").getAttribute("lang"), "ar", "the Arabic landing URL should declare Arabic");
    assert.equal(await arabic.locator("html").getAttribute("dir"), "rtl", "the Arabic landing URL should use RTL direction");
    assert.equal(await arabic.locator('link[rel="canonical"]').getAttribute("href"), "https://ahmad-sadek.github.io/ar/");
    assert.equal(await arabic.locator("#homeTitle").getAttribute("aria-label"), "أحمد صادق");
    assert.equal(await arabic.locator("#homeTitle .first-name").innerText(), "أحمد");
    assert.equal(await arabic.locator("#homeTitle .last-name").innerText(), "صادق");
    assert.doesNotMatch(await arabic.locator("#homeTitle").innerText(), /صادق\./, "the Arabic name should not carry an awkward trailing Latin period");
    assert.match(await arabic.locator("#featuredList").innerText(), /The Discipline of Curiosity/);
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
        columnWidths: gridStyle.gridTemplateColumns.trim().split(/\s+/).map((value) => parseFloat(value)),
        columnCount: gridStyle.gridTemplateColumns.trim().split(/\s+/).length,
        introMarginTop: parseFloat(getComputedStyle(el.closest(".hero-grid").children[1]).marginTop),
        introTopOffset: el.closest(".hero-grid").children[1].getBoundingClientRect().top - el.getBoundingClientRect().top,
        fits: el.scrollWidth <= el.clientWidth,
        spanTopDifference: Math.abs(spans[0].getBoundingClientRect().top - spans[1].getBoundingClientRect().top)
      };
    });
    assert.equal(desktopHero.display, "flex", "the Arabic name should be composed horizontally");
    assert.equal(desktopHero.whiteSpace, "nowrap", "the Arabic name should stay on one line");
    assert.equal(desktopHero.columnCount, 2, "the desktop Arabic hero should balance name and intro in two columns");
    assert.equal(desktopHero.gridAlignment, "start", "the one-line name should start at the top of the hero composition");
    assert.ok(desktopHero.columnWidths[0] > desktopHero.columnWidths[1],
      "the Arabic hero should retain the wider name column and narrower intro column");
    assert.ok(desktopHero.introMarginTop >= 120 && desktopHero.introMarginTop <= 165,
      "the Arabic intro should return to a noticeably lower position, not merely centered with the one-line name");
    assert.ok(desktopHero.introTopOffset >= 120,
      "the intro block should sit below the one-line headline, restoring the original editorial rhythm");
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
        introMarginTop: parseFloat(getComputedStyle(el.closest(".hero-grid").children[1]).marginTop),
        fits: el.scrollWidth <= el.clientWidth
      };
    });
    assert.equal(mobileHero.display, "flex", "the Arabic name should remain composed horizontally on mobile");
    assert.equal(mobileHero.whiteSpace, "nowrap", "the Arabic name should not wrap on mobile");
    assert.equal(mobileHero.columnCount, 1, "mobile hero content should be stacked in one column");
    assert.equal(mobileHero.introMarginTop, 0, "the extra desktop intro offset should be removed on mobile");
    assert.equal(mobileHero.fits, true, "the Arabic name should fit without horizontal overflow on mobile");
    await arabic.close();

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
