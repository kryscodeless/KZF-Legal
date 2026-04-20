async function embedChunks(chunks) {
  // Embedding provider integration point.
  return chunks.map((chunk, index) => ({ id: index, vector: [], chunk }));
}

module.exports = { embedChunks };
