// script.js - build gallery from photo-list.json
// Uses top-level await (supported in module scripts) for initial data load.

const container = document.getElementById('gallery');
try {
  const res = await fetch('../photo-list.json', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load list: ' + res.status);
  const data = await res.json();
  buildGallery(data, container);
} catch (err) {
  console.error(err);
  container.innerHTML = '<div class="empty-state">Error loading photos. Please refresh.</div>';
  container.setAttribute('aria-busy', 'false');
}

function buildGallery(data, container) {
  container.textContent = '';
  const entries = Object.entries(data);
  // Cache original dataset for filtering
  globalThis.__PHOTO_DATA__ = entries;
  if (!entries.length) {
    container.innerHTML = '<div class="empty-state">No photos available.</div>';
    container.setAttribute('aria-busy', 'false');
    return;
  }

  const template = document.getElementById('card-template');
  const frag = document.createDocumentFragment();

  for (const [tail, meta] of entries) {
    const node = template.content.firstElementChild.cloneNode(true);
    const img = node.querySelector('img');
    const tailEl = node.querySelector('.tail');
    const photogEl = node.querySelector('.photographer');

    const file = meta.photo || `${tail}.jpg`;

    img.alt = `Aircraft ${tail}${meta.photographer ? ' photo by ' + meta.photographer : ''}`;
  img.dataset.src = `../images/${file}`; // lazy load via observer (moved under web/)
    tailEl.textContent = tail;
    photogEl.textContent = meta.photographer || 'Unknown';

    // error fallback
    img.addEventListener('error', () => {
      node.dataset.error = 'Missing image';
      img.style.objectFit = 'contain';
      img.style.background = 'repeating-conic-gradient(from 45deg,#222 0 25%,#333 0 50%)';
      delete img.dataset.src;
    });

    node.addEventListener('click', () => openLightbox(tail, meta));

    frag.appendChild(node);
  }

  container.appendChild(frag);
  container.setAttribute('aria-busy', 'false');
  initLazyLoading();
  initModeToggle();
  initSearch();
}

function initLazyLoading() {
  const imgs = document.querySelectorAll('img[data-src]');
  if (!('IntersectionObserver' in globalThis)) {
    for (const img of imgs) {
      img.src = img.dataset.src;
      delete img.dataset.src;
    }
    return;
  }
  const io = new IntersectionObserver((entries, obs) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        const img = e.target;
        img.src = img.dataset.src;
        img.onload = () => img.classList.add('loaded');
        delete img.dataset.src;
        obs.unobserve(img);
      }
    }
  }, { rootMargin: '200px 0px 200px 0px', threshold: 0.01 });
  for (const i of imgs) io.observe(i);
}

// Lightbox implementation
function openLightbox(tail, meta) {
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  const metaEl = document.getElementById('lightbox-meta');
  const file = meta.photo || `${tail}.jpg`;
  img.src = `../images/${file}`;
  img.alt = `Aircraft ${tail} full size`;
  metaEl.textContent = `${tail} — Photographer: ${meta.photographer || 'Unknown'}`;
  lb.hidden = false;
  document.body.style.overflow = 'hidden';
  trapFocus(lb);
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  lb.hidden = true;
  document.body.style.overflow = '';
  releaseFocus();
}

// Accessibility: focus trap
let previousFocus = null;
function trapFocus(modal) {
  previousFocus = document.activeElement;
  const focusable = Array.from(modal.querySelectorAll('button, [href], img'));
  const first = focusable[0];
  const last = focusable.at(-1);
  modal.addEventListener('keydown', function handler(e) {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    } else if (e.key === 'Escape') { closeLightbox(); }
  });
  (first || modal).focus();
}
function releaseFocus() { previousFocus?.focus(); }

// Event listeners
globalThis.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
document.querySelector('#lightbox .close').addEventListener('click', closeLightbox);
document.getElementById('lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') closeLightbox(); });

function initModeToggle() {
  const btn = document.getElementById('modeToggle');
  const gallery = document.getElementById('gallery');
  if (!btn || !gallery) return;
  btn.addEventListener('click', () => {
    const filling = gallery.classList.toggle('fill'); // toggles fill mode
    if (filling) {
      gallery.classList.remove('fit');
      btn.textContent = 'Fit Mode';
      btn.setAttribute('aria-pressed', 'true');
      btn.title = 'Switch to showing whole image';
    } else {
      gallery.classList.add('fit');
      btn.textContent = 'Fill Mode';
      btn.setAttribute('aria-pressed', 'false');
      btn.title = 'Switch to filling frame (may crop)';
    }
  });
}

function initSearch() {
  const input = document.getElementById('search');
  if (!input || !globalThis.__PHOTO_DATA__) return;
  const container = document.getElementById('gallery');
  const template = document.getElementById('card-template');
  let lastValue = '';
  input.addEventListener('input', () => {
    const value = input.value.trim().toLowerCase();
    if (value === lastValue) return;
    lastValue = value;
    container.textContent = '';
  const matches = value === '' ? globalThis.__PHOTO_DATA__ : globalThis.__PHOTO_DATA__.filter(([tail, meta]) => {
      const photog = (meta.photographer || '').toLowerCase();
      return tail.toLowerCase().includes(value) || photog.includes(value);
    });
    if (!matches.length) {
      container.innerHTML = '<div class="no-results">No matches</div>';
      return;
    }
    const frag = document.createDocumentFragment();
    for (const [tail, meta] of matches) {
      const node = template.content.firstElementChild.cloneNode(true);
      const img = node.querySelector('img');
      const tailEl = node.querySelector('.tail');
      const photogEl = node.querySelector('.photographer');
      const file = meta.photo || `${tail}.jpg`;
      img.alt = `Aircraft ${tail}${meta.photographer ? ' photo by ' + meta.photographer : ''}`;
      img.dataset.src = `../images/${file}`;
      tailEl.textContent = tail;
      photogEl.textContent = meta.photographer || 'Unknown';
      img.addEventListener('error', () => {
        node.dataset.error = 'Missing image';
        img.style.objectFit = 'contain';
        img.style.background = 'repeating-conic-gradient(from 45deg,#222 0 25%,#333 0 50%)';
        delete img.dataset.src;
      });
      node.addEventListener('click', () => openLightbox(tail, meta));
      frag.appendChild(node);
    }
    container.appendChild(frag);
    initLazyLoading();
  });
}
