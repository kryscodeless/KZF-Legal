const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Document = require("../models/Document");
const config = require("../config/env");
const Chat = require("../models/Chat");
const { fromFile } = require("file-type");
const logger = require("../utils/logger");
const { ALLOWED_MIME_TYPES } = require("../middleware/upload");
const ragService = require("../../rag/index");

// Detect duplicate documents by computing a checksum of the file content
const _computeChecksum = (filePath) =>
  new Promise((resolve, reject) => {
    // Use a streaming approach to compute the checksum for large files without loading them entirely into memory
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });

// Move the file from temporary storage to permanent storage and return the new URL
const _moveToPermStorage = async (tmpPath, filename) => {
  const destDir = path.join(__dirname, "../uploads/documents");
  fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, filename);
  await fs.promises.rename(tmpPath, destPath);
  return `/uploads/documents/${filename}`;
};

// File deletion utility to remove files from disk
const _deleteFileFromDisk = async (relativeStorageUrl) => {
  const absolutePath = path.join(__dirname, "..", relativeStorageUrl);
  try {
    await fs.promises.unlink(absolutePath);
  } catch (err) {
    logger.warn(
      { err, storageUrl: relativeStorageUrl },
      "Could not delete file from disk — it may have already been removed",
    );
  }
};

const createDocument = async (file, userId, chatId) => {
  const tmpPath = file.path;
  try {
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

    // Perform server-side file type detection using the file-type library, which reads the file's magic numbers to determine its true type
    let detectedType = await fromFile(tmpPath);

    // Fallback for .txt files
    if (!detectedType && path.extname(tmpPath).toLowerCase() === ".txt") {
      detectedType = {
        mime: "text/plain",
        ext: "txt",
      };
    }

    // Definitive file type check, the fileFilter in upload.js is a preliminary gate based on the client-reported Content-Type.
    if (!detectedType || !ALLOWED_MIME_TYPES.has(detectedType.mime)) {
      const error = new Error(
        `File content does not match an allowed type. Detected: ${detectedType?.mime ?? "unknown"}`,
      );
      error.status = 415;
      error.code = "UNSUPPORTED_FILE_TYPE";
      throw error;
    }

    // Compute a hashed checksum of the file content
    const checksum = await _computeChecksum(tmpPath);
    // Duplicate detection using hashed checksum
    const duplicate = await Document.findOne({
      user: userId,
      chat: chatId,
      checksum,
    });
    if (duplicate) {
      const error = new Error("Duplicate document detected");
      error.status = 409;
      error.code = "DOCUMENT_ALREADY_EXISTS";
      throw error;
    }

    // Move file to permanent storage
    const storageUrl = await _moveToPermStorage(tmpPath, file.filename);

    // Create document record in database
    const document = await Document.create({
      user: userId,
      chat: chatId,
      filename: file.originalname,
      mimeType: detectedType.mime,
      size: file.size,
      storageUrl,
      checksum,
      status: "pending",
    });

    return document;
  } catch (err) {
    // Clean up the temp file in case of any error to prevent orphaned files consuming disk space
    try {
      await fs.promises.unlink(tmpPath);
    } catch (cleanupErr) {
      logger.warn(
        { err: cleanupErr, tmpPath },
        "Failed to clean up temporary file after error",
      );
    }
    throw err;
  }
};

const processDocument = async (documentId, userId, file_path, mimeType, io) => {
  try {
    const filePath = path.join(__dirname, "..", file_path);
    // Ingest the document into the RAG pipeline to extract text, generate embeddings, and make it available for querying.
    const result = await ragService.ingestDocument({ userId, documentId: documentId.toString(), filePath, mimeType });
    // Persist the extracted summary and mark as fully ingested
    await Document.findByIdAndUpdate(documentId, {
      extractedSummary: result.extractedSummary,
      status: "ingested",
    });

    // Notify the client that the document is ready to be used in queries
    io.to(`user:${userId}`).emit("document:update", {
      documentId: documentId,
      extractedSummary: result.extractedSummary,
      status: "ingested",
    });
  } catch (err) {
    // Log the error with contextual information for easier debugging
    logger.error(`processDocument error for documentId ${documentId}:`, err);

    try {
      // Update the document status to "failed" and store the error message for debugging purposes.
      await Document.findByIdAndUpdate(documentId, {
        status: "failed",
        errorMessage: err.message,
      });
    } catch (updateErr) {
      // If updating the document status also fails, log that error as well.
      logger.error(
        `Failed to update document status to failed for documentId ${documentId}:`,
        updateErr,
      );
    }

    // Emit the failure event to the client so they can inform the user and potentially allow them to retry or delete the document.
    io.to(`user:${userId}`).emit("document:update", {
      documentId: documentId,
      status: "failed",
      error:
        "An error occurred while processing the document. Please try again later.",
    });
  }
};

// Remove a document, ensuring that only the owner can delete it and that the file is removed from disk
const removeDocument = async (documentId, userId, chatId) => {
  // Verify that the document exists and belongs to the user before attempting deletion
  const document = await Document.findOne({ _id: documentId, user: userId });

  // If the document doesn't exist or doesn't belong to the user, return a 404 Not Found error to prevent unauthorized access
  if (!document) {
    const error = new Error("Document not found");
    error.status = 404;
    error.code = "NOT_FOUND";
    throw error;
  }

  // Delete the file from disk
  await _deleteFileFromDisk(document.storageUrl);

  // Remove the document record from the database
  await Document.deleteOne({ _id: documentId });

  // Pass the documentId and ChatId to the RAG service to allow it to clean up any associated vector embeddings
  // await ragService.removeDocument({ documentId, chatId });
};

// Retrieve all documents for a user, excluding sensitive fields like storageUrl and extractedSummary
const getDocumentsByUser = async (userId) => {
  return Document.find({ user: userId })
    .select("-storageUrl -extractedSummary -checksum")
    .sort({ createdAt: -1 });
};

// Retrieve all documents for a specific chat, which can be used to show the documents
const getDocumentsByChat = async (userId, chatId) => {
  return Document.find({ chat: chatId, user: userId })
    .select("-storageUrl -extractedSummary -checksum")
    .sort({ createdAt: -1 });
};

module.exports = {
  createDocument,
  processDocument,
  removeDocument,
  getDocumentsByUser,
  getDocumentsByChat,
};
