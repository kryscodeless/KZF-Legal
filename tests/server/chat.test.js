const expect = require("chai").expect;
const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../../server/app");
const { createUserAndToken } = require("./helpers/mockAuth");
const sinon = require("sinon");
const ragService = require("../../rag/index");
const { createFakeIo } = require("./helpers/fakeSocket");

// Create a chat and return its ID
const createChat = async (token, title = "Test Chat") => {
    const res = await request(app)
        .post("/api/chat/create")
        .set("Authorization", `Bearer ${token}`)
        .send({ title });

    return res.body.data.chatId;
};

// Chat creation test
describe("POST /api/chat/create", () => {
    let token;

    beforeEach(async () => {
        ({ token } = await createUserAndToken());
    });

    // Standard successful chat creation - should return a chatId
    it("should create a new chat and return 201 with a chatId", async () => {
        const res = await request(app)
            .post("/api/chat/create")
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "Skilled Worker Visa Query" });

        expect(res.status).to.equal(201);
        expect(res.body.success).to.be.true;
        expect(res.body.data).to.have.property("chatId");
        expect(mongoose.Types.ObjectId.isValid(res.body.data.chatId)).to.be.true;
    });

    // Title is optional - should default when omitted
    it("should create a chat with default title when title is omitted", async () => {
        const res = await request(app)
            .post("/api/chat/create")
            .set("Authorization", `Bearer ${token}`)
            .send({});

        expect(res.status).to.equal(201);
        expect(res.body.data).to.have.property("chatId");
    });

    // Title length validation - should reject titles over 100 characters
    it("should return 400 VALIDATION_ERROR when title exceeds 100 characters", async () => {
        const res = await request(app)
            .post("/api/chat/create")
            .set("Authorization", `Bearer ${token}`)
            .send({ title: "a".repeat(101) });

        expect(res.status).to.equal(400);
        expect(res.body.error.code).to.equal("VALIDATION_ERROR");
    });

    // Authentication enforcement
    it("should return 401 AUTH_INVALID_TOKEN when no token is provided", async () => {
        const res = await request(app)
            .post("/api/chat/create")
            .send({ title: "Test" });

        expect(res.status).to.equal(401);
        expect(res.body.error.code).to.equal("AUTH_INVALID_TOKEN");
    });

    it("should return 401 AUTH_INVALID_TOKEN with a malformed token", async () => {
        const res = await request(app)
            .post("/api/chat/create")
            .set("Authorization", "Bearer not.a.real.token")
            .send({ title: "Test" });

        expect(res.status).to.equal(401);
        expect(res.body.error.code).to.equal("AUTH_INVALID_TOKEN");
    });
});

