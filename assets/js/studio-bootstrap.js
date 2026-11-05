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
    const retryScript = document.createElement("script");
    retryScript.src = "/assets/js/studio-retry.js";
    await new Promise((resolve, reject) => {
      retryScript.onload = resolve;
      retryScript.onerror = () => reject(new Error("تعذر تحميل آلية إعادة المحاولة الآمنة."));
      document.body.appendChild(retryScript);
    });
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

    const manageLink = document.createElement("a");
    manageLink.href = "/studio/manage.html";
    manageLink.textContent = "إدارة المنشورات";
    manageLink.setAttribute("aria-label", "إدارة المنشورات وحذفها");
    Object.assign(manageLink.style, {
      position: "fixed", insetInlineStart: "22px", bottom: "22px", zIndex: "9999",
      display: "inline-block", padding: "12px 18px", border: "1px solid #b9aa8c",
      borderRadius: "999px", background: "#292720", color: "#f8f5ed",
      font: "600 13px/1.4 system-ui, sans-serif", textDecoration: "none",
      boxShadow: "0 8px 24px rgba(35, 31, 24, .16)"
    });
    document.body.appendChild(manageLink);
  } catch (error) {
    document.body.textContent = error && error.message ? error.message : "تعذر فتح الاستوديو.";
  }
})();