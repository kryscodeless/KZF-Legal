const path = require("path");
const { chunkText } = require("./chunker");
const { embedChunks } = require("./embedder");
const { retrieveWebContext } = require("./webRetriever");
const { buildContext } = require("./contextBuilder");
const { generateAnswer, MODEL } = require("./generator");
const { createDefaultVectorStore } = require("./storage");
const { ingestText, ingestCorpusDirectory } = require("./pipeline");
const { extractDocumentText } = require("./documentExtractor");

const DEFAULT_CORPUS_DIR = path.join(__dirname, "corpus");
const {
  SubmitQueryInputSchema,
  SubmitQueryResponseSchema,
  IngestDocumentInputSchema,
  IngestDocumentResponseSchema,
  RemoveDocumentInputSchema,
  RemoveDocumentResponseSchema,
} = require("./schemas/api");

const _defaultFns = {
  chunker: chunkText,
  embedder: embedChunks,
  webRetriever: retrieveWebContext,
  contextBuilder: buildContext,
  generator: generateAnswer,
  documentExtractor: extractDocumentText,
};

const state = {
  ..._defaultFns,
  vectorStore: null,
};

function getVectorStore() {
  if (!state.vectorStore) {
    state.vectorStore = createDefaultVectorStore();
    state.vectorStore.load();
  }

  return state.vectorStore;
}

let globalCorpusSeedPromise = null;

async function ensureGlobalCorpusSeeded() {
  const vectorStore = getVectorStore();
  if (typeof vectorStore.countByNamespace !== "function") {
    return;
  }

  if (!globalCorpusSeedPromise) {
    globalCorpusSeedPromise = (async () => {
      const count = await vectorStore.countByNamespace("global");
      if (count > 0) {
        return;
      }

      await ingestCorpusDirectory({
        corpusDir: process.env.RAG_CORPUS_DIR || DEFAULT_CORPUS_DIR,
        namespace: "global",
        vectorStore,
      });
      await Promise.resolve(vectorStore.save());
    })().catch((err) => {
      globalCorpusSeedPromise = null;
      throw err;
    });
  }

  await globalCorpusSeedPromise;
}

function init() {
  return { ready: true };
}

function makeRagError(code, message, retryable = false) {
  const err = new Error(message);
  err.code = code;
  err.retryable = retryable;
  return err;
}

async function ingestDocument({ userId, documentId, filePath, mimeType }) {
  const input = IngestDocumentInputSchema.parse({ userId, documentId, filePath, mimeType });
  const startedAt = Date.now();

  let text;
  try {
    text = await state.documentExtractor({
      filePath: input.filePath,
      mimeType: input.mimeType,
    });
  } catch (err) {
    if (err.code) {
      throw err;
    }

    throw makeRagError("RAG_VALIDATION_ERROR", `Cannot read file: ${err.message}`, false);
  }

  await ensureGlobalCorpusSeeded();

  const namespace = `user:${input.userId}`;
  const vectorStore = getVectorStore();
  const chunks = await ingestText({
    text,
    sourceId: input.documentId,
    namespace,
    vectorStore,
    chunker: state.chunker,
    embedder: state.embedder,
    metadata: { userId: input.userId, documentId: input.documentId },
  });
  await Promise.resolve(vectorStore.save());

  return IngestDocumentResponseSchema.parse({
    chunks,
    meta: { ingestMs: Date.now() - startedAt },
  });
}

async function retrieveVectorHits(vectorStore, queryVector, userId, scopedDocumentIds) {
  const limit = 4;

  if (!scopedDocumentIds) {
    return Promise.resolve(vectorStore.search({
      queryVector,
      limit,
      namespaces: ["global", `user:${userId}`],
      documentIds: null,
    }));
  }

  const [userHits, globalHits] = await Promise.all([
    Promise.resolve(vectorStore.search({
      queryVector,
      limit,
      namespaces: [`user:${userId}`],
      documentIds: scopedDocumentIds,
    })),
    Promise.resolve(vectorStore.search({
      queryVector,
      limit,
      namespaces: ["global"],
      documentIds: null,
    })),
  ]);

  const seen = new Set();
  return [...userHits, ...globalHits]
    .filter((hit) => {
      if (seen.has(hit.id)) {
        return false;
      }
      seen.add(hit.id);
      return true;
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, limit);
}

async function submitQuery({ userId, question, documentIds }) {
  const input = SubmitQueryInputSchema.parse({ userId, question, documentIds });
  const startedAt = Date.now();

  await ensureGlobalCorpusSeeded();

  let embeddedQuestion;
  try {
    embeddedQuestion = await state.embedder([input.question]);
  } catch (err) {
    throw makeRagError("RAG_UPSTREAM_ERROR", "Embedding service unavailable", true);
  }

  const queryVector = embeddedQuestion[0]?.vector || [];
  const scopedDocumentIds = input.documentIds?.length ? input.documentIds : null;
  const vectorStore = getVectorStore();

  const vectorHits = await retrieveVectorHits(
    vectorStore,
    queryVector,
    input.userId,
    scopedDocumentIds,
  );

  let webResponse;
  try {
    webResponse = await state.webRetriever(input.question);
  } catch {
    webResponse = { sources: [] };
  }
  const webResults = webResponse.sources || [];

  const { contextText, citations } = state.contextBuilder({ vectorHits, webResults });

  let answer;
  try {
    answer = await state.generator({ question: input.question, contextText });
  } catch (err) {
    const detail = err?.message ? `: ${err.message}` : "";
    throw makeRagError("RAG_UPSTREAM_ERROR", `LLM service unavailable${detail}`, true);
  }

  return SubmitQueryResponseSchema.parse({
    answer,
    citations,
    meta: {
      latencyMs: Date.now() - startedAt,
      model: MODEL,
      retrieval: {
        vectorHits: vectorHits.length,
        webHits: webResults.length,
      },
    },
  });
}

async function removeDocument({ userId, documentId }) {
  const input = RemoveDocumentInputSchema.parse({ userId, documentId });
  const removed = await Promise.resolve(getVectorStore().removeByDocument({
    namespace: `user:${input.userId}`,
    documentId: input.documentId,
  }));

  if (removed > 0) {
    await Promise.resolve(getVectorStore().save());
  }

  return RemoveDocumentResponseSchema.parse({ removed });
}

function __setState(nextState = {}) {
  const keys = [
    "vectorStore",
    "chunker",
    "embedder",
    "webRetriever",
    "contextBuilder",
    "generator",
    "documentExtractor",
  ];
  for (const key of keys) {
    if (Object.hasOwn(nextState, key)) {
      state[key] = nextState[key];
    }
  }
}

function __resetState() {
  Object.assign(state, _defaultFns);
  state.vectorStore = null;
  globalCorpusSeedPromise = null;
}

module.exports = { init, ingestDocument, submitQuery, removeDocument, __setState, __resetState };
