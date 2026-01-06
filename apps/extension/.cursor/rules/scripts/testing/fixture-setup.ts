import { loadFixture, resetFixture } from '@test';

beforeEach(() => {
  resetFixture();
  loadFixture('disney');
});
