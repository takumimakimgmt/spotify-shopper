import { test, expect } from '@playwright/test';

test.describe('TrackTable match badge UI', () => {
  test('shows canonical/guess match badges for tracks', async ({ page }) => {
    // API mocks (no raw URLs)
    await page.route('**/api/playlist**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          title: 'E2E Playlist',
          total: 2,
          playlistUrl: 'spotify:playlist:e2e',
          tracks: [
            { title: 'Canon Song', artist: 'Test Artist', album: 'A', label: 'X', owned: true, owned_reason: 'canonical' },
            { title: 'Guess Song', artist: 'Test Artist', album: 'B', label: 'Y', owned: true, owned_reason: 'guess' },
          ],
        }),
      });
    });
    await page.route('**/api/match-snapshot-with-xml**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          title: 'E2E Playlist',
          total: 2,
          playlistUrl: 'spotify:playlist:e2e',
          tracks: [
            { title: 'Canon Song', artist: 'Test Artist', album: 'A', label: 'X', owned: true, owned_reason: 'canonical' },
            { title: 'Guess Song', artist: 'Test Artist', album: 'B', label: 'Y', owned: true, owned_reason: 'guess' },
          ],
        }),
      });
    });
    // Go to root (no baseURL fallback)
    await page.goto('/');
    // XML upload (dummy)
    await page.getByTestId('rekordbox-xml').setInputFiles({
      name: 'rekordbox.xml',
      mimeType: 'text/xml',
      buffer: Buffer.from('<DJ_PLAYLISTS></DJ_PLAYLISTS>'),
    });
    // Dummy playlist ID (no raw URL)
    await page.getByTestId('playlist-url').fill('spotify:playlist:e2e');
    await page.getByTestId('analyze-btn').click();
    await expect(page.getByText('Canon Song')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Guess Song')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('≈')).toBeVisible();
    await expect(page.getByText('~')).toBeVisible();
  });
});
