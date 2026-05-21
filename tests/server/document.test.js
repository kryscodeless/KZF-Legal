const expect = require("chai").expect;
const request = require("supertest");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");
const app = require("../../server/app");
const { createUserAndToken } = require("./helpers/mockAuth");
const sinon = require("sinon");
const ragService = require("../../rag/index");
const { createFakeIo } = require("./helpers/fakeSocket");

// Path to fixture files used across the suite
const FIXTURES_DIR = path.join(__dirname, "fixtures");

const fixturePath = (filename) => path.join(FIXTURES_DIR, filename);

// Create a chat and return its ID
const createChat = async (token, title = "Document Test Chat") => {
    const res = await request(app)
        .post("/api/chat/create")
        .set("Authorization", `Bearer ${token}`)
        .send({ title });

    return res.body.data.chatId;
};

// Upload a document and return its ID
const uploadDocument = async (token, chatId, fixtureName = "sample.pdf") => {
    const res = await request(app)
        .post(`/api/documents/upload/${chatId}`)
        .set("Authorization", `Bearer ${token}`)
        .attach("document", fixturePath(fixtureName));

    return res.body.data?.documentId;
};

// Upload tests 
describe("POST /api/documents/upload/:chatId", () => {
    let token;
    let chatId;
    let ragStub;
    let fakeIo;

    beforeEach(async () => {
        // Create a user and chat for testing
        ({ token } = await createUserAndToken());
        chatId = await createChat(token);

        // Wire a fake Socket.io into the Express app for this test
        fakeIo = createFakeIo();
        app.set("io", fakeIo);

        // Stub the RAG ingestion call so processUpload doesn't hit external services
        ragStub = sinon.stub(ragService, "ingestDocument").resolves({
            extractedSummary: "Stubbed summary.",
        });
    });

    afterEach(async () => {
        // Restore the original RAG service method and clean up the fake Socket.io instance
        ragStub.restore();
        app.set("io", undefined);
    });

    // Standard successful upload — should return 202 with a pending documentId
    it("should accept a valid PDF and return 202 with a pending documentId", async () => {
        const res = await request(app)
            .post(`/api/documents/upload/${chatId}`)
            .set("Authorization", `Bearer ${token}`)
            .attach("document", fixturePath("sample.pdf"));
        
        // Wait a moment to ensure the document is fully processed and the stubbed RAG call is made
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(res.status).to.equal(202);
        expect(res.body.success).to.be.true;
        expect(res.body.data).to.have.property("documentId");
        expect(res.body.data.status).to.equal("pending");
        expect(mongoose.Types.ObjectId.isValid(res.body.data.documentId)).to.be.true;
    });

    // Plain text files are also accepted
    it("should accept a valid .txt file", async () => {
        const res = await request(app)
            .post(`/api/documents/upload/${chatId}`)
            .set("Authorization", `Bearer ${token}`)
            .attach("document", fixturePath("sample.txt"));

        // Wait a moment to ensure the document is fully processed and the stubbed RAG call is made
        await new Promise(resolve => setTimeout(resolve, 100));

        expect(res.status).to.equal(202);
        expect(res.body.data.status).to.equal("pending");
    });

    // Validation: chatId must be a valid ObjectId
    it("should return 400 VALIDATION_ERROR when chatId is not a valid ObjectId", async () => {
        const res = await request(app)
            .post("/api/documents/upload/not-a-valid-id")
            .set("Authorization", `Bearer ${token}`)
            .attach("document", fixturePath("sample.pdf"));

        expect(res.status).to.equal(400);
        expect(res.body.error.code).to.equal("VALIDATION_ERROR");
    });

    // Non-existent chatId should be rejected
    it("should return 404 NOT_FOUND when chatId does not exist", async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();

        const res = await request(app)
            .post(`/api/documents/upload/${fakeId}`)
            .set("Authorization", `Bearer ${token}`)
            .attach("document", fixturePath("sample.pdf"));

        expect(res.status).to.equal(404);
        expect(res.body.error.code).to.equal("NOT_FOUND");
    });

    // Authorization: cannot upload to another user's chat
    it("should return 404 NOT_FOUND when chat belongs to another user", async () => {
        const { token: otherToken } = await createUserAndToken({
            email: "other.user@example.com",
        });

        const res = await request(app)
            .post(`/api/documents/upload/${chatId}`)
            .set("Authorization", `Bearer ${otherToken}`)
            .attach("document", fixturePath("sample.pdf"));

        expect(res.status).to.equal(404);
        expect(res.body.error.code).to.equal("NOT_FOUND");
    });

    // No file attached — multer rejects with 400
    it("should return 400 when no file is attached", async () => {
        const res = await request(app)
            .post(`/api/documents/upload/${chatId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(400);
    });

    // Wrong file type — should be rejected at the multer fileFilter level
    it("should return 415 UNSUPPORTED_FILE_TYPE for disallowed mimetypes", async () => {
        const res = await request(app)
            .post(`/api/documents/upload/${chatId}`)
            .set("Authorization", `Bearer ${token}`)
            .attach("document", fixturePath("sample.exe"));

        expect(res.status).to.equal(415);
        expect(res.body.error.code).to.equal("UNSUPPORTED_FILE_TYPE");
    });

    // File too large — multer enforces the 10MB limit
    it("should return 413 LIMIT_FILE_SIZE when file exceeds 10MB", async () => {
        const res = await request(app)
            .post(`/api/documents/upload/${chatId}`)
            .set("Authorization", `Bearer ${token}`)
            .attach("document", fixturePath("oversized.pdf"));

        expect(res.status).to.equal(413);
        expect(res.body.error.code).to.equal("LIMIT_FILE_SIZE");
    });

    // Duplicate file (same checksum) — should be rejected with 409
    it("should return 409 DOCUMENT_ALREADY_EXISTS when uploading the same file twice", async () => {
        await request(app)
            .post(`/api/documents/upload/${chatId}`)
            .set("Authorization", `Bearer ${token}`)
            .attach("document", fixturePath("sample.pdf"));

        const res = await request(app)
            .post(`/api/documents/upload/${chatId}`)
            .set("Authorization", `Bearer ${token}`)
            .attach("document", fixturePath("sample.pdf"));

        expect(res.status).to.equal(409);
        expect(res.body.error.code).to.equal("DOCUMENT_ALREADY_EXISTS");
    });

    // Authentication enforcement
    it("should return 401 AUTH_INVALID_TOKEN without a token", async () => {
        const res = await request(app)
            .post(`/api/documents/upload/${chatId}`)

        expect(res.status).to.equal(401);
        expect(res.body.error.code).to.equal("AUTH_INVALID_TOKEN");
    });

    it("should return 401 AUTH_INVALID_TOKEN with a malformed token", async () => {
        const res = await request(app)
            .post(`/api/documents/upload/${chatId}`)
            .set("Authorization", "Bearer not.a.real.token")

        expect(res.status).to.equal(401);
        expect(res.body.error.code).to.equal("AUTH_INVALID_TOKEN");
    });
});

// Document lisiting tests
describe("GET /api/documents/", () => {
    let token;
    let ragStub;
    let fakeIo;

    beforeEach(async () => {
        // Create a user for testing
        ({ token } = await createUserAndToken());

        // Wire a fake Socket.io into the Express app for this test
        fakeIo = createFakeIo();
        app.set("io", fakeIo);

        // Stub the RAG ingestion call so processUpload doesn't hit external services
        ragStub = sinon.stub(ragService, "ingestDocument").resolves({
            extractedSummary: "Stubbed summary.",
        });
    });

    afterEach(async () => {
        // Restore the original RAG service method and clean up the fake Socket.io instance
        ragStub.restore();
        app.set("io", undefined);
    });

    // Empty list when no documents exist
    it("should return 200 with an empty array when the user has no documents", async () => {
        const res = await request(app)
            .get("/api/documents/")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(200);
        expect(res.body.success).to.be.true;
        expect(res.body.data.documents).to.be.an("array").that.is.empty;
    });

    // Standard list — returns the user's documents
    it("should return 200 with all documents belonging to the user", async () => {
        const chatId = await createChat(token);
        await uploadDocument(token, chatId, "sample.pdf");
        await uploadDocument(token, chatId, "sample.txt");

        const res = await request(app)
            .get("/api/documents/")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(200);
        expect(res.body.data.documents).to.have.lengthOf(2);
    });

    // Sensitive fields should not be exposed in the response
    it("should not expose storageUrl, extractedSummary, or checksum", async () => {
        const chatId = await createChat(token);
        await uploadDocument(token, chatId, "sample.pdf");

        const res = await request(app)
            .get("/api/documents/")
            .set("Authorization", `Bearer ${token}`);

        const doc = res.body.data.documents[0];
        expect(doc).to.not.have.property("storageUrl");
        expect(doc).to.not.have.property("extractedSummary");
        expect(doc).to.not.have.property("checksum");
    });

    // Isolation — users only see their own documents
    it("should not return documents belonging to other users", async () => {
        const chatId = await createChat(token);
        await uploadDocument(token, chatId, "sample.pdf");

        const { token: otherToken } = await createUserAndToken({
            email: "other.user@example.com",
        });
        const otherChatId = await createChat(otherToken);
        await uploadDocument(otherToken, otherChatId, "sample.txt");

        const res = await request(app)
            .get("/api/documents/")
            .set("Authorization", `Bearer ${token}`);

        expect(res.body.data.documents).to.have.lengthOf(1);
    });

    // Authentication enforcement
    it("should return 401 AUTH_INVALID_TOKEN without a token", async () => {
        const res = await request(app).get("/api/documents/");

        expect(res.status).to.equal(401);
        expect(res.body.error.code).to.equal("AUTH_INVALID_TOKEN");
    });
});

// Chat based document listing tests
describe("GET /api/documents/chat/:chatId", () => {
    let token;
    let chatId;
    let ragStub;
    let fakeIo;

    beforeEach(async () => {
        // Create a user and chat for testing
        ({ token } = await createUserAndToken());
        chatId = await createChat(token);

        // Wire a fake Socket.io into the Express app for this test
        fakeIo = createFakeIo();
        app.set("io", fakeIo);

        // Stub the RAG ingestion call so processUpload doesn't hit external services
        ragStub = sinon.stub(ragService, "ingestDocument").resolves({
            extractedSummary: "Stubbed summary.",
        });
    });

    afterEach(async () => {
        // Restore the original RAG service method and clean up the fake Socket.io instance
        ragStub.restore();
        app.set("io", undefined);
    });

    // Standard retrieval — returns documents within the chat
    it("should return 200 with documents belonging to the chat", async () => {
        await uploadDocument(token, chatId, "sample.pdf");
        await uploadDocument(token, chatId, "sample.txt");

        const res = await request(app)
            .get(`/api/documents/chat/${chatId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(200);
        expect(res.body.success).to.be.true;
        expect(res.body.data.documents).to.have.lengthOf(2);
    });

    // Empty chat — should return empty array, not 404
    it("should return 200 with an empty array when the chat has no documents", async () => {
        const res = await request(app)
            .get(`/api/documents/chat/${chatId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(200);
        expect(res.body.data.documents).to.be.an("array").that.is.empty;
    });

    // Should only return documents from the specified chat, not all the user's docs
    it("should not return documents from other chats", async () => {
        const otherChatId = await createChat(token, "Other Chat");
        await uploadDocument(token, chatId, "sample.pdf");
        await uploadDocument(token, otherChatId, "sample.txt");

        const res = await request(app)
            .get(`/api/documents/chat/${chatId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.body.data.documents).to.have.lengthOf(1);
    });

    // Sensitive fields should not be exposed
    it("should not expose storageUrl, extractedSummary, or checksum", async () => {
        await uploadDocument(token, chatId, "sample.pdf");

        const res = await request(app)
            .get(`/api/documents/chat/${chatId}`)
            .set("Authorization", `Bearer ${token}`);

        const doc = res.body.data.documents[0];
        expect(doc).to.not.have.property("storageUrl");
        expect(doc).to.not.have.property("extractedSummary");
        expect(doc).to.not.have.property("checksum");
    });

    // Validation: chatId must be a valid ObjectId
    it("should return 400 VALIDATION_ERROR when chatId is not a valid ObjectId", async () => {
        const res = await request(app)
            .get("/api/documents/chat/not-a-valid-id")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(400);
        expect(res.body.error.code).to.equal("VALIDATION_ERROR");
    });

    // Authentication enforcement
    it("should return 401 AUTH_INVALID_TOKEN without a token", async () => {
        const res = await request(app).get(`/api/documents/chat/${chatId}`);

        expect(res.status).to.equal(401);
        expect(res.body.error.code).to.equal("AUTH_INVALID_TOKEN");
    });
});

// Document deletion tests
describe("DELETE /api/documents/:documentId", () => {
    let token;
    let chatId;
    let documentId;
    let ragStub;
    let fakeIo;

    beforeEach(async () => {
        // Create a user and chat for testing
        ({ token } = await createUserAndToken());
        chatId = await createChat(token);
        
        // Wire a fake Socket.io into the Express app for this test
        fakeIo = createFakeIo();
        app.set("io", fakeIo);  

        // Stub the RAG ingestion call so processUpload doesn't hit external services
        ragStub = sinon.stub(ragService, "ingestDocument").resolves({
            extractedSummary: "Stubbed summary.",
        });

        documentId = await uploadDocument(token, chatId, "sample.pdf");
        // Wait a moment to ensure the document is fully processed and available for deletion
        await new Promise(resolve => setTimeout(resolve, 100));
    });

    afterEach(async () => {
        // Restore the original RAG service method and clean up the fake Socket.io instance
        ragStub.restore();
        app.set("io", undefined);
    });

    // Standard successful deletion
    it("should delete the document and return 200", async () => {
        const res = await request(app)
            .delete(`/api/documents/${documentId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(200);
        expect(res.body.success).to.be.true;
        expect(res.body.message).to.equal("Document deleted successfully");
    });

    // Verify the document no longer appears in listings after deletion
    it("should make the document inaccessible after deletion", async () => {
        await request(app)
            .delete(`/api/documents/${documentId}`)
            .set("Authorization", `Bearer ${token}`);

        const res = await request(app)
            .get("/api/documents/")
            .set("Authorization", `Bearer ${token}`);

        expect(res.body.data.documents).to.be.an("array").that.is.empty;
    });

    // Deleting an already deleted document should return 404
    it("should return 404 NOT_FOUND when deleting an already deleted document", async () => {
        await request(app)
            .delete(`/api/documents/${documentId}`)
            .set("Authorization", `Bearer ${token}`);

        const res = await request(app)
            .delete(`/api/documents/${documentId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(404);
        expect(res.body.error.code).to.equal("NOT_FOUND");
    });

    // Validation: documentId must be a valid ObjectId
    it("should return 400 VALIDATION_ERROR when documentId is not a valid ObjectId", async () => {
        const res = await request(app)
            .delete("/api/documents/not-a-valid-id")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(400);
        expect(res.body.error.code).to.equal("VALIDATION_ERROR");
    });

    // Non-existent documentId should return 404
    it("should return 404 NOT_FOUND when document does not exist", async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();

        const res = await request(app)
            .delete(`/api/documents/${fakeId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(404);
        expect(res.body.error.code).to.equal("NOT_FOUND");
    });

    // Authorization: cannot delete another user's document
    it("should return 404 NOT_FOUND when document belongs to another user", async () => {
        const { token: otherToken } = await createUserAndToken({
            email: "other.user@example.com",
        });

        const res = await request(app)
            .delete(`/api/documents/${documentId}`)
            .set("Authorization", `Bearer ${otherToken}`);

        expect(res.status).to.equal(404);
        expect(res.body.error.code).to.equal("NOT_FOUND");
    });

    // Authentication enforcement
    it("should return 401 AUTH_INVALID_TOKEN without a token", async () => {
        const res = await request(app).delete(`/api/documents/${documentId}`);

        expect(res.status).to.equal(401);
        expect(res.body.error.code).to.equal("AUTH_INVALID_TOKEN");
    });
});
