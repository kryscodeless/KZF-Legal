const fs = require("fs");
const os = require("os");
const path = require("path");
const { expect } = require("chai");
const sinon = require("sinon");
const ragService = require("../../rag");

describe("ragService (v2)", () => {
  afterEach(() => {
    ragService.__resetState();
  });

  describe("init", () => {
    it("returns ready:true", () => {
      expect(ragService.init().ready).to.equal(true);
    });

    it("ignores io argument (v2 — BE owns sockets)", () => {
      expect(ragService.init({ io: {} }).ready).to.equal(true);
    });
  });

  describe("ingestDocument", () => {
    let tmpFile;

    beforeEach(() => {
      tmpFile = path.join(os.tmpdir(), `rag-test-${Date.now()}.txt`);
      fs.writeFileSync(tmpFile, "visa subclass 500 requirements text");
    });

    afterEach(() => {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    });

    it("ingests a file and returns chunks + meta", async () => {
      const vectorStore = { upsert: sinon.stub(), save: sinon.stub() };
      ragService.__setState({
        vectorStore,
        chunker: sinon.stub().returns(["visa text"]),
        embedder: sinon.stub().resolves([{ chunk: "visa text", vector: [1, 0] }]),
      });

      const result = await ragService.ingestDocument({
        userId: "u1",
        documentId: "doc-1",
        filePath: tmpFile,
        mimeType: "text/plain",
      });

      expect(result.chunks).to.equal(1);
      expect(result.meta).to.have.property("ingestMs");
      expect(vectorStore.save.calledOnce).to.equal(true);
    });

    it("throws RAG_VALIDATION_ERROR when file does not exist", async () => {
      try {
        await ragService.ingestDocument({
          userId: "u1",
          documentId: "doc-1",
          filePath: "/nonexistent/path.txt",
          mimeType: "text/plain",
        });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err.code).to.equal("RAG_VALIDATION_ERROR");
        expect(err.retryable).to.equal(false);
      }
    });

    it("ingests a real PDF fixture through the document extractor", async () => {
      const pdfFixture = path.join(__dirname, "fixtures/student-visa.pdf");
      const vectorStore = { upsert: sinon.stub(), save: sinon.stub() };
      ragService.__setState({
        vectorStore,
        chunker: sinon.stub().returns(["student visa text"]),
        embedder: sinon.stub().resolves([{ chunk: "student visa text", vector: [1, 0] }]),
      });

      const result = await ragService.ingestDocument({
        userId: "u1",
        documentId: "doc-pdf",
        filePath: pdfFixture,
        mimeType: "application/pdf",
      });

      expect(result.chunks).to.equal(1);
      expect(vectorStore.save.calledOnce).to.equal(true);
    });
  });

  describe("submitQuery", () => {
    it("returns answer, citations, and meta", async () => {
      ragService.__setState({
        embedder: sinon.stub().resolves([{ vector: [1, 0], chunk: "question" }]),
        vectorStore: {
          search: sinon.stub().returns([{
            id: "doc:0",
            chunk: "subclass 500 info",
            score: 0.9,
            metadata: { sourceId: "doc-a" },
            namespace: "global",
            vector: [],
          }]),
        },
        webRetriever: sinon.stub().resolves({ query: "q", sources: [] }),
        contextBuilder: sinon.stub().returns({
          contextText: "[1] subclass 500 info",
          citations: [{ id: 1, title: "doc-a", source: "vector", snippet: "subclass 500 info" }],
        }),
        generator: sinon.stub().resolves("You need X for subclass 500 [1]"),
      });

      const result = await ragService.submitQuery({
        userId: "u1",
        question: "What are subclass 500 requirements?",
      });

      expect(result.answer).to.be.a("string");
      expect(result.citations).to.be.an("array").with.length(1);
      expect(result.meta.retrieval.vectorHits).to.equal(1);
      expect(result.meta.retrieval.webHits).to.equal(0);
      expect(result.meta).to.have.property("model");
      expect(result.meta).to.have.property("latencyMs");
    });

    it("throws RAG_UPSTREAM_ERROR when embedding fails", async () => {
      ragService.__setState({
        embedder: sinon.stub().rejects(new Error("OpenAI unreachable")),
        vectorStore: { countByNamespace: sinon.stub().resolves(1), search: sinon.stub() },
      });

      try {
        await ragService.submitQuery({
          userId: "u1",
          question: "Can I extend my visa?",
        });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err.code).to.equal("RAG_UPSTREAM_ERROR");
        expect(err.retryable).to.equal(true);
      }
    });

    it("throws RAG_UPSTREAM_ERROR when generator fails", async () => {
      ragService.__setState({
        embedder: sinon.stub().resolves([{ vector: [1, 0], chunk: "q" }]),
        vectorStore: { search: sinon.stub().returns([]) },
        webRetriever: sinon.stub().resolves({ query: "q", sources: [] }),
        contextBuilder: sinon.stub().returns({ contextText: "some context", citations: [] }),
        generator: sinon.stub().rejects(new Error("Claude unavailable")),
      });

      try {
        await ragService.submitQuery({
          userId: "u1",
          question: "Can I extend my visa?",
        });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err.code).to.equal("RAG_UPSTREAM_ERROR");
        expect(err.retryable).to.equal(true);
      }
    });

    it("merges scoped user search with global corpus", async () => {
      const search = sinon.stub();
      search.onFirstCall().returns([{
        id: "upload:0",
        chunk: "checklist only",
        score: 0.95,
        metadata: { documentId: "doc-a", sourceId: "doc-a" },
        namespace: "user:u1",
        vector: [],
      }]);
      search.onSecondCall().returns([{
        id: "global:0",
        chunk: "subclass 500 work hours",
        score: 0.88,
        metadata: { sourceId: "Subclass_500_Student_visa.pdf" },
        namespace: "global",
        vector: [],
      }]);
      ragService.__setState({
        embedder: sinon.stub().resolves([{ vector: [1, 0], chunk: "question" }]),
        vectorStore: { countByNamespace: sinon.stub().resolves(1), search },
        webRetriever: sinon.stub().resolves({ query: "q", sources: [] }),
        contextBuilder: sinon.stub().returns({ contextText: "merged", citations: [] }),
        generator: sinon.stub().resolves("Merged answer"),
      });

      await ragService.submitQuery({
        userId: "u1",
        question: "What are subclass 500 requirements?",
        documentIds: ["doc-a"],
      });

      expect(search.calledTwice).to.equal(true);
      expect(search.firstCall.args[0]).to.deep.equal({
        queryVector: [1, 0],
        limit: 4,
        namespaces: ["user:u1"],
        documentIds: ["doc-a"],
      });
      expect(search.secondCall.args[0]).to.deep.equal({
        queryVector: [1, 0],
        limit: 4,
        namespaces: ["global"],
        documentIds: null,
      });
    });
  });

  describe("removeDocument", () => {
    it("removes vectors for the document and persists when records were deleted", async () => {
      const removeByDocument = sinon.stub().returns(2);
      const save = sinon.stub();
      ragService.__setState({
        vectorStore: { removeByDocument, save },
      });

      const result = await ragService.removeDocument({
        userId: "u1",
        documentId: "doc-a",
      });

      expect(removeByDocument.calledOnceWith({
        namespace: "user:u1",
        documentId: "doc-a",
      })).to.equal(true);
      expect(save.calledOnce).to.equal(true);
      expect(result.removed).to.equal(2);
    });

    it("does not persist when no vectors were removed", async () => {
      const removeByDocument = sinon.stub().returns(0);
      const save = sinon.stub();
      ragService.__setState({
        vectorStore: { removeByDocument, save },
      });

      const result = await ragService.removeDocument({
        userId: "u1",
        documentId: "doc-missing",
      });

      expect(save.called).to.equal(false);
      expect(result.removed).to.equal(0);
    });
  });
});
