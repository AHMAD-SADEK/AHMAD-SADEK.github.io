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
      const grid = el.closest(".hero-grid");
      const gridStyle = getComputedStyle(grid);
      const hero = el.closest(".hero");
      const heroRect = hero.getBoundingClientRect();
      const spans = [...el.querySelectorAll("span")];
      const firstRect = spans[0].getBoundingClientRect();
      const lastRect = spans[1].getBoundingClientRect();
      const intro = grid.children[1];
      const introStyle = getComputedStyle(intro);
      const introRect = intro.getBoundingClientRect();
      const leadRect = intro.querySelector(".hero-lead").getBoundingClientRect();
      const nameLeft = Math.min(firstRect.left, lastRect.left);
      const transformX = new DOMMatrix(introStyle.transform).m41;
      return {
        display: titleStyle.display,
        flexDirection: titleStyle.flexDirection,
        fontFamily: titleStyle.fontFamily,
        whiteSpace: titleStyle.whiteSpace,
        columnWidths: (gridStyle.gridTemplateColumns.match(/[0-9.]+px/g) || []).map((value) => parseFloat(value)),
        columnCount: (gridStyle.gridTemplateColumns.match(/[0-9.]+px/g) || []).length,
        introMarginTop: parseFloat(introStyle.marginTop),
        introTopOffset: introRect.top - el.getBoundingClientRect().top,
        introTransformX: transformX,
        textGap: nameLeft - leadRect.right,
        titleHeight: el.getBoundingClientRect().height,
        verticalOverlap: firstRect.bottom - lastRect.top,
        heroPaddingTop: parseFloat(getComputedStyle(hero).paddingTop),
        heroBottomGap: heroRect.bottom - Math.max(firstRect.bottom, lastRect.bottom)
      };
    });
    assert.equal(desktopHero.display, "flex", "the Arabic name should use a designed flex composition");
    assert.equal(desktopHero.flexDirection, "column", "the name should form a compact vertical signature");
    assert.match(desktopHero.fontFamily, /Aref Ruqaa/, "the Arabic name should use its dedicated display typeface");
    assert.equal(desktopHero.whiteSpace, "nowrap", "each Arabic name word should stay unbroken");
    assert.equal(desktopHero.columnCount, 2, "the desktop Arabic hero should retain a two-column composition");
    assert.ok(desktopHero.columnWidths[0] < desktopHero.columnWidths[1],
      "the intro side should have the wider track to reduce the central void");
    assert.ok(desktopHero.introMarginTop >= 58 && desktopHero.introMarginTop <= 72,
      "the intro should sit lower, level with the lower word, without a huge vertical jump");
    assert.ok(desktopHero.introTopOffset >= 58 && desktopHero.introTopOffset <= 74,
      "the visible intro offset should match the compact editorial placement");
    assert.ok(desktopHero.introTransformX >= 65 && desktopHero.introTransformX <= 72,
      "the intro should move toward the headline to close the horizontal gap");
    assert.ok(desktopHero.textGap >= 30 && desktopHero.textGap <= 260,
      "the space between the headline and intro should be controlled");
    assert.ok(desktopHero.titleHeight >= 140 && desktopHero.titleHeight <= 205,
      "the stacked signature should have enough height to balance the hero");
    assert.ok(desktopHero.verticalOverlap >= 7 && desktopHero.verticalOverlap <= 28,
      "the two words should overlap vertically in a measured, legible way");
    assert.equal(desktopHero.heroPaddingTop, 88, "the Arabic hero should have restrained top padding");
    assert.ok(desktopHero.heroBottomGap <= 190,
      "the empty area beneath the name should be smaller than the prior composition");

    await arabic.setViewportSize({ width: 375, height: 812 });
    const mobileHero = await arabic.locator("#homeTitle").evaluate((el) => {
      const titleStyle = getComputedStyle(el);
      const grid = el.closest(".hero-grid");
      const gridStyle = getComputedStyle(grid);
      const introStyle = getComputedStyle(grid.children[1]);
      const spans = [...el.querySelectorAll("span")];
      return {
        display: titleStyle.display,
        flexDirection: titleStyle.flexDirection,
        fontFamily: titleStyle.fontFamily,
        whiteSpace: titleStyle.whiteSpace,
        columnCount: (gridStyle.gridTemplateColumns.match(/[0-9.]+px/g) || []).length,
        introMarginTop: parseFloat(introStyle.marginTop),
        introTransform: introStyle.transform,
        verticalOverlap: spans[0].getBoundingClientRect().bottom - spans[1].getBoundingClientRect().top,
        fits: el.scrollWidth <= el.clientWidth
      };
    });
    assert.equal(mobileHero.display, "flex", "the Arabic name should use the designed signature on mobile");
    assert.equal(mobileHero.flexDirection, "column", "the signature should remain vertically composed on mobile");
    assert.match(mobileHero.fontFamily, /Aref Ruqaa/, "the display typeface should remain active on mobile");
    assert.equal(mobileHero.whiteSpace, "nowrap", "each word should remain unbroken on mobile");
    assert.equal(mobileHero.columnCount, 1, "mobile hero content should be stacked in one column");
    assert.equal(mobileHero.introMarginTop, 0, "the extra desktop intro offset should be removed on mobile");
    assert.equal(mobileHero.introTransform, "none", "the horizontal desktop shift should be removed on mobile");
    assert.ok(mobileHero.verticalOverlap >= 5 && mobileHero.verticalOverlap <= 26,
      "the overlap should remain compact on mobile");
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
