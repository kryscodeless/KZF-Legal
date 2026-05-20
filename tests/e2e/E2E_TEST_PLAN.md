# E2E Test Plan

## Goal

Use one end-to-end test that validates frontend, backend, and RAG integration together.

## Test Name

`User uploads document and asks question`

## Flow

1. Register or log in through the UI.
2. Open the Chat page.
3. Upload one small known PDF fixture.
4. Wait until upload is visible/ready in UI.
5. Ask a question that the uploaded document should answer.
6. Assert AI reply appears in chat (`.msg-row.ai`).
7. Assert at least one citation/source element appears.

## Coverage Mapping

- Frontend:
  - Auth form flow
  - Upload UI flow
  - Chat input/output rendering
- Backend:
  - Auth endpoints
  - Document upload endpoint
  - Chat endpoint
  - Socket update delivery path
- RAG:
  - Document ingestion
  - Retrieval from uploaded content
  - Answer generation with citations

## Assertion Strategy

- Do not assert exact full AI text.
- Assert:
  - AI response exists
  - response contains a broad expected keyword
  - at least one citation/source is rendered
- Use explicit waits only for:
  - upload-ready state
  - AI response render

## Inputs

- Fixture: one deterministic PDF (`rag/corpus/Subclass_500_Student_visa.pdf`)
- Query: one fixed question aligned to fixture content.

## Definition of Done

- The single spec passes locally and in CI.
- Failures produce actionable logs/screenshots.
