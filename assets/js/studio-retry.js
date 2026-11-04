(function () {
  "use strict";
  if (window.__archiveStudioRetryInstalled) return;
  window.__archiveStudioRetryInstalled = true;
  const nativeFetch = window.fetch.bind(window);
  const apiRoot = "https://api.github.com/repos/AHMAD-SADEK/AHMAD-SADEK.github.io";
  let lastTreeChanges = null;
  let lastCommitMessage = null;

  function requestInfo(input, init) {
    const url = typeof input === "string" ? input : input.url;
    const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
    return { url: new URL(url, window.location.href), method };
  }

  function readJsonBody(init) {
    if (!init || typeof init.body !== "string") return null;
    try { return JSON.parse(init.body); } catch (_) { return null; }
  }

  function headersFor(init) {
    const headers = new Headers(init && init.headers ? init.headers : {});
    headers.set("Accept", "application/vnd.github+json");
    headers.set("X-GitHub-Api-Version", "2022-11-28");
    headers.set("Content-Type", "application/json");
    return headers;
  }

  async function apiRequest(path, method, body, headers) {
    const response = await nativeFetch(apiRoot + path, {
      method: method,
      headers: headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    let data = {};
    try { data = await response.clone().json(); } catch (_) {}
    if (!response.ok) {
      const error = new Error(data.message || ("GitHub returned HTTP " + response.status));
      error.status = response.status;
      error.response = response;
      throw error;
    }
    return data;
  }

  async function rebaseAndRetry(originalUrl, originalInit, headers) {
    if (!Array.isArray(lastTreeChanges) || !lastTreeChanges.length || !lastCommitMessage) return null;
    let lastResponse = null;
    for (let attempt = 1; attempt <= 6; attempt += 1) {
      try {
        const ref = await apiRequest("/git/ref/heads/main", "GET", undefined, headers);
        const headSha = ref && ref.object && ref.object.sha;
        if (!headSha) throw new Error("Could not read the latest main branch.");
        const parent = await apiRequest("/git/commits/" + encodeURIComponent(headSha), "GET", undefined, headers);
        const tree = await apiRequest("/git/trees", "POST", {
          base_tree: parent.tree.sha,
          tree: lastTreeChanges
        }, headers);
        const commit = await apiRequest("/git/commits", "POST", {
          message: lastCommitMessage,
          tree: tree.sha,
          parents: [headSha]
        }, headers);
        const retryInit = Object.assign({}, originalInit, {
          method: "PATCH",
          headers: headers,
          body: JSON.stringify({ sha: commit.sha, force: false })
        });
        lastResponse = await nativeFetch(originalUrl, retryInit);
        if (lastResponse.ok) return lastResponse;
        let failure = {};
        try { failure = await lastResponse.clone().json(); } catch (_) {}
        if (!/not a fast forward/i.test(String(failure.message || ""))) return lastResponse;
      } catch (error) {
        if (error && error.response) return error.response;
        return new Response(JSON.stringify({ message: "Automatic retry failed: " + (error.message || "unknown error") }), {
          status: 409,
          headers: { "Content-Type": "application/json" }
        });
      }
      await new Promise(resolve => setTimeout(resolve, Math.min(250 * attempt, 1500)));
    }
    return lastResponse || new Response(JSON.stringify({ message: "The branch kept changing. Please retry saving; your text is still in the editor." }), {
      status: 409,
      headers: { "Content-Type": "application/json" }
    });
  }

  window.fetch = async function (input, init) {
    const info = requestInfo(input, init);
    const body = readJsonBody(init);
    if (info.method === "POST" && /\/git\/trees\/?$/.test(info.url.pathname) && body && Array.isArray(body.tree)) {
      lastTreeChanges = body.tree.map(entry => Object.assign({}, entry));
    }
    if (info.method === "POST" && /\/git\/commits\/?$/.test(info.url.pathname) && body && body.message) {
      lastCommitMessage = String(body.message);
    }
    const response = await nativeFetch(input, init);
    if (info.method !== "PATCH" || !/\/git\/refs\/heads\/main\/?$/.test(info.url.pathname) || response.ok) {
      return response;
    }
    let failure = {};
    try { failure = await response.clone().json(); } catch (_) {}
    if (!/not a fast forward/i.test(String(failure.message || ""))) return response;
    const headers = headersFor(init);
    const retryResponse = await rebaseAndRetry(input, init || {}, headers);
    return retryResponse || response;
  };
})();