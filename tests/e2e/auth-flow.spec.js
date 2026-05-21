const { test, expect } = require("@playwright/test");

function uniqueEmail(prefix = "e2e") {
    return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 100000)}@example.com`;
}

test("user can register, logout, fail login with wrong password, login, and logout again", async ({ page }) => {
    const email = uniqueEmail("auth-flow");
    const password = "SecurePass123!";
    const wrongPassword = "WrongPass456!";

    // 1) Open the app and switch to the registration view.
    await page.goto("/");
    await page.click("#link-to-register");
    await expect(page.locator("#reg-email")).toBeVisible();

    // 2) Register a brand-new account.
    await page.fill("#reg-email", email);
    await page.fill("#reg-password", password);
    await page.click("#btn-register");

    // 3) After registration the app returns to the login view — log in.
    await page.fill("#login-email", email);
    await page.fill("#login-password", password);
    await page.click("#btn-login");

    // 4) The app shell becomes visible once authenticated.
    await expect(page.locator("#app-shell")).toBeVisible();

    // 5) Verify the user is actually logged in by navigating to a protected page.
    await page.click('.sb-item[data-page="chat"]');
    await expect(page.locator("#page-chat")).toBeVisible();

    // 6) Logout via the sidebar logout control.
    await page.click("#btn-logout");

    // 7) After logout, the login form should be visible again and the shell hidden.
    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.locator("#app-shell")).toBeHidden();

    // 8) Attempt to log in with the WRONG password — should be rejected.
    await page.fill("#login-email", email);
    await page.fill("#login-password", wrongPassword);
    await page.click("#btn-login");

    // App shell must NOT appear; the login form remains, optionally with an error toast.
    await expect(page.locator("#app-shell")).toBeHidden();
    await expect(page.locator("#login-email")).toBeVisible();

    // 9) Log in correctly with the original password.
    await page.fill("#login-email", email);
    await page.fill("#login-password", password);
    await page.click("#btn-login");

    // 10) App shell visible again — second login on same account works.
    await expect(page.locator("#app-shell")).toBeVisible();

    // 11) Final logout — confirm clean teardown.
    await page.click("#btn-logout");
    await expect(page.locator("#login-email")).toBeVisible();
    await expect(page.locator("#app-shell")).toBeHidden();
});

test("registration with mismatched/short password is rejected by the form", async ({ page }) => {
    const email = uniqueEmail("auth-weak");

    await page.goto("/");
    await page.click("#link-to-register");

    // Try to register with a password too short to satisfy backend validation (min 8 chars).
    await page.fill("#reg-email", email);
    await page.fill("#reg-password", "short");
    await page.click("#btn-register");

    // The registration must NOT succeed — the registration form should still be visible
    // and the app shell should not appear.
    await expect(page.locator("#app-shell")).toBeHidden();
    await expect(page.locator("#reg-email")).toBeVisible();
});

test("logging in with a non-existent account is rejected", async ({ page }) => {
    const email = uniqueEmail("never-registered");
    const password = "SecurePass123!";

    await page.goto("/");

    // Skip registration — go straight to login with an email that was never registered.
    await page.fill("#login-email", email);
    await page.fill("#login-password", password);
    await page.click("#btn-login");

    // App shell must not appear.
    await expect(page.locator("#app-shell")).toBeHidden();
    await expect(page.locator("#login-email")).toBeVisible();
});

test("registering the same email twice is rejected", async ({ page }) => {
    const email = uniqueEmail("dup-register");
    const password = "SecurePass123!";

    // First registration succeeds.
    await page.goto("/");
    await page.click("#link-to-register");
    await page.fill("#reg-email", email);
    await page.fill("#reg-password", password);
    await page.click("#btn-register");

    // Login flow appears — log in to confirm registration worked.
    await page.fill("#login-email", email);
    await page.fill("#login-password", password);
    await page.click("#btn-login");
    await expect(page.locator("#app-shell")).toBeVisible();

    // Logout and try to register the same email again.
    await page.click("#btn-logout");
    await page.click("#link-to-register");
    await page.fill("#reg-email", email);
    await page.fill("#reg-password", password);
    await page.click("#btn-register");

    // Duplicate registration should NOT auto-login — the app shell must stay hidden.
    await expect(page.locator("#app-shell")).toBeHidden();
    await expect(page.locator("#reg-email")).toBeVisible();
});
