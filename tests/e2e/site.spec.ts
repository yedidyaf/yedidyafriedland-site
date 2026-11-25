import { expect, test, type Page } from '@playwright/test';

/** Answers the current question with *some* answer, whatever its type. */
async function answerSomething(page: Page) {
  const card = page.locator('.qcard').first();
  if (await card.locator('.order-list').count()) {
    await card.locator('.order-list .mv').nth(1).click();
  } else if (await card.locator('.chip').count()) {
    const items = card.locator('.item');
    for (let i = 0; i < (await items.count()); i++) await items.nth(i).locator('.chip').first().click();
  } else if (await card.locator('.opt').count()) {
    await card.locator('.opt').first().click();
  } else {
    await card.locator('.code .ln').first().click();
  }
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  (page as Page & { _errors?: string[] })._errors = errors;
});
test.afterEach(async ({ page }) => {
  expect((page as Page & { _errors?: string[] })._errors).toEqual([]);
});

test('home links to both languages', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('באיזו שפה');
  await expect(page.locator('a.lang-card')).toHaveCount(2);
  await expect(page.locator('main a[href*="/basics/"]')).toHaveCount(0);
});

test('language page: chapters open to show their topics', async ({ page }) => {
  await page.goto('/');
  await page.locator('a.lang-card').first().click();
  await expect(page).toHaveURL(/\/python\/$/);
  const first = page.locator('details.chapter').first();
  const topic = first.locator('.topic-list a').first();
  await expect(topic).toBeHidden();
  await first.locator('summary').click();
  await expect(topic).toBeVisible();
  await expect(first.getByRole('link', { name: 'מבחן על כל הפרק' })).toBeVisible();
});

test('topic practice: answer, get feedback, finish, see results and progress', async ({ page }) => {
  await page.goto('/exam/?lang=python&mode=topic&chapter=basics&topic=variables&count=3');
  for (let i = 0; i < 3; i++) {
    await expect(page.locator('.qcard')).toBeVisible();
    await answerSomething(page);
    await page.getByRole('button', { name: 'בדיקה' }).click();
    await expect(page.locator('.feedback .verdict')).toBeVisible();
    await expect(page.locator('.feedback .explain')).toBeVisible();
    if (i < 2) await page.getByRole('button', { name: /הבאה/ }).click();
  }
  await page.getByRole('button', { name: 'סיום המבחן' }).click();
  await expect(page.locator('.result-hero .score')).toBeVisible();
  await page.goto('/progress/');
  await expect(page.getByText('היסטוריית מבחנים')).toBeVisible();
  await page.goto('/python/');
  await expect(page.locator('[data-topic="python/basics/variables"]')).not.toHaveText('לא התחלתם');
});

test('order question: move lines, check, see the correct order', async ({ page }) => {
  await page.goto('/exam/?lang=python&mode=topic&chapter=control-flow&topic=for-loops&count=17');
  const palette = page.locator('.palette button');
  await expect(palette.first()).toBeVisible();
  for (let i = 0; i < (await palette.count()); i++) {
    await palette.nth(i).click();
    if (await page.locator('.order-list').count()) break;
  }
  const lines = page.locator('.order-list .oline');
  await expect(lines).toHaveCount(5);
  await expect(page.getByRole('button', { name: 'בדיקה' })).toBeDisabled();
  const first = await lines.first().locator('.src').textContent();
  // tap a line, then tap where it should go
  await lines.nth(0).locator('.src').click();
  await lines.nth(4).locator('.src').click();
  await expect(lines.nth(4).locator('.src')).toHaveText(first!);
  await page.getByRole('button', { name: 'בדיקה' }).click();
  await expect(page.locator('.feedback .verdict')).toBeVisible();
  await expect(page.locator('.order-list .mark')).toHaveCount(5);
});

test('an open exam survives a reload', async ({ page }) => {
  await page.goto('/exam/?lang=python&mode=simulation');
  await expect(page.locator('.timer')).toBeVisible();
  await expect(page.locator('.palette button')).toHaveCount(30);
  await answerSomething(page);
  await page.reload();
  await expect(page.locator('.palette button.done')).toHaveCount(1);
  await expect(page).toHaveURL(/\/exam\/$/);
});

