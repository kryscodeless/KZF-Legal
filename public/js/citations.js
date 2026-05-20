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

  window.formatAiResponse = function formatAiResponse(answer, citations = []) {
    const safeCitations = Array.isArray(citations) ? citations : [];

    const paragraphs = String(answer || '')
      .split(/\n\n+/)
      .filter(Boolean)
      .map((paragraph) => {
        const html = formatInlineMarkdown(escapeHtml(paragraph));
        return `<p>${linkInlineCitations(html, safeCitations)}</p>`;
      })
      .join('');

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
