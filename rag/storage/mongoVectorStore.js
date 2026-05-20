const mongoose = require("mongoose");
const { searchRecords } = require("./vectorSearch");

const COLLECTION_NAME = "vector_chunks";

const connections = new Map();

function normalizeItems(items = []) {
  return items.map((item) => ({
    id: item.id,
    namespace: item.namespace || "global",
    vector: item.vector || [],
    chunk: item.chunk || "",
    metadata: item.metadata || {},
  }));
}

function getChunkModel(uri) {
  if (connections.has(uri)) {
    return connections.get(uri);
  }

  const connection = mongoose.createConnection(uri);
  const schema = new mongoose.Schema(
    {
      id: { type: String, required: true },
      namespace: { type: String, required: true },
      chunk: { type: String, default: "" },
      vector: { type: [Number], default: [] },
      metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    { versionKey: false },
  );

  schema.index({ id: 1, namespace: 1 }, { unique: true });
  schema.index({ namespace: 1 });

  const model = connection.model(COLLECTION_NAME, schema);
  const store = {
    model,
    ready: connection.asPromise(),
  };
  connections.set(uri, store);
  return store;
}

function createMongoVectorStore(options = {}) {
  const uri = options.uri || process.env.RAG_MONGODB_URI;
  if (!uri) {
    throw new Error("RAG_MONGODB_URI is required for the Mongo vector store");
  }

  const { model, ready } = getChunkModel(uri);

  async function upsert(items = []) {
    await ready;
    const incoming = normalizeItems(items);
    if (!incoming.length) {
      return 0;
    }

    await model.bulkWrite(
      incoming.map((item) => ({
        replaceOne: {
          filter: { id: item.id, namespace: item.namespace },
          replacement: item,
          upsert: true,
        },
      })),
    );

    return incoming.length;
  }

  async function search(searchOptions) {
    await ready;
    const records = await model
      .find({ namespace: { $in: searchOptions.namespaces || ["global"] } })
      .lean();

    return searchRecords(records, searchOptions);
  }

  async function removeByDocument({ namespace, documentId }) {
    await ready;
    const result = await model.deleteMany({
      namespace,
      $or: [
        { "metadata.documentId": documentId },
        { "metadata.sourceId": documentId },
      ],
    });

    return result.deletedCount;
  }

  async function all() {
    await ready;
    return model.find({}).lean();
  }

  async function clear() {
    await ready;
    await model.deleteMany({});
  }

  async function countByNamespace(namespace) {
    await ready;
    return model.countDocuments({ namespace });
  }

  function load() {
    return [];
  }

  function save() {}

  return {
    upsert,
    search,
    removeByDocument,
    countByNamespace,
    save,
    load,
    all,
    clear,
  };
}

function __resetForTests() {
  connections.clear();
}

module.exports = {
  createMongoVectorStore,
  __resetForTests,
};
