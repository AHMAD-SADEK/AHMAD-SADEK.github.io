(async function () {
  "use strict";
  try {
    if (!("DecompressionStream" in window)) throw new Error("يرجى استخدام متصفح حديث يدعم فك ضغط الملفات.");
    const response = await fetch("/studio/studio-page.gz", { cache: "no-store" });
    if (!response.ok) throw new Error("تعذر تحميل واجهة الاستوديو.");
    const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
    const html = await new Response(stream).text();
    document.open();
    document.write(html);
    document.close();
  } catch (error) {
    document.body.textContent = error && error.message ? error.message : "تعذر فتح الاستوديو.";
  }
})();