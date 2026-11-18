const Lightbox = (function () {
  let fileList = [];
  let currentIndex = 0;
  let dialogEl = null;
  let activeMediaEl = null;
  let touchStartX = 0;
  let touchEndX = 0;

  function init() {
    dialogEl = document.getElementById('lightbox-dialog');
    if (!dialogEl) return;

    // Prev / Next buttons
    const prevBtn = dialogEl.querySelector('.lightbox-nav-btn.prev');
    const nextBtn = dialogEl.querySelector('.lightbox-nav-btn.next');
    const closeBtn = dialogEl.querySelector('.lightbox-close-btn');

    if (prevBtn) prevBtn.addEventListener('click', prev);
    if (nextBtn) nextBtn.addEventListener('click', next);
    if (closeBtn) closeBtn.addEventListener('click', close);

    // Click backdrop to close
    dialogEl.addEventListener('click', (e) => {
      if (e.target === dialogEl || e.target.classList.contains('lightbox-body')) {
        close();
      }
    });

    // Keyboard navigation
    window.addEventListener('keydown', (e) => {
      if (!dialogEl.hasAttribute('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    });

    // Mobile touch swipe gestures
    const bodyEl = dialogEl.querySelector('.lightbox-body');
    if (bodyEl) {
      bodyEl.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      bodyEl.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
      }, { passive: true });
    }
  }

  function handleSwipe() {
    const diff = touchEndX - touchStartX;
    if (Math.abs(diff) > 50) {
      if (diff < 0) {
        next();
      } else {
        prev();
      }
    }
  }

  function open(files, index) {
    if (!dialogEl) init();
    fileList = files;
    currentIndex = index;
    updateContent();

    if (dialogEl.showModal) {
      dialogEl.showModal();
    } else {
      dialogEl.setAttribute('open', '');
    }

    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (!dialogEl) return;
    if (activeMediaEl && activeMediaEl.tagName === 'VIDEO') {
      activeMediaEl.pause();
    }
    if (dialogEl.close) {
      dialogEl.close();
    } else {
      dialogEl.removeAttribute('open');
    }
    document.body.style.overflow = '';
  }

  function prev() {
    if (fileList.length === 0) return;
    currentIndex = (currentIndex - 1 + fileList.length) % fileList.length;
    updateContent();
  }

  function next() {
    if (fileList.length === 0) return;
    currentIndex = (currentIndex + 1) % fileList.length;
    updateContent();
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function updateContent() {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[currentIndex];
    const cdnUrl = ManifestStore.getCDNUrl(file.path);
    const githubUrl = ManifestStore.getGitHubBlobUrl(file.path);

    const mediaContainer = dialogEl.querySelector('.lightbox-media-container');
    const counterEl = dialogEl.querySelector('.lightbox-counter');
    const titleEl = dialogEl.querySelector('.lightbox-title');
    const metaEl = dialogEl.querySelector('.lightbox-meta');
    const downloadBtn = dialogEl.querySelector('.lightbox-download-btn');
    const githubBtn = dialogEl.querySelector('.lightbox-github-btn');
    const copyBtn = dialogEl.querySelector('.lightbox-copy-btn');

    if (counterEl) {
      counterEl.textContent = `${currentIndex + 1} of ${fileList.length}`;
    }

    if (titleEl) {
      titleEl.textContent = file.alt;
    }

    if (metaEl) {
      metaEl.innerHTML = `
        <span>Category: <strong>${file.category}</strong></span>
        <span>•</span>
        <span>Format: <strong>${file.ext.toUpperCase()}</strong></span>
        <span>•</span>
        <span>Size: <strong>${formatBytes(file.bytes)}</strong></span>
      `;
    }

    if (mediaContainer) {
      mediaContainer.innerHTML = '';
      if (file.type === 'video') {
        const wrapper = document.createElement('div');
        wrapper.className = 'lightbox-media-wrapper loading';
        wrapper.innerHTML = `<div class="spinner"></div>`;

        const video = document.createElement('video');
        video.className = 'lightbox-media';
        video.controls = true;
        video.autoplay = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = 'metadata';

        const rawUrl = ManifestStore.getRawUrl(file.path);
        let triedFallback = false;

        video.src = cdnUrl;

        video.addEventListener('loadeddata', () => {
          wrapper.classList.remove('loading');
          const spinner = wrapper.querySelector('.spinner');
          if (spinner) spinner.remove();
        });

        video.addEventListener('error', () => {
          if (!triedFallback) {
            triedFallback = true;
            console.warn('CDN video load failed, retrying with raw GitHub URL...');
            video.src = rawUrl;
            video.load();
          } else {
            console.error('All video playback sources failed.');
            wrapper.classList.remove('loading');
            wrapper.innerHTML = `
              <div class="video-error-fallback">
                <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <circle cx="10" cy="13" r="2"/>
                  <path d="m20 17-10.5-7.5"/>
                </svg>
                <p>Video preview unavailable for direct streaming.</p>
                <p class="text-xs text-muted">Large video files (~${formatBytes(file.bytes)}) require downloading to play locally.</p>
                <button class="btn-primary" id="video-fallback-dl-btn">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                  <span>Download Original Video (${formatBytes(file.bytes)})</span>
                </button>
              </div>
            `;
            const dlBtn = wrapper.querySelector('#video-fallback-dl-btn');
            if (dlBtn) dlBtn.onclick = () => Gallery.triggerDownload(file, dlBtn);
          }
        });

        wrapper.appendChild(video);
        mediaContainer.appendChild(wrapper);
        activeMediaEl = video;
      } else {
        const previewUrl = ManifestStore.getLightboxUrl(file.path, 1600);
        const img = document.createElement('img');
        img.className = 'lightbox-media';
        img.src = previewUrl;
        img.alt = file.alt;

        img.addEventListener('error', () => {
          if (img.src !== cdnUrl) {
            img.src = cdnUrl;
          }
        });

        mediaContainer.appendChild(img);
        activeMediaEl = img;
      }
    }

    if (downloadBtn) {
      downloadBtn.onclick = () => Gallery.triggerDownload(file, downloadBtn);
    }

    if (githubBtn) {
      githubBtn.href = githubUrl;
    }

    if (copyBtn) {
      copyBtn.onclick = () => Gallery.copyDirectLink(file);
    }

    // Update URL hash to point to wallpaper
    window.history.replaceState(null, '', `#wallpaper/${file.category}/${file.name}`);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    open,
    close,
    prev,
    next
  };
})();