test('settings export produces a backup file', async ({ page }) => {
  await page.goto('/settings/');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ייצוא קובץ גיבוי' }).click();
  expect((await download).suggestedFilename()).toMatch(/^yedidyafriedland-backup-.*\.json$/);
});

test('sample question on a topic page gives feedback', async ({ page }) => {
  await page.goto('/python/oop/inheritance/');
  const sample = page.locator('.sample-q').first();
  await sample.scrollIntoViewIfNeeded();
  await sample.getByRole('button', { name: 'הצגת התשובה' }).click();
  await expect(sample.locator('.explain')).toBeVisible();
});

test('pages have no horizontal scroll on phones', async ({ page }) => {
  for (const url of ['/', '/python/', '/csharp/', '/python/basics/variables/', '/about/', '/glossary/']) {
    await page.goto(url);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(over, url).toBeLessThanOrEqual(1);
  }
});

for (const [lang, chapter, topic] of [
  ['csharp', 'clean-code', 'conventions'],
  ['python', 'software-design', 'architecture-assembly'],
  ['csharp', 'oop', 'class-design'],
]) {
  test(`exam with wide code keeps the page inside the screen: ${lang}/${topic}`, async ({ page }) => {
    await page.goto(`/exam/?lang=${lang}&mode=topic&chapter=${chapter}&topic=${topic}&count=16`);
    for (let i = 0; i < 16; i++) {
      await page.locator('.palette button').nth(i).click();
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, `question ${i + 1}`).toBeLessThanOrEqual(1);
      // long code lines wrap instead of hiding behind a horizontal scroll inside the block
      const hidden = await page.evaluate(() =>
        [...document.querySelectorAll('pre.code, .match .sig')].filter((e) => e.scrollWidth > e.clientWidth + 1).length,
      );
      expect(hidden, `question ${i + 1}: code blocks with hidden overflow`).toBe(0);
    }
  });
}

test('architecture class labels show the class and its method on separate lines', async ({ page }) => {
  await page.goto('/exam/?lang=python&mode=topic&chapter=software-design&topic=dependency-injection&count=16');
  for (let i = 0; i < 16; i++) {
    await page.locator('.palette button').nth(i).click();
    const sig = page.locator('.match .sig', { hasText: 'class GradeRepository' });
    if (await sig.count()) {
      await expect(sig.locator('.sl')).toHaveCount(2);
      await expect(sig.locator('.sl').nth(1)).toHaveText(/^def grades_of/);
      return;
    }
  }
  throw new Error('GradeRepository question not found');
});

test('multi-line code options keep their line breaks', async ({ page }) => {
  await page.goto('/exam/?lang=csharp&mode=topic&chapter=clean-code&topic=conventions&count=16');
  for (let i = 0; i < 16; i++) {
    await page.locator('.palette button').nth(i).click();
    if ((await page.locator('.qprompt').textContent())?.includes('סוגריים מסולסלים')) {
      const lines = await page.locator('.code-options .opt').evaluateAll((els) => els.map((e) => e.querySelectorAll('.ln').length));
      expect(lines.sort()).toEqual([3, 4, 4]);
      return;
    }
  }
  throw new Error('braces question not found');
});

test('pages carry share preview and search metadata', async ({ page }) => {
  await page.goto('/about/');
  const meta = (sel: string) => page.locator(sel).getAttribute('content');
  expect(await page.title()).toContain('ידידיה פרידלנד');
  expect(await meta('meta[property="og:image"]')).toMatch(/^https?:\/\/.+\/og\.png$/);
  expect(await meta('meta[property="og:image:width"]')).toBe('1200');
  expect(await meta('meta[property="og:locale"]')).toBe('he_IL');
  const graphs = await page.locator('script[type="application/ld+json"]').allTextContents();
  const person = graphs.map((g) => JSON.parse(g)).flatMap((g) => g['@graph'] ?? [g]).find((o) => o['@type'] === 'Person');
  expect(person).toMatchObject({ name: 'ידידיה פרידלנד', alternateName: 'Yedidya Friedland' });
});
