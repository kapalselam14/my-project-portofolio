<script>
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import Article from "$lib/components/Article.svelte";
  import RightRail from "$lib/components/RightRail.svelte";
  import { sortBy, sortOrder } from "$lib/stores/sort.js";
  import { searchScope, isGlobalScope, userChoseGlobalScope } from "$lib/stores/searchScope.js";
  import { getUserById } from "$lib/api/profile-api.js";
  import { mapArticles } from "$lib/utils/articleMapper.js";
  
  /** @type {import('./$types').PageData} */
  export let data;
  
  let currentArticles = [];
  let isLoading = false;
  let scopedUsername = '';
  let initialLoadDone = false;
  
  // Get authorId from page data
  $: urlAuthorId = data.authorId;
  
  // Track if user explicitly chose global
  let userExplicitlyChoseGlobal = false;
  $: userChoseGlobalScope.subscribe(value => {
    userExplicitlyChoseGlobal = value;
  });
  
  // When URL has authorId, reset the "user chose global" flag
  // This allows a new scoped search to work after user previously went global
  $: if (urlAuthorId) {
    userChoseGlobalScope.set(false);
  }
  
  // Reactive: Update scope when urlAuthorId changes
  // Set scope immediately so chip shows, then fetch username to update it
  $: {
    if (urlAuthorId && !userExplicitlyChoseGlobal) {
      const userId = parseInt(urlAuthorId);
      
      // Check if we already have the correct scope with username
      if ($searchScope && $searchScope.type === 'user' && $searchScope.userId === userId && $searchScope.username) {
        // Scope already set with real username, keep cache in sync
        scopedUsername = $searchScope.username;
      } else if (scopedUsername) {
        // We have cached username, use it immediately
        searchScope.set({
          type: 'user',
          userId: userId,
          username: scopedUsername
        });
      } else {
        // No cached username - set scope with userId first (chip will show "User")
        // Then fetch real username and update
        searchScope.set({
          type: 'user',
          userId: userId,
          username: '' // Empty initially, will be updated
        });
        
        getUserById(urlAuthorId).then(userData => {
          scopedUsername = userData.username;
          searchScope.set({
            type: 'user',
            userId: userId,
            username: userData.username
          });
        }).catch(error => {
          console.error('[Search] Failed to fetch user data:', error);
          // Keep scope with userId but no username
        });
      }
    } else if (!urlAuthorId) {
      // No authorId means global search
      searchScope.set('global');
      scopedUsername = '';
    }
  }
  
  onMount(async () => {
    // Initial setup - fetch search results and mark as ready
    // Scope setting is handled by reactive statement above
    await fetchSearchResults();
    initialLoadDone = true;
  });
  
  
  // Function to search globally
  function searchGlobally() {
    if (data.query) {
      // Set scope to global to remove the chip
      searchScope.set('global');
      goto(`/search?q=${encodeURIComponent(data.query)}`);
    }
  }

  // Fetch search results with current sort settings and scope
  async function fetchSearchResults() {
    if (!data.query || !data.query.trim()) {
      currentArticles = [];
      return;
    }

    isLoading = true;
    try {
      const params = new URLSearchParams();
      params.append('search', data.query.trim());
      params.append('sortBy', $sortBy);
      params.append('sortOrder', $sortOrder);
      
      // Add authorId if searching within a profile scope
      if (urlAuthorId) {
        params.append('authorId', urlAuthorId);
      }

      const res = await fetch(`/api/articles?${params.toString()}`);
      
      if (res.ok) {
        currentArticles = await res.json();
      } else {
        currentArticles = [];
      }
    } catch (error) {
      console.error('Failed to fetch search results:', error);
      currentArticles = [];
    } finally {
      isLoading = false;
    }
  }

  // Re-fetch when sort changes
  $: if (initialLoadDone && ($sortBy || $sortOrder)) {
    fetchSearchResults();
  }

  // Update when page data changes (new search query)
  $: if (initialLoadDone && data.query) {
    fetchSearchResults();
  }

  // Map articles once data is loaded
  let mappedArticles = [];
  $: {
    if (currentArticles && currentArticles.length > 0) {
      mapArticles(currentArticles).then(result => {
        mappedArticles = result;
      });
    } else {
      mappedArticles = [];
    }
  }
