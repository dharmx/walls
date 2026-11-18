const ManifestStore = (function () {
  let manifestData = null;

  function getRepoPath() {
    const htmlRepo = document.documentElement.getAttribute('data-repo');
    return htmlRepo || 'dharmx/walls';
  }

  function getCDNUrl(filePath, bytes) {
    const repo = getRepoPath();
    if (bytes === undefined && manifestData && manifestData.files) {
      const found = manifestData.files.find(f => f.path === filePath);
      if (found) bytes = found.bytes;
    }
    // jsDelivr enforces a strict 20MB limit. Bypass for files >= 19MB using raw GitHub.
    if (bytes && bytes >= 19 * 1024 * 1024) {
      return `https://raw.githubusercontent.com/${repo}/main/${filePath}`;
    }
    return `https://cdn.jsdelivr.net/gh/${repo}@main/${filePath}`;
  }

  function getRawUrl(filePath) {
    const repo = getRepoPath();
    return `https://raw.githubusercontent.com/${repo}/main/${filePath}`;
  }

  function getThumbnailUrl(filePath, width = 400) {
    const rawUrl = getRawUrl(filePath);
    const stripped = rawUrl.replace(/^https?:\/\//, '');
    return `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}&w=${width}&fit=cover`;
  }

  function getLightboxUrl(filePath, width = 1600) {
    const rawUrl = getRawUrl(filePath);
    const stripped = rawUrl.replace(/^https?:\/\//, '');
    return `https://images.weserv.nl/?url=${encodeURIComponent(stripped)}&w=${width}&fit=contain`;
  }

  function getGitHubBlobUrl(filePath) {
    const repo = getRepoPath();
    return `https://github.com/${repo}/blob/main/${filePath}`;
  }

  let loadError = false;

  async function loadManifest() {
    if (manifestData) return manifestData;
    try {
      const response = await fetch('manifest.json');
      if (!response.ok) {
        throw new Error(`Failed to fetch manifest.json: ${response.statusText}`);
      }
      manifestData = await response.json();
      loadError = false;
      return manifestData;
    } catch (err) {
      console.error('Error loading manifest.json:', err);
      loadError = true;
      return { categories: [], files: [], hasError: true };
    }
  }

  function hasLoadError() {
    return loadError;
  }

  function getCategories() {
    return manifestData ? manifestData.categories : [];
  }

  function getAllFiles() {
    return manifestData ? manifestData.files : [];
  }

  function getFilesByCategory(categorySlug) {
    if (!manifestData) return [];
    if (!categorySlug || categorySlug === 'all') {
      return manifestData.files;
    }
    return manifestData.files.filter(f => f.category === categorySlug);
  }

  function searchFiles(query, categorySlug = 'all') {
    if (!manifestData || !query) return getFilesByCategory(categorySlug);
    const cleanQuery = query.toLowerCase().trim();
    let pool = getFilesByCategory(categorySlug);
    return pool.filter(f => f.name.toLowerCase().includes(cleanQuery) || f.alt.toLowerCase().includes(cleanQuery));
  }

  return {
    getRepoPath,
    getCDNUrl,
    getRawUrl,
    getThumbnailUrl,
    getLightboxUrl,
    getGitHubBlobUrl,
    loadManifest,
    hasLoadError,
    getCategories,
    getAllFiles,
    getFilesByCategory,
    searchFiles
  };
})();
