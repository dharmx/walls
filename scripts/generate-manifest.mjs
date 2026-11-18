import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getImageDimensions } from './image-dimensions.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const OUTPUT_FILE = path.join(REPO_ROOT, 'docs', 'manifest.json');

// Supported extensions
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm']);

// Directories or files to ignore
const IGNORED_NAMES = new Set(['.git', '.github', 'docs', 'scripts', 'node_modules']);

// Manual label override map for special category slugs
// TODO: adjust labels according to preference
const LABEL_OVERRIDES = {
  'm-26.jp': 'M-26.jp',
  'jackb': 'Jack B',
  'devicons': 'DevIcons',
  'stalenhag': 'Stålenhag',
  'gruvbox': 'Gruvbox',
  'nord': 'Nord',
  'outrun': 'Outrun',
  'solarized': 'Solarized'
};

function titleCaseSlug(slug) {
  if (LABEL_OVERRIDES[slug]) {
    return LABEL_OVERRIDES[slug];
  }
  return slug
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getFileType(ext) {
  const lowerExt = ext.toLowerCase();
  if (IMAGE_EXTENSIONS.has(lowerExt)) return 'image';
  if (VIDEO_EXTENSIONS.has(lowerExt)) return 'video';
  return null;
}

function generateAltText(filename) {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  return nameWithoutExt.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function scanRepository() {
  console.log(`Scanning repository at: ${REPO_ROOT}`);
  
  const entries = fs.readdirSync(REPO_ROOT, { withFileTypes: true });
  const categoryDirs = entries
    .filter(entry => entry.isDirectory() && !IGNORED_NAMES.has(entry.name) && !entry.name.startsWith('.'))
    .map(entry => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const categories = [];
  const files = [];

  for (const slug of categoryDirs) {
    const dirPath = path.join(REPO_ROOT, slug);
    const catEntries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    let catCount = 0;
    let firstCoverPath = null;

    catEntries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    for (const entry of catEntries) {
      if (!entry.isFile() || entry.name.startsWith('.')) continue;

      const ext = path.extname(entry.name).slice(1).toLowerCase();
      const type = getFileType(ext);
      if (!type) continue; // Skip non-media files

      const relativePath = `${slug}/${entry.name}`;
      const fullPath = path.join(dirPath, entry.name);

      let bytes = 0;
      try {
        const stats = fs.statSync(fullPath);
        bytes = stats.size;
      } catch (err) {
        console.warn(`Could not stat file ${relativePath}:`, err.message);
      }

      const dimensions = getImageDimensions(fullPath);
      const alt = generateAltText(entry.name);

      const fileObj = {
        category: slug,
        name: entry.name,
        path: relativePath,
        ext,
        type,
        bytes,
        alt
      };

      if (dimensions && dimensions.width && dimensions.height) {
        fileObj.width = dimensions.width;
        fileObj.height = dimensions.height;
      }

      files.push(fileObj);

      catCount++;
      if (!firstCoverPath) {
        firstCoverPath = relativePath;
      }
    }

    if (catCount > 0) {
      categories.push({
        slug,
        label: titleCaseSlug(slug),
        count: catCount,
        cover: firstCoverPath || ''
      });
    }
  }

  const docsDir = path.join(REPO_ROOT, 'docs');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const manifestData = {
    generatedAt: new Date().toISOString(),
    categories,
    files
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifestData, null, 2), 'utf-8');
  console.log(`Successfully generated manifest with ${categories.length} categories and ${files.length} total files.`);
  console.log(`Saved to: ${OUTPUT_FILE}`);
}

scanRepository();
