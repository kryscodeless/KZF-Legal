const { z } = require("zod");

const CitationSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  source: z.enum(["vector", "web"]),
  url: z.string().url().optional(),
  snippet: z.string().min(1),
  documentRef: z.string().nullable().optional(),
});

const SubmitQueryInputSchema = z.object({
  userId: z.string().min(1),
  question: z.string().min(5),
  documentIds: z.array(z.string()).optional(),
});

const SubmitQueryResponseSchema = z.object({
  answer: z.string().min(1),
  citations: z.array(CitationSchema),
  meta: z.object({
    latencyMs: z.number().int().nonnegative(),
    model: z.string(),
    retrieval: z.object({
      vectorHits: z.number().int().nonnegative(),
      webHits: z.number().int().nonnegative(),
    }),
  }),
});

const IngestDocumentInputSchema = z.object({
  userId: z.string().min(1),
  documentId: z.string().min(1),
  filePath: z.string().min(1),
  mimeType: z.string().optional(),
  filename: z.string().optional(),
});

const IngestDocumentResponseSchema = z.object({
  chunks: z.number().int().nonnegative(),
  meta: z.object({
    ingestMs: z.number().int().nonnegative(),
  }),
});

const RemoveDocumentInputSchema = z.object({
  userId: z.string().min(1),
  documentId: z.string().min(1),
});

const RemoveDocumentResponseSchema = z.object({
  removed: z.number().int().nonnegative(),
});

module.exports = {
  CitationSchema,
  SubmitQueryInputSchema,
  SubmitQueryResponseSchema,
  IngestDocumentInputSchema,
  IngestDocumentResponseSchema,
  RemoveDocumentInputSchema,
  RemoveDocumentResponseSchema,
};
