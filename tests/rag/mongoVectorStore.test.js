const { expect } = require("chai");
const sinon = require("sinon");
const { createDefaultVectorStore } = require("../../rag/storage");
const { createMongoVectorStore, __resetForTests } = require("../../rag/storage/mongoVectorStore");

describe("rag/storage/mongoVectorStore", () => {
  let originalRagMongoUri;

  beforeEach(() => {
    originalRagMongoUri = process.env.RAG_MONGODB_URI;
    sinon.restore();
    __resetForTests();
  });

  afterEach(() => {
    if (originalRagMongoUri === undefined) {
      delete process.env.RAG_MONGODB_URI;
    } else {
      process.env.RAG_MONGODB_URI = originalRagMongoUri;
    }
  });

  it("requires RAG_MONGODB_URI for the default vector store", () => {
    delete process.env.RAG_MONGODB_URI;
    expect(() => createDefaultVectorStore()).to.throw("RAG_MONGODB_URI is required");
  });

  it("upserts, searches, and removes records in Mongo", async () => {
    const records = [
      {
        id: "doc-a:0",
        namespace: "user:1",
        chunk: "alpha",
        vector: [1, 0],
        metadata: { documentId: "doc-a" },
      },
      {
        id: "doc-b:0",
        namespace: "user:1",
        chunk: "beta",
        vector: [0, 1],
        metadata: { documentId: "doc-b" },
      },
    ];

    const model = {
      bulkWrite: sinon.stub().resolves(),
      find: sinon.stub(),
      deleteMany: sinon.stub().resolves({ deletedCount: 1 }),
    };
    model.find.returns({
      lean: sinon.stub().resolves(records),
    });

    const connection = {
      asPromise: sinon.stub().resolves(),
      model: sinon.stub().returns(model),
    };
    sinon.stub(require("mongoose"), "createConnection").returns(connection);

    const store = createMongoVectorStore({ uri: "mongodb://127.0.0.1:27017/kfz-legal-rag-test" });

    await store.upsert(records.slice(0, 1));
    expect(model.bulkWrite.calledOnce).to.equal(true);

    const hits = await store.search({
      queryVector: [1, 0],
      limit: 4,
      namespaces: ["user:1"],
      documentIds: ["doc-a"],
    });
    expect(hits).to.have.length(1);
    expect(hits[0].metadata.documentId).to.equal("doc-a");

    const removed = await store.removeByDocument({
      namespace: "user:1",
      documentId: "doc-a",
    });
    expect(removed).to.equal(1);
    expect(model.deleteMany.calledOnce).to.equal(true);
  });
});
