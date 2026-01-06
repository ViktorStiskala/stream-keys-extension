import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'fs';
import { createHash } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Parse CLI arguments
const args = process.argv.slice(2);
const replaceMode = args.includes('--replace');

// Bookmarks to create in both browsers
const BOOKMARKS = [
  {
    name: 'HBO Max | #1',
    url: 'https://play.hbomax.com/video/watch/5b6aa3a2-93cd-4bbc-baf8-8689fb9d6224/2101774f-1971-4c9c-aea4-c0f713b63ac4',
  },
  {
    name: 'Disney+ | #1',
    url: 'https://www.disneyplus.com/cs-cz/play/5311b05a-88c3-409d-85ef-3d05715c07b0',
  },
  {
    name: 'YouTube | #1',
    url: 'https://www.youtube.com/watch?v=9Xs418q7u9I',
  },
  {
    name: 'IP Leak',
    url: 'https://ipleak.net',
  },
];

// Chrome profile paths
const CHROME_PROFILE_DIR = resolve(projectRoot, '.chrome-profile/Default');
const CHROME_BOOKMARKS_FILE = resolve(CHROME_PROFILE_DIR, 'Bookmarks');
const CHROME_FAVICONS_DB = resolve(CHROME_PROFILE_DIR, 'Favicons');

// Firefox profile paths
const FIREFOX_PROFILE_DIR = resolve(projectRoot, '.firefox-profile');
const FIREFOX_PLACES_DB = resolve(FIREFOX_PROFILE_DIR, 'places.sqlite');
const FIREFOX_FAVICONS_DB = resolve(FIREFOX_PROFILE_DIR, 'favicons.sqlite');

// Firefox build profile (used by dev:firefox, may have better icons from actual browsing)
const FIREFOX_BUILD_PROFILE_DIR = resolve(projectRoot, 'build/dev/firefox/profile');
const FIREFOX_BUILD_FAVICONS_DB = resolve(FIREFOX_BUILD_PROFILE_DIR, 'favicons.sqlite');

// Firefox cache directories to clear
const FIREFOX_CACHE_DIRS = [
  'startupCache',
  'cache2',
];

/**
 * Clear Firefox cache directories to ensure favicon changes take effect
 */
function clearFirefoxCaches() {
  console.log('\n🗑️  Clearing Firefox Caches');
  console.log('===========================');

  for (const cacheDir of FIREFOX_CACHE_DIRS) {
    const cachePath = resolve(FIREFOX_PROFILE_DIR, cacheDir);
    if (existsSync(cachePath)) {
      try {
        rmSync(cachePath, { recursive: true });
        mkdirSync(cachePath, { recursive: true });
        console.log(`  Cleared: ${cacheDir}/`);
      } catch (e) {
        console.log(`  Warning: Could not clear ${cacheDir}/: ${e.message}`);
      }
    }
  }
}

/**
 * Fetch favicon from Google's favicon service
 * @param {string} url - The page URL
 * @param {number} size - Desired size (16 or 32)
 * @returns {Promise<Buffer|null>} - Favicon data as Buffer or null on error
 */
async function fetchFavicon(url, size = 32) {
  try {
    const domain = new URL(url).origin;
    const faviconUrl = `https://www.google.com/s2/favicons?sz=${size}&domain_url=${encodeURIComponent(domain)}`;

    const response = await fetch(faviconUrl);
    if (!response.ok) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.log(`    Warning: Could not fetch favicon for ${url}: ${error.message}`);
    return null;
  }
}

/**
 * Generate Chrome timestamp (microseconds since 1601-01-01)
 */
function chromeTimestamp() {
  // Chrome uses microseconds since January 1, 1601
  // JavaScript Date uses milliseconds since January 1, 1970
  // Difference is 11644473600000 milliseconds
  const epochDiff = 11644473600000n;
  return String((BigInt(Date.now()) + epochDiff) * 1000n);
}

/**
 * Compute URL hash compatible with Firefox Places database (moz_places.url_hash)
 * Firefox uses a prefix hash based on the URL's origin
 */
function computeUrlHash(url) {
  // Firefox uses a prefix-based hash for moz_places
  // This is a simplified version that works for our use case
  let hash = 0n;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5n) - hash + BigInt(url.charCodeAt(i))) & 0xffffffffffffn;
  }
  return Number(hash);
}

