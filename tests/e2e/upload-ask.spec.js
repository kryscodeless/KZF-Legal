const path = require("path");
const { test, expect } = require("@playwright/test");

const FIXTURE_PATH = path.resolve(
  __dirname,
  "../../rag/corpus/Subclass_500_Student_visa.pdf",
);
const QUESTION = "What are the key student visa requirements in this document?";

function uniqueEmail(prefix = "e2e") {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 100000)}@example.com`;
}

test("user uploads document and asks question", async ({ page }) => {
  const email = uniqueEmail("upload-ask");
  const password = "SecurePass123!";

  // 1) Register or log in through the UI.
  await page.goto("/");
  await page.click("#link-to-register");
  await page.fill("#reg-email", email);
  await page.fill("#reg-password", password);
  await page.click("#btn-register");

  await page.fill("#login-email", email);
  await page.fill("#login-password", password);
  await page.click("#btn-login");
  await expect(page.locator("#app-shell")).toBeVisible();

  // 2) Open the Chat page.
  await page.click('.sb-item[data-page="chat"]');
  await expect(page.locator("#page-chat")).toBeVisible();

  // 3-4) Upload fixture and wait for upload-ready state.
  await page.setInputFiles("#chat-file-input", FIXTURE_PATH);
  await expect(page.locator("#attach-chips-row .attach-chip").first()).toContainText(
    "Subclass_500_Student_visa.pdf",
    { timeout: 30_000 },
  );

  // 5) Ask question aligned to uploaded document.
  await page.fill("#chat-input", QUESTION);
  await page.click("#chat-send-btn");

  // 6) Assert AI reply appears.
  const aiRow = page.locator("#chat-messages .msg-row.ai").last();
  await expect(aiRow).toBeVisible({ timeout: 90_000 });

  // Broad keyword assertion (not exact full answer).
  await expect(aiRow).toContainText(/(visa|student|requirement|application|document)/i);

  // 7) Assert citation/source element appears.
  await expect(aiRow.locator(".citations-block .citations-item").first()).toBeVisible({
    timeout: 30_000,
  });
});
