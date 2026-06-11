/**
 * Build script for shiye-books content API.
 * Scans data/ directory, generates JSON API + copies images to dist/.
 * Runs as part of Cloudflare Pages build (npm run build).
 */

import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { Marked } from 'marked';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DIST_DIR = path.resolve(process.cwd(), 'dist');
const DATA_CDN = process.env.DATA_CDN || '/data';

// Custom marked instance with renderer overrides
const md = new Marked();
md.use({
  renderer: {
    hr() {
      return '<div class="divider"></div>';
    },
    image({ href, title, text }) {
      const alt = text || '';
      const hasCaption = alt.startsWith('图：') || alt.startsWith('图:');
      // Wrap in figure with min-height placeholder to prevent CLS (layout shift)
      const img = `<img src="${href}" alt="${alt}" loading="lazy" decoding="async">`;
      if (hasCaption) {
        return `<figure class="illust">${img}<figcaption>${alt}</figcaption></figure>`;
      }
      return img;
    },
  },
});

function renderMarkdown(src) {
  let html = md.parse(src);
  let hIdx = 0;
  html = html.replace(/<(h[23])>/g, (_, tag) => `<${tag} id="toc-h-${hIdx++}">`);
  return html;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  if (typeof dateStr === 'object' && dateStr instanceof Date) {
    return `${dateStr.getFullYear()}年${dateStr.getMonth() + 1}月${dateStr.getDate()}日`;
  }
  const s = String(dateStr);
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}年${parseInt(m[2])}月${parseInt(m[3])}日`;
  return s;
}

/**
 * Resolve relative image paths to absolute CDN URLs.
 * Points directly to data/ directory on Cloudflare Pages.
 */
function resolveImagePaths(html, category, slug, chapterSlug) {
  let base = `${DATA_CDN}/${category}/${slug}`;
  if (chapterSlug) base += `/chapters/${chapterSlug}`;
  return html.replace(/src="\.?\/?(images\/)/g, `src="${base}/$1`);
}

function chapterTitleFromDir(dirName) {
  const m = dirName.match(/^\d+[-_\s]+(.+)$/);
  return m ? m[1] : dirName;
}

/**
 * Scan a chapters/ directory and return sorted chapter info.
 */
function scanChapters(articleDir, category, slug, withContent) {
  const chaptersDir = path.join(articleDir, 'chapters');
  if (!fs.existsSync(chaptersDir)) return [];

  const dirs = fs
    .readdirSync(chaptersDir)
    .filter((f) => fs.statSync(path.join(chaptersDir, f)).isDirectory())
    .sort();

  return dirs.map((dirName) => {
    const entry = {
      slug: dirName,
      title: chapterTitleFromDir(dirName),
    };
    if (withContent) {
      const chapterDir = path.join(chaptersDir, dirName);
      const contentPath = path.join(chapterDir, 'content.md');
      let contentHtml = '';
      if (fs.existsSync(contentPath)) {
        contentHtml = renderMarkdown(fs.readFileSync(contentPath, 'utf-8'));
      }
      entry.content = resolveImagePaths(contentHtml, category, slug, dirName);
    }
    return entry;
  });
}

/**
 * Build an essay object.
 * withContent=false -> metadata only (for listing).
 * withContent=true  -> include rendered HTML content.
 */
function buildEssay(articleDir, category, slug, withContent) {
  const metaPath = path.join(articleDir, 'meta.yaml');
  if (!fs.existsSync(metaPath)) return null;

  const meta = yaml.load(fs.readFileSync(metaPath, 'utf-8'));

  const chapters = scanChapters(articleDir, category, slug, withContent);

  const essay = {
    id: slug,
    title: meta.title || slug,
    category,
    author: meta.author || '',
    date: formatDate(meta.date),
    tags: meta.tags || [],
    time: meta.time || '',
    summary: meta.summary || '',
    cover: meta.cover ? `${DATA_CDN}/${category}/${slug}/${meta.cover}` : '',
    chapters,
    locked: !!meta.locked,
  };

  if (withContent) {
    const contentPath = path.join(articleDir, 'content.md');
    let contentHtml = '';
    if (fs.existsSync(contentPath)) {
      contentHtml = renderMarkdown(fs.readFileSync(contentPath, 'utf-8'));
    }
    essay.content = resolveImagePaths(contentHtml, category, slug, null);
  }

  return essay;
}

/**
 * Scan all essays and return the full data set.
 */
