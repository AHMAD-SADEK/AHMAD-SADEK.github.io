/* Small, safe Markdown renderer for public archive submissions.
   Raw HTML is always escaped. Only vetted URLs are emitted as links/media. */
(function () {
  "use strict";

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function safeURL(value, kind = "link") {
    const candidate = String(value ?? "").trim().replace(/&amp;/g, "&");
    if (!candidate || /[\u0000-\u001F\u007F]/.test(candidate)) return "";
    if (/^(?:https?):\/\//i.test(candidate)) {
      try {
        const url = new URL(candidate);
        if (url.protocol !== "https:" && url.protocol !== "http:") return "";
        return url.href;
      } catch { return ""; }
    }
    if (kind === "link" && /^(?:mailto:|tel:)/i.test(candidate)) return candidate;
    if (/^(?:\/(?!\/)|\.{1,2}\/|#)/.test(candidate)) return candidate;
    return "";
  }

  function inline(source) {
    const tokens = [];
    const stash = (html) => {
      const marker = "\u0000M" + tokens.length + "\u0000";
      tokens.push(html);
      return marker;
    };

    let text = String(source ?? "");

    // Protect inline code first; its contents never pass through formatting rules.
    text = text.replace(/\x60([^\x60\n]+)\x60/g, (_, code) =>
      stash("<code>" + escapeHTML(code) + "</code>")
    );

    text = text.replace(/!\[([^\]]*)\]\((\S+?)(?:\s+["']([^"']*)["'])?\)/g, (_, alt, rawURL, title) => {
      const url = safeURL(rawURL, "image");
      if (!url) return escapeHTML("![" + alt + "](" + rawURL + ")");
      return stash('<img src="' + escapeHTML(url) + '" alt="' + escapeHTML(alt) +
        '"' + (title ? ' title="' + escapeHTML(title) + '"' : "") +
        ' loading="lazy" decoding="async">');
    });

    text = text.replace(/\[([^\]]+)\]\((\S+?)(?:\s+["']([^"']*)["'])?\)/g, (_, label, rawURL, title) => {
      const url = safeURL(rawURL, "link");
      if (!url) return escapeHTML("[" + label + "](" + rawURL + ")");
      const external = /^https?:\/\//i.test(url);
      return stash('<a href="' + escapeHTML(url) + '"' +
        (title ? ' title="' + escapeHTML(title) + '"' : "") +
        (external ? ' target="_blank" rel="noopener noreferrer"' : "") +
        ">" + escapeHTML(label) + "</a>");
    });

    text = escapeHTML(text);
    text = text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/__(.+?)__/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>")
      .replace(/~~(.+?)~~/g, "<del>$1</del>")
      .replace(/\n/g, "<br>");

    return text.replace(/\u0000M(\d+)\u0000/g, (_, index) => tokens[Number(index)] ?? "");
  }

  function isTableDivider(line) {
    const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
    return cells.length > 0 && cells.every((cell) => /^\s*:?-{3,}:?\s*$/.test(cell));
  }
  function tableCells(line) {
    return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
  }
  function isUnordered(line) { return /^\s*[-*+]\s+/.test(line); }
  function isOrdered(line) { return /^\s*\d+[.)]\s+/.test(line); }
  function isHeading(line) { return /^\s{0,3}#{1,6}\s+/.test(line); }
  function isFence(line) { return /^\s*\x60\x60\x60/.test(line); }
  function isRule(line) { return /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line); }
  function isQuote(line) { return /^\s*>\s?/.test(line); }

  function render(markdown) {
    const lines = String(markdown ?? "").replace(/\r\n?/g, "\n").split("\n");
    const html = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }

      if (isFence(line)) {
        const language = line.trim().slice(3).trim().replace(/[^a-zA-Z0-9_-]/g, "");
        const codeLines = [];
        i++;
        while (i < lines.length && !isFence(lines[i])) codeLines.push(lines[i++]);
        if (i < lines.length) i++;
        html.push('<pre><code' + (language ? ' class="language-' + language + '"' : "") +
          ">" + escapeHTML(codeLines.join("\n")) + "</code></pre>");
        continue;
      }

      if (isRule(line)) { html.push("<hr>"); i++; continue; }

      if (isHeading(line)) {
        const match = line.trim().match(/^(#{1,6})\s+(.+)$/);
        if (match) {
          const level = Math.min(4, Math.max(2, match[1].length + 1));
          html.push("<h" + level + ">" + inline(match[2].replace(/\s+#+\s*$/, "")) +
            "</h" + level + ">");
        }
        i++; continue;
      }

      if (isQuote(line)) {
        const quote = [];
        while (i < lines.length && isQuote(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ""));
        html.push("<blockquote><p>" + inline(quote.join("\n")) + "</p></blockquote>");
        continue;
      }

      if ((isUnordered(line) || isOrdered(line)) && !(i + 1 < lines.length && isTableDivider(lines[i + 1]))) {
        const ordered = isOrdered(line);
        const tag = ordered ? "ol" : "ul";
        const items = [];
        while (i < lines.length && (ordered ? isOrdered(lines[i]) : isUnordered(lines[i]))) {
          items.push("<li>" + inline(lines[i].replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/, "")) + "</li>");
          i++;
        }
        html.push("<" + tag + ">" + items.join("") + "</" + tag + ">");
        continue;
      }

      if (i + 1 < lines.length && line.includes("|") && isTableDivider(lines[i + 1])) {
        const headers = tableCells(line);
        i += 2;
        const rows = [];
        while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(tableCells(lines[i++]));
        const headerHTML = headers.map((cell) => "<th scope=\"col\">" + inline(cell) + "</th>").join("");
        const rowsHTML = rows.map((row) => "<tr>" + headers.map((_, index) =>
          "<td>" + inline(row[index] ?? "") + "</td>").join("") + "</tr>").join("");
        html.push("<div class=\"table-scroll\"><table><thead><tr>" + headerHTML +
          "</tr></thead><tbody>" + rowsHTML + "</tbody></table></div>");
        continue;
      }

      const paragraph = [line];
      i++;
      while (i < lines.length && lines[i].trim() &&
        !isFence(lines[i]) && !isHeading(lines[i]) && !isRule(lines[i]) &&
        !isQuote(lines[i]) && !isUnordered(lines[i]) && !isOrdered(lines[i])) {
        if (i + 1 < lines.length && lines[i].includes("|") && isTableDivider(lines[i + 1])) break;
        paragraph.push(lines[i++]);
      }
      html.push("<p>" + inline(paragraph.join("\n")) + "</p>");
    }
    return html.join("\n");
  }

  window.ArchiveMarkdown = Object.freeze({ render, escapeHTML, safeURL });
})();