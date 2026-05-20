# E2E Execution Checklist

## Step 1: Freeze Contract
- [ ] Confirm `E2E_TEST_PLAN.md` and `E2E_CONTRACT.md` are final.
- [ ] No scope expansion beyond this single flow.

## Step 2: Domain Owner Readiness
- [ ] FE confirms selectors/UI states in contract are stable.
- [ ] BE confirms auth/upload/chat happy path is stable.
- [ ] RAG confirms fixture + fixed question returns answer + citation.

## Step 3: Test Owner Implementation
- [ ] Add Playwright config at `tests/e2e/playwright.config.js`.
- [ ] Add one E2E spec at `tests/e2e/upload-ask.spec.js`.
- [ ] Keep assertions exactly aligned with contract pass checks.

## Step 4: Validation
- [ ] Run E2E locally at least 3 times.
- [ ] Collect failure screenshots/traces if test fails.
- [ ] Open issues to FE/BE/RAG owner based on failure location.

## Step 5: CI
- [ ] Add/confirm CI command for single E2E test.
- [ ] Ensure CI saves failure artifacts.

## Done Criteria
- [ ] Single E2E test passes locally.
- [ ] Single E2E test passes in CI.
