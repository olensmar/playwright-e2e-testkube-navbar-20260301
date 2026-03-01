import { test, expect } from '@playwright/test';

const EXPECTED_NAV_ITEMS = [
  { label: 'Product', hasMenu: true },
  { label: 'Pricing', hasMenu: false },
  { label: 'Docs', hasMenu: false },
  { label: 'Resources', hasMenu: true },
  { label: 'Company', hasMenu: true },
  { label: 'Blog', hasMenu: false },
];

const EXPECTED_CTA_BUTTONS = [
  { label: 'Sign in' },
  { label: 'Get started', variant: 'primary' },
];

// Slow network can cause flakiness; give the navbar some room to settle.
const NAV_TIMEOUT = 15_000;

/**
 * Helper to normalize text content (trim & collapse whitespace)
 */
function normalizeText(text: string | null): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

// Desktop navbar validations
// ---------------------------------------------------------------------------

test.describe('Testkube navbar - desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('displays correct nav items and CTAs', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const navbar = page.locator('header:has(nav), [data-testid="navbar"], nav[role="navigation"]').first();
    await expect(navbar).toBeVisible({ timeout: NAV_TIMEOUT });

    const navLinks = navbar.getByRole('link');

    for (const item of EXPECTED_NAV_ITEMS) {
      const link = navLinks.filter({ hasText: item.label }).first();
      await expect(link, `Nav item '${item.label}' should be visible`).toBeVisible();
    }

    for (const cta of EXPECTED_CTA_BUTTONS) {
      const button = navbar.getByRole('link', { name: cta.label }).first().or(
        navbar.getByRole('button', { name: cta.label }).first(),
      );
      await expect(button, `CTA '${cta.label}' should be visible`).toBeVisible();
    }

    // Basic accessibility expectations on the nav region
    const navRegion = page.locator('nav[aria-label], nav[role="navigation"]').first();
    await expect(navRegion, 'Nav region with ARIA label or navigation role should exist').toBeVisible();
  });

  test('dropdown menus are accessible and toggle on hover/click', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const navbar = page.locator('header:has(nav), [data-testid="navbar"], nav[role="navigation"]').first();
    await expect(navbar).toBeVisible({ timeout: NAV_TIMEOUT });

    for (const item of EXPECTED_NAV_ITEMS.filter((i) => i.hasMenu)) {
      const trigger = navbar.getByRole('link', { name: item.label }).first();
      await expect(trigger, `Dropdown trigger '${item.label}' should be visible`).toBeVisible();

      // Prefer ARIA attributes when present
      const hasExpandedAttr = await trigger.evaluate((el) => el.hasAttribute('aria-expanded'));

      if (hasExpandedAttr) {
        await expect(trigger).toHaveAttribute('aria-haspopup', /menu|true/i);
        // Toggle with click for reliability across implementations
        await trigger.click();
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      } else {
        // Fallback: hover to reveal a submenu/popover
        await trigger.hover();
      }

      // Look for a submenu or popover near the trigger
      const menuCandidates = page.locator('[role="menu"], [data-headlessui-state], [data-radix-menubar-content]
        , .dropdown-menu, .popover, [class*="menu" i]').filter({ has: page.getByText(item.label, { exact: false }) });

      // We only assert that *some* menu-like element becomes visible after interaction
      await expect(menuCandidates.first()).toBeVisible({ timeout: NAV_TIMEOUT });
    }
  });
});

// Mobile navbar validations
// ---------------------------------------------------------------------------

test.describe('Testkube navbar - mobile', () => {
  test.use({ viewport: { width: 414, height: 844 } }); // iPhone-ish size

  test('hamburger menu toggles and exposes nav items', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    const navbar = page.locator('header:has(nav), [data-testid="navbar"], nav[role="navigation"]').first();
    await expect(navbar).toBeVisible({ timeout: NAV_TIMEOUT });

    // Try several common selectors for a hamburger / menu toggle
    const menuToggle = page
      .getByRole('button', { name: /menu|navigation|open.*menu|close.*menu/i })
      .or(page.locator('[data-testid="navbar-menu-toggle"], [aria-label*="menu" i], button.hamburger, button[aria-expanded]'))
      .first();

    await expect(menuToggle, 'Mobile menu toggle button should be visible').toBeVisible();

    // Open the menu and assert that nav items appear in the DOM
    await menuToggle.click();

    for (const item of EXPECTED_NAV_ITEMS) {
      const link = page.getByRole('link', { name: new RegExp(`^${item.label}$`, 'i') }).first();
      await expect(link, `Nav item '${item.label}' should be visible in mobile menu`).toBeVisible();
    }

    for (const cta of EXPECTED_CTA_BUTTONS) {
      const button = page
        .getByRole('link', { name: new RegExp(`^${cta.label}$`, 'i') })
        .or(page.getByRole('button', { name: new RegExp(`^${cta.label}$`, 'i') }))
        .first();
      await expect(button, `CTA '${cta.label}' should be visible in mobile menu`).toBeVisible();
    }
  });
});
