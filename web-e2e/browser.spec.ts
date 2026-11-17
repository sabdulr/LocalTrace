import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs/promises';
const require = createRequire(path.resolve('package.json'));
test('black and white preview, trace and restore original colors', async ({ page }) => {
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Make black and white', exact: true });
  await expect(button).toBeDisabled();
  const buffer = await require('sharp')(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect x="2" y="2" width="12" height="28" fill="#200000"/><rect x="18" y="2" width="12" height="28" fill="#ffffcc"/></svg>')).png().toBuffer();
  await page.locator('input[type=file]').setInputFiles({ name: 'colors.png', mimeType: 'image/png', buffer });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.locator('footer')).toContainText('Black and white preview ready');
  await expect(page.getByLabel('HEX 1', { exact: true })).toHaveValue('#000000');
  await expect(page.getByLabel('HEX 2', { exact: true })).toHaveValue('#ffffff');
  const preview = await page.locator('.canvas img.artwork').getAttribute('src');
  const original = await page.locator('.dropzone img').getAttribute('src');
  const { data } = await require('sharp')(Buffer.from(preview!.split(',')[1], 'base64')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparent = false, black = false, white = false;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) { transparent = true; continue; }
    // Preview downsampling antialiases boundaries; interior colors remain binary.
    black ||= data[i] === 0; white ||= data[i] >= 254;
    expect(data[i + 1]).toBe(data[i]); expect(data[i + 2]).toBe(data[i]);
  }
  expect(transparent).toBe(true);
  expect(black && white).toBe(true);
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('svg path[data-id]').first()).toBeVisible();
  const fills = await page.locator('svg path[data-id]').evaluateAll(paths => paths.map(p => getComputedStyle(p).fill));
  expect(fills.length).toBeGreaterThan(0);
  expect(fills.every(fill => fill === 'rgb(0, 0, 0)' || fill === 'rgb(255, 255, 255)')).toBe(true);
  await page.getByRole('button', { name: 'Detect colors', exact: true }).click();
  await expect(page.locator('footer')).toContainText('Quantized preview updated');
  await expect(page.getByLabel('HEX 1', { exact: true })).not.toHaveValue('#000000');
  await expect(page.locator('.dropzone img')).toHaveAttribute('src', original!);
});
test('browser conversion, editing, downloads and project reopening', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const buffer = await require('sharp')(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect x="8" y="8" width="48" height="48" fill="#ff0000"/></svg>')).png().toBuffer();
  await page.locator('input[type=file]').setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer });
  await expect(page.getByRole('button', { name: 'Convert', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Convert', exact: true }).click();
  await expect(page.locator('svg path[data-id]').first()).toBeVisible();
  await page.locator('.layer-head button').first().click();
  await page.locator('.shape-row').first().click();
  const count = await page.locator('svg path[data-id]').count();
  await page.getByRole('button', { name: 'Duplicate selection' }).click();
  await expect(page.locator('svg path[data-id]')).toHaveCount(count + 1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('svg path[data-id]')).toHaveCount(count);
  let project: Buffer | undefined;
  for (const name of ['Export SVG', 'PNG preview', 'DXF polylines', 'All color SVGs', 'Save']) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name, exact: true }).click();
    const download = await pending;
    const bytes = await fs.readFile((await download.path())!);
    expect(bytes.length).toBeGreaterThan(20);
    if (name === 'Export SVG') expect(bytes.toString()).toContain('<path');
    if (name === 'PNG preview') expect(bytes.subarray(1, 4).toString()).toBe('PNG');
    if (name === 'DXF polylines') expect(bytes.toString()).toContain('LWPOLYLINE');
    if (name === 'All color SVGs') expect(bytes.subarray(0, 2).toString()).toBe('PK');
    if (name === 'Save') project = bytes;
  }
  await page.reload();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open project', exact: true }).click();
  await (await chooser).setFiles({ name: 'artwork.localtrace.json', mimeType: 'application/json', buffer: project! });
  await expect(page.locator('svg path[data-id]')).toHaveCount(count);
  await page.context().addInitScript(() => { window.print = () => {}; });
  const popup = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'PDF', exact: true }).click();
  const print = await popup;
  await expect(print.locator('svg path').first()).toBeAttached();
  await print.close();
  expect(errors).toEqual([]);
});
test('rejects cross-origin API access and invalid documents', async ({ request, baseURL }) => {
  const response = await request.post('/api/cancel', { data: {}, headers: { Origin: 'https://example.com', 'X-LocalTrace-Client': 'test' } });
  expect(response.status()).toBe(403);
  const invalid = await request.post('/api/export', { data: { doc: {}, kind: 'svg' }, headers: { Origin: baseURL!, 'X-LocalTrace-Client': 'test' } });
  expect(invalid.status()).toBe(400);
});
