<script>
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { searchScope, isGlobalScope, userChoseGlobalScope } from '$lib/stores/searchScope.js';

  // Search-related state
  let searchInput = '';
  let searchInputRef;

  // Live search dropdown state
  let searchSuggestions = [];
  let showSearchDropdown = false;
  let searchDebounceTimer;
  let searchDropdownRef;

  // Check if we're on a profile page or search results page with authorId
  $: isProfilePage = $page.url.pathname.startsWith('/profile/');
  $: isSearchPage = $page.url.pathname.startsWith('/search');
  $: isHomePage = $page.url.pathname === '/';
  $: searchAuthorId = $page.url.searchParams.get('authorId');
  
  // Show chip purely based on searchScope state
  // Chip shows whenever scope is set to a user (not global)
  // User must explicitly click × to remove it
  $: showChip = !isGlobalScope($searchScope) && !isHomePage;
  
  // Auto-reset scope to global when navigating to home page
  $: if (isHomePage && !isGlobalScope($searchScope)) {
    searchScope.set('global');
  }

  // Live search: fetch top 5 matches as user types
  async function fetchSearchSuggestions(query) {
    const trimmedQuery = query.trim();
    
    // Require minimum 2 characters for search
    if (!trimmedQuery || trimmedQuery.length < 2) {
      searchSuggestions = [];
      showSearchDropdown = false;
      return;
    }

    try {
      const params = new URLSearchParams();
      params.append('search', trimmedQuery);
      
      // IMPORTANT: If on home page, ALWAYS search globally
      // Apply scope filter only if NOT on home page AND scope is not global
      if (!isHomePage && !isGlobalScope($searchScope)) {
        params.append('authorId', $searchScope.userId);
      }

      const response = await fetch(`http://localhost:3000/api/articles?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        searchSuggestions = data.slice(0, 5); // Top 5 results only
        showSearchDropdown = true;
      }
    } catch (error) {
      console.error('Error fetching search suggestions:', error);
      searchSuggestions = [];
    }
  }

  // Debounced search input handler
  function handleSearchInput() {
    clearTimeout(searchDebounceTimer);
    
    // If less than 2 characters, close dropdown immediately
    if (searchInput.trim().length < 2) {
      searchSuggestions = [];
      showSearchDropdown = false;
      return;
    }
    
    searchDebounceTimer = setTimeout(() => {
      fetchSearchSuggestions(searchInput);
    }, 300); // 300ms debounce
  }

  // Navigate to article when clicked
  function goToArticle(articleId) {
    showSearchDropdown = false;
    searchInput = '';
    goto(`/articles/${articleId}`);
  }

  // Strip HTML tags for preview
  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  // Handle Enter key press in search - go to full search page
  function handleSearchKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      showSearchDropdown = false; // Close dropdown
      
      const query = searchInput.trim();
      
      // Require minimum 2 characters
      if (query && query.length >= 2) {
        // IMPORTANT: If on home page, ALWAYS search globally
        // This prevents scope from persisting when navigating from profile page
        if (isHomePage || isGlobalScope($searchScope)) {
          goto(`/search?q=${encodeURIComponent(query)}`);
        } else {
          goto(`/search?q=${encodeURIComponent(query)}&authorId=${$searchScope.userId}`);
        }
      }
    }
  }

  // Toggle scope to global (when user clicks × on chip)
  function setGlobalScope() {
    searchScope.set('global');
    // Mark that user explicitly chose global scope
    userChoseGlobalScope.set(true);
  }

  // Click outside handler for search dropdown
  function handleClickOutside(event) {
    // Close search dropdown
    if (
      showSearchDropdown &&
      searchDropdownRef &&
      !searchDropdownRef.contains(event.target) &&
      searchInputRef &&
      !searchInputRef.contains(event.target)
    ) {
      showSearchDropdown = false;
    }
  }

  onMount(() => {
    document.addEventListener('mousedown', handleClickOutside);
  });

  onDestroy(() => {
    document.removeEventListener('mousedown', handleClickOutside);
    clearTimeout(searchDebounceTimer);
  });
</script>

<div class="search-container">
  <!-- Search Icon (only when no chip) -->
  {#if !showChip}
    <span class="search-icon">🔍</span>
  {/if}

  <!-- Profile Chip (inside search bar, shown on profile or search page with authorId) -->
  {#if showChip}
    <div class="scope-chip">
      <span class="chip-avatar">👤</span>
      <span class="chip-text">{$searchScope.username}</span>
      <button 
        class="chip-close"
        on:click={setGlobalScope}
        aria-label="Remove filter"
        title="Search all articles"
      >
        ×
      </button>
    </div>
    
    <!-- Divider line -->
    <div class="chip-divider"></div>
  {/if}

  <input 
    class="searchbox"
    class:has-chip={showChip}
    type="text" 
    placeholder={showChip ? `Search in ${$searchScope.username || 'this profile'}` : "Search Articles..."}
    bind:value={searchInput}
    bind:this={searchInputRef}
    on:input={handleSearchInput}
    on:keydown={handleSearchKeydown}
  />

  <!-- Live Search Dropdown (Top 5 results) -->
  {#if showSearchDropdown}
    <div class="search-dropdown" bind:this={searchDropdownRef}>
      {#if searchSuggestions.length > 0}
        <div class="search-results">
          {#each searchSuggestions as article}
            <button 
              class="search-result-item"
              on:click={() => goToArticle(article.id)}
            >
              <div class="result-title">{article.title}</div>
              <div class="result-meta">
                <span class="result-author">by {article.username}</span>
                <span class="result-date">{new Date(article.created_at).toLocaleDateString()}</span>
              </div>
              <div class="result-preview">{stripHtml(article.content).substring(0, 100)}...</div>
            </button>
          {/each}
        </div>
        <div class="search-dropdown-footer">
          Press Enter to see all results
        </div>
      {:else}
        <!-- No results message (respects scope) -->
        <div class="no-results">
          {#if !isGlobalScope($searchScope)}
            <div class="no-results-icon">🔍</div>
            <div class="no-results-text">No results found in <strong>{$searchScope.username}</strong>'s articles</div>
            <button class="search-global-btn" on:click={setGlobalScope}>
              Search all articles instead
            </button>
          {:else}
            <div class="no-results-icon">🔍</div>
            <div class="no-results-text">No results found</div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .search-container {
    position: relative;
    flex: 1;
    min-width: 250px;
    max-width: 80%;
    width: 100%;
    display: flex;
    align-items: center;
    border: 2px solid;
    border-color: var(--searchbox-border);
    border-radius: 999px;
    background-color: var(--textbox-bg);
    padding: 8px 16px;
    gap: 8px;
    box-sizing: border-box;
    overflow: visible;
  }

  .search-icon {
    display: flex;
    align-items: center;
    font-size: 20px;
    flex-shrink: 0;
  }

  /* Profile Chip inside search bar */
  .scope-chip {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px 4px 4px;
    background: #e5e7eb;
    border-radius: 16px;
    flex-shrink: 0;
    position: relative;
  }

  :global(body.dark) .scope-chip {
    background: #374151;
  }

  :global(body.dark) .chip-text {
    color: #f3f4f6;
  }

  :global(body.dark) .chip-close {
    background: #f3f4f6;
    color: #111827;
  }

  :global(body.dark) .chip-close:hover {
    background: #e5e7eb;
  }

  :global(body.dark) .chip-divider {
    background: #4b5563;
  }

  .chip-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #14b8a6;
    color: white;
    font-size: 12px;
    flex-shrink: 0;
  }

  .chip-text {
    font-size: 13px;
    font-weight: 600;
    color: #111827;
    white-space: nowrap;
  }

  .chip-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: #111827;
    color: white;
    border: none;
    font-size: 14px;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    transition: all 0.2s ease;
  }

  .chip-close:hover {
    background: #374151;
    transform: scale(1.1);
  }

  .chip-divider {
    width: 1px;
    height: 20px;
    background: #d1d5db;
    flex-shrink: 0;
  }

  .searchbox {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-style: italic;
    font-weight: bold;
    font-size: 15px;
    color: var(--text);
    min-width: 0;
    padding: 0;
  }

  .searchbox.has-chip {
    padding-left: 0;
  }

  .searchbox::placeholder {
    color: #9ca3af;
  }

  .search-container:focus-within {
    border-color: rgb(136, 136, 134);
    box-shadow: 0 0 1px rgb(221, 221, 218);
  }

  .search-container:hover {
    background-color: #cfcbc6;
  }

  :global(body.dark) .search-container:hover {
    background-color: rgb(62, 62, 61);
  }

  /* Live Search Dropdown */
  .search-dropdown {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-height: 400px;
    overflow-y: auto;
    z-index: 1000;
  }

  .search-results {
    display: flex;
    flex-direction: column;
  }

  .search-result-item {
    padding: 12px 16px;
    border: none;
    border-bottom: 1px solid var(--border);
    background: var(--card);
    text-align: left;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .search-result-item:hover {
    background: var(--button-hover);
  }

  .search-result-item:last-child {
    border-bottom: none;
  }

  .result-title {
    font-weight: 600;
    color: var(--text);
    margin-bottom: 4px;
    font-size: 14px;
  }

  .result-meta {
    display: flex;
    gap: 12px;
    font-size: 12px;
    color: var(--muted);
    margin-bottom: 6px;
  }

  .result-author {
    color: var(--accent);
  }

  .result-preview {
    font-size: 13px;
    color: var(--muted);
    line-height: 1.4;
  }

  .search-dropdown-footer {
    padding: 10px 16px;
    text-align: center;
    font-size: 12px;
    color: var(--muted);
    background: var(--bg);
    border-top: 1px solid var(--border);
    font-style: italic;
  }

  .no-results {
    padding: 32px 24px;
    text-align: center;
  }

  .no-results-icon {
    font-size: 48px;
    margin-bottom: 12px;
    opacity: 0.5;
  }

  .no-results-text {
    color: var(--muted);
    font-size: 14px;
    margin-bottom: 16px;
  }

  .no-results-text strong {
    color: var(--accent);
    font-weight: 600;
  }

  .search-global-btn {
    padding: 8px 16px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    transition: background 0.2s ease;
  }

  .search-global-btn:hover {
    background: var(--accent-hover);
  }

  

  /* Mobile Optimization (≤768px) */
  @media (max-width: 768px) {
    .search-container {
      /* Flexible sizing */
      min-width: 0;
      max-width: 100%;
      
      /* Compact spacing */
      padding: 0.375rem 0.625rem; /* 6px 10px */
      gap: 0.375rem; /* 6px */
      
      /* Thinner border for mobile */
      border-width: 1px;
    }

    /* Scope chip - compact but touchable */
    .scope-chip {
      padding: 0.25rem 0.375rem 0.25rem 0.25rem; /* 4px 6px 4px 4px */
      gap: 0.25rem; /* 4px */
      max-width: 120px;
      border-radius: 12px;
    }

    .chip-avatar {
      width: 16px;
      height: 16px;
      font-size: 10px;
      flex-shrink: 0;
    }

    .chip-text {
      font-size: 11px;
      font-weight: 500;
      max-width: 80px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Touch-friendly close button (min 44px touch target recommended) */
    .chip-close {
      width: 20px;
      height: 20px;
      font-size: 14px;
      min-width: 20px;
      min-height: 20px;
      flex-shrink: 0;
      /* Larger tap area with pseudo-element */
      position: relative;
    }

    .chip-close::before {
      content: '';
      position: absolute;
      top: -8px;
      left: -8px;
      right: -8px;
      bottom: -8px;
      /* Invisible but tappable area */
    }

    .chip-close:active {
      transform: scale(0.9);
    }

    .chip-divider {
      height: 16px;
      flex-shrink: 0;
    }

    /* Search input */
    .searchbox {
      font-size: 13px;
      min-width: 0;
      flex: 1;
    }

    .searchbox::placeholder {
      font-size: 12px;
    }

    /* Search dropdown - full width on mobile */
    .search-dropdown {
      left: -10px;
      right: -10px;
      width: calc(100% + 20px);
      max-height: 60vh; /* Don't take entire screen */
    }

    /* Search result items - larger touch targets */
    .search-result-item {
      padding: 0.75rem 1rem; /* 12px 16px */
      min-height: 44px; /* Apple HIG recommendation */
    }

    .result-title {
      font-size: 13px;
      line-height: 1.4;
    }

    .result-meta {
      font-size: 11px;
      margin-top: 0.25rem;
    }

    .result-preview {
      font-size: 12px;
      line-height: 1.3;
      margin-top: 0.25rem;
    }

    /* No results section */
    .no-results {
      padding: 2rem 1.5rem;
    }

    .no-results-icon {
      font-size: 40px;
    }

    .no-results-text {
      font-size: 13px;
    }

    .search-global-btn {
      padding: 0.625rem 1rem; /* 10px 16px */
      font-size: 13px;
      min-height: 44px; /* Touch-friendly */
    }
  }

  /* Extra small devices optimization */
  @media (max-width: 375px) {
    .search-container {
      padding: 0.25rem 0.5rem; /* 4px 8px */
      gap: 0.25rem; /* 4px */
    }

    .scope-chip {
      max-width: 100px;
    }

    .chip-text {
      max-width: 60px;
      font-size: 10px;
    }

    .searchbox {
      font-size: 12px;
    }

    .searchbox::placeholder {
      font-size: 11px;
    }
  }
</style>

