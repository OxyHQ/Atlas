import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON);
// biome-ignore lint/correctness/noUnresolvedImports: resolved from the explicit harness installation above.
const { chromium } = require('@playwright/test');
const origin = 'http://localhost:8131';
const output = process.env.BASELINE_OUTPUT ?? 'docs/audits/issue-663-rerun';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ['--no-sandbox'],
});
const report = {
  source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  frames: [],
  unexpected: [],
  errors: [],
};
for (const mode of ['light', 'dark']) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    colorScheme: mode,
    locale: 'en-US',
  });
  await context.routeWebSocket(
    (url) => url.host !== new URL(origin).host,
    (s) => s.close(),
  );
  await context.route('**/*', async (route) => {
    const r = route.request(),
      u = new URL(r.url());
    if (u.origin === origin) return route.continue();
    const headers = {
      'access-control-allow-origin': origin,
      'access-control-allow-headers': '*',
      'access-control-allow-credentials': 'true',
    };
    const json = (body) => route.fulfill({ json: body, headers });
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (u.pathname.startsWith('/auth/oauth/client/'))
      return json({
        application: {
          id: 'fixture-app',
          name: 'Atlas fixture',
          type: 'internal',
          isOfficial: true,
          isInternal: true,
          clientId: u.pathname.split('/').pop(),
          scopes: [],
        },
      });
    if (u.pathname === '/store/categories') return json([]);
    if (u.pathname === '/store/apps')
      return json({
        data: [
          {
            id: 'fixture-mail',
            slug: 'fixture-mail',
            name: 'Fixture Mail',
            tagline: 'One synthetic result',
            icon: null,
            rating: { average: null, count: 0 },
            category: null,
          },
        ],
        pagination: { hasMore: false, total: 1, page: 1, limit: 100 },
      });
    if (u.pathname === '/session/user' || u.pathname === '/users/me')
      return route.fulfill({ status: 401, json: { error: 'Anonymous' }, headers });
    report.unexpected.push(`${r.method()} ${u.origin}${u.pathname}`);
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));
  await page.goto(`${origin}/search?q=mail`, { timeout: 180000, waitUntil: 'domcontentloaded' });
  await page.getByTestId('atlas-shell').waitFor({ timeout: 180000 });
  await page.getByText('Fixture Mail', { exact: true }).first().waitFor({ timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1000);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${output}/${mode}-${width}.png` });
    const measurement = await page.evaluate(() => ({
      url: location.href,
      width: innerWidth,
      height: innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
      documentWidth: document.documentElement.scrollWidth,
      htmlClass: document.documentElement.className,
      regions: [
        ...document.querySelectorAll(
          '[data-testid],[data-bloom-screen-viewport],[data-bloom-material]',
        ),
      ]
        .map((n) => {
          const r = n.getBoundingClientRect(),
            c = getComputedStyle(n);
          return {
            id: n.getAttribute('data-testid'),
            viewport: n.getAttribute('data-bloom-screen-viewport'),
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            background: c.backgroundColor,
            paddingBottom: c.paddingBottom,
          };
        })
        .filter((r) => r.width && r.height),
      bottomAncestors: [
        ...(function* (n) {
          while (n) {
            yield n;
            n = n.parentElement;
          }
        })(document.elementFromPoint(2, innerHeight - 2)),
      ].map((n) => ({
        tag: n.tagName,
        id: n.getAttribute('data-testid'),
        class: n.className,
        bg: getComputedStyle(n).backgroundColor,
        rect: n.getBoundingClientRect().toJSON(),
      })),
    }));
    report.frames.push({ mode, ...measurement });
  }
  await context.close();
}
await browser.close();
writeFileSync(`${output}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log({ frames: report.frames.length, errors: report.errors, unexpected: report.unexpected });
