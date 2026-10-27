import { test, expect } from '@playwright/test';

// Spotify and YouTube are left out: the test is about the site, not the players.
test.beforeEach(async ({ page }) => {
  await page.route(/spotify\.com|youtube\.com|ytimg\.com|googlevideo\.com/, (route) => route.abort());
});

const watchErrors = (page) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource/.test(m.text()) && errors.push(m.text()));
  return errors;
};

test('open a record, dive into a single, switch language, close', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./?lang=tr');
  await expect(page.locator('html')).toHaveClass(/ready/);
  await expect(page.locator('html')).not.toHaveClass(/no-webgl/); // the real 3D path, dive included

  // who this is and how to reach them, on the first screen
  await expect(page.locator('.brand-sub')).toContainText('Endüstri Mühendisi');
  const contact = page.locator('header .contact');
  await expect(contact.locator('a[data-c="email"]')).toHaveAttribute('href', 'mailto:alperen.kivanc@hotmail.com');
  await expect(contact.locator('a[data-c="linkedin"]')).toHaveAttribute('href', /linkedin\.com\/in\//);
  const cv = await contact.locator('a[data-c="cv"]').getAttribute('href');
  expect((await page.request.get(cv)).ok()).toBe(true);

  // open the first record
  await page.locator('.hero-open').click();
  await expect(page).toHaveURL(/#\/universite-tecrubelerim$/);
  await expect(page.locator('#post')).toHaveClass(/is-in/, { timeout: 15_000 });
  await expect(page.locator('.ph-title')).toContainText('Üniversite');
  await expect(page.locator('.pf-contact')).toBeAttached();

  // into one of its singles
  await page.locator('.tracks-l a').first().click();
  await expect(page).toHaveURL(/#\/universite-tecrubelerim\/kulup-etkinlikleri$/);
  await expect(page.locator('.ph-title')).toContainText('Kulüp');

  // English, same page
  await page.locator('[data-lang="en"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('.ph-title')).toContainText('Student Club Activities');

  // back to the exhibition
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).not.toHaveClass(/in-post/, { timeout: 15_000 });
  await expect(page.locator('#hero')).not.toHaveClass(/is-hidden/);

  expect(errors).toEqual([]);
});

test('a shared link opens its page directly', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./?lang=en#/kariyer-yolculugum');
  await expect(page.locator('#post')).toHaveClass(/is-in/, { timeout: 15_000 });
  await expect(page.locator('.ph-title')).toContainText('Professional Career');
  await expect(page.locator('.role-when').first()).toContainText('2023');
  expect(errors).toEqual([]);
});

test('no placeholder text is left in any article', async ({ page }) => {
  const content = await (await page.request.get('content/records.json')).json();
  const posts = content.records.flatMap((r) => [r.post, ...(r.children || []).map((c) => c.post)]);
  for (const p of posts) {
    for (const file of [p, p.replace(/\.md$/, '.en.md')]) {
      const res = await page.request.get(`content/${file}`);
      expect(res.ok(), file).toBe(true);
      expect(await res.text(), file).not.toMatch(/\[(Yer tutucu|Placeholder)\]/);
    }
  }
});

test('the static preview page of a record leads into the app', async ({ page, request }) => {
  const html = await (await request.get('en/kariyer-yolculugum/')).text();
  expect(html).toContain('<meta property="og:title" content="Professional Career');
  await page.goto('en/kariyer-yolculugum/');
  await expect(page).toHaveURL(/\?lang=en#\/kariyer-yolculugum$/);
  await expect(page.locator('#post')).toHaveClass(/is-in/, { timeout: 15_000 });
});

test('the travel photo ring opens a photo and Escape closes only the photo', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('./?lang=tr#/dunya-turu-hobiler/kesif-seyahat');
  await expect(page.locator('#post')).toHaveClass(/is-in/, { timeout: 15_000 });
  await expect(page.locator('.rg-card')).toHaveCount(16);
  await page.evaluate(() => {
    const s = document.querySelector('.post-scroll');
    s.scrollTop = document.querySelector('.ring-gallery').offsetTop;
  });
  await expect(async () => {
    // the article takes focus once it has opened, so focus the card on every try
    await page.locator('.rg-card').first().focus();
    await page.keyboard.press('Enter'); // ignored until the intro has finished
    await expect(page.locator('.rg-stage')).toHaveClass(/is-preview/, { timeout: 500 });
  }).toPass({ timeout: 20_000 });
  await expect(page.locator('.rg-title')).toContainText('Helsinki');
  await page.waitForTimeout(2200);
  await page.keyboard.press('Escape');
  await expect(page.locator('.rg-stage')).not.toHaveClass(/is-preview/, { timeout: 5_000 });
  await expect(page.locator('html')).toHaveClass(/in-post/);
  expect(errors).toEqual([]);
});
