import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { JSDOM } from 'jsdom';
import * as prettier from 'prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

const DOM_DIR = resolve(projectRoot, 'resources/dom');

// Elements to remove entirely
const ELEMENTS_TO_REMOVE = ['style', 'link', 'script', 'noscript'];

// Attributes to remove from all elements
const ATTRIBUTES_TO_REMOVE = ['style', 'integrity', 'crossorigin', 'fetchpriority'];

// Prettier options for HTML formatting
const PRETTIER_OPTIONS = {
  parser: 'html',
  printWidth: 10000, // Very high to prevent attribute wrapping - keep elements on single lines
  tabWidth: 2,
  useTabs: false,
  htmlWhitespaceSensitivity: 'ignore',
  bracketSameLine: true,
  singleAttributePerLine: false,
};

function cleanupHtml(html) {
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Remove unwanted elements
  for (const tagName of ELEMENTS_TO_REMOVE) {
    const elements = document.querySelectorAll(tagName);
    console.log(`  Removing ${elements.length} <${tagName}> elements`);
    elements.forEach((el) => el.remove());
  }

  // Remove HTML comments
  const walker = document.createTreeWalker(document, 128 /* NodeFilter.SHOW_COMMENT */);
  const comments = [];
  while (walker.nextNode()) {
    comments.push(walker.currentNode);
  }
  if (comments.length > 0) {
    console.log(`  Removing ${comments.length} HTML comments`);
    comments.forEach((comment) => comment.remove());
  }

  // Remove unwanted attributes from all elements
  const allElements = document.querySelectorAll('*');
  let styleAttrsRemoved = 0;
  let otherAttrsRemoved = 0;

  for (const el of allElements) {
    for (const attr of ATTRIBUTES_TO_REMOVE) {
      if (el.hasAttribute(attr)) {
        el.removeAttribute(attr);
        if (attr === 'style') {
          styleAttrsRemoved++;
        } else {
          otherAttrsRemoved++;
        }
      }
    }
  }

  console.log(`  Removed ${styleAttrsRemoved} inline style attributes`);
  if (otherAttrsRemoved > 0) {
    console.log(`  Removed ${otherAttrsRemoved} other attributes (integrity, crossorigin, fetchpriority)`);
  }

  // Remove path data from SVG path elements
  const pathElements = document.querySelectorAll('path');
  if (pathElements.length > 0) {
    console.log(`  Clearing 'd' attribute from ${pathElements.length} <path> elements`);
    pathElements.forEach((el) => {
      if (el.hasAttribute('d')) {
        el.setAttribute('d', '');
      }
    });
  }

  // Remove content from data: image src attributes (keep mimetype and encoding prefix)
  // Handles: data:image/svg+xml;base64,... or data:image/svg+xml;utf8,... etc.
  const elementsWithSrc = document.querySelectorAll('[src]');
  let dataUrisCleaned = 0;
  const dataImagePattern = /^data:(image\/[^;,]+)(;[^,]+)?,.*$/;

  for (const el of elementsWithSrc) {
    const src = el.getAttribute('src');
    if (src && src.startsWith('data:image/')) {
      const match = src.match(dataImagePattern);
      if (match) {
        const mimetype = match[1]; // e.g., "image/svg+xml"
        const encoding = match[2] || ''; // e.g., ";base64", ";utf8", or empty
        el.setAttribute('src', `data:${mimetype}${encoding},`);
        dataUrisCleaned++;
      }
    }
  }

  if (dataUrisCleaned > 0) {
    console.log(`  Cleaned ${dataUrisCleaned} data:image src attributes`);
  }

  // Get the cleaned HTML
  // Use the full document to preserve DOCTYPE and html structure
  return dom.serialize();
}

async function formatHtml(html) {
  try {
    return await prettier.format(html, PRETTIER_OPTIONS);
  } catch (error) {
    console.error('  Warning: Prettier formatting failed, using basic formatting');
    console.error(`  Error: ${error.message}`);
    // Fallback to basic formatting if prettier fails
    return html.replace(/></g, '>\n<');
  }
}

async function processFile(filePath) {
  console.log(`\nProcessing: ${filePath}`);

  const html = readFileSync(filePath, 'utf-8');
  const originalSize = html.length;

  const cleanedHtml = cleanupHtml(html);
  const formattedHtml = await formatHtml(cleanedHtml);

  writeFileSync(filePath, formattedHtml, 'utf-8');

  const newSize = formattedHtml.length;
  const lineCount = formattedHtml.split('\n').length;
  const reduction = (((originalSize - newSize) / originalSize) * 100).toFixed(1);

  console.log(`  Size: ${originalSize.toLocaleString()} → ${newSize.toLocaleString()} bytes (${reduction}% reduction)`);
  console.log(`  Lines: ${lineCount}`);
}

async function main() {
  console.log('HTML Cleanup Script');
  console.log('===================');
  console.log(`Processing files in: ${DOM_DIR}`);

  const files = readdirSync(DOM_DIR).filter((f) => f.endsWith('.html'));

  if (files.length === 0) {
    console.log('No HTML files found.');
    return;
  }

  console.log(`Found ${files.length} HTML file(s)`);

  for (const file of files) {
    const filePath = resolve(DOM_DIR, file);
    await processFile(filePath);
  }

  console.log('\nCleanup complete!');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

