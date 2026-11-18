const Gallery = (function () {
  const BATCH_SIZE = 36;
  let batchErrorCount = 0;
  let batchTotalCount = 0;
  let hasShownBatchNotice = false;

  function recordBatchError() {
    batchErrorCount++;
    if (!hasShownBatchNotice && batchTotalCount > 0 && (batchErrorCount / batchTotalCount) > 0.3) {
      hasShownBatchNotice = true;
      showToast('Some wallpapers failed to load. CDN or network issue detected.');
    }
  }

  function resetBatchErrorTracker(batchSize) {
    batchErrorCount = 0;
    batchTotalCount = batchSize;
    hasShownBatchNotice = false;
  }
  let mediaObserver = null;
  let sentinelObserver = null;

  function initObservers() {
    // Media Lazy Loading Observer
    if (!mediaObserver) {
      mediaObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const mediaEl = entry.target;
            const src = mediaEl.getAttribute('data-src');
            if (src) {
              if (mediaEl.tagName === 'IMG') {
                mediaEl.src = src;
              } else if (mediaEl.tagName === 'VIDEO') {
                mediaEl.src = src;
                mediaEl.load();
              }
              mediaEl.removeAttribute('data-src');
            }
            observer.unobserve(mediaEl);
          }
        });
      }, { rootMargin: '200px 0px' });
    }

    // Infinite Scroll Sentinel Observer
    const sentinel = document.getElementById('loading-sentinel');
    if (sentinel && !sentinelObserver) {
      sentinelObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && renderedCount < currentFileList.length) {
            renderNextBatch();
          }
        });
      }, { rootMargin: '300px 0px' });
      sentinelObserver.observe(sentinel);
    }
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function createCardElement(file, globalIndex) {
    const card = document.createElement('article');
    card.className = 'gallery-card';
    card.setAttribute('data-index', globalIndex);
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `View ${file.alt}`);

    const cdnUrl = ManifestStore.getCDNUrl(file.path);
    const rawUrl = ManifestStore.getRawUrl(file.path);

    // Task 1: Use thumbnail proxy for grid images (except video / gif)
    const isVideoOrGif = file.type === 'video' || file.ext === 'gif';
    const thumbnailUrl = isVideoOrGif ? cdnUrl : ManifestStore.getThumbnailUrl(file.path, 400);

    const typeIconKey = file.type === 'video' ? 'video' : (file.ext === 'gif' ? 'gif' : 'image');

    // Task 2: Reserve aspect ratio if dimensions exist
    const aspectRatioStyle = (file.width && file.height) 
      ? `style="aspect-ratio: ${file.width} / ${file.height};"` 
      : '';

    card.innerHTML = `
      <div class="card-media-wrapper loading" ${aspectRatioStyle}>
        ${file.type === 'video' ? `
          <video 
            class="card-media" 
            data-src="${thumbnailUrl}" 
            muted 
            loop 
            playsinline 
            preload="none" 
            aria-label="${file.alt}">
          </video>
        ` : `
          <img 
            class="card-media" 
            data-src="${thumbnailUrl}" 
            alt="${file.alt}" 
            loading="lazy" 
          />
        `}
        <div class="card-type-badge" title="${file.type === 'video' ? 'Video wallpaper' : 'Image wallpaper'}">
          ${Icons[typeIconKey]}
        </div>
        <div class="card-scrim">
          <h3 class="card-title" title="${file.name}">${file.alt}</h3>
          <div class="card-actions">
            <button class="card-btn card-download-btn" title="Download Wallpaper" aria-label="Download ${file.alt}">
              ${Icons.download}
            </button>
            <button class="card-btn card-copy-btn" title="Copy Direct Link" aria-label="Copy link for ${file.alt}">
              ${Icons.copy}
            </button>
          </div>
        </div>
      </div>
    `;

    const mediaEl = card.querySelector('.card-media');
    const wrapper = card.querySelector('.card-media-wrapper');

    // Handle thumbnail loading error fallback
    let errorCount = 0;
    mediaEl.addEventListener('error', () => {
      errorCount++;
      if (errorCount === 1 && mediaEl.src !== cdnUrl) {
        mediaEl.src = cdnUrl;
      } else if (errorCount <= 2 && mediaEl.src !== rawUrl) {
        mediaEl.src = rawUrl;
      } else {
        // Priority 4: All fallbacks failed — render Image Unavailable box
        wrapper.classList.remove('loading');
        wrapper.innerHTML = `
          <div class="card-media-unavailable">
            ${Icons.image}
            <span>Image Unavailable</span>
          </div>
        `;
        recordBatchError();
      }
    });

    // Remove shimmer loading state once loaded
    const onLoaded = () => {
      wrapper.classList.remove('loading');
      mediaEl.classList.add('loaded');
    };

    if (file.type === 'video') {
      mediaEl.addEventListener('loadeddata', onLoaded);
      card.addEventListener('mouseenter', () => mediaEl.play().catch(() => {}));
      card.addEventListener('mouseleave', () => mediaEl.pause());
    } else {
      mediaEl.addEventListener('load', onLoaded);
      if (mediaEl.complete && mediaEl.naturalWidth > 0) {
        onLoaded();
      }
    }

    // Download button event
    const downloadBtn = card.querySelector('.card-download-btn');
    downloadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerDownload(file, downloadBtn);
    });

    // Copy link button event
    const copyBtn = card.querySelector('.card-copy-btn');
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyDirectLink(file);
    });

    // Card click & keyboard handlers
    card.addEventListener('click', () => {
      Lightbox.open(currentFileList, globalIndex);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (e.key === ' ') e.preventDefault();
        Lightbox.open(currentFileList, globalIndex);
      }
    });

    if (mediaObserver) {
      mediaObserver.observe(mediaEl);
    }

    return card;
  }

  async function triggerDownload(file, buttonEl) {
    const originalHTML = buttonEl.innerHTML;
    
    // Task 5: Switch to spinner icon first
    buttonEl.innerHTML = Icons.spinner || '<div class="btn-spin"></div>';
    buttonEl.classList.add('is-loading');

    const cdnUrl = ManifestStore.getCDNUrl(file.path);

    try {
      const res = await fetch(cdnUrl);
      if (!res.ok) throw new Error('CDN fetch failed');
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);

      // On actual success, show green checkmark
      buttonEl.innerHTML = Icons.check;
      buttonEl.style.color = '#4ade80';
      buttonEl.classList.remove('is-loading');

      setTimeout(() => {
        buttonEl.innerHTML = originalHTML;
        buttonEl.style.color = '';
      }, 1500);

    } catch (err) {
      // Fallback direct link attempt
      try {
        const a = document.createElement('a');
        a.href = cdnUrl;
        a.download = file.name;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Notify user about tab opening
        showToast('Opening wallpaper link in new tab...');
        buttonEl.innerHTML = originalHTML;
        buttonEl.classList.remove('is-loading');
      } catch (fallbackErr) {
        // Show failure state & toast
        buttonEl.innerHTML = originalHTML;
        buttonEl.classList.remove('is-loading');
        showToast('Download failed — try again');
      }
    }
  }

  function copyDirectLink(file) {
    const url = ManifestStore.getCDNUrl(file.path);
    navigator.clipboard.writeText(url).then(() => {
      showToast('Direct link copied to clipboard!');
    }).catch(() => {
      showToast('Could not copy link');
    });
  }

  function showToast(message) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast-item';
    toast.innerHTML = `${Icons.check} <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 200);
    }, 2500);
  }

  function renderNextBatch() {
    const container = document.getElementById('gallery-grid');
    if (!container) return;

    const start = renderedCount;
    const end = Math.min(renderedCount + BATCH_SIZE, currentFileList.length);

    resetBatchErrorTracker(end - start);

    const fragment = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      const card = createCardElement(currentFileList[i], i);
      fragment.appendChild(card);
    }

    container.appendChild(fragment);
    renderedCount = end;

    const sentinel = document.getElementById('loading-sentinel');
    if (sentinel) {
      if (renderedCount >= currentFileList.length) {
        sentinel.style.display = 'none';
      } else {
        sentinel.style.display = 'flex';
      }
    }
  }

  function setFiles(files, categorySlug = 'all') {
    const container = document.getElementById('gallery-grid');
    if (!container) return;

    // Crossfade transition out
    container.classList.add('crossfade-out');

    setTimeout(() => {
      container.innerHTML = '';
      currentFileList = files;
      renderedCount = 0;

      if (files.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">${Icons.search}</div>
            <h3>No wallpapers found</h3>
            <p>Try searching for something else or select another category.</p>
          </div>
        `;
        const sentinel = document.getElementById('loading-sentinel');
        if (sentinel) sentinel.style.display = 'none';
      } else {
        renderNextBatch();
      }

      container.classList.remove('crossfade-out');
      initObservers();
    }, 120);
  }

  return {
    setFiles,
    triggerDownload,
    copyDirectLink,
    showToast
  };
})();
