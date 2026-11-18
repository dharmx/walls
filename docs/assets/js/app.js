(function () {
  let activeCategory = 'all';
  let searchQuery = '';
  let searchTimeout = null;

  async function initApp() {
    console.log('Initializing Wallpaper Gallery application...');
    
    // Load manifest data
    const manifest = await ManifestStore.loadManifest();
    
    if (manifest.hasError || ManifestStore.hasLoadError()) {
      renderManifestError();
      return;
    }

    // Render hero statistics & marquee
    renderHeroStats(manifest);
    initHeroMarquee(manifest.files);

    // Render category rail chips & modal
    renderCategoryRail(manifest.categories);
    initAllCategoriesModal(manifest.categories);

    // Setup UI listeners
    setupSearchInput();
    initScrollToTop();

    // Handle initial hash routing
    handleHashRouting();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashRouting);
  }

  function renderManifestError() {
    const container = document.getElementById('gallery-grid');
    const sentinel = document.getElementById('loading-sentinel');
    if (sentinel) sentinel.style.display = 'none';
    if (!container) return;

    container.innerHTML = `
      <div class="manifest-error-container">
        <h3>Couldn't load the wallpaper gallery</h3>
        <p>Please check your network connection and try again.</p>
        <button class="btn-primary" onclick="location.reload()">Retry Loading</button>
      </div>
    `;
  }

  function initHeroMarquee(files) {
    const track = document.getElementById('hero-marquee-track');
    if (!track || !files || files.length === 0) return;

    // Pick 18 sample image files
    const imageFiles = files.filter(f => f.type === 'image');
    if (imageFiles.length === 0) return;

    const sampleSize = Math.min(18, imageFiles.length);
    const step = Math.max(1, Math.floor(imageFiles.length / sampleSize));
    const samples = [];

    for (let i = 0; i < sampleSize; i++) {
      samples.push(imageFiles[(i * step) % imageFiles.length]);
    }

    // Duplicate samples array so CSS marquee animation scrolls continuously
    const fullTrackItems = [...samples, ...samples];

    track.innerHTML = fullTrackItems.map(file => {
      const thumbUrl = ManifestStore.getThumbnailUrl(file.path, 300);
      return `<img class="hero-marquee-item" src="${thumbUrl}" alt="${file.alt}" loading="lazy" />`;
    }).join('');
  }

  function renderHeroStats(manifest) {
    const totalFilesEl = document.getElementById('stat-total-files');
    const totalCatsEl = document.getElementById('stat-total-categories');

    const totalFiles = manifest.files ? manifest.files.length : 0;
    const totalCats = manifest.categories ? manifest.categories.length : 0;

    if (totalFilesEl) {
      totalFilesEl.textContent = `${totalFiles.toLocaleString()}+ Wallpapers`;
    }
    if (totalCatsEl) {
      totalCatsEl.textContent = `${totalCats} Categories`;
    }
  }

  function renderCategoryRail(categories) {
    const wrapper = document.getElementById('category-chips-wrapper');
    const downloadAllContainer = document.getElementById('category-download-all-container');
    if (!wrapper) return;

    wrapper.innerHTML = '';

    // "All Categories" Chip
    const allCount = categories.reduce((sum, cat) => sum + cat.count, 0);
    const allChip = document.createElement('a');
    allChip.href = '#category/all';
    allChip.className = `chip-item ${activeCategory === 'all' ? 'active' : ''}`;
    allChip.setAttribute('data-category', 'all');
    allChip.innerHTML = `
      <span>All</span>
      <span class="chip-badge">${allCount}</span>
    `;
    allChip.addEventListener('click', (e) => {
      e.preventDefault();
      selectCategory('all');
    });
    wrapper.appendChild(allChip);

    // Individual Category Chips
    categories.forEach(cat => {
      const chip = document.createElement('a');
      chip.href = `#category/${cat.slug}`;
      chip.className = `chip-item ${activeCategory === cat.slug ? 'active' : ''}`;
      chip.setAttribute('data-category', cat.slug);

      // Task 1: Use thumbnail proxy for category chip covers
      const coverUrl = cat.cover ? ManifestStore.getThumbnailUrl(cat.cover, 60) : '';

      chip.innerHTML = `
        ${coverUrl ? `<img class="chip-thumb" src="${coverUrl}" alt="${cat.label} cover" loading="lazy" />` : ''}
        <span>${cat.label}</span>
        <span class="chip-badge">${cat.count}</span>
      `;

      chip.addEventListener('click', (e) => {
        e.preventDefault();
        selectCategory(cat.slug);
      });

      wrapper.appendChild(chip);
    });

    setupRailScrollAffordance(wrapper);
    updateDownloadAllButton();
  }

  function setupRailScrollAffordance(wrapper) {
    const prevBtn = document.getElementById('rail-scroll-prev');
    const nextBtn = document.getElementById('rail-scroll-next');
    if (!prevBtn || !nextBtn || !wrapper) return;

    function updateScrollState() {
      const scrollLeft = wrapper.scrollLeft;
      const maxScroll = wrapper.scrollWidth - wrapper.clientWidth;

      if (scrollLeft <= 5) {
        prevBtn.classList.remove('visible');
        wrapper.classList.add('at-start');
      } else {
        prevBtn.classList.add('visible');
        wrapper.classList.remove('at-start');
      }

      if (scrollLeft >= maxScroll - 5) {
        nextBtn.classList.remove('visible');
        wrapper.classList.add('at-end');
      } else {
        nextBtn.classList.add('visible');
        wrapper.classList.remove('at-end');
      }
    }

    prevBtn.addEventListener('click', () => {
      wrapper.scrollBy({ left: -240, behavior: 'smooth' });
    });

    nextBtn.addEventListener('click', () => {
      wrapper.scrollBy({ left: 240, behavior: 'smooth' });
    });

    wrapper.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState, { passive: true });
    setTimeout(updateScrollState, 100);
  }

  function updateDownloadAllButton() {
    const container = document.getElementById('category-download-all-container');
    if (!container) return;

    if (activeCategory === 'all') {
      container.innerHTML = '';
      return;
    }

    const repo = ManifestStore.getRepoPath();
    const downloadZipUrl = `https://download-directory.github.io/?url=https://github.com/${repo}/tree/main/${activeCategory}`;

    container.innerHTML = `
      <a 
        href="${downloadZipUrl}" 
        target="_blank" 
        rel="noopener noreferrer" 
        class="category-download-all-btn" 
        title="Download all wallpapers in this category via Download-Directory"
      >
        ${Icons.download}
        <span>Download All (.zip)</span>
      </a>
    `;
  }

  function selectCategory(slug) {
    activeCategory = slug;
    
    // Update active class on chips
    const chips = document.querySelectorAll('#category-chips-wrapper .chip-item');
    chips.forEach(chip => {
      if (chip.getAttribute('data-category') === slug) {
        chip.classList.add('active');
        chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        chip.classList.remove('active');
      }
    });

    updateDownloadAllButton();
    updateGalleryView();
    window.location.hash = `#category/${slug}`;
  }

  function setupSearchInput() {
    const input = document.getElementById('search-input');
    const clearBtn = document.getElementById('search-clear-btn');
    if (!input) return;

    input.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      if (clearBtn) {
        if (searchQuery.length > 0) {
          clearBtn.classList.add('visible');
        } else {
          clearBtn.classList.remove('visible');
        }
      }

      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        updateGalleryView();
        if (searchQuery.length > 0) {
          window.history.replaceState(null, '', `#search/${encodeURIComponent(searchQuery)}`);
        }
      }, 200);
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        searchQuery = '';
        clearBtn.classList.remove('visible');
        updateGalleryView();
        window.history.replaceState(null, '', `#category/${activeCategory}`);
      });
    }
  }

  function updateGalleryView() {
    let files = [];
    const countEl = document.getElementById('search-result-count');

    if (searchQuery.trim().length > 0) {
      files = ManifestStore.searchFiles(searchQuery, activeCategory);
      if (countEl) {
        countEl.style.display = 'block';
        const scope = activeCategory === 'all' ? 'all categories' : `category "${activeCategory}"`;
        countEl.textContent = `${files.length} wallpaper${files.length === 1 ? '' : 's'} matching "${searchQuery.trim()}" in ${scope}`;
      }
    } else {
      files = ManifestStore.getFilesByCategory(activeCategory);
      if (countEl) {
        countEl.style.display = 'none';
        countEl.textContent = '';
      }
    }
    Gallery.setFiles(files, activeCategory);
  }

  function handleHashRouting() {
    const hash = window.location.hash;
    if (!hash) {
      updateGalleryView();
      return;
    }

    if (hash.startsWith('#category/')) {
      const slug = hash.replace('#category/', '');
      if (slug && slug !== activeCategory) {
        activeCategory = slug;
        selectCategory(slug);
      } else {
        updateGalleryView();
      }
    } else if (hash.startsWith('#search/')) {
      const query = decodeURIComponent(hash.replace('#search/', ''));
      searchQuery = query;
      const input = document.getElementById('search-input');
      if (input) input.value = query;
      const clearBtn = document.getElementById('search-clear-btn');
      if (clearBtn && query) clearBtn.classList.add('visible');
      updateGalleryView();
    } else if (hash.startsWith('#wallpaper/')) {
      // Deep link to specific wallpaper lightbox: #wallpaper/<category>/<filename>
      const parts = hash.replace('#wallpaper/', '').split('/');
      if (parts.length >= 2) {
        const cat = parts[0];
        const filename = parts.slice(1).join('/');
        activeCategory = cat;
        
        // Select category
        const chips = document.querySelectorAll('.chip-item');
        chips.forEach(chip => {
          if (chip.getAttribute('data-category') === cat) chip.classList.add('active');
          else chip.classList.remove('active');
        });

        const files = ManifestStore.getFilesByCategory(cat);
        Gallery.setFiles(files, cat);

        const index = files.findIndex(f => f.name === filename || f.path === `${cat}/${filename}`);
        if (index !== -1) {
          setTimeout(() => Lightbox.open(files, index), 200);
        }
      }
    }
  }

  function initAllCategoriesModal(categories) {
    const modalBtn = document.getElementById('all-categories-modal-btn');
    const dialogEl = document.getElementById('all-categories-dialog');
    const closeBtn = document.getElementById('all-categories-close-btn');
    const gridEl = document.getElementById('all-categories-modal-grid');

    if (!modalBtn || !dialogEl || !gridEl) return;

    function closeModal() {
      if (dialogEl.close) {
        dialogEl.close();
      } else {
        dialogEl.removeAttribute('open');
      }
      document.body.style.overflow = '';
    }

    function openModal() {
      if (dialogEl.showModal) {
        dialogEl.showModal();
      } else {
        dialogEl.setAttribute('open', '');
      }
      document.body.style.overflow = 'hidden';
    }

    // Render category grid inside modal
    gridEl.innerHTML = categories.map(cat => {
      const coverUrl = cat.cover ? ManifestStore.getThumbnailUrl(cat.cover, 80) : '';
      return `
        <a href="#category/${cat.slug}" class="chip-item" data-cat="${cat.slug}">
          ${coverUrl ? `<img class="chip-thumb" src="${coverUrl}" alt="${cat.label}" loading="lazy" />` : ''}
          <span>${cat.label}</span>
          <span class="chip-badge">${cat.count}</span>
        </a>
      `;
    }).join('');

    // Grid click listener
    gridEl.querySelectorAll('.chip-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const slug = item.getAttribute('data-cat');
        closeModal();
        selectCategory(slug);
      });
    });

    modalBtn.addEventListener('click', openModal);

    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    // Backdrop click detection
    dialogEl.addEventListener('click', (e) => {
      const rect = dialogEl.getBoundingClientRect();
      const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
                          rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
      if (!isInDialog) {
        closeModal();
      }
    });

    dialogEl.addEventListener('cancel', () => {
      document.body.style.overflow = '';
    });
  }

  function initScrollToTop() {
    const btn = document.getElementById('scroll-to-top-btn');
    if (!btn) return;

    window.addEventListener('scroll', () => {
      const threshold = window.innerHeight * 1.5;
      if (window.scrollY > threshold) {
        btn.classList.add('visible');
      } else {
        btn.classList.remove('visible');
      }
    }, { passive: true });

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
