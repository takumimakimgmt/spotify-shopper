import { test, expect } from '@playwright/test';

// Minimal E2E: localStorage seed → reload → UI assert

test.describe('Persistence E2E', () => {
  test('restores tab, XML meta, and form state from localStorage', async ({ page }) => {
    // Seed localStorage before page load
    await page.addInitScript(() => {
      window.localStorage.setItem('spotify-shopper-results', JSON.stringify({
        version: 2,
        results: [
          {
            url: 'spotify:playlist:e2e',
            summary: {
              title: 'Test Playlist',
              total: 2,
              playlistUrl: 'spotify:playlist:e2e',
              analyzedAt: Date.now(),
              rekordboxMeta: {
                filename: 'test.xml',
                updatedAtISO: '2023-12-23T12:34:56.000Z',
              },
              hasRekordboxData: true,
              errorText: null,
              meta: {},
            },
          },
        ],
      }));
      window.localStorage.setItem('spotify-shopper-active-tab', 'spotify:playlist:e2e');
      window.localStorage.setItem('spotify-shopper-form-collapsed', 'false');
    });

    await page.goto('/');

    // Assert: tab is present and active
    await expect(page.locator('button[aria-selected="true"]')).toContainText('Test Playlist');

    // Assert: XML filename and date are shown
    await expect(page.locator('text=test.xml')).toBeVisible();
    await expect(page.locator('text=2023/12/23')).toBeVisible();

    // Assert: form is expanded (not collapsed)
    await expect(page.locator('form')).toBeVisible();
  });
});
