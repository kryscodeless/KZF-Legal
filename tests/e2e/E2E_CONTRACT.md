# E2E Contract (Single Flow)

## Flow Under Test
`User uploads document and asks question (happy path)`

## Locked Inputs
- Fixture file: `rag/corpus/Subclass_500_Student_visa.pdf`
- Fixed question: `What are the key student visa requirements in this document?`

## FE Contract
FE must keep these selectors and visible UI states stable:
- `#login-email`
- `#login-password`
- `#btn-login`
- `#link-to-register`
- `#reg-email`
- `#reg-password`
- `#btn-register`
- `.sb-item[data-page="chat"]`
- `#chat-file-input`
- `#attach-chips-row`
- `#chat-input`
- `#chat-send-btn`
- `#chat-messages`
- `.msg-row.ai`

FE must render:
- an upload-ready/attached file state in the chat attachment area
- an AI response row in chat
- citation/source UI element(s) in the AI response

## BE Contract
BE must keep this happy-path flow stable:
1. Register/login works from UI auth forms.
2. Document upload endpoint accepts the fixture for the active chat.
3. Chat query endpoint accepts the fixed question.
4. Chat completion is delivered to UI (including socket-driven updates where applicable).

## RAG Contract
RAG must produce a stable success output for the locked input pair:
- Non-empty answer text
- At least one citation/source in response payload consumed by FE

## Pass Checks (What Test Owner Will Assert)
1. User can register/login from UI.
2. User can open chat page.
3. Uploading `Subclass_500_Student_visa.pdf` shows attached/ready state.
4. User question is accepted and displayed in chat.
5. AI response row appears in chat.
6. AI response contains broad expected legal/visa wording.
7. At least one citation/source element is rendered.

## Timeouts
- Upload-ready UI: up to 30s
- AI response render: up to 90s

## Failure Artifacts
Test run must retain:
- screenshot on failure
- trace on failure
