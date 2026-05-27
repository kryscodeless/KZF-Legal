(function () {
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatInlineMarkdown(text) {
    return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  function linkInlineCitations(html, citations) {
    const ids = new Set(citations.map((citation) => String(citation.id)));

    return html.replace(/\[(\d+)\]/g, (match, id) => {
      if (!ids.has(String(id))) {
        return match;
      }

      return `<a href="#cite-${id}" class="citation citation-link">[${id}]</a>`;
    });
  }

  function renderMarkdown(text, citations) {
    const lines = String(text || '').split('\n');
    const results = [];
    let listItems = [];
    let paraLines = [];

    function flushList() {
      if (!listItems.length) return;
      const items = listItems
        .map((l) => `<li>${linkInlineCitations(formatInlineMarkdown(escapeHtml(l)), citations)}</li>`)
        .join('');
      results.push(`<ul>${items}</ul>`);
      listItems = [];
    }

    function flushPara() {
      if (!paraLines.length) return;
      const html = formatInlineMarkdown(escapeHtml(paraLines.join(' ')));
      results.push(`<p>${linkInlineCitations(html, citations)}</p>`);
      paraLines = [];
    }

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) { flushList(); flushPara(); continue; }

      const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)/);
      if (headingMatch) {
        flushList(); flushPara();
        const level = headingMatch[1].length;
        const html = linkInlineCitations(formatInlineMarkdown(escapeHtml(headingMatch[2])), citations);
        results.push(`<h${level}>${html}</h${level}>`);
        continue;
      }

      if (/^---+$/.test(trimmed)) { flushList(); flushPara(); results.push('<hr>'); continue; }

      const listMatch = trimmed.match(/^[-*]\s+(.+)/);
      if (listMatch) { flushPara(); listItems.push(listMatch[1]); continue; }

      flushList();
      paraLines.push(trimmed);
    }

    flushList();
    flushPara();
    return results.join('');
  }

  window.formatAiResponse = function formatAiResponse(answer, citations = []) {
    const safeCitations = Array.isArray(citations) ? citations : [];

    const paragraphs = renderMarkdown(answer, safeCitations);

    if (!safeCitations.length) {
      return paragraphs || '<p></p>';
    }

    const items = safeCitations.map((citation) => {
      const label = escapeHtml(citation.title || `Source ${citation.id}`);
      const snippet = escapeHtml(
        String(citation.snippet || '').length > 180
          ? `${String(citation.snippet).slice(0, 180)}…`
          : String(citation.snippet || ''),
      );
      const titleHtml = citation.url
        ? `<a href="${escapeHtml(citation.url)}" target="_blank" rel="noopener noreferrer">${label}</a>`
        : label;

      return `<li id="cite-${citation.id}" class="citations-item"><span class="citation">[${citation.id}]</span> ${titleHtml}<div class="citation-snippet">${snippet}</div></li>`;
    }).join('');

    return `${paragraphs}<div class="citations-block"><div class="citations-heading">Sources</div><ul class="citations-list">${items}</ul></div>`;
  };
})();
