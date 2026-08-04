// Renders bookshelf.html from bookshelf-data.json.
// Usable as a CLI (`node scripts/render.js`) or via require('./render').render().

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'bookshelf-data.json');
const OUT_PATH = path.join(ROOT, 'bookshelf.html');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hasNotes(entry) {
  const n = entry.notes;
  if (!n) return false;
  const mp = Array.isArray(n.mainPoints) ? n.mainPoints.filter(x => x && x.trim()) : [];
  const ks = Array.isArray(n.keySnippets) ? n.keySnippets.filter(x => x && x.trim()) : [];
  const pc = (n.perspectiveChange || '').trim();
  return mp.length > 0 || ks.length > 0 || pc.length > 0;
}

function renderMeta(entry, metaStyle) {
  if (!entry.meta) return '';
  if (metaStyle === 'author') return `<span class="author">${esc(entry.meta)}</span>`;
  if (metaStyle === 'tag') return `<span class="tag">${esc(entry.meta)}</span>`;
  return '';
}

function renderNotes(entry) {
  const n = entry.notes || {};
  const mp = (Array.isArray(n.mainPoints) ? n.mainPoints : []).filter(x => x && x.trim());
  const ks = (Array.isArray(n.keySnippets) ? n.keySnippets : []).filter(x => x && x.trim());
  const pc = (n.perspectiveChange || '').trim();
  const blocks = [];

  if (mp.length) {
    blocks.push(
      `        <div class="note-block">\n` +
      `          <div class="note-label">Main points</div>\n` +
      `          <ul class="note-points">\n` +
      mp.map(p => `            <li>${esc(p)}</li>`).join('\n') + '\n' +
      `          </ul>\n` +
      `        </div>`
    );
  }
  if (pc) {
    blocks.push(
      `        <div class="note-block">\n` +
      `          <div class="note-label">How my perspective changed</div>\n` +
      `          <p class="note-text">${esc(pc)}</p>\n` +
      `        </div>`
    );
  }
  if (ks.length) {
    blocks.push(
      `        <div class="note-block">\n` +
      `          <div class="note-label">Key snippets</div>\n` +
      `          <ul class="note-snippets">\n` +
      ks.map(p => `            <li>${esc(p)}</li>`).join('\n') + '\n' +
      `          </ul>\n` +
      `        </div>`
    );
  }
  if (entry.url) {
    blocks.push(`        <a class="entry-visit" href="${esc(entry.url)}" target="_blank" rel="noopener">visit ↗</a>`);
  }

  return (
    `      <div class="entry-notes">\n` +
    `        <div class="entry-notes-inner"><div class="entry-notes-pad">\n` +
    blocks.join('\n') + '\n' +
    `        </div></div>\n` +
    `      </div>`
  );
}

function renderLinkEntry(entry, metaStyle) {
  const meta = renderMeta(entry, metaStyle);
  if (hasNotes(entry)) {
    return (
      `      <li class="has-notes">\n` +
      `        <div class="entry-row">\n` +
      `          <button class="entry-toggle" type="button" aria-expanded="false"><span class="entry-caret">›</span><span class="entry-title">${esc(entry.title)}</span></button>\n` +
      (meta ? `          ${meta}\n` : '') +
      `        </div>\n` +
      renderNotes(entry) + '\n' +
      `      </li>`
    );
  }
  if (entry.url) {
    return `      <li><a href="${esc(entry.url)}" target="_blank" rel="noopener">${esc(entry.title)}</a>${meta ? ' ' + meta : ''}</li>`;
  }
  return `      <li><span>${esc(entry.title)}</span>${meta ? ' ' + meta : ''}</li>`;
}

function renderToolEntry(entry) {
  let inner;
  if (entry.url) {
    inner = `    <a href="${esc(entry.url)}" target="_blank" rel="noopener">${esc(entry.title)}</a>`;
  } else {
    inner = `    <span style="font-weight: 600; font-size: 0.9rem;">${esc(entry.title)}</span>`;
  }
  const desc = entry.desc && entry.desc.trim()
    ? `\n    <p class="tool-desc">${esc(entry.desc)}</p>`
    : '';
  return `  <div class="tool-item">\n${inner}${desc}\n  </div>`;
}

function renderCategory(cat) {
  const header = `    <div class="category-header">${esc(cat.title)}</div>`;
  if (cat.layout === 'tools') {
    const items = cat.entries.map(renderToolEntry).join('\n');
    return (
      `  <!-- ${cat.id.toUpperCase()} -->\n` +
      `  <section class="section">\n` +
      `    <div class="section-inner">\n` +
      `${header}\n` +
      `${items}\n` +
      `    </div>\n` +
      `  </section>`
    );
  }
  const items = cat.entries.map(e => renderLinkEntry(e, cat.metaStyle)).join('\n');
  return (
    `  <!-- ${cat.id.toUpperCase()} -->\n` +
    `  <section class="section">\n` +
    `    <div class="section-inner">\n` +
    `${header}\n` +
    `      <ul class="link-list">\n` +
    `${items}\n` +
    `      </ul>\n` +
    `    </div>\n` +
    `  </section>`
  );
}

function renderHtml(data) {
  const sections = data.categories.map(renderCategory).join('\n\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bookshelf – Sam Beskind</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
<nav>
  <a href="index.html" class="logo">s.b.</a>
  <button class="nav-toggle" onclick="document.querySelector('.nav-links').classList.toggle('open')" aria-label="Toggle menu">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
  </button>
  <ul class="nav-links">
    <li><a href="index.html">about</a></li>
    <li><a href="bookshelf.html" class="active">bookshelf</a></li>
    <li><a href="writing.html">writing</a></li>
    <li><a href="projects.html">projects</a></li>
  </ul>
</nav>
<main>

  <div class="page-header">
    <div class="page-header-inner">
      <h1>${esc(data.title)}</h1>
    </div>
  </div>

${sections}

</main>
<footer>
  <p>give your all.</p>
</footer>
<script>
  document.querySelectorAll('.entry-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var li = btn.closest('.has-notes');
      if (!li) return;
      var open = li.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
</script>
</body>
</html>
`;
}

function render() {
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const html = renderHtml(data);
  fs.writeFileSync(OUT_PATH, html);
  return { data, html };
}

module.exports = { render, renderHtml, DATA_PATH, OUT_PATH };

if (require.main === module) {
  render();
  console.log('Rendered bookshelf.html');
}
