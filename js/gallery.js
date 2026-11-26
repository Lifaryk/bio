(async () => {
  const grid = document.querySelector('.photo-grid[data-image-folder]');
  if (!grid) return;

  const folder = grid.dataset.imageFolder;
  const label = grid.dataset.imageLabel || 'Image';
  const extensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'bmp', 'svg']);

  try {
    const response = await fetch(`${folder}/`);
    if (!response.ok) throw new Error('Could not read the image folder');

    const html = await response.text();
    const documentFromListing = new DOMParser().parseFromString(html, 'text/html');
    const files = [...documentFromListing.querySelectorAll('a[href]')]
      .map(link => decodeURIComponent(link.getAttribute('href').split(/[?#]/)[0]))
      .filter(name => {
        const extension = name.split('.').pop().toLowerCase();
        return name !== '../' && extensions.has(extension);
      })
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    for (const [index, filename] of files.entries()) {
      const figure = document.createElement('figure');
      const image = document.createElement('img');
      image.src = `${folder}/${encodeURIComponent(filename)}`;
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
