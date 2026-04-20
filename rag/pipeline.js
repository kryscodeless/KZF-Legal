const { chunkText } = require("./chunker");
const { embedChunks } = require("./embedder");
const { buildContext } = require("./contextBuilder");

async function runRagPipeline(text) {
  const chunks = chunkText(text);
  const embeddings = await embedChunks(chunks);
  const context = buildContext({ chunks });

  return { chunks, embeddings, context };
}

module.exports = { runRagPipeline };