</script>

<svelte:head>
  <title>Search Results{data.query ? ` - ${data.query}` : ''}</title>
</svelte:head>

<div class="content-shell">
  <main class="feed" aria-label="Search results">
    <div class="search-header">
      <h1>Search Results</h1>
      {#if data.query}
        <p class="search-query">Showing results for: <strong>"{data.query}"</strong></p>
      {/if}
    </div>

    {#if data.error}
      <div class="error-message">
        <p>❌ {data.error}</p>
        <p class="hint">Please try again later.</p>
      </div>
    {:else if !data.query}
      <div class="no-query">
        <p>🔍 Enter a search term to find articles</p>
      </div>
    {:else if isLoading}
      <div class="loading-state">
        <p>⏳ Loading results...</p>
      </div>
    {:else if mappedArticles.length === 0}
      <div class="no-results">
        {#if urlAuthorId && scopedUsername}
          <!-- Scoped search - no results in user's profile -->
          <div class="no-results-icon">🔍</div>
          <h2>Hm...we couldn't find any results for "{data.query}"</h2>
          <p class="hint">in <strong>{scopedUsername}</strong>'s articles</p>
          <p class="suggestion">Double-check your spelling or try different keywords</p>
          <button class="show-all-btn" on:click={searchGlobally}>
            Show results from all articles →
          </button>
        {:else}
          <!-- Global search - no results anywhere -->
          <div class="no-results-icon">🔍</div>
          <h2>Hm...we couldn't find any results for "{data.query}"</h2>
          <p class="suggestion">Double-check your spelling or try different keywords</p>
        {/if}
      </div>
    {:else}
      <div class="results-count">
        Found {mappedArticles.length} {mappedArticles.length === 1 ? 'article' : 'articles'}
      </div>
      {#each mappedArticles as post (post.id)}
        <Article {post} />
      {/each}
    {/if}
  </main>
  <RightRail />
</div>

<style>
  .content-shell {
    --rail-width: 320px;
    --gap: 24px;
    max-width: 1100px;
    margin: 0 auto;
    padding: 16px 20px 48px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--rail-width);
    gap: var(--gap);
  }

  .feed {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .search-header {
    padding: 14px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    margin-bottom: 8px;
  }

  .search-header h1 {
    margin: 0 0 4px 0;
    font-size: 18px;
    color: var(--text);
  }

  .search-query {
    margin: 0;
    font-size: 16px;
    color: var(--muted);
  }

  .search-query strong {
    color: var(--accent);
  }

  .results-count {
    padding: 12px 16px;
    background: var(--bg);
    border-left: 4px solid var(--accent);
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
  }

  .no-results,
  .no-query,
  .error-message,
  .loading-state {
    text-align: center;
    padding: 64px 24px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  .no-results p:first-child,
  .no-query p,
  .error-message p:first-child,
  .loading-state p {
    font-size: 18px;
    color: var(--text);
    margin: 0 0 12px 0;
  }

  .hint {
    font-size: 14px;
    color: var(--muted);
    margin: 8px 0 0 0;
  }

  /* Reddit-style no results */
  .no-results-icon {
    font-size: 64px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .no-results h2 {
    margin: 0 0 8px 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--text);
  }

  .suggestion {
    font-size: 14px;
    color: var(--muted);
    margin: 12px 0 20px 0;
  }

  .show-all-btn {
    display: inline-block;
    margin-top: 16px;
    padding: 10px 24px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 999px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .show-all-btn:hover {
    background: var(--accent-hover, #2563eb);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  }

  @media (max-width: 960px) {
    .content-shell {
      grid-template-columns: 1fr;
    }
  }
</style>

