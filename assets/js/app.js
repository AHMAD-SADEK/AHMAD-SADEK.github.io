/* Client-side archive UI. Publication approval happens before archive.json is generated. */
(function () {
  "use strict";

  const DATA_URL = "/archive.json";
  const EMAIL = "ahmadsadekalbasatneh@gmail.com";
  const I18N = {
    en: {
      skip: "Skip to content", brandMark: "AS", brandName: "AHMAD SADEK",
      navHome: "Home", navAbout: "About", navArchive: "Archive", navWriting: "Writing",
      navResearch: "Research", navBooks: "Books", navProjects: "Projects", menuLabel: "Menu",
      eyebrow: "A PERSONAL ARCHIVE", firstName: "Ahmad", lastName: "Sadek.",
      heroLead: "A quiet collection of things I study, build, question, and write.",
      heroMeta: "Pharmacy Student · Researcher · Writer · Curious Mind",
      discover: "Discover the person behind the archive", identity: "Identity",
      manifesto: "A growing record of a life shaped by learning — from pharmacy and scientific research to engineering, philosophy, writing, and the questions that remain open.",
      fromArchive: "From the archive", viewArchive: "View complete archive",
      gardens: "Fields of interest", gardensNote: "Different disciplines. One mind. A growing body of work.",
      gardenScience: "SCIENCE", gardenBuilding: "ENGINEERING", gardenThought: "IDEAS", gardenPersonal: "PERSONAL",
      pharmacyMenu: "Medicine & Pharmacy", engineeringMenu: "Engineering & Technology",
      thoughtMenu: "Thought & Philosophy", personalMenu: "Personal",
      pharmacyDesc: "Research, learning, scientific notes, and work from the health sciences.",
      engineeringDesc: "Projects, experiments, systems, technology, and things made from ideas.",
      thoughtDesc: "Questions, reflections, philosophy, humanities, and attempts to understand.",
      personalDesc: "Experiences, observations, lessons, memories, and the quieter parts of the journey.",
      library: "Library", libraryHeadline: "Research, writing, books, and projects — kept in one place.",
      libraryText: "A growing archive where every piece becomes part of a larger story.",
      contact: "Contact", contactHeadline: "For ideas worth discussing.",
      contactText: "For research, collaboration, academic work, or simply a thoughtful exchange.",
      aboutLabel: "ABOUT — AHMAD SADEK", aboutTitle: "The person behind the archive.",
      aboutIntro: "A pharmacy student building a broad body of work across science, technology, thought, and writing.",
      profile: "PROFILE", aboutBody: "I am Ahmad Sadek, a student of pharmacy at Lebanese International University. Beyond one discipline, I am interested in learning deeply, building meaningful things, investigating questions, and preserving the ideas that shape my thinking.",
      aboutNote: "This archive is a work in progress. Published entries are reviewed before they appear here.",
      archiveLabel: "ARCHIVE", archiveTitle: "Everything, in one place.",
      archiveIntro: "A searchable record of writing, research, books, projects, ideas, and personal work.",
      searchLabel: "Search the archive", search: "Search the archive…",
      all: "All", writingFilter: "Writing", researchFilter: "Research", booksFilter: "Books",
      projectsFilter: "Projects", ideasFilter: "Ideas", personalFilter: "Personal",
      writingLabel: "WRITING", writingTitle: "Thoughts, in words.",
      writingIntro: "Essays, articles, observations, and things worth putting into language.",
      researchLabel: "RESEARCH", researchTitle: "Questions, investigated.",
      researchIntro: "Research, scientific work, papers, reviews, and academic inquiry.",
      booksLabel: "BOOKS", booksTitle: "Ideas, bound together.",
      booksIntro: "Books and long-form works, prepared to be read directly inside the site.",
      projectsLabel: "PROJECTS", projectsTitle: "Ideas, made real.",
      projectsIntro: "Engineering, academic, technical, and experimental work.",
      pharmacyLabel: "MEDICINE & PHARMACY", pharmacyTitle: "Science, carefully explored.",
      pharmacyPageIntro: "Research, learning, scientific notes, reviews, and academic work from the health sciences.",
      engineeringLabel: "ENGINEERING & TECHNOLOGY", engineeringTitle: "Things, made from ideas.",
      engineeringPageIntro: "Projects, experiments, systems, technology, and work that turns concepts into reality.",
      thoughtLabel: "THOUGHT & PHILOSOPHY", thoughtTitle: "Questions, kept open.",
      thoughtPageIntro: "Philosophy, humanities, reflections, ideas, and attempts to understand the world and the self.",
      personalLabel: "PERSONAL", personalTitle: "The quieter side of the journey.",
      personalPageIntro: "Experiences, observations, lessons, memories, and the human side of the archive.",
      footer: "AHMAD SADEK — PERSONAL ARCHIVE", openSource: "Open source", loading: "Loading the archive…",
      loadingArticle: "Loading the article…", empty: "Nothing has been published in this section yet.",
      noResults: "No entries match your search. Try another phrase or filter.",
      loadError: "The archive could not be loaded. Check your connection and try again.",
      retry: "Try again", countOne: "entry", countMany: "entries", back: "Back to archive",
      abstract: "Abstract", references: "References", attachments: "Attached files",
      relatedLinks: "Related links", openFile: "Open / download", articleSource: "View source on GitHub",
      readingTime: "Reading time", by: "By",
      translationFallback: "This entry is shown in its original language because a translation is not available.",
      categories: {
        pharmacy: "Medicine & Pharmacy", engineering: "Engineering & Technology",
        thought: "Thought & Philosophy", personal: "Personal", academic: "Academic", general: "General"
      },
      types: { writing: "Writing", research: "Research", book: "Book", project: "Project", idea: "Idea", personal: "Personal", other: "Entry" }
    },
    ar: {
      skip: "انتقل إلى المحتوى", brandMark: "أص", brandName: "أحمد صادق",
      navHome: "الرئيسية", navAbout: "عن أحمد", navArchive: "الأرشيف", navWriting: "الكتابات",
      navResearch: "الأبحاث", navBooks: "الكتب", navProjects: "المشاريع", menuLabel: "القائمة",
      eyebrow: "أرشيف أحمد صادق الشخصي", firstName: "أحمد", lastName: "صادق",
      heroLead: "مساحة هادئة لما أدرسه، وأبنيه، وأتساءل عنه، وأكتبه.",
      heroMeta: "طالب صيدلة · باحث · كاتب · عقل فضولي",
      discover: "اكتشف الشخص خلف الأرشيف", identity: "الهوية",
      manifesto: "سجل متنامٍ لحياة تشكلها المعرفة؛ من الصيدلة والبحث العلمي إلى الهندسة والفلسفة والكتابة، والأسئلة التي لا تزال مفتوحة.",
      fromArchive: "من الأرشيف", viewArchive: "تصفح الأرشيف الكامل",
      gardens: "مجالات الاهتمام", gardensNote: "مجالات مختلفة. عقل واحد. وأعمال تتسع مع الوقت.",
      gardenScience: "علوم", gardenBuilding: "هندسة", gardenThought: "فكر", gardenPersonal: "شخصي",
      pharmacyMenu: "الطب والصيدلة", engineeringMenu: "الهندسة والتقنية",
      thoughtMenu: "الفكر والفلسفة", personalMenu: "شخصي",
      pharmacyDesc: "أبحاث وتعلّم وملاحظات علمية وأعمال من العلوم الصحية.",
      engineeringDesc: "مشاريع وتجارب وأنظمة وتقنيات وأفكار تحولت إلى أشياء ملموسة.",
      thoughtDesc: "أسئلة وتأملات وفلسفة وعلوم إنسانية ومحاولات للفهم.",
      personalDesc: "تجارب وملاحظات ودروس وذكريات والجانب الهادئ من الرحلة.",
      library: "المكتبة", libraryHeadline: "أبحاث وكتابات وكتب ومشاريع — محفوظة في مكان واحد.",
      libraryText: "أرشيف متنامٍ تصبح فيه كل إضافة جزءًا من قصة أكبر.",
      contact: "تواصل", contactHeadline: "للأفكار التي تستحق النقاش.",
      contactText: "للبحث والتعاون والعمل الأكاديمي، أو لمجرد حوار هادئ وهادف.",
      aboutLabel: "عن أحمد صادق", aboutTitle: "الشخص خلف الأرشيف.",
      aboutIntro: "طالب صيدلة يبني عالمًا واسعًا من العمل بين العلوم والتقنية والفكر والكتابة.",
      profile: "نبذة", aboutBody: "أنا أحمد صادق، طالب صيدلة في الجامعة اللبنانية الدولية. لا أحصر فضولي في تخصص واحد؛ أهتم بالتعلّم العميق، وبناء الأشياء ذات المعنى، والبحث في الأسئلة، وحفظ الأفكار التي تشكل طريقة تفكيري.",
      aboutNote: "هذا الأرشيف في طور النمو. تُراجع المواد قبل إتاحتها للجمهور.",
      archiveLabel: "الأرشيف", archiveTitle: "كل شيء، في مكان واحد.",
      archiveIntro: "سجل قابل للبحث يضم الكتابات والأبحاث والكتب والمشاريع والأفكار والعمل الشخصي.",
      searchLabel: "ابحث في الأرشيف", search: "ابحث في الأرشيف…",
      all: "الكل", writingFilter: "الكتابات", researchFilter: "الأبحاث", booksFilter: "الكتب",
      projectsFilter: "المشاريع", ideasFilter: "الأفكار", personalFilter: "شخصي",
      writingLabel: "الكتابات", writingTitle: "أفكار في كلمات.",
      writingIntro: "مقالات ونصوص وتأملات وأشياء تستحق أن توضع في اللغة.",
      researchLabel: "الأبحاث", researchTitle: "أسئلة تحت البحث.",
      researchIntro: "أبحاث ودراسات وأوراق ومراجعات واستقصاءات أكاديمية.",
      booksLabel: "الكتب", booksTitle: "أفكار مجتمعة في كتب.",
      booksIntro: "كتب وأعمال طويلة مجهزة لتُقرأ مباشرة داخل الموقع.",
      projectsLabel: "المشاريع", projectsTitle: "أفكار تتحول إلى واقع.",
      projectsIntro: "أعمال هندسية وأكاديمية وتقنية وتجريبية.",
      pharmacyLabel: "الطب والصيدلة", pharmacyTitle: "علم بهدوء وعمق.",
      pharmacyPageIntro: "أبحاث وتعلّم وملاحظات علمية ومراجعات وأعمال أكاديمية من العلوم الصحية.",
      engineeringLabel: "الهندسة والتقنية", engineeringTitle: "أشياء تبدأ من فكرة.",
      engineeringPageIntro: "مشاريع وتجارب وأنظمة وتقنيات وأعمال تحوّل المفاهيم إلى واقع.",
      thoughtLabel: "الفكر والفلسفة", thoughtTitle: "أسئلة تبقى مفتوحة.",
      thoughtPageIntro: "فلسفة وعلوم إنسانية وتأملات وأفكار ومحاولات لفهم العالم والذات.",
      personalLabel: "المساحة الشخصية", personalTitle: "الجانب الأهدأ من الرحلة.",
      personalPageIntro: "تجارب وملاحظات ودروس وذكريات والجانب الإنساني من الأرشيف.",
      footer: "أحمد صادق — الأرشيف الشخصي", openSource: "مفتوح المصدر", loading: "يجري تحميل الأرشيف…",
      loadingArticle: "يجري تحميل المقالة…", empty: "لا توجد مواد منشورة في هذا القسم بعد.",
      noResults: "لا توجد مواد تطابق بحثك. جرّب عبارة أو تصنيفًا آخر.",
      loadError: "تعذر تحميل الأرشيف. تحقق من الاتصال ثم حاول مجددًا.",
      retry: "إعادة المحاولة", countOne: "مادة", countMany: "مواد", back: "العودة إلى الأرشيف",
      abstract: "الملخص", references: "المراجع", attachments: "الملفات المرفقة",
      relatedLinks: "روابط ذات صلة", openFile: "فتح / تنزيل", articleSource: "عرض المصدر على GitHub",
      readingTime: "وقت القراءة", by: "بقلم",
      translationFallback: "هذه المادة معروضة بلغتها الأصلية لعدم توفر ترجمة.",
      categories: {
        pharmacy: "الطب والصيدلة", engineering: "الهندسة والتقنية",
        thought: "الفكر والفلسفة", personal: "المساحة الشخصية", academic: "أكاديمي", general: "عام"
      },
      types: { writing: "كتابة", research: "بحث", book: "كتاب", project: "مشروع", idea: "فكرة", personal: "شخصي", other: "مادة" }
    }
  };

  const TYPE_FILTERS = new Set(["writing", "research", "book", "project", "idea", "personal"]);
  const CATEGORY_FILTERS = new Set(["pharmacy", "engineering", "thought"]);
  const NAV_ITEMS = [
    ["home", "navHome"], ["about", "navAbout"], ["archive", "navArchive"],
    ["writing", "navWriting"], ["research", "navResearch"], ["books", "navBooks"],
    ["projects", "navProjects"], ["pharmacy", "pharmacyMenu"],
    ["engineering", "engineeringMenu"], ["thought", "thoughtMenu"],
    ["personal", "personalMenu"], ["contact", "contact"]
  ];

  let archiveItems = [];
  let currentLanguage = "en";
  let currentFilter = "all";
  let loadFailed = false;

  function t(key) {
    const value = I18N[currentLanguage][key];
    return value === undefined ? key : value;
  }
  function safeText(element, value) {
    element.textContent = value == null ? "" : String(value);
  }
  function safeURL(value, kind) {
    return window.ArchiveMarkdown ? window.ArchiveMarkdown.safeURL(value, kind) : "";
  }
  function languageSafeRead() {
    if (/^\/ar(?:\/|$)/.test(window.location.pathname)) return "ar";
    try { return localStorage.getItem("ahmad-lang") === "ar" ? "ar" : "en"; }
    catch (_) { return "en"; }
  }
  function languageSafeWrite(value) {
    try { localStorage.setItem("ahmad-lang", value); } catch (_) { /* Storage may be unavailable. */ }
  }
  function setLanguage(language) {
    const requestedLanguage = language === "ar" ? "ar" : "en";
    const isArabicPath = /^\/ar(?:\/|$)/.test(window.location.pathname);
    if ((requestedLanguage === "ar") !== isArabicPath) {
      languageSafeWrite(requestedLanguage);
      window.location.href = (requestedLanguage === "ar" ? "/ar/" : "/") + window.location.hash;
      return;
    }
    currentLanguage = requestedLanguage;
    languageSafeWrite(currentLanguage);
    document.documentElement.lang = currentLanguage;
    document.documentElement.dir = currentLanguage === "ar" ? "rtl" : "ltr";

    document.querySelectorAll("[data-i]").forEach((element) => {
      const key = element.dataset.i;
      if (Object.prototype.hasOwnProperty.call(I18N[currentLanguage], key)) {
        safeText(element, I18N[currentLanguage][key]);
      }
    });
    document.querySelectorAll("[data-placeholder]").forEach((element) => {
      const key = element.dataset.placeholder;
      if (key === "search") {
        element.placeholder = t("search");
        element.setAttribute("aria-label", t("searchLabel"));
      }
    });
    document.querySelectorAll("[data-lang]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.lang === currentLanguage));
    });
    const menu = document.getElementById("mobileNav");
    menu.querySelectorAll("[data-i]").forEach((link) => {
      if (I18N[currentLanguage][link.dataset.i]) safeText(link, t(link.dataset.i));
    });
    renderFeatured();
    renderAllLists();
    if (location.hash.startsWith("#entry/")) renderArticle(location.hash.slice(7));
    else updateDocumentMeta(getPageForHash());
  }

  function getPageForHash() {
    const hash = location.hash.slice(1) || "home";
    if (hash.startsWith("entry/")) return "entry";
    if (hash === "contact") return "home";
    const section = document.querySelector('[data-page="' + CSS.escape(hash) + '"]');
    return section ? hash : "home";
  }

  function updateDocumentMeta(page, item) {
    const titleMap = {
      home: "homeTitle", about: "aboutTitle", archive: "archiveTitle",
      writing: "writingTitle", research: "researchTitle", books: "booksTitle",
      projects: "projectsTitle", pharmacy: "pharmacyTitle", engineering: "engineeringTitle",
      thought: "thoughtTitle", personal: "personalTitle"
    };
    const titleElement = document.getElementById(titleMap[page] || "homeTitle");
    const heading = item ? item.title : (titleElement ? titleElement.textContent : "Ahmad Sadek");
    const siteName = currentLanguage === "ar" ? "أحمد صادق" : "Ahmad Sadek";
    document.title = page === "home"
      ? (currentLanguage === "ar" ? "أحمد صادق — الأرشيف الشخصي" : "Ahmad Sadek — Personal Archive")
      : (heading || siteName) + " — " + siteName;
    const description = item
      ? (item.subtitle || item.abstract || item.title)
      : (page === "home" ? t("heroLead") : (document.querySelector('[data-page="' + CSS.escape(page) + '"] .page-intro')?.textContent || t("manifesto")));
    const desc = document.querySelector('meta[name="description"]');
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (desc) desc.setAttribute("content", description);
    if (ogTitle) ogTitle.setAttribute("content", document.title);
    if (ogDescription) ogDescription.setAttribute("content", description);
  }

  function navTargetFor(page) {
    return page === "entry" ? "archive" : page;
  }
  function renderRoute() {
    const rawHash = location.hash.slice(1) || "home";
    if (rawHash.startsWith("entry/")) {
      document.querySelectorAll("[data-page]").forEach((page) => { page.hidden = page.dataset.page !== "entry"; });
      document.querySelectorAll(".desktop-nav .nav-link, .mobile-nav .nav-link").forEach((link) => {
        if (link.hash === "#archive") link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
      closeMobileMenu();
      renderArticle(rawHash.slice(6));
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    const pageId = rawHash === "contact" ? "home" : rawHash;
    const page = document.querySelector('[data-page="' + CSS.escape(pageId) + '"]');
    const activeId = page ? pageId : "home";
    document.querySelectorAll("[data-page]").forEach((element) => { element.hidden = element.dataset.page !== activeId; });
    document.querySelectorAll(".desktop-nav .nav-link, .mobile-nav .nav-link").forEach((link) => {
      if (link.hash === "#" + navTargetFor(activeId)) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    closeMobileMenu();
    updateDocumentMeta(activeId);
    if (activeId === "archive") renderArchiveList();
    if (rawHash === "contact") {
      requestAnimationFrame(() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } else {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  function makeStatus(message, className = "") {
    const element = document.createElement("p");
    element.className = "status-message" + (className ? " " + className : "");
    safeText(element, message);
    return element;
  }
  function renderEmpty(container, message) {
    container.replaceChildren(makeStatus(message));
  }
  function typeLabel(type) { return I18N[currentLanguage].types[type] || I18N[currentLanguage].types.other; }
  function categoryLabel(category) { return I18N[currentLanguage].categories[category] || ""; }

  function primaryLanguageFor(item) {
    if (item && (item.primaryLanguage === "ar" || item.primaryLanguage === "en")) return item.primaryLanguage;
    const choice = String(item?.language || "");
    if (/arabic|العربية/i.test(choice) && !/bilingual|ثنائية اللغة/i.test(choice)) return "ar";
    if (/english/i.test(choice) && !/bilingual/i.test(choice)) return "en";
    return /[\u0600-\u06FF]/.test(item?.contentMarkdown || "") ? "ar" : "en";
  }

  function displayDate(value) {
    if (!value) return "";
    const match = String(value).match(/^\d{4}-\d{2}-\d{2}$/);
    if (!match) return String(value);
    const date = new Date(value + "T12:00:00Z");
    try {
      return new Intl.DateTimeFormat(currentLanguage === "ar" ? "ar" : "en", {
        year: "numeric", month: "short", day: "numeric", timeZone: "UTC"
      }).format(date);
    } catch (_) { return value; }
  }

  function matchesFilter(item, filter) {
    if (filter === "all") return true;
    if (CATEGORY_FILTERS.has(filter)) return item.category === filter;
    if (filter === "personal") return item.type === "personal" || item.category === "personal";
    if (TYPE_FILTERS.has(filter)) return item.type === filter;
    return item.category === filter;
  }
  function searchMatches(item, query) {
    if (!query) return true;
    const blob = [
      item.title, item.subtitle, item.abstract, item.contentMarkdown, item.referencesMarkdown,
      item.type, item.category, item.language, ...(item.tags || []), ...(item.technologies || [])
    ].join(" ").toLocaleLowerCase(currentLanguage === "ar" ? "ar" : "en");
    return blob.includes(query.toLocaleLowerCase(currentLanguage === "ar" ? "ar" : "en"));
  }

  function createEntry(item) {
    const link = document.createElement("a");
    link.className = "entry";
    link.href = "/articles/" + encodeURIComponent(String(item.id)) + "/";
    link.setAttribute("aria-label", item.title + " — " + typeLabel(item.type));

    const type = document.createElement("div");
    type.className = "entry-type";
    safeText(type, typeLabel(item.type));

    const details = document.createElement("div");
    const heading = document.createElement("h2");
    safeText(heading, item.title);
    details.appendChild(heading);
    const summary = document.createElement("p");
    safeText(summary, item.subtitle || item.abstract || "");
    details.appendChild(summary);

    const date = document.createElement("div");
    date.className = "entry-date";
    safeText(date, displayDate(item.date));

    link.append(type, details, date);
    return link;
  }

  function renderList(container, items, emptyMessage) {
    if (!container) return;
    if (!items.length) { renderEmpty(container, emptyMessage || t("empty")); return; }
    const fragment = document.createDocumentFragment();
    items.forEach((item) => fragment.appendChild(createEntry(item)));
    container.replaceChildren(fragment);
  }

  function renderArchiveList() {
    const list = document.getElementById("archiveList");
    if (!list) return;
    const query = document.getElementById("archiveSearch")?.value?.trim() || "";
    const items = archiveItems.filter((item) => matchesFilter(item, currentFilter) && searchMatches(item, query));
    renderList(list, items, query || currentFilter !== "all" ? t("noResults") : t("empty"));
    const status = document.getElementById("archiveStatus");
    if (status) safeText(status, items.length + " " + (items.length === 1 ? t("countOne") : t("countMany")));
  }

  function renderAllLists() {
    renderArchiveList();
    document.querySelectorAll("[data-list-type]").forEach((container) => {
      const filter = container.dataset.listType;
      renderList(container, archiveItems.filter((item) => matchesFilter(item, filter)));
    });
  }

  function renderFeatured() {
    const container = document.getElementById("featuredList");
    if (!container) return;
    const latest = archiveItems.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.id - a.id).slice(0, 3);
    container.classList.toggle("single", latest.length === 1);
    container.classList.toggle("double", latest.length === 2);
    if (!latest.length) {
      container.replaceChildren(makeStatus(loadFailed ? t("loadError") : t("empty"), loadFailed ? "error" : ""));
      if (loadFailed) container.appendChild(makeRetryButton());
      return;
    }
    const fragment = document.createDocumentFragment();
    latest.forEach((item) => {
      const link = document.createElement("a");
      link.className = "feature";
      link.href = "/articles/" + encodeURIComponent(String(item.id)) + "/";
      const label = document.createElement("small");
      safeText(label, typeLabel(item.type) + (categoryLabel(item.category) ? " · " + categoryLabel(item.category) : ""));
      const heading = document.createElement("h3");
      safeText(heading, item.title);
      link.append(label, heading);
      fragment.appendChild(link);
    });
    container.replaceChildren(fragment);
  }

  function makeRetryButton() {
    const button = document.createElement("button");
    button.type = "button";
    safeText(button, t("retry"));
    button.addEventListener("click", loadArchive);
    return button;
  }

  function renderMarkdownBlock(title, markdown, contentLanguage = currentLanguage) {
    if (!markdown || !window.ArchiveMarkdown) return null;
    const section = document.createElement("section");
    section.className = "article-prose";
    section.lang = currentLanguage;
    section.dir = currentLanguage === "ar" ? "rtl" : "ltr";
    if (title) {
      const heading = document.createElement("h2");
      safeText(heading, title);
      section.appendChild(heading);
    }
    const content = document.createElement("div");
    content.lang = contentLanguage;
    content.dir = contentLanguage === "ar" ? "rtl" : "ltr";
    // The renderer escapes source HTML and emits only a small allowlisted set of elements.
    content.innerHTML = window.ArchiveMarkdown.render(markdown);
    section.appendChild(content);
    return section;
  }

  function addMeta(parent, label, value) {
    if (!value) return;
    const span = document.createElement("span");
    safeText(span, label ? label + ": " + value : value);
    parent.appendChild(span);
  }

  function renderAttachments(host, item) {
    const attachments = Array.isArray(item.attachments) ? item.attachments : [];
    const links = Array.isArray(item.links) ? item.links : [];
    const safeAttachments = attachments.map((attachment) => ({
      label: String(attachment.label || t("openFile")),
      url: safeURL(attachment.url, "link")
    })).filter((attachment) => attachment.url);
    const safeLinks = links.map((link) => ({
      label: String(link.label || t("openFile")),
      url: safeURL(link.url, "link")
    })).filter((link) => link.url);

    if (safeAttachments.length) {
      const section = document.createElement("section");
      section.className = "article-prose";
      const heading = document.createElement("h2");
      safeText(heading, t("attachments"));
      section.appendChild(heading);
      safeAttachments.forEach((attachment) => {
        const isPDF = /\.pdf(?:$|[?#])/i.test(attachment.url) || /\.pdf$/i.test(attachment.label);
        if (isPDF) {
          const details = document.createElement("details");
          details.className = "pdf-attachment";
          const summary = document.createElement("summary");
          safeText(summary, attachment.label + " — " + t("openFile"));
          details.appendChild(summary);
          const pdf = document.createElement("object");
          pdf.data = attachment.url;
          pdf.type = "application/pdf";
          pdf.setAttribute("aria-label", attachment.label);
          const fallback = document.createElement("p");
          safeText(fallback, currentLanguage === "ar" ? "تعذرت معاينة الملف في هذا المتصفح." : "This browser could not preview the PDF.");
          const fallbackLink = document.createElement("a");
          fallbackLink.href = attachment.url;
          fallbackLink.target = "_blank";
          fallbackLink.rel = "noopener noreferrer";
          safeText(fallbackLink, t("openFile"));
          fallback.appendChild(document.createTextNode(" "));
          fallback.appendChild(fallbackLink);
          pdf.appendChild(fallback);
          details.appendChild(pdf);
          const link = document.createElement("a");
          link.className = "attachment-link";
          link.href = attachment.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          safeText(link, t("openFile") + " ↗");
          details.appendChild(link);
          section.appendChild(details);
        } else {
          const link = document.createElement("p");
          const anchor = document.createElement("a");
          anchor.href = attachment.url;
          anchor.target = "_blank";
          anchor.rel = "noopener noreferrer";
          anchor.textContent = attachment.label + " ↗";
          link.appendChild(anchor);
          section.appendChild(link);
        }
      });
      host.appendChild(section);
    }

    if (safeLinks.length) {
      const section = document.createElement("section");
      section.className = "article-prose";
      const heading = document.createElement("h2");
      safeText(heading, t("relatedLinks"));
      section.appendChild(heading);
      const list = document.createElement("ul");
      safeLinks.forEach((itemLink) => {
        const li = document.createElement("li");
        const anchor = document.createElement("a");
        anchor.href = itemLink.url;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        safeText(anchor, itemLink.label);
        li.appendChild(anchor);
        list.appendChild(li);
      });
      section.appendChild(list);
      host.appendChild(section);
    }
  }

  function renderArticle(rawId) {
    const host = document.getElementById("articleHost");
    if (!host) return;
    const idText = String(rawId ?? "");
    const id = /^[1-9]\d*$/.test(idText) ? Number(idText) : NaN;
    const item = Number.isSafeInteger(id)
      ? archiveItems.find((entry) => entry.id === id)
      : undefined;
    if (!item) {
      host.replaceChildren(makeStatus(loadFailed ? t("loadError") : t("empty"), loadFailed ? "error" : ""));
      if (loadFailed) host.appendChild(makeRetryButton());
      updateDocumentMeta("entry");
      return;
    }

    host.replaceChildren();
    const back = document.createElement("a");
    back.className = "article-back";
    back.href = "#archive";
    safeText(back, "← " + t("back"));
    host.appendChild(back);

    const type = document.createElement("div");
    type.className = "article-type";
    safeText(type, typeLabel(item.type) + (categoryLabel(item.category) ? " · " + categoryLabel(item.category) : ""));
    host.appendChild(type);

    const articlePrimaryLanguage = primaryLanguageFor(item);
    const heading = document.createElement("h1");
    heading.id = "articleTitle";
    heading.lang = articlePrimaryLanguage;
    heading.dir = articlePrimaryLanguage;
    safeText(heading, item.title);
    host.setAttribute("aria-labelledby", "articleTitle");
    host.appendChild(heading);

    if (item.subtitle) {
      const subtitle = document.createElement("p");
      subtitle.className = "article-subtitle";
      subtitle.lang = articlePrimaryLanguage;
      subtitle.dir = articlePrimaryLanguage;
      safeText(subtitle, item.subtitle);
      host.appendChild(subtitle);
    }

    const meta = document.createElement("div");
    meta.className = "article-meta";
    addMeta(meta, t("by"), item.author);
    addMeta(meta, "", displayDate(item.date));
    addMeta(meta, t("readingTime"), item.readingTime);
    if (Array.isArray(item.tags) && item.tags.length) addMeta(meta, "", item.tags.join(" · "));
    host.appendChild(meta);

    const coverURL = safeURL(item.coverImage, "image");
    if (coverURL) {
      const cover = document.createElement("img");
      cover.className = "article-cover";
      cover.src = coverURL;
      cover.alt = item.title;
      cover.loading = "lazy";
      cover.decoding = "async";
      host.appendChild(cover);
    }

    const primaryLanguage = articlePrimaryLanguage;
    const hasTranslation = Boolean(String(item.secondLanguage || "").trim());
    const showingTranslation = hasTranslation && currentLanguage !== primaryLanguage;
    const body = showingTranslation ? item.secondLanguage : item.contentMarkdown;
    if (!hasTranslation && currentLanguage !== primaryLanguage) {
      const note = document.createElement("p");
      note.className = "small-meta";
      note.dir = "auto";
      safeText(note, t("translationFallback"));
      host.appendChild(note);
    }
    const abstractBlock = showingTranslation ? null : renderMarkdownBlock(t("abstract"), item.abstract, primaryLanguage);
    if (abstractBlock) host.appendChild(abstractBlock);
    const bodyBlock = renderMarkdownBlock("", body, showingTranslation ? currentLanguage : primaryLanguage);
    if (bodyBlock) host.appendChild(bodyBlock);
    const refsBlock = renderMarkdownBlock(t("references"), item.referencesMarkdown, primaryLanguage);
    if (refsBlock) host.appendChild(refsBlock);

    renderAttachments(host, item);
    if (item.sourceUrl && safeURL(item.sourceUrl, "link")) {
      const source = document.createElement("p");
      source.className = "article-source";
      const link = document.createElement("a");
      link.className = "text-link";
      link.href = safeURL(item.sourceUrl, "link");
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      safeText(link, t("articleSource") + " ↗");
      source.appendChild(link);
      host.appendChild(source);
    }
    updateDocumentMeta("entry", item);
  }

  async function loadArchive() {
    loadFailed = false;
    const lists = [document.getElementById("archiveList"), document.getElementById("featuredList")];
    lists.forEach((container) => { if (container) renderEmpty(container, t("loading")); });
    try {
      const response = await fetch(DATA_URL, { cache: "no-cache", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Archive request failed: " + response.status);
      const data = await response.json();
      if (!data || !Array.isArray(data.items)) throw new Error("Archive has an invalid format.");
      archiveItems = data.items.filter((item) =>
        item && Number.isInteger(Number(item.id)) && String(item.title || "").trim() &&
        ["writing", "research", "book", "project", "idea", "personal"].includes(item.type)
      ).map((item) => ({ ...item, id: Number(item.id) }));
      loadFailed = false;
      renderFeatured();
      renderAllLists();
      if (location.hash.startsWith("#entry/")) renderArticle(location.hash.slice(7));
    } catch (error) {
      loadFailed = true;
      console.error("Archive loading failed.", error);
      renderFeatured();
      renderAllLists();
      const archiveList = document.getElementById("archiveList");
      if (archiveList) {
        archiveList.replaceChildren(makeStatus(t("loadError"), "error"));
        archiveList.appendChild(makeRetryButton());
      }
      document.querySelectorAll("[data-list-type]").forEach((container) => {
        container.replaceChildren(makeStatus(t("loadError"), "error"));
        container.appendChild(makeRetryButton());
      });
      if (location.hash.startsWith("#entry/")) renderArticle(location.hash.slice(7));
    }
  }

  function closeMobileMenu() {
    const button = document.getElementById("menuButton");
    const menu = document.getElementById("mobileNav");
    if (!button || !menu) return;
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
    button.textContent = t("menuLabel");
  }

  function buildMobileMenu() {
    const menu = document.getElementById("mobileNav");
    NAV_ITEMS.forEach(([id, key]) => {
      const link = document.createElement("a");
      link.className = "nav-link";
      link.href = "#" + id;
      link.dataset.i = key;
      safeText(link, t(key));
      menu.appendChild(link);
    });
  }

  function init() {
    document.getElementById("year").textContent = String(new Date().getFullYear());
    buildMobileMenu();
    setLanguage(languageSafeRead());

    document.querySelectorAll("[data-lang]").forEach((button) => {
      button.addEventListener("click", () => setLanguage(button.dataset.lang));
    });
    document.querySelectorAll(".filters").forEach((filterBar) => {
      filterBar.addEventListener("click", (event) => {
        const button = event.target.closest("[data-filter]");
        if (!button) return;
        currentFilter = button.dataset.filter || "all";
        filterBar.querySelectorAll("[data-filter]").forEach((candidate) => {
          candidate.setAttribute("aria-pressed", String(candidate === button));
        });
        renderArchiveList();
      });
    });
    document.getElementById("archiveSearch")?.addEventListener("input", renderArchiveList);

    const menuButton = document.getElementById("menuButton");
    const menu = document.getElementById("mobileNav");
    menuButton.addEventListener("click", () => {
      const open = menu.hidden;
      menu.hidden = !open;
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.textContent = open ? (currentLanguage === "ar" ? "إغلاق" : "Close") : t("menuLabel");
    });
    menu.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeMobileMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !menu.hidden) {
        closeMobileMenu();
        menuButton.focus();
      }
    });
    document.addEventListener("click", (event) => {
      if (!menu.hidden && !menu.contains(event.target) && !menuButton.contains(event.target)) closeMobileMenu();
    });
    window.addEventListener("hashchange", renderRoute);
    renderRoute();
    loadArchive();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();