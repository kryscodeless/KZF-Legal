const mongoose = require("mongoose");
const Chat = require("../models/Chat");
const Message = require("../models/Message");
const logger = require("../utils/logger");
const config = require("../config/env");
const ragService = require("../../rag/index");

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const createChat = async (userId, title) => {
  const chat = await Chat.create({
    user: userId,
    title: title ?? "New Chat",
    lastMessageAt: Date.now(),
  });

  const chatId = chat._id;

  return chatId;
};

const createPendingMessage = async (userId, query, chatId, documentIds) => {
  // Validate ObjectId format before querying
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    const error = new Error("Invalid chatId format");
    error.status = 404;
    error.code = "NOT_FOUND";
    throw error;
  }

  // Attempt to find the chat in the database by ID
  const chat = await Chat.findById(chatId);

  // chatId was provided but no matching chat exists
  if (!chat || chat.user.toString() !== userId) {
    const error = new Error("Chat not found");
    error.status = 404;
    error.code = "NOT_FOUND";
    throw error;
  }

  // Chat exists — update lastMessageAt
  await Chat.findByIdAndUpdate(chatId, { lastMessageAt: Date.now() });

  // Create message shell with status "pending". This allows the UI to show a loading state while the query is being processed.
  const message = await Message.create({
    chat: chatId,
    user: userId,
    query: query,
    response: { answer: "", citations: [] },
    documents: documentIds || [],
    status: "pending",
  });

  const messageId = message._id;

  return messageId;
};

const processQuery = async (query, messageId, userId, documentIds, io) => {
  try {
    // Call the RAG service to process the query and retrieve an answer along with any relevant citations.
    const ragResult = await ragService.submitQuery({ userId, question: query, documentIds: documentIds.map((id) => id.toString()) });

    // Update the message in DB
    await Message.findByIdAndUpdate(
      messageId,
      {
        response: {
          answer: ragResult.answer,
          citations: ragResult.citations,
        },
        status: "completed",
      },
      { runValidators: true },
    );

    // Emit to the user's socket room
    io.to(`user:${userId}`).emit("chat:update", {
      messageId: messageId,
      response: {
        answer: ragResult.answer,
        citations: ragResult.citations,
      },
      status: "completed",
    });
  } catch (err) {
    // If there's an error during processing, update the message status to "failed" and emit a failed event to the client.
    logger.error(`processQuery error for messageId ${messageId}:`, err);
    try {
      await Message.findByIdAndUpdate(
        messageId,
        { status: "failed" },
        { runValidators: true },
      );
    } catch (updateErr) {
      logger.error(
        `Failed to update message status to failed for messageId ${messageId}:`,
        updateErr,
      );
    }

    io.to(`user:${userId}`).emit("chat:update", {
      messageId: messageId,
      status: "failed",
      error:
        "An error occurred while processing your query. Please try again later.",
    });
  }
};

// List all chat chats for a user, paginated and sorted by recent activity.
const listAllChats = async (
  userId,
  page = DEFAULT_PAGE,
  limit = DEFAULT_LIMIT,
) => {
  // Sanitize and validate pagination parameters to prevent abuse and ensure reasonable defaults.
  const safePage = Math.max(parseInt(page, 10) || DEFAULT_PAGE, 1);
  const safeLimit = Math.min(
    Math.max(parseInt(limit, 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );
  const skip = (safePage - 1) * safeLimit;

  // Filter chats by user ID to ensure users only see their own chat history.
  const filter = { user: userId };

  // Use Promise.all to execute both queries in parallel for better performance.
  const [chats, total] = await Promise.all([
    Chat.find(filter)
      .select("_id title lastMessageAt createdAt updatedAt")
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    Chat.countDocuments(filter),
  ]);

  // Return the paginated list of chats along with pagination metadata for client-side handling.
  return {
    chats,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
};

// Retrieve a chat chat by its ID, including all messages sorted by creation time.
const getChatById = async (userId, chatId) => {
  // Validate chatId format before querying the database to prevent unnecessary queries and potential errors.
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    const error = new Error("Chat not found");
    error.status = 404;
    error.code = "NOT_FOUND";
    throw error;
  }

  // Single query enforces ownership atomically at the DB level.
  const chat = await Chat.findOne({
    _id: chatId,
    user: userId,
  }).lean();

  // If no chat is found, it means either the chat doesn't exist or doesn't belong to the user.
  if (!chat) {
    const error = new Error("Chat not found");
    error.status = 404;
    error.code = "NOT_FOUND";
    throw error;
  }

  // Retrieve all messages for the chat, sorted by creation time to maintain conversation flow.
  const messages = await Message.find({ chat: chat._id })
    .sort({ createdAt: 1 })
    .lean();

  // Return the chat data along with its messages to the controller for response formatting.
  return { ...chat, messages };
};

const deleteChatById = async (userId, chatId) => {
  // Validate chatId format before querying the database to prevent unnecessary queries and potential errors.
  if (!mongoose.Types.ObjectId.isValid(chatId)) {
    const error = new Error("Chat not found");
    error.status = 404;
    error.code = "NOT_FOUND";
    throw error;
  }

  // Message deletion is handled by the ChatSchema post middleware
  const deletedChat = await Chat.findOneAndDelete({
    _id: chatId,
    user: userId,
  });

  // If no chat was deleted, it means either the chat doesn't exist or doesn't belong to the user.
  if (!deletedChat) {
    const error = new Error("Chat not found");
    error.status = 404;
    error.code = "NOT_FOUND";
    throw error;
  }
};

module.exports = {
  createChat,
  createPendingMessage,
  processQuery,
  listAllChats,
  getChatById,
  deleteChatById,
};