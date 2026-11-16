import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
const requireLocal = createRequire(path.resolve("package.json"));
test("offline desktop import, conversion, selection, recoloring and undo", async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.LOCALTRACE_DEV;
  const app = await electron.launch({
    executablePath: process.env.LOCALTRACE_PACKAGED || requireLocal("electron"),
    args: process.env.LOCALTRACE_PACKAGED ? [] : ["."],
    env,
  });
  try {
    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.context().setOffline(true);
    const artwork = await requireLocal("sharp")(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="#ffffff"/><rect x="30" y="30" width="180" height="180" rx="20" fill="#e63946"/><circle cx="200" cy="200" r="80" fill="#2563eb"/></svg>',
      ),
    )
      .png()
      .toBuffer();
    await page
      .locator("input[type=file]")
      .setInputFiles({
        name: "artwork.png",
        mimeType: "image/png",
        buffer: artwork,
      });
    await expect(
      page.getByRole("button", { name: "Convert", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Convert", exact: true }).click();
    await expect(page.locator("svg path[data-id]").first()).toBeVisible({
      timeout: 30000,
    });
    await expect(page.locator(".layer")).not.toHaveCount(0);
    await page.locator(".layer-head button").first().click();
    await page.locator(".shape-row").first().click();
    await expect(
      page.getByRole("button", { name: "Duplicate selection" }),
    ).toBeVisible();
    const paths = await page.locator("svg path[data-id]").count();
    await page.getByRole("button", { name: "Duplicate selection" }).click();
    await expect(page.locator("svg path[data-id]")).toHaveCount(paths + 1);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.locator("svg path[data-id]")).toHaveCount(paths);
    // Exercise real IPC exports, replacing only OS file-picker interaction.
    for (const [kind, button] of [
      ["svg", "Export SVG"],
      ["png", "PNG preview"],
      ["pdf", "PDF"],
      ["dxf", "DXF polylines"],
      ["project", "Save"],
    ] as const) {
      const output = path.resolve(
        `test-results/export.${kind === "project" ? "localtrace.json" : kind}`,
      );
      await app.evaluate(({ dialog }, filePath) => {
        dialog.showSaveDialog = async () => ({ filePath, canceled: false });
      }, output);
      await page.getByRole("button", { name: button, exact: true }).click();
      await expect(page.locator("footer")).toContainText(
        "Saved successfully.",
        { timeout: 20000 },
      );
      const content = await fs.readFile(output);
      if (kind === "svg") {
        expect(content.toString()).toContain("<path");
        expect(content.toString()).toContain('inkscape:groupmode="layer"');
        expect(content.toString()).not.toContain("<image");
      }
      if (kind === "png") expect(content.subarray(1, 4).toString()).toBe("PNG");
      if (kind === "pdf")
        expect(content.subarray(0, 4).toString()).toBe("%PDF");
      if (kind === "dxf") expect(content.toString()).toContain("LWPOLYLINE");
      if (kind === "project")
        expect(JSON.parse(content.toString()).document.shapes.length).toBe(
          paths,
        );
    }
    const projectFile = path.resolve("test-results/export.localtrace.json");
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => ({
        filePaths: [filePath],
        canceled: false,
      });
    }, projectFile);
    await page
      .getByRole("button", { name: "Open project", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Convert", exact: true }),
    ).toBeEnabled();
    await expect(page.locator("svg path[data-id]")).toHaveCount(paths);
    await page
      .locator(".layer")
      .first()
      .locator("input[type=checkbox]")
      .last()
      .check();
    await expect(page.locator(".shape-row").first()).toBeDisabled();
    await page
      .locator(".layer")
      .first()
      .locator("input[type=checkbox]")
      .last()
      .uncheck();
    const colorDir = path.resolve("test-results/colors");
    await fs.mkdir(colorDir, { recursive: true });
    await app.evaluate(({ dialog }, dir) => {
      dialog.showOpenDialog = async () => ({
        filePaths: [dir],
        canceled: false,
      });
    }, colorDir);
    await page
      .getByRole("button", { name: "All color SVGs", exact: true })
      .click();
    await expect(page.locator("footer")).toContainText("Saved successfully.");
    const batch = await fs.readdir(colorDir);
    expect(batch).toHaveLength(1);
    const files = await fs.readdir(path.join(colorDir, batch[0]));
    expect(files.length).toBeGreaterThan(1);
    await page.locator(".right").evaluate((el) => (el.scrollTop = 0));
    await page.screenshot({ path: "test-results/desktop.png" });
    expect(errors).toEqual([]);
  } finally {
    await app.close();
  }
});
