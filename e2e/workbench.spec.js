import { test, expect } from '@playwright/test';

test('guided review produces endpoint impact and actual breaking findings', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/The diff is data/})).toBeVisible();
  await page.getByRole('button',{name:'Use example'}).click();
  await expect(page.locator('#results')).toBeVisible({timeout:20000});
  await expect(page.locator('#stat-removed')).toHaveText('1');
  await expect(page.locator('#stat-added')).toHaveText('1');
  await expect(page.locator('#decision-title')).toContainText('potential breaking');
  await page.getByRole('tab',{name:/Compatibility findings/}).click();
  await expect(page.locator('#pane-findings')).toBeVisible();
  await expect(page.locator('.finding-row').first()).toBeVisible();
  await page.locator('.finding-row details summary').first().click();
  await page.locator('.finding-row select').first().selectOption('fix');
  await page.locator('.finding-row textarea').first().fill('Tracked in issue API-321; upgrade client SDK before rollout');
  await expect(page.locator('#triage-progress')).toContainText('1 /');
  await page.getByRole('tab',{name:'Release plan'}).click();
  await page.locator('.checklist-row input').first().check();
  await expect(page.locator('#checklist-progress')).toContainText('1 /');

  const downloadEvent=page.waitForEvent('download');
  await page.getByRole('button',{name:/Export JSON/}).click();
  const file=await downloadEvent;
  expect(file.suggestedFilename()).toBe('schemadiff-release-review.json');
  const data=JSON.parse(await (await import('node:fs/promises')).readFile(await file.path(),'utf8'));
  expect(data.overview.counts.removed).toBe(1);
  expect(data.findings.breakingCount).toBeGreaterThan(0);
  expect(data.triage.some(item=>item.disposition==='fix')).toBeTruthy();
  expect(data.checklist.some(item=>item.done)).toBeTruthy();
});
test('operations can be searched and the input order swapped', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button',{name:'Use example'}).click();
  await expect(page.locator('#results')).toBeVisible({timeout:20000});
  await page.locator('#endpoint-status').selectOption('removed');
  await expect(page.locator('.endpoint-row')).toHaveCount(1);
  await expect(page.locator('.endpoint-row').first()).toContainText('/legacy-report');
  await page.locator('#endpoint-query').fill('not-on-any-route');
  await expect(page.locator('.empty')).toBeVisible();
  await page.getByRole('button',{name:/Swap/}).click();
  await expect(page.locator('#results')).toBeHidden();
  await page.getByRole('button',{name:/Analyze release impact/}).click();
  await expect(page.locator('#results')).toBeVisible({timeout:20000});
  await expect(page.locator('#stat-removed')).toHaveText('1');
  await expect(page.locator('#stat-added')).toHaveText('1');
});
test('accepts local JSON files without loading remote URLs', async ({ page }) => {
  await page.goto('/');
  const spec=(paths,version)=>JSON.stringify({openapi:'3.0.3',info:{title:'Demo',version},paths});
  await page.locator('#base-file').setInputFiles({
    name:'before.json',mimeType:'application/json',
    buffer:Buffer.from(spec({'/ping':{get:{responses:{'200':{description:'OK'}}}}},'1'))
  });
  await page.locator('#revision-file').setInputFiles({
    name:'after.json',mimeType:'application/json',
    buffer:Buffer.from(spec({},'2'))
  });
  await page.getByRole('button',{name:/Analyze release impact/}).click();
  await expect(page.locator('#results')).toBeVisible({timeout:20000});
  await expect(page.locator('#stat-removed')).toHaveText('1');
});
test('mobile layout does not introduce horizontal page scrolling', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.getByRole('button',{name:'Use example'}).click();
  await expect(page.locator('#results')).toBeVisible({timeout:20000});
  const metrics=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:window.innerWidth}));
  expect(metrics.width).toBeLessThanOrEqual(metrics.viewport + 1);
});
