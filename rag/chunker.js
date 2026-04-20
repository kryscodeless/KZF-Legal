function chunkText(text, chunkSize = 500) {
  if (!text) return [];

  const chunks = [];
  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }

  return chunks;
}

module.exports = { chunkText };
