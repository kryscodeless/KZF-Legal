async function retrieveWebContext(query) {
  // Web retrieval integration point.
  return { query, sources: [] };
}

module.exports = { retrieveWebContext };
