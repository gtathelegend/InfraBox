import { expect, test, type Page } from "@playwright/test";

async function loginAndLoadDashboard(page: Page) {
  await page.goto("/auth");
  await page.getByTestId("continue-workspace-btn").click();
  await expect(page).toHaveURL(/connect-repository/);

  await expect(page.getByTestId("repo-option-0")).toBeVisible();
  await page.getByTestId("repo-option-0").click();

  const analyzeRequest = page.waitForResponse((response) =>
    response.url().includes("/analyze") && response.request().method() === "POST",
  );
  await page.getByTestId("analyze-repo-btn").click();
  expect((await analyzeRequest).ok()).toBeTruthy();

  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.evaluate(() => {
    window.localStorage.setItem("infrabox.workspaceId", "1");
  });
}

async function recoverFromConnectRepository(page: Page) {
  const connectHeading = page.getByRole("heading", { name: "Connect Repository" });
  const onConnectPage = await connectHeading.isVisible({ timeout: 1500 }).catch(() => false);
  if (!onConnectPage) return;

  await expect(page.getByTestId("repo-option-0")).toBeVisible();
  await page.getByTestId("repo-option-0").click();

  const analyzeRequest = page.waitForResponse((response) =>
    response.url().includes("/analyze") && response.request().method() === "POST",
  );
  await page.getByTestId("analyze-repo-btn").click();
  expect((await analyzeRequest).ok()).toBeTruthy();
  await expect(page).toHaveURL(/dashboard/);
}

test.describe.serial("Frontend-backend integration flows", () => {
  test("1) Login -> dashboard loads data", async ({ page }) => {
    const reposResponse = page.waitForResponse((response) =>
      response.url().includes("/api/repositories") && response.request().method() === "GET",
    );

    await loginAndLoadDashboard(page);

    const response = await reposResponse;
    expect(response.ok()).toBeTruthy();
    await expect(page.getByText("Active Repositories")).toBeVisible();
  });

  test("2) Connect repository -> pipelines appear", async ({ page }) => {
    await loginAndLoadDashboard(page);

    await page.getByRole("link", { name: "Pipeline" }).click();
    await recoverFromConnectRepository(page);
    await page.getByRole("link", { name: "Pipeline" }).click();

    await expect(page).toHaveURL(/\/pipeline/);
    const pipelinesResponse = page.waitForResponse((response) =>
      response.url().includes("/api/pipelines") && response.request().method() === "GET",
    );
    expect((await pipelinesResponse).ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: "Pipeline Visualizer" })).toBeVisible();
    await expect(page.getByText("CI/CD Stages")).toBeVisible();
  });

  test("3) Run simulation -> results displayed", async ({ page }) => {
    await loginAndLoadDashboard(page);

    await page.getByRole("link", { name: "Simulations" }).click();
    await recoverFromConnectRepository(page);
    await page.getByRole("link", { name: "Simulations" }).click();

    await expect(page).toHaveURL(/\/simulations/);
    const simulationResponse = page.waitForResponse((response) =>
      response.url().includes("/api/simulation") && response.request().method() === "GET",
    );
    expect((await simulationResponse).ok()).toBeTruthy();
    await expect(page.getByText("Simulation Lab")).toBeVisible();
    await expect(page.getByText("CPU usage")).toBeVisible();
    await expect(page.getByText("Memory usage")).toBeVisible();
  });

  test("4) Assistant query -> AI response returned", async ({ page }) => {
    await loginAndLoadDashboard(page);
    await page.getByRole("link", { name: "AI Assistant" }).click();
    await recoverFromConnectRepository(page);
    await page.getByRole("link", { name: "AI Assistant" }).click();

    const assistantResponse = page.waitForResponse((response) =>
      response.url().includes("/api/assistant/query") && response.request().method() === "POST",
    );

    await expect(page).toHaveURL(/\/ai-assistant/);
    await page.getByTestId("assistant-input").fill("Why did deployment fail?");
    await page.getByTestId("assistant-send-btn").click();

    expect((await assistantResponse).ok()).toBeTruthy();
    await expect(page.getByText("Payment service memory exceeded container limit.")).toBeVisible();
  });

  test("5) Deployment triggered -> status updated", async ({ page }) => {
    await loginAndLoadDashboard(page);
    await page.getByRole("link", { name: "Deployments" }).click();
    await recoverFromConnectRepository(page);
    await page.getByRole("link", { name: "Deployments" }).click();

    const deployResponse = page.waitForResponse((response) =>
      response.url().includes("/api/deploy/run") && response.request().method() === "POST",
    );

    await expect(page).toHaveURL(/\/deployments/);
    await page.getByTestId("approve-deployment-btn").click();
    expect((await deployResponse).ok()).toBeTruthy();

    await expect(page.getByTestId("deployment-status")).toContainText("running");
  });
});
