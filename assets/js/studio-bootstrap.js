(async function () {
  "use strict";
  try {
    if (!("DecompressionStream" in window)) throw new Error("يرجى استخدام متصفح حديث يدعم فك ضغط الملفات.");
    const response = await fetch("/studio/studio-page.gz", { cache: "no-store" });
    if (!response.ok) throw new Error("تعذر تحميل واجهة الاستوديو.");
    const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
    const html = await new Response(stream).text();
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const scripts = Array.from(parsed.querySelectorAll("script")).map((script) => ({
      src: script.getAttribute("src"),
      type: script.getAttribute("type"),
      text: script.textContent || ""
    }));
    parsed.querySelectorAll("script").forEach((script) => script.remove());
    document.replaceChild(parsed.documentElement, document.documentElement);
    for (const spec of scripts) {
      const script = document.createElement("script");
      if (spec.type) script.type = spec.type;
      if (spec.src) {
        script.src = spec.src;
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = () => reject(new Error("تعذر تحميل أحد مكونات الاستوديو."));
          document.body.appendChild(script);
        });
      } else {
        script.textContent = spec.text;
        document.body.appendChild(script);
      }
    }
  } catch (error) {
    document.body.textContent = error && error.message ? error.message : "تعذر فتح الاستوديو.";
  }
})();