// Query submission tests
describe("POST /api/chat/:chatId", () => {
    let token;
    let chatId;
    let ragStub;
    let fakeIo;

    beforeEach(async () => {
        // Create a user and a chat for testing query submissions
        ({ token } = await createUserAndToken());
        chatId = await createChat(token);

        // Wire a fake Socket.io into the Express app for this test
        fakeIo = createFakeIo();
        app.set("io", fakeIo);

        // Stub the RAG call so processQuery doesn't hit external services during tests.
        ragStub = sinon.stub(ragService, "submitQuery").resolves({
            answer: "Stubbed answer.",
            citations: [
                {
                    id: 1,
                    title: "Stub citation",
                    source: "web",
                    url: "https://example.com",
                    snippet: "stubbed snippet",
                },
            ],
        });
    });

    afterEach(() => {
        // Restore the original RAG function after each test
        ragStub.restore();
        // Remove the fake Socket.io from the app to avoid side effects on other tests
        app.set("io", undefined);
    });

    // Standard successful query submission - should return 202 with a pending messageId
    it("should accept a query and return 202 with a pending messageId", async () => {
        const res = await request(app)
            .post(`/api/chat/${chatId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                query: "What are the English language requirements for a Skilled Worker visa?",
                documentIds: [],
            });

        expect(res.status).to.equal(202);
        expect(res.body.success).to.be.true;
        expect(res.body.data).to.have.property("messageId");
        expect(res.body.data.status).to.equal("pending");
        expect(mongoose.Types.ObjectId.isValid(res.body.data.messageId)).to.be.true;
    });

    // documentIds is optional and defaults to empty array
    it("should accept a query without documentIds", async () => {
        const res = await request(app)
            .post(`/api/chat/${chatId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ query: "Test query" });

        expect(res.status).to.equal(202);
        expect(res.body.data.status).to.equal("pending");
    });

    // Validation: query is required
    it("should return 400 VALIDATION_ERROR when query is missing", async () => {
        const res = await request(app)
            .post(`/api/chat/${chatId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({});

        expect(res.status).to.equal(400);
        expect(res.body.error.code).to.equal("VALIDATION_ERROR");
    });

    it("should return 400 VALIDATION_ERROR when query is empty string", async () => {
        const res = await request(app)
            .post(`/api/chat/${chatId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ query: "" });

        expect(res.status).to.equal(400);
        expect(res.body.error.code).to.equal("VALIDATION_ERROR");
    });

    it("should return 400 VALIDATION_ERROR when query exceeds 2000 characters", async () => {
        const res = await request(app)
            .post(`/api/chat/${chatId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ query: "a".repeat(2001) });

        expect(res.status).to.equal(400);
        expect(res.body.error.code).to.equal("VALIDATION_ERROR");
    });

    // Validation: chatId must be a valid ObjectId
    it("should return 400 VALIDATION_ERROR when chatId is not a valid ObjectId", async () => {
        const res = await request(app)
            .post("/api/chat/not-a-valid-id")
            .set("Authorization", `Bearer ${token}`)
            .send({ query: "Test query" });

        expect(res.status).to.equal(400);
        expect(res.body.error.code).to.equal("VALIDATION_ERROR");
    });

    // Validation: documentIds must contain valid ObjectIds
    it("should return 400 VALIDATION_ERROR when documentIds contains an invalid ObjectId", async () => {
        const res = await request(app)
            .post(`/api/chat/${chatId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ query: "Test query", documentIds: ["not-valid"] });

        expect(res.status).to.equal(400);
        expect(res.body.error.code).to.equal("VALIDATION_ERROR");
    });

    // Authorization: user cannot post to another user's chat
    it("should return 404 NOT_FOUND when chat belongs to another user", async () => {
        const { token: otherToken } = await createUserAndToken({
            email: "other.user@example.com",
        });

        const res = await request(app)
            .post(`/api/chat/${chatId}`)
            .set("Authorization", `Bearer ${otherToken}`)
            .send({ query: "Trying to access another user's chat" });

        expect(res.status).to.equal(404);
        expect(res.body.error.code).to.equal("NOT_FOUND");
    });

    // Non-existent but valid ObjectId
    it("should return 404 NOT_FOUND when chatId does not exist", async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();

        const res = await request(app)
            .post(`/api/chat/${fakeId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ query: "Test query" });

        expect(res.status).to.equal(404);
        expect(res.body.error.code).to.equal("NOT_FOUND");
    });

    // Authentication enforcement
    it("should return 401 AUTH_INVALID_TOKEN without a token", async () => {
        const res = await request(app)
            .post(`/api/chat/${chatId}`)
            .send({ query: "Test query" });

        expect(res.status).to.equal(401);
        expect(res.body.error.code).to.equal("AUTH_INVALID_TOKEN");
    });
});

// Chat listing tests
describe("GET /api/chat/", () => {
    let token;

    beforeEach(async () => {
        ({ token } = await createUserAndToken());
    });

    // Empty list when no chats exist
    it("should return 200 with an empty array when the user has no chats", async () => {
        const res = await request(app)
            .get("/api/chat/")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(200);
        expect(res.body.success).to.be.true;
        expect(res.body.data.chats).to.be.an("array").that.is.empty;
        expect(res.body.data.pagination).to.have.property("total", 0);
    });

    // Standard list - should return all the user's chats with pagination metadata
    it("should return 200 with the user's chats and pagination metadata", async () => {
        await createChat(token, "Chat 1");
        await createChat(token, "Chat 2");
        await createChat(token, "Chat 3");

        const res = await request(app)
            .get("/api/chat/")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(200);
        expect(res.body.data.chats).to.have.lengthOf(3);
        expect(res.body.data.pagination).to.include.keys(
            "page",
            "limit",
            "total",
            "totalPages"
        );
        expect(res.body.data.pagination.total).to.equal(3);
    });

    // Pagination - respects page and limit query parameters
    it("should respect page and limit query parameters", async () => {
        for (let i = 0; i < 5; i++) {
            await createChat(token, `Chat ${i}`);
        }

        const res = await request(app)
            .get("/api/chat/?page=1&limit=2")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(200);
        expect(res.body.data.chats).to.have.lengthOf(2);
        expect(res.body.data.pagination.page).to.equal(1);
        expect(res.body.data.pagination.limit).to.equal(2);
        expect(res.body.data.pagination.total).to.equal(5);
        expect(res.body.data.pagination.totalPages).to.equal(3);
    });

    // Isolation - users only see their own chats
    it("should not return chats belonging to other users", async () => {
        await createChat(token, "My Chat");

        const { token: otherToken } = await createUserAndToken({
            email: "other.user@example.com",
        });
        await createChat(otherToken, "Their Chat");

        const res = await request(app)
            .get("/api/chat/")
            .set("Authorization", `Bearer ${token}`);

        expect(res.body.data.chats).to.have.lengthOf(1);
        expect(res.body.data.chats[0].title).to.equal("My Chat");
    });

    // Validation: invalid pagination params
    it("should return 400 VALIDATION_ERROR when page is not a positive integer", async () => {
        const res = await request(app)
            .get("/api/chat/?page=abc")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(400);
        expect(res.body.error.code).to.equal("VALIDATION_ERROR");
    });

    it("should return 400 VALIDATION_ERROR when limit exceeds 50", async () => {
        const res = await request(app)
            .get("/api/chat/?limit=999")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(400);
        expect(res.body.error.code).to.equal("VALIDATION_ERROR");
    });

    // Authentication enforcement
    it("should return 401 AUTH_INVALID_TOKEN without a token", async () => {
        const res = await request(app).get("/api/chat/");

        expect(res.status).to.equal(401);
        expect(res.body.error.code).to.equal("AUTH_INVALID_TOKEN");
    });
});

// Chat retrieval tests
describe("GET /api/chat/:chatId", () => {
    let token;
    let chatId;

    beforeEach(async () => {
        ({ token } = await createUserAndToken());
        chatId = await createChat(token, "Visa Application Help");
    });

    // Standard retrieval - returns chat with messages array
    it("should return 200 with the chat and its messages", async () => {
        const res = await request(app)
            .get(`/api/chat/${chatId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(200);
        expect(res.body.success).to.be.true;
        expect(res.body.data.chat).to.have.property("_id", chatId);
        expect(res.body.data.chat).to.have.property("title", "Visa Application Help");
        expect(res.body.data.chat.messages).to.be.an("array");
    });

    // Should include any messages submitted to the chat
    it("should include messages submitted to the chat", async () => {
        await request(app)
            .post(`/api/chat/${chatId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ query: "What are the visa requirements?" });

        const res = await request(app)
            .get(`/api/chat/${chatId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.body.data.chat.messages).to.have.lengthOf(1);
        expect(res.body.data.chat.messages[0].query).to.equal(
            "What are the visa requirements?"
        );
    });

    // Validation: chatId must be a valid ObjectId
    it("should return 400 VALIDATION_ERROR when chatId is not a valid ObjectId", async () => {
        const res = await request(app)
            .get("/api/chat/not-an-id")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(400);
        expect(res.body.error.code).to.equal("VALIDATION_ERROR");
    });

    // Non-existent chatId
    it("should return 404 NOT_FOUND when chat does not exist", async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();

        const res = await request(app)
            .get(`/api/chat/${fakeId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(404);
        expect(res.body.error.code).to.equal("NOT_FOUND");
    });

    // Authorization: cannot retrieve another user's chat
    it("should return 404 NOT_FOUND when chat belongs to another user", async () => {
        const { token: otherToken } = await createUserAndToken({
            email: "other.user@example.com",
        });

        const res = await request(app)
            .get(`/api/chat/${chatId}`)
            .set("Authorization", `Bearer ${otherToken}`);

        expect(res.status).to.equal(404);
        expect(res.body.error.code).to.equal("NOT_FOUND");
    });

    // Authentication enforcement
    it("should return 401 AUTH_INVALID_TOKEN without a token", async () => {
        const res = await request(app).get(`/api/chat/${chatId}`);

        expect(res.status).to.equal(401);
        expect(res.body.error.code).to.equal("AUTH_INVALID_TOKEN");
    });
});

// Chat deletion tests
describe("DELETE /api/chat/:chatId", () => {
    let token;
    let chatId;
    let ragStub;
    let fakeIo;

    beforeEach(async () => {
        // Create a user and a chat for testing deletion
        ({ token } = await createUserAndToken());
        chatId = await createChat(token);

        // Wire a fake Socket.io into the Express app for this test
        fakeIo = createFakeIo();
        app.set("io", fakeIo);

        // Stub the RAG call so processQuery doesn't hit external services during tests.
        ragStub = sinon.stub(ragService, "submitQuery").resolves({
            answer: "Stubbed answer.",
            citations: [
                {
                    id: 1,
                    title: "Stub citation",
                    source: "web",
                    url: "https://example.com",
                    snippet: "stubbed snippet",
                },
            ],
        });
    });

    afterEach(() => {
        // Restore the original RAG function after each test
        ragStub.restore();
        // Remove the fake Socket.io from the app to avoid side effects on other tests
        app.set("io", undefined);
    });

    // Standard successful deletion
    it("should delete the chat and return 200", async () => {
        const res = await request(app)
            .delete(`/api/chat/${chatId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(200);
        expect(res.body.success).to.be.true;
    });

    // Verify the chat is actually gone after deletion
    it("should make the chat inaccessible after deletion", async () => {
        await request(app)
            .delete(`/api/chat/${chatId}`)
            .set("Authorization", `Bearer ${token}`);

        const res = await request(app)
            .get(`/api/chat/${chatId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(404);
        expect(res.body.error.code).to.equal("NOT_FOUND");
    });

    // Deleting a chat should also remove its messages
    it("should also delete associated messages", async () => {
        await request(app)
            .post(`/api/chat/${chatId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ query: "Test query" });

        // Wait a moment to ensure the message is fully processed and available for deletion
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await request(app)
            .delete(`/api/chat/${chatId}`)
            .set("Authorization", `Bearer ${token}`);

        // Re-creating a chat and getting it should show no messages
        const newChatId = await createChat(token);
        const res = await request(app)
            .get(`/api/chat/${newChatId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.body.data.chat.messages).to.be.an("array").that.is.empty;
    });

    // Validation: chatId must be a valid ObjectId
    it("should return 400 VALIDATION_ERROR when chatId is not a valid ObjectId", async () => {
        const res = await request(app)
            .delete("/api/chat/invalid-id")
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(400);
        expect(res.body.error.code).to.equal("VALIDATION_ERROR");
    });

    // Non-existent chatId
    it("should return 404 NOT_FOUND when chat does not exist", async () => {
        const fakeId = new mongoose.Types.ObjectId().toString();

        const res = await request(app)
            .delete(`/api/chat/${fakeId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(res.status).to.equal(404);
        expect(res.body.error.code).to.equal("NOT_FOUND");
    });

    // Authorization: cannot delete another user's chat
    it("should return 404 NOT_FOUND when chat belongs to another user", async () => {
        const { token: otherToken } = await createUserAndToken({
            email: "other.user@example.com",
        });

        const res = await request(app)
            .delete(`/api/chat/${chatId}`)
            .set("Authorization", `Bearer ${otherToken}`);

        expect(res.status).to.equal(404);
        expect(res.body.error.code).to.equal("NOT_FOUND");
    });

    // Authentication enforcement
    it("should return 401 AUTH_INVALID_TOKEN without a token", async () => {
        const res = await request(app).delete(`/api/chat/${chatId}`);

        expect(res.status).to.equal(401);
        expect(res.body.error.code).to.equal("AUTH_INVALID_TOKEN");
    });
});