(async () => {
  const grid = document.querySelector('.photo-grid[data-image-folder]');
  if (!grid) return;

  const owner = 'Lifaryk';
  const repo = 'bio';
  const branch = 'main';

  const rawFolder = grid.dataset.imageFolder.trim();
  const label = grid.dataset.imageLabel || 'Image';
  const extensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg']);
  const cacheTtlMs = 10 * 60 * 1000;

  function normalizeRepoPath(path) {
    let cleaned = decodeURIComponent(path.split(/[?#]/)[0])
      .replace(/^https?:\/\/[^/]+/i, '')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');

    if (!path.startsWith('/') && !path.startsWith('http')) {
      const currentDir = window.location.pathname
        .replace(/^\/+/, '')
        .replace(/[^/]*$/, '');
      const stack = currentDir ? currentDir.split('/').filter(Boolean) : [];

      for (const part of cleaned.split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') stack.pop();
        else stack.push(part);
      }
      cleaned = stack.join('/');
    }

    return cleaned;
  }

  const repoPath = normalizeRepoPath(rawFolder);
  const webFolderUrl = rawFolder.replace(/\/+$/, '');

  async function getFilesFromGitHubApi() {
    if (!repoPath) return null;

    const cacheKey = `gh_img_cache:${owner}/${repo}@${branch}:${repoPath}`;
    try {
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (Date.now() - cached.time < cacheTtlMs && Array.isArray(cached.files)) {
          return cached.files;
        }
      }
    } catch (_) {}

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(repoPath).replace(/%2F/g, '/')}?ref=${encodeURIComponent(branch)}`;
    const response = await fetch(apiUrl, {
      headers: { Accept: 'application/vnd.github+json' }
    });
    if (!response.ok) return null;

    const items = await response.json();
    if (!Array.isArray(items)) return null;

    const files = items
      .filter(item => item.type === 'file')
      .map(item => item.name)
      .filter(name => {
        const ext = name.split('.').pop().toLowerCase();
        return extensions.has(ext);
      });

    try {
      localStorage.setItem(cacheKey, JSON.stringify({ time: Date.now(), files }));
    } catch (_) {}

    return files;
  }

  async function getFilesFromDirectoryListing() {
    const response = await fetch(`${webFolderUrl}/`);
    if (!response.ok) throw new Error('Could not read the image folder');

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return [...doc.querySelectorAll('a[href]')]
      .map(link => decodeURIComponent(link.getAttribute('href').split(/[?#]/)[0]))
      .filter(name => {
        const ext = name.split('.').pop().toLowerCase();
        return name !== '../' && extensions.has(ext);
      });
  }

  try {
    let files = await getFilesFromGitHubApi();
    if (!files) {
      files = await getFilesFromDirectoryListing();
    }

    files = [...new Set(files)].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    for (const [index, filename] of files.entries()) {
      const figure = document.createElement('figure');
      const image = document.createElement('img');
      image.src = `${webFolderUrl}/${encodeURIComponent(filename)}`;
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
