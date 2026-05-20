function formatCitationTitle(hit) {
  const sourceId = hit.metadata?.sourceId;
  if (sourceId && !/^[a-f0-9]{24}$/i.test(String(sourceId))) {
    return String(sourceId);
  }

  return "Uploaded document";
}

function buildContext({ vectorHits = [], webResults = [] }) {
  const citations = [];
  const parts = [];
  let id = 1;

  for (const hit of vectorHits) {
    citations.push({
      id,
      title: formatCitationTitle(hit),
      source: "vector",
      snippet: hit.chunk,
      documentRef: hit.metadata?.documentId || null,
    });
    parts.push(`[${id}] ${hit.chunk}`);
    id += 1;
  }

  for (const result of webResults) {
    citations.push({
      id,
      title: result.title || "Web result",
      source: "web",
      url: result.url,
      snippet: result.snippet || result.content || "",
    });
    parts.push(`[${id}] ${result.snippet || result.content || ""}`);
    id += 1;
  }

  return {
    contextText: parts.join("\n\n"),
    citations,
  };
}

module.exports = { buildContext };
