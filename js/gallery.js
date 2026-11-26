(async () => {
  const grid = document.querySelector('.photo-grid[data-image-folder]');
  if (!grid) return;

  const owner = 'Lifaryk';
  const repo = 'bio';
  const branch = 'main';

  const rawFolder = (grid.dataset.imageFolder || '').trim();
  const folder = rawFolder.replace(/\/+$/, '');
  const label = grid.dataset.imageLabel || 'Image';
  const extensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg']);
  const cacheTtlMs = 10 * 60 * 1000;

  function resolveRepoPath(folderValue) {
    const cleanValue = decodeURIComponent(folderValue.split(/[?#]/)[0])
      .replace(/^https?:\/\/[^/]+/i, '');

    const currentDirParts = window.location.pathname
      .replace(/^\/+/, '')
      .replace(/[^/]*$/, '')
      .split('/')
      .filter(Boolean);

    const stack = cleanValue.startsWith('/') ? [] : [...currentDirParts];

    for (const part of cleanValue.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') stack.pop();
      else stack.push(part);
    }

    return stack.join('/');
  }

  async function getFilesFromGitHubApi() {
    const repoPath = resolveRepoPath(folder || '.');
    if (!repoPath) return null;

    const cacheKey = `gh_gallery:${owner}/${repo}@${branch}:${repoPath}`;
    try {
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (Date.now() - cached.time < cacheTtlMs && Array.isArray(cached.files)) {
          return cached.files;
        }
      }
    } catch (_) {}

    const encodedPath = repoPath.split('/').map(encodeURIComponent).join('/');
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`;

    const response = await fetch(apiUrl, {
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (!response.ok) return null;

    const items = await response.json();
    if (!Array.isArray(items)) return null;

    const files = items
      .filter(item => item.type === 'file')
      .map(item => item.name)
      .filter(name => extensions.has(name.split('.').pop().toLowerCase()));

    try {
      localStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), files }));
    } catch (_) {}

    return files;
  }

  async function getFilesFromDirectoryListing() {
    const base = folder || '.';
    const response = await fetch(`${base}/`);
    if (!response.ok) throw new Error('Could not read the image folder');

    const html = await response.text();
    if (!/<a\s+[^>]*href=/i.test(html)) {
      throw new Error('Directory listing is not available');
    }

    const doc = new DOMParser().parseFromString(html, 'text/html');
    return [...doc.querySelectorAll('a[href]')]
      .map(link => decodeURIComponent(link.getAttribute('href').split(/[?#]/)[0]))
      .filter(name => {
        const extension = name.split('.').pop().toLowerCase();
        return name !== '../' && extensions.has(extension);
      });
  }

  try {
    let files = await getFilesFromGitHubApi();
    if (files === null) {
      files = await getFilesFromDirectoryListing();
    }

    files = [...new Set(files)].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    const imgBase = folder || '.';
    for (const [index, filename] of files.entries()) {
      const figure = document.createElement('figure');
      const image = document.createElement('img');
      image.src = `${imgBase}/${encodeURIComponent(filename)}`;
      image.alt = `${label} ${index + 1}`;
      image.loading = 'lazy';
      figure.append(image);
      grid.append(figure);
    }

    if (files.length === 0) {
      const message = document.createElement('p');
      message.className = 'empty';
      message.textContent = 'No images yet.';
      grid.replaceWith(message);
    }
  } catch (error) {
    const message = document.createElement('p');
    message.className = 'empty';
    message.textContent = 'Could not load images. Open this page through the local web server.';
    grid.replaceWith(message);
  }
})();