/**
 * Compute icon URL hash compatible with Firefox favicons database (fixed_icon_url_hash)
 * Firefox uses Mozilla's HashString which is a DJB2-style hash (32-bit)
 */
function computeIconUrlHash(url) {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    // DJB2 hash: hash * 33 + c, keeping it as 32-bit unsigned
    hash = ((hash * 33) + url.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Generate a UUID v4
 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Calculate MD5 checksum for Chrome bookmarks
 */
function calculateChecksum(bookmarksObj) {
  // Chrome calculates checksum on the roots object as JSON string
  const rootsJson = JSON.stringify(bookmarksObj.roots);
  return createHash('md5').update(rootsJson).digest('hex');
}

/**
 * Create a fresh Chrome bookmarks structure
 */
function createFreshChromeBookmarks() {
  const now = chromeTimestamp();
  return {
    checksum: '', // Will be calculated after
    roots: {
      bookmark_bar: {
        children: [],
        date_added: now,
        date_last_used: '0',
        date_modified: now,
        guid: generateUUID(),
        id: '1',
        name: 'Bookmarks Bar',
        type: 'folder',
      },
      other: {
        children: [],
        date_added: now,
        date_last_used: '0',
        date_modified: '0',
        guid: generateUUID(),
        id: '2',
        name: 'Other Bookmarks',
        type: 'folder',
      },
      synced: {
        children: [],
        date_added: now,
        date_last_used: '0',
        date_modified: '0',
        guid: generateUUID(),
        id: '3',
        name: 'Mobile Bookmarks',
        type: 'folder',
      },
    },
    version: 1,
  };
}

/**
 * Create a Chrome bookmark entry
 */
function createChromeBookmarkEntry(bookmark, id) {
  const now = chromeTimestamp();
  return {
    date_added: now,
    date_last_used: '0',
    guid: generateUUID(),
    id: String(id),
    meta_info: {
      power_bookmark_meta: '',
    },
    name: bookmark.name,
    type: 'url',
    url: bookmark.url,
  };
}

/**
 * Get the next available ID from Chrome bookmarks
 */
function getNextChromeId(bookmarksObj) {
  let maxId = 3; // Root folders use 1, 2, 3
  const findMaxId = (children) => {
    for (const child of children) {
      const id = parseInt(child.id, 10);
      if (id > maxId) maxId = id;
      if (child.children) findMaxId(child.children);
    }
  };
  findMaxId(bookmarksObj.roots.bookmark_bar.children);
  findMaxId(bookmarksObj.roots.other.children);
  findMaxId(bookmarksObj.roots.synced.children);
  return maxId + 1;
}

/**
 * Check if a URL already exists in Chrome bookmarks
 */
function chromeBookmarkExists(bookmarksObj, url) {
  const checkChildren = (children) => {
    for (const child of children) {
      if (child.url === url) return true;
      if (child.children && checkChildren(child.children)) return true;
    }
    return false;
  };
  return (
    checkChildren(bookmarksObj.roots.bookmark_bar.children) ||
    checkChildren(bookmarksObj.roots.other.children) ||
    checkChildren(bookmarksObj.roots.synced.children)
  );
}

/**
 * Setup Chrome favicons
 * @param {Array<{name: string, url: string}>} bookmarks - Bookmarks to add favicons for
 */
async function setupChromeFavicons(bookmarks) {
  console.log('\n🖼️  Chrome Favicons');
  console.log('===================');

  if (!existsSync(CHROME_FAVICONS_DB)) {
    console.log(`  Error: Favicons database not found at ${CHROME_FAVICONS_DB}`);
    console.log('  Run Chrome with the profile first to create the database.');
    return;
  }

  const db = new Database(CHROME_FAVICONS_DB);

  try {
    if (replaceMode) {
      // Clear existing favicon mappings for our bookmark URLs
      const deleteMapping = db.prepare(`DELETE FROM icon_mapping WHERE page_url = ?`);
      for (const bookmark of bookmarks) {
        deleteMapping.run(bookmark.url);
      }
      console.log('  Cleared existing favicon mappings');
    }

    const now = Math.floor(Date.now() / 1000); // Chrome uses seconds for last_updated

    // Prepare statements
    const insertFavicon = db.prepare(`
      INSERT OR IGNORE INTO favicons (url, icon_type) VALUES (?, 1)
    `);

    const getFaviconId = db.prepare(`
      SELECT id FROM favicons WHERE url = ?
    `);

    const insertBitmap = db.prepare(`
      INSERT OR REPLACE INTO favicon_bitmaps (icon_id, last_updated, image_data, width, height)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertMapping = db.prepare(`
      INSERT OR IGNORE INTO icon_mapping (page_url, icon_id) VALUES (?, ?)
    `);

    const checkMappingExists = db.prepare(`
      SELECT 1 FROM icon_mapping WHERE page_url = ?
    `);

    // Find existing favicons used by pages from the same domain
    // This picks up CDN-hosted favicons that Chrome already cached
    const getExistingDomainFavicon = db.prepare(`
      SELECT DISTINCT f.id, f.url
      FROM icon_mapping im
      JOIN favicons f ON im.icon_id = f.id
      JOIN favicon_bitmaps b ON f.id = b.icon_id
      WHERE im.page_url LIKE ? || '%'
        AND f.url NOT LIKE ? || '%'
        AND b.image_data IS NOT NULL
      ORDER BY b.width DESC
      LIMIT 1
    `);

    let added = 0;
    let skipped = 0;

    for (const bookmark of bookmarks) {
      // Check if mapping already exists
      if (!replaceMode && checkMappingExists.get(bookmark.url)) {
        console.log(`  Skipped (exists): ${bookmark.name}`);
        skipped++;
        continue;
      }

      const domain = new URL(bookmark.url).origin;

      // First, look for existing favicon used by pages from this domain (CDN favicons)
      const existingFavicon = getExistingDomainFavicon.get(domain, domain);

      if (existingFavicon) {
        // Use existing CDN favicon
        insertMapping.run(bookmark.url, existingFavicon.id);
        console.log(`  Using existing: ${bookmark.name} (${existingFavicon.url})`);
        added++;
        continue;
      }

      // Fall back to fetching from Google's favicon service
      console.log(`  Fetching: ${bookmark.name}...`);
      const [favicon16, favicon32] = await Promise.all([fetchFavicon(bookmark.url, 16), fetchFavicon(bookmark.url, 32)]);

      if (!favicon16 && !favicon32) {
        console.log(`    No favicon available`);
        continue;
      }

      // Create favicon URL based on domain
      const faviconUrl = `${domain}/favicon.ico`;

      // Insert favicon record
      insertFavicon.run(faviconUrl);
      const favicon = getFaviconId.get(faviconUrl);

      if (!favicon) {
        console.log(`    Error: Could not create favicon record`);
        continue;
      }

      // Insert bitmap(s)
      if (favicon16) {
        insertBitmap.run(favicon.id, now, favicon16, 16, 16);
      }
      if (favicon32) {
        insertBitmap.run(favicon.id, now, favicon32, 32, 32);
      }

      // Map page URL to favicon
      insertMapping.run(bookmark.url, favicon.id);

      console.log(`    Added favicon (${favicon16 ? '16px' : ''}${favicon16 && favicon32 ? ', ' : ''}${favicon32 ? '32px' : ''})`);
      added++;
    }

    console.log(`\n  Summary: ${added} added, ${skipped} skipped`);
  } finally {
    db.close();
  }
}

/**
 * Try to copy icons from the build profile to the base profile
 * The build profile has icons from actual browsing sessions
 */
function copyIconsFromBuildProfile(db, domain) {
  if (!existsSync(FIREFOX_BUILD_FAVICONS_DB)) {
    return null;
  }

  try {
    const buildDb = new Database(FIREFOX_BUILD_FAVICONS_DB, { readonly: true });

    try {
      // Find the best icon used by pages from this domain in the build profile
      const buildIcon = buildDb
        .prepare(
          `
        SELECT DISTINCT i.icon_url, i.fixed_icon_url_hash, i.width, i.data, i.expire_ms
        FROM moz_icons i
        JOIN moz_icons_to_pages ip ON i.id = ip.icon_id
        JOIN moz_pages_w_icons p ON ip.page_id = p.id
        WHERE p.page_url LIKE ? || '%' 
          AND i.width >= 16 
          AND i.data IS NOT NULL
          AND i.fixed_icon_url_hash < 4294967296
        ORDER BY i.width DESC 
        LIMIT 1
      `
        )
        .get(domain);

      if (buildIcon) {
        // Check if this icon already exists in the target database
        const existing = db
          .prepare(`SELECT id FROM moz_icons WHERE icon_url = ? AND width = ?`)
          .get(buildIcon.icon_url, buildIcon.width);

        if (existing) {
          // Update existing icon
          db.prepare(`UPDATE moz_icons SET data = ?, expire_ms = ?, root = 1 WHERE id = ?`).run(
            buildIcon.data,
            buildIcon.expire_ms,
            existing.id
          );
          return { id: existing.id, icon_url: buildIcon.icon_url, source: 'build (updated)' };
        } else {
          // Insert new icon
          const result = db
            .prepare(
              `
            INSERT INTO moz_icons (icon_url, fixed_icon_url_hash, width, root, expire_ms, data)
            VALUES (?, ?, ?, 1, ?, ?)
          `
            )
            .run(buildIcon.icon_url, buildIcon.fixed_icon_url_hash, buildIcon.width, buildIcon.expire_ms, buildIcon.data);
          return { id: result.lastInsertRowid, icon_url: buildIcon.icon_url, source: 'build (new)' };
        }
      }
    } finally {
      buildDb.close();
    }
  } catch (e) {
    // Build profile might be locked or corrupted, ignore
  }

  return null;
}

/**
 * Setup Firefox favicons
 * @param {Array<{name: string, url: string}>} bookmarks - Bookmarks to add favicons for
 */
async function setupFirefoxFavicons(bookmarks) {
  console.log('\n🖼️  Firefox Favicons');
  console.log('====================');

  if (!existsSync(FIREFOX_FAVICONS_DB)) {
    console.log(`  Error: favicons.sqlite not found at ${FIREFOX_FAVICONS_DB}`);
    console.log('  Run Firefox with the profile first to create the database.');
    return;
  }

  // Check if build profile exists
  if (existsSync(FIREFOX_BUILD_FAVICONS_DB)) {
    console.log('  Found build profile, will use icons from there');
  }

  const db = new Database(FIREFOX_FAVICONS_DB);

  try {
    if (replaceMode) {
      // Clear existing page records for our bookmark URLs
      const deletePage = db.prepare(`DELETE FROM moz_pages_w_icons WHERE page_url = ?`);
      for (const bookmark of bookmarks) {
        deletePage.run(bookmark.url);
      }
      console.log('  Cleared existing favicon mappings');
    }

    const expireMs = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days from now

    // Prepare statements
    // Look for existing root icon for this domain (any URL from same origin)
    // Prefer icons with 32-bit hashes (Firefox's native format)
    const getExistingRootIcon = db.prepare(`
      SELECT id, icon_url FROM moz_icons 
      WHERE root = 1 AND icon_url LIKE ? || '%' AND width >= 16
        AND fixed_icon_url_hash < 4294967296
      ORDER BY width DESC LIMIT 1
    `);

    // Find icons that were previously used by pages from this domain
    // This catches CDN-hosted favicons (e.g., static-assets.bamgrid.com for disneyplus.com)
    // Prefer icons with 32-bit hashes
    const getIconUsedByDomain = db.prepare(`
      SELECT DISTINCT i.id, i.icon_url, i.width
      FROM moz_icons i
      JOIN moz_icons_to_pages ip ON i.id = ip.icon_id
      JOIN moz_pages_w_icons p ON ip.page_id = p.id
      WHERE p.page_url LIKE ? || '%' AND i.width >= 16 AND i.data IS NOT NULL
        AND i.fixed_icon_url_hash < 4294967296
      ORDER BY i.width DESC LIMIT 1
    `);

    // Find ANY existing icon for this domain that has a 32-bit hash (for setting root=1)
    const getAnyDomainIcon = db.prepare(`
      SELECT id, icon_url, fixed_icon_url_hash FROM moz_icons 
      WHERE icon_url LIKE ? || '%' AND width >= 16 AND data IS NOT NULL
        AND fixed_icon_url_hash < 4294967296
      ORDER BY width DESC LIMIT 1
    `);

    // Update an existing icon to be a root icon
    const setIconAsRoot = db.prepare(`
      UPDATE moz_icons SET root = 1 WHERE id = ?
    `);

    // Look for any existing icon with this exact URL
    const getExistingIcon = db.prepare(`
      SELECT id, fixed_icon_url_hash FROM moz_icons WHERE icon_url = ? ORDER BY id LIMIT 1
    `);

    const updateIcon = db.prepare(`
      UPDATE moz_icons SET data = ?, expire_ms = ?, root = 1 WHERE id = ?
    `);

    // Insert new icon - will copy hash from existing if available
    const insertIcon = db.prepare(`
      INSERT INTO moz_icons (icon_url, fixed_icon_url_hash, width, root, expire_ms, data)
      VALUES (?, ?, ?, 1, ?, ?)
    `);

    const insertPage = db.prepare(`
      INSERT OR IGNORE INTO moz_pages_w_icons (page_url, page_url_hash)
      VALUES (?, ?)
    `);

    const getPageId = db.prepare(`
      SELECT id FROM moz_pages_w_icons WHERE page_url = ?
    `);

    const insertIconToPage = db.prepare(`
      INSERT OR REPLACE INTO moz_icons_to_pages (page_id, icon_id, expire_ms)
      VALUES (?, ?, ?)
    `);

    const checkPageHasIcon = db.prepare(`
      SELECT 1 FROM moz_pages_w_icons p
      JOIN moz_icons_to_pages ip ON p.id = ip.page_id
      WHERE p.page_url = ?
    `);

    let added = 0;
    let skipped = 0;

    // Statement to delete existing page mapping (for updates)
    const deletePageMapping = db.prepare(`DELETE FROM moz_pages_w_icons WHERE page_url = ?`);

    for (const bookmark of bookmarks) {
      const domain = new URL(bookmark.url).origin;
      let iconId;
      let fromBuild = false;

      // Always try to get icon from build profile first (has icons from actual browsing)
      const buildIcon = copyIconsFromBuildProfile(db, domain);
      if (buildIcon) {
        iconId = buildIcon.id;
        fromBuild = true;
        // Delete existing mapping so we can create a new one with the build icon
        deletePageMapping.run(bookmark.url);
        console.log(`  From build profile: ${bookmark.name} (${buildIcon.icon_url})`);
      }

      // If no build icon and page already has a favicon, skip (in non-replace mode)
      if (!iconId && !replaceMode && checkPageHasIcon.get(bookmark.url)) {
        console.log(`  Skipped (exists): ${bookmark.name}`);
        skipped++;
        continue;
      }

      // Fall back to icons in the base profile
      if (!iconId) {
        // Look for icons used by pages from this domain (catches CDN-hosted favicons)
        let existingIcon = getIconUsedByDomain.get(domain);

        // Fall back to root icons for this domain
        if (!existingIcon) {
          existingIcon = getExistingRootIcon.get(domain);
        }

        // Fall back to ANY icon for this domain with a valid 32-bit hash
        let promoted = false;
        if (!existingIcon) {
          existingIcon = getAnyDomainIcon.get(domain);
          if (existingIcon) {
            // Promote this icon to root status so it's used for all pages from this domain
            setIconAsRoot.run(existingIcon.id);
            promoted = true;
          }
        }

        if (existingIcon) {
          // Use existing icon - no need to fetch
          iconId = existingIcon.id;
          // Ensure the icon is marked as root
          setIconAsRoot.run(existingIcon.id);
          if (promoted) {
            console.log(`  Promoted to root: ${bookmark.name} (${existingIcon.icon_url})`);
          } else {
            console.log(`  Using existing: ${bookmark.name} (${existingIcon.icon_url})`);
          }
        }
      }

      if (!iconId) {
        // Fetch favicon since no existing icon found
        console.log(`  Fetching: ${bookmark.name}...`);
        const faviconData = await fetchFavicon(bookmark.url, 32);

        if (!faviconData) {
          console.log(`    No favicon available`);
          continue;
        }

        // Create icon URL based on domain
        const iconUrl = `${domain}/favicon.ico`;

        // Check if there's an existing icon with this URL to get its hash
        const existingIcon = getExistingIcon.get(iconUrl);
        let iconUrlHash;
        
        if (existingIcon) {
          // Update existing icon and use its hash
          updateIcon.run(faviconData, expireMs, existingIcon.id);
          iconId = existingIcon.id;
          console.log(`    Updated existing icon`);
        } else {
          // Insert new icon with computed hash
          iconUrlHash = computeIconUrlHash(iconUrl);
          const result = insertIcon.run(iconUrl, iconUrlHash, 32, expireMs, faviconData);
          iconId = result.lastInsertRowid;
          console.log(`    Added new icon`);
        }
      }

      if (!iconId) {
        console.log(`    Error: Could not get/create icon record`);
        continue;
      }

      // Insert page record
      const pageUrlHash = computeUrlHash(bookmark.url);
      insertPage.run(bookmark.url, pageUrlHash);
      const page = getPageId.get(bookmark.url);

      if (!page) {
        console.log(`    Error: Could not create page record`);
        continue;
      }

      // Link icon to page
      insertIconToPage.run(page.id, iconId, expireMs);

      console.log(`    Added favicon (32px)`);
      added++;
    }

    // Checkpoint WAL to ensure changes are written to main database file
    // This is important because the profile gets copied and WAL files might not be included
    db.pragma('wal_checkpoint(TRUNCATE)');

    console.log(`\n  Summary: ${added} added, ${skipped} skipped`);
  } finally {
    db.close();
  }
}

/**
 * Setup Chrome bookmarks
 */
function setupChromeBookmarks() {
  console.log('\n📘 Chrome Bookmarks');
  console.log('===================');

  // Ensure directory exists
  if (!existsSync(CHROME_PROFILE_DIR)) {
    mkdirSync(CHROME_PROFILE_DIR, { recursive: true });
    console.log(`  Created directory: ${CHROME_PROFILE_DIR}`);
  }

  let bookmarksObj;
  let nextId;

  if (replaceMode || !existsSync(CHROME_BOOKMARKS_FILE)) {
    // Create fresh bookmarks
    bookmarksObj = createFreshChromeBookmarks();
    nextId = 4;
    if (replaceMode) {
      console.log('  Mode: Replace all bookmarks');
    } else {
      console.log('  Creating new bookmarks file');
    }
  } else {
    // Load existing bookmarks
    const content = readFileSync(CHROME_BOOKMARKS_FILE, 'utf-8');
    bookmarksObj = JSON.parse(content);
    nextId = getNextChromeId(bookmarksObj);
    console.log('  Mode: Merge with existing bookmarks');
  }

  // Add bookmarks
  let added = 0;
  let skipped = 0;

  for (const bookmark of BOOKMARKS) {
    if (!replaceMode && chromeBookmarkExists(bookmarksObj, bookmark.url)) {
      console.log(`  Skipped (exists): ${bookmark.name}`);
      skipped++;
      continue;
    }

    const entry = createChromeBookmarkEntry(bookmark, nextId++);
    bookmarksObj.roots.bookmark_bar.children.push(entry);
    console.log(`  Added: ${bookmark.name}`);
    added++;
  }

  // Update modification time
  bookmarksObj.roots.bookmark_bar.date_modified = chromeTimestamp();

  // Calculate checksum
  bookmarksObj.checksum = calculateChecksum(bookmarksObj);

  // Write file
  writeFileSync(CHROME_BOOKMARKS_FILE, JSON.stringify(bookmarksObj, null, 3));

  console.log(`\n  Summary: ${added} added, ${skipped} skipped`);
  console.log(`  Written to: ${CHROME_BOOKMARKS_FILE}`);
}

/**
 * Setup Firefox bookmarks using SQLite
 */
function setupFirefoxBookmarks() {
  console.log('\n🦊 Firefox Bookmarks');
  console.log('====================');

  if (!existsSync(FIREFOX_PLACES_DB)) {
    console.log(`  Error: places.sqlite not found at ${FIREFOX_PLACES_DB}`);
    console.log('  Run Firefox with the profile first to create the database.');
    return;
  }

  const db = new Database(FIREFOX_PLACES_DB);

  try {
    // Get the toolbar folder ID (type 2 = toolbar, parent 1 = root)
    const toolbarFolder = db
      .prepare(
        `
      SELECT id FROM moz_bookmarks 
      WHERE type = 2 AND parent = 1 AND title = 'toolbar'
    `
      )
      .get();

    if (!toolbarFolder) {
      console.log('  Error: Could not find toolbar folder in bookmarks');
      return;
    }

    const toolbarId = toolbarFolder.id;
    console.log(`  Toolbar folder ID: ${toolbarId}`);

    if (replaceMode) {
      console.log('  Mode: Replace all bookmarks');

      // Delete all bookmarks from toolbar (type 1 = bookmark)
      const deleted = db
        .prepare(
          `
        DELETE FROM moz_bookmarks 
        WHERE parent = ? AND type = 1
      `
        )
        .run(toolbarId);

      console.log(`  Deleted ${deleted.changes} existing bookmarks`);

      // Clean up orphaned places entries (optional, keeps DB tidy)
      db.prepare(
        `
        DELETE FROM moz_places 
        WHERE id NOT IN (SELECT fk FROM moz_bookmarks WHERE fk IS NOT NULL)
        AND id NOT IN (SELECT place_id FROM moz_historyvisits)
      `
      ).run();
    } else {
      console.log('  Mode: Merge with existing bookmarks');
    }

    // Get current max position in toolbar
    const maxPos = db
      .prepare(
        `
      SELECT COALESCE(MAX(position), -1) as maxPos 
      FROM moz_bookmarks 
      WHERE parent = ?
    `
      )
      .get(toolbarId);

    let position = maxPos.maxPos + 1;
    let added = 0;
    let skipped = 0;

    // Prepare statements
    const insertPlace = db.prepare(`
      INSERT OR IGNORE INTO moz_places (url, url_hash, rev_host, frecency, last_visit_date)
      VALUES (?, ?, ?, 100, ?)
    `);

    const getPlaceId = db.prepare(`
      SELECT id FROM moz_places WHERE url = ?
    `);

    const checkBookmarkExists = db.prepare(`
      SELECT 1 FROM moz_bookmarks b
      JOIN moz_places p ON b.fk = p.id
      WHERE p.url = ? AND b.parent = ?
    `);

    const insertBookmark = db.prepare(`
      INSERT INTO moz_bookmarks (type, fk, parent, position, title, dateAdded, lastModified, guid)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = Date.now() * 1000; // Firefox uses microseconds

    for (const bookmark of BOOKMARKS) {
      // Check if bookmark already exists in toolbar
      if (!replaceMode && checkBookmarkExists.get(bookmark.url, toolbarId)) {
        console.log(`  Skipped (exists): ${bookmark.name}`);
        skipped++;
        continue;
      }

      // Create reverse host (e.g., "com.example." from "https://example.com/path")
      const urlObj = new URL(bookmark.url);
      const revHost = urlObj.hostname.split('.').reverse().join('.') + '.';

      // Compute URL hash for Firefox Places
      const urlHash = computeUrlHash(bookmark.url);

      // Insert or get place
      insertPlace.run(bookmark.url, urlHash, revHost, now);
      const place = getPlaceId.get(bookmark.url);

      if (!place) {
        console.log(`  Error: Could not create place for ${bookmark.url}`);
        continue;
      }

      // Generate a Firefox-compatible GUID (12 chars, base64-like)
      const guid = generateUUID().replace(/-/g, '').slice(0, 12);

      // Insert bookmark
      insertBookmark.run(place.id, toolbarId, position++, bookmark.name, now, now, guid);

      console.log(`  Added: ${bookmark.name}`);
      added++;
    }

    // Checkpoint WAL to ensure changes are written to main database file
    db.pragma('wal_checkpoint(TRUNCATE)');

    console.log(`\n  Summary: ${added} added, ${skipped} skipped`);
    console.log(`  Updated: ${FIREFOX_PLACES_DB}`);
  } finally {
    db.close();
  }
}

/**
 * Main entry point
 */
async function main() {
  console.log('Bookmarks Setup Script');
  console.log('======================');
  console.log(`Mode: ${replaceMode ? '--replace (clear and recreate)' : 'merge (add missing)'}`);

  // Setup bookmarks
  setupChromeBookmarks();
  setupFirefoxBookmarks();

  // Setup favicons (fetch from network)
  await setupChromeFavicons(BOOKMARKS);
  await setupFirefoxFavicons(BOOKMARKS);

  // Clear Firefox caches to ensure changes take effect
  clearFirefoxCaches();

  console.log('\n✅ Done!');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