function scanAllEssays(withContent) {
  if (!fs.existsSync(DATA_DIR)) {
    return { essays: {}, essayOrder: [], allTags: [], categories: [] };
  }

  const categories = fs
    .readdirSync(DATA_DIR)
    .filter((f) => fs.statSync(path.join(DATA_DIR, f)).isDirectory())
    .sort();

  const essays = {};
  const essayOrder = [];
  const allTags = new Set();

  for (const category of categories) {
    const catDir = path.join(DATA_DIR, category);
    const slugs = fs
      .readdirSync(catDir)
      .filter((f) => fs.statSync(path.join(catDir, f)).isDirectory());

    for (const slug of slugs) {
      const articleDir = path.join(catDir, slug);
      const essay = buildEssay(articleDir, category, slug, withContent);
      if (!essay) continue;

      essays[slug] = essay;
      essayOrder.push(slug);
      (essay.tags || []).forEach((t) => allTags.add(t));
    }
  }

  essayOrder.sort((a, b) => {
    const da = essays[a].date;
    const db = essays[b].date;
    return da < db ? 1 : da > db ? -1 : 0;
  });

  return { essays, essayOrder, allTags: [...allTags].sort(), categories };
}

// ── Main build ──────────────────────────────────────────────

console.log('Building content API...');

// Only clean dist/api/ — don't wipe entire dist/ (frontend build output may exist)
const API_DIR = path.join(DIST_DIR, 'api');
if (fs.existsSync(API_DIR)) {
  fs.rmSync(API_DIR, { recursive: true });
}

// 1. Generate index.json (metadata only, no content)
const { essays, essayOrder, allTags, categories } = scanAllEssays(false);

const metaEssays = {};
for (const [slug, essay] of Object.entries(essays)) {
  metaEssays[slug] = essay;
}

const indexData = { essays: metaEssays, essayOrder, allTags, categories };

fs.mkdirSync(path.join(DIST_DIR, 'api', 'essay'), { recursive: true });
fs.writeFileSync(
  path.join(DIST_DIR, 'api', 'index.json'),
  JSON.stringify(indexData, null, 2)
);
console.log(`  api/index.json (${essayOrder.length} essays, ${categories.length} categories)`);

// 2. Generate per-essay JSON (full content with chapters)
const fullData = scanAllEssays(true);
for (const slug of essayOrder) {
  const essay = fullData.essays[slug];
  if (essay) {
    fs.writeFileSync(
      path.join(DIST_DIR, 'api', 'essay', `${slug}.json`),
      JSON.stringify(essay, null, 2)
    );
  }
}
console.log(`  api/essay/*.json (${essayOrder.length} files)`);

// 3. Copy images from data/ → dist/data/ so Cloudflare Pages serves them directly
function copyImages() {
  if (!fs.existsSync(DATA_DIR)) return;
  const categories = fs.readdirSync(DATA_DIR).filter((f) => fs.statSync(path.join(DATA_DIR, f)).isDirectory());
  let count = 0;
  for (const category of categories) {
    const catDir = path.join(DATA_DIR, category);
    const slugs = fs.readdirSync(catDir).filter((f) => fs.statSync(path.join(catDir, f)).isDirectory());
    for (const slug of slugs) {
      const articleDir = path.join(catDir, slug);
      // Article images
      const imagesDir = path.join(articleDir, 'images');
      if (fs.existsSync(imagesDir)) {
        const dest = path.join(DIST_DIR, 'data', category, slug, 'images');
        fs.cpSync(imagesDir, dest, { recursive: true });
        count++;
      }
      // Chapter images
      const chaptersDir = path.join(articleDir, 'chapters');
      if (fs.existsSync(chaptersDir)) {
        const chapters = fs.readdirSync(chaptersDir).filter((f) => fs.statSync(path.join(chaptersDir, f)).isDirectory());
        for (const ch of chapters) {
          const chImages = path.join(chaptersDir, ch, 'images');
          if (fs.existsSync(chImages)) {
            const dest = path.join(DIST_DIR, 'data', category, slug, 'chapters', ch, 'images');
            fs.cpSync(chImages, dest, { recursive: true });
            count++;
          }
        }
      }
    }
  }
  console.log(`  images copied (${count} directories)`);
}
copyImages();

// 4. Copy root verification files (e.g. WeChat domain verification) to dist/
const VERIFY_PATTERN = /^[0-9a-f]{32}\.txt$/;
for (const f of fs.readdirSync(process.cwd())) {
  if (VERIFY_PATTERN.test(f)) {
    fs.copyFileSync(f, path.join(DIST_DIR, f));
    console.log(`  copied ${f} → dist/`);
  }
}

console.log('Build complete!');
