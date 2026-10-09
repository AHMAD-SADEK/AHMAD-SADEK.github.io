/* Standalone article-page controller. Data is built from owner-approved archive entries. */
(function () {
  "use strict";

  const dataNode = document.getElementById("articleData");
  if (!dataNode || !window.ArchiveMarkdown) return;

  let item;
  try {
    item = JSON.parse(dataNode.textContent || "{}");
  } catch (error) {
    console.error("Article data could not be read.", error);
    const target = document.getElementById("articleContent");
    if (target) target.textContent = "This article could not be displayed.";
    return;
  }
  if (!item || !Number.isSafeInteger(Number(item.id)) || !String(item.title || "").trim()) return;

  const labels = {
    en: {
      brand: "AHMAD SADEK", archive: "Archive", about: "About", back: "← Back to archive",
      abstract: "Abstract", references: "References", attachments: "Attached files",
      links: "Related links", open: "Open / download", source: "View source on GitHub",
      by: "By", readingTime: "Reading time", translationFallback: "This entry is shown in its original language because a translation is not available.",
      types: { writing: "Writing", research: "Research", book: "Book", project: "Project", idea: "Idea", personal: "Personal" },
      categories: { pharmacy: "Medicine & Pharmacy", engineering: "Engineering & Technology", thought: "Thought & Philosophy", personal: "Personal", academic: "Academic", general: "General" }
    },
    ar: {
      brand: "أحمد صادق", archive: "الأرشيف", about: "عن أحمد", back: "العودة إلى الأرشيف ←",
      abstract: "الملخص", references: "المراجع", attachments: "الملفات المرفقة",
      links: "روابط ذات صلة", open: "فتح / تنزيل", source: "عرض المصدر على GitHub",
      by: "بقلم", readingTime: "وقت القراءة", translationFallback: "هذه المادة معروضة بلغتها الأصلية لعدم توفر ترجمة.",
      types: { writing: "كتابة", research: "بحث", book: "كتاب", project: "مشروع", idea: "فكرة", personal: "شخصي" },
      categories: { pharmacy: "الطب والصيدلة", engineering: "الهندسة والتقنية", thought: "الفكر والفلسفة", personal: "المساحة الشخصية", academic: "أكاديمي", general: "عام" }
    }
  };

  const primaryLanguage = item.primaryLanguage === "ar" || item.primaryLanguage === "en"
    ? item.primaryLanguage
    : (/[٠-٩\u0600-\u06FF]/.test(item.contentMarkdown || "") ? "ar" : "en");
  const translationAvailable = Boolean(String(item.secondLanguage || "").trim());
  let language = readLanguage();
  const byId = (id) => document.getElementById(id);
  const safeText = (node, value) => { if (node) node.textContent = value == null ? "" : String(value); };
  const safeURL = (value, kind) => window.ArchiveMarkdown.safeURL(value, kind);

  function readLanguage() {
    try {
      const saved = localStorage.getItem("ahmad-lang");
      return saved === "ar" || saved === "en" ? saved : primaryLanguage;
    } catch (_) {
      return primaryLanguage;
    }
  }

  function writeLanguage(value) {
    try { localStorage.setItem("ahmad-lang", value); } catch (_) {}
  }

  function formatDate(value) {
    if (!value) return "";
    try {
      return new Intl.DateTimeFormat(language === "ar" ? "ar" : "en", {
        year: "numeric", month: "short", day: "numeric", timeZone: "UTC"
      }).format(new Date(String(value).slice(0, 10) + "T12:00:00Z"));
    } catch (_) { return String(value); }
  }

  function typeAndCategory() {
    const t = labels[language];
    const type = t.types[item.type] || (language === "ar" ? "مادة" : "Entry");
    const category = t.categories[item.category] || "";
    safeText(byId("articleType"), type + (category ? " · " + category : ""));
  }

  function renderMarkdown(targetId, source, contentLanguage) {
    const target = byId(targetId);
    if (!target) return;
    target.lang = contentLanguage;
    target.dir = contentLanguage === "ar" ? "rtl" : "ltr";
    target.innerHTML = window.ArchiveMarkdown.render(source || "");
  }

  function addMeta(label, value) {
    if (!value) return;
    const span = document.createElement("span");
    safeText(span, label ? label + ": " + value : value);
    byId("articleMeta").appendChild(span);
  }

  function addOutboundLink(container, url, title) {
    const valid = safeURL(url, "link");
    if (!valid) return null;
    const link = document.createElement("a");
    link.href = valid;
    if (/^https?:\/\//i.test(valid)) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    safeText(link, title);
    container.appendChild(link);
    return link;
  }

  function renderAttachments() {
    const attachmentItems = Array.isArray(item.attachments) ? item.attachments : [];
    const linkItems = Array.isArray(item.links) ? item.links : [];
    const attachmentHost = byId("attachmentsContent");
    const linkHost = byId("linksContent");
    let attachmentCount = 0;
    let linkCount = 0;

    attachmentItems.forEach((attachment) => {
      const url = safeURL(attachment && attachment.url, "link");
      if (!url) return;
      attachmentCount += 1;
      const label = String(attachment.label || labels[language].open);
      const paragraph = document.createElement("p");
      const isPDF = /\.pdf(?:$|[?#])/i.test(url) || /\.pdf$/i.test(label);
      if (isPDF) {
        const details = document.createElement("details");
        details.className = "pdf-attachment";
        const summary = document.createElement("summary");
        safeText(summary, label + " — " + labels[language].open);
        details.appendChild(summary);
        const object = document.createElement("object");
        object.type = "application/pdf";
        object.data = url;
        object.setAttribute("aria-label", label);
        const fallback = document.createElement("p");
        safeText(fallback, language === "ar" ? "تعذرت معاينة الملف في هذا المتصفح. " : "This browser could not preview the PDF. ");
        addOutboundLink(fallback, url, labels[language].open);
        object.appendChild(fallback);
        details.appendChild(object);
        const extraLink = document.createElement("p");
        addOutboundLink(extraLink, url, labels[language].open + " ↗");
        details.appendChild(extraLink);
        attachmentHost.appendChild(details);
      } else {
        addOutboundLink(paragraph, url, label + " ↗");
        attachmentHost.appendChild(paragraph);
      }
    });

    linkItems.forEach((linkItem) => {
      const url = safeURL(linkItem && linkItem.url, "link");
      if (!url) return;
      linkCount += 1;
      const paragraph = document.createElement("p");
      addOutboundLink(paragraph, url, String(linkItem.label || labels[language].open));
      linkHost.appendChild(paragraph);
    });

    byId("articleAttachments").hidden = attachmentCount === 0;
    byId("articleLinks").hidden = linkCount === 0;
  }

  function render() {
    const t = labels[language];
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.title = String(item.title) + " — Ahmad Sadek";
    document.querySelectorAll("[data-ui]").forEach((node) => {
      const key = node.dataset.ui;
      if (Object.prototype.hasOwnProperty.call(t, key)) safeText(node, t[key]);
    });
    document.querySelectorAll("[data-lang]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.lang === language));
    });
    safeText(byId("abstractLabel"), t.abstract);
    safeText(byId("referencesLabel"), t.references);
    safeText(byId("attachmentsLabel"), t.attachments);
    safeText(byId("linksLabel"), t.links);
    safeText(byId("articleSource"), "");

    typeAndCategory();
    byId("articleMeta").replaceChildren();
    addMeta(t.by, item.author);
    addMeta("", formatDate(item.date));
    addMeta(t.readingTime, item.readingTime);
    if (Array.isArray(item.tags) && item.tags.length) addMeta("", item.tags.join(" · "));

    const coverURL = safeURL(item.coverImage, "image");
    if (coverURL) {
      byId("articleCover").src = coverURL;
      byId("articleCover").hidden = false;
    } else {
      byId("articleCover").hidden = true;
    }

    const showingTranslation = translationAvailable && language !== primaryLanguage;
    const body = showingTranslation ? item.secondLanguage : item.contentMarkdown;
    const abstractSection = byId("articleAbstract");
    if (item.abstract && !showingTranslation) {
      renderMarkdown("abstractContent", item.abstract, primaryLanguage);
      abstractSection.hidden = false;
    } else {
      abstractSection.hidden = true;
    }

    if (!translationAvailable && language !== primaryLanguage) {
      const note = document.createElement("p");
      note.className = "small-meta";
      note.dir = "auto";
      safeText(note, t.translationFallback);
      byId("articleContent").replaceChildren(note);
      const bodyHtml = document.createElement("div");
      bodyHtml.lang = primaryLanguage;
      bodyHtml.dir = primaryLanguage === "ar" ? "rtl" : "ltr";
      bodyHtml.innerHTML = window.ArchiveMarkdown.render(body || "");
      byId("articleContent").appendChild(bodyHtml);
    } else {
      renderMarkdown("articleContent", body, showingTranslation ? language : primaryLanguage);
    }

    if (item.referencesMarkdown) {
      renderMarkdown("referencesContent", item.referencesMarkdown, primaryLanguage);
      byId("articleReferences").hidden = false;
    } else {
      byId("articleReferences").hidden = true;
    }
  }

  function init() {
    const sourceUrl = safeURL(item.sourceUrl, "link");
    if (sourceUrl) addOutboundLink(byId("articleSource"), sourceUrl, labels[language].source + " ↗");
    renderAttachments();
    render();
    document.querySelectorAll("[data-lang]").forEach((button) => {
      button.addEventListener("click", () => {
        language = button.dataset.lang === "ar" ? "ar" : "en";
        writeLanguage(language);
        render();
      });
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();