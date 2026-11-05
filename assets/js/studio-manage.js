(function () {
  "use strict";
  const REPO = "AHMAD-SADEK/AHMAD-SADEK.github.io";
  const API = "https://api.github.com/repos/" + REPO;
  const TYPES = new Set(["writing", "research", "book", "project", "idea", "personal"]);
  const state = { token: "", items: [] };
  const byId = (id) => document.getElementById(id);

  function status(message, kind) {
    const node = byId("manageStatus");
    node.textContent = message;
    node.className = "manage-status" + (kind ? " " + kind : "");
  }
  function makeHeaders(extra) {
    const result = new Headers(extra || {});
    result.set("Accept", "application/vnd.github+json");
    result.set("X-GitHub-Api-Version", "2022-11-28");
    if (state.token) result.set("Authorization", "Bearer " + state.token);
    return result;
  }
  async function api(path, options) {
    const init = Object.assign({}, options || {});
    init.headers = makeHeaders(init.headers);
    const response = await fetch(API + path, init);
    let payload = {};
    try { payload = await response.json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(payload.message || ("GitHub returned HTTP " + response.status));
      error.status = response.status;
      throw error;
    }
    return payload;
  }
  function folderFor(item) {
    try {
      const url = new URL(item.sourceUrl);
      const marker = "/tree/main/";
      const index = url.pathname.indexOf(marker);
      if (index < 0) return null;
      const folder = decodeURIComponent(url.pathname.slice(index + marker.length));
      const parts = folder.split("/");
      if (parts.length !== 3 || parts[0] !== "content" || !TYPES.has(parts[1]) ||
          !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parts[2])) return null;
      return folder;
    } catch (_) { return null; }
  }
  function render() {
    const host = byId("publishedPosts");
    host.replaceChildren();
    byId("postCount").textContent = state.items.length + " منشور";
    if (!state.items.length) {
      const empty = document.createElement("p");
      empty.className = "empty-posts";
      empty.textContent = "لا توجد منشورات منشورة حالياً.";
      host.appendChild(empty);
      return;
    }
    state.items.forEach((item) => {
      const row = document.createElement("article");
      row.className = "post-row";
      const details = document.createElement("div");
      const title = document.createElement("h3");
      title.className = "post-title";
      title.textContent = item.title || "منشور بلا عنوان";
      const meta = document.createElement("div");
      meta.className = "post-meta";
      meta.textContent = [item.type, item.category, item.date].filter(Boolean).join(" · ");
      details.append(title, meta);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "delete-post";
      button.textContent = "حذف نهائي";
      button.disabled = !folderFor(item);
      button.title = button.disabled ? "لا يتوفر مسار ملفي لهذا المنشور" : "حذف المنشور وملفاته المصدرية نهائياً";
      button.addEventListener("click", () => removePost(item, button));
      row.append(details, button);
      host.appendChild(row);
    });
  }
  async function loadPosts() {
    const response = await fetch("/archive.json?refresh=" + Date.now(), { cache: "no-store" });
    if (!response.ok) throw new Error("تعذر تحميل الأرشيف المنشور.");
    const archive = await response.json();
    state.items = Array.isArray(archive.items) ? archive.items : [];
    render();
  }
  async function verifyToken() {
    const candidate = byId("githubToken").value.trim();
    if (!candidate) { status("أدخل رمز الوصول أولاً.", "error"); return; }
    state.token = candidate;
    byId("connect").disabled = true;
    try {
      await api("/contents/archive.json?ref=main");
      status("تم التحقق من الرمز. يمكنك الآن حذف المنشورات.", "success");
    } catch (error) {
      state.token = "";
      status("تعذر التحقق من الرمز أو أنه لا يملك صلاحية Contents: " + error.message, "error");
    } finally { byId("connect").disabled = false; }
  }
  async function deleteFolder(folder, title) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const ref = await api("/git/ref/heads/main");
        const headSha = ref && ref.object && ref.object.sha;
        if (!headSha) throw new Error("تعذر قراءة رأس الفرع main.");
        const parent = await api("/git/commits/" + encodeURIComponent(headSha));
        const tree = await api("/git/trees/" + encodeURIComponent(parent.tree.sha) + "?recursive=1");
        if (tree.truncated) throw new Error("شجرة الملفات أكبر من حد GitHub الآمن؛ لم يُنفّذ الحذف.");
        const prefix = folder + "/";
        const files = (tree.tree || []).filter((entry) =>
          entry.type === "blob" && (entry.path === folder || entry.path.startsWith(prefix))
        );
        const metadataExists = files.some((entry) => entry.path === folder + "/metadata.json");
        const manuscriptExists = files.some((entry) => entry.path === folder + "/content.md");
        if (!metadataExists || !manuscriptExists) {
          throw new Error("لم يتم العثور على ملفات metadata.json وcontent.md المتوقعة؛ أُلغي الحذف للحماية.");
        }
        const newTree = await api("/git/trees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base_tree: parent.tree.sha,
            tree: files.map((entry) => ({
              path: entry.path, mode: entry.mode || "100644", type: "blob", sha: null
            }))
          })
        });
        const commit = await api("/git/commits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "content: permanently delete " + String(title || folder).slice(0, 120),
            tree: newTree.sha,
            parents: [headSha]
          })
        });
        await api("/git/refs/heads/main", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sha: commit.sha, force: false })
        });
        return;
      } catch (error) {
        const retryable = error.status === 409 || error.status === 422 ||
          /fast.forward|reference update failed/i.test(error.message || "");
        if (!retryable || attempt === 2) throw error;
      }
    }
  }
  async function removePost(item, button) {
    const folder = folderFor(item);
    if (!folder) { status("لا يمكن حذف هذا العنصر لأن مساره ليس ضمن مجلد منشورات content/.", "error"); return; }
    if (!state.token) {
      status("تحقق من رمز الوصول قبل تنفيذ الحذف.", "error");
      byId("githubToken").focus();
      return;
    }
    const confirmed = window.confirm(
      "هل تريد حذف المنشور «" + item.title + "» نهائياً؟\n\nسيُحذف مجلد المنشور وملفاته المصدرية من المستودع. لا يمكن التراجع عن هذا الإجراء من الاستوديو."
    );
    if (!confirmed) return;
    button.disabled = true;
    button.textContent = "جارٍ الحذف…";
    try {
      await deleteFolder(folder, item.title);
      state.items = state.items.filter((candidate) => Number(candidate.id) !== Number(item.id));
      render();
      status("حُذفت ملفات المنشور من المستودع. سيُعاد بناء الأرشيف وخريطة الموقع تلقائياً.", "success");
    } catch (error) {
      button.disabled = false;
      button.textContent = "حذف نهائي";
      status("لم يكتمل الحذف: " + error.message, "error");
    }
  }
  byId("connect").addEventListener("click", verifyToken);
  byId("githubToken").addEventListener("keydown", (event) => {
    if (event.key === "Enter") verifyToken();
  });
  loadPosts().catch((error) => {
    byId("publishedPosts").textContent = error.message;
    status("تعذر تحميل المنشورات.", "error");
  });
})();