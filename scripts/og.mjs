// Link preview image (LinkedIn, WhatsApp, Slack…): a 1200×630 shot of the exhibition.
// Start the dev server first (npm run dev), then: npm run og [url]
import { chromium } from '@playwright/test';

const url = process.argv[2] || 'http://localhost:5178/?lang=tr';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.route(/spotify\.com|youtube\.com/, (route) => route.abort());
await page.goto(url);
await page.waitForFunction(() => document.documentElement.classList.contains('ready'));
// the player, the language switch and the hints mean nothing in a still image
await page.addStyleTag({ content: '.np, .lang, .contact, .hero-hint, .hero-open, .cursor { visibility: hidden !important; }' });
await page.waitForTimeout(5000); // records glide in and settle
await page.screenshot({ path: 'public/content/og.jpg', type: 'jpeg', quality: 86 });
await browser.close();
console.log('public/content/og.jpg');
