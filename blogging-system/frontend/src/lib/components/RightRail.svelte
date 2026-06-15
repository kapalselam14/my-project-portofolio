<script>
  import { onMount } from "svelte";
  import { fetchTopAuthors } from '$lib/api/profile-api.js';

  export let limit = 3;
  
  let topAuthors = [];
  let loading = true;
  let error = null;

  // Ensure images load from backend (dev server only proxies /api)
  const backendBase = import.meta.env.VITE_BACKEND_ORIGIN || 'http://localhost:3000';
  function imgUrl(path) {
    const p = path && path.trim().length > 0 ? path : '/default-avatars/arcane-magic.png';
    if (p.startsWith('http')) return p;
    const normalized = p.startsWith('/') ? p : `/${p}`;
    return `${backendBase}${normalized}`;
  }

  onMount(async () => {
    try {
      topAuthors = await fetchTopAuthors(limit);
    } catch (e) {
      error = e?.message || 'Failed to load top authors';
    } finally {
      loading = false;
    }
  });
</script>

<aside class="right-rail" aria-label="Right sidebar">
  <div class="rail-card">
    <h3>Top Authors</h3>
    {#if loading}
      <p class ="loading">Loading...</p>
    {:else if error}
      <p class="error">{error}</p>
    {:else if topAuthors.length === 0}
      <p class="empty">No authors found.</p>
    {:else}
      <ul class="top-authors">
      {#each topAuthors as author}
        <li class="author-row">
          <a class="author-link" href={`/profile/${author.id}`} title={`View @${author.username}'s profile`}>
            <img 
              class="avatar" 
              src={imgUrl(author.avatar_url)} 
              alt={author.username} 
            />
            <div class="author-info">
              <div class="author-name">@{author.username}</div>
              <div class="author-stats">{author.article_count} {author.article_count === 1 ? 'post' : 'posts'} • {author.total_likes} likes</div>
            </div>
          </a>
        </li>
      {/each}
    </ul>
    {/if}
  </div>
</aside>

<style>
  .right-rail {
    position: sticky;
    top: calc(10vh + 2rem + 2px);
    height: max-content;
  }
  
  .rail-card {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 16px;
  }
  .rail-card h3 {
    font-size: 18px;
    margin: 0 0 6px 0;
  }
  .rail-card h3 {
    font-size: 18px;
    margin: 0 0 6px 0;
  }
  
  .avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
    box-shadow: 0 0 0 1px var(--border);
  }
  
  .top-authors {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
  }
  /* simple dividers between rows */
  .top-authors li + li {
    border-top: 1px solid var(--border);
    padding-top: 12px;
    margin-top: 12px;
  }
  
  .author-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 10px 0;
    cursor: pointer;
    transition: all 0.3s ease;
    border-radius: 10px;
    padding: 6px 6px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .author-row:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .author-link:hover .author-name {
    text-decoration: underline;
    color: var(--accent);
  }
  
  .author-info {
    display: flex;
    flex-direction: column;
  }
  
  .author-name {
    font-weight: 600;
    font-size: 16px;
    letter-spacing: 0.2px;
  }
  
  .author-stats {
    font-size: 14px;
    color: var(--muted);
  }
  
  .author-link{
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: inherit;
    width: 100%;
  }
  .loading, .error, .empty {
    text-align: center;
    padding: 20px;
    font-size: 15px;
  }
  
  .loading {
    color: #888;
  }
  
  .error {
    color: #ef4444;
  }
  
  .empty {
    color: #999;
  }

  /* Mobile Responsive Design (≤768px) */
  @media (max-width: 768px) {
    .right-rail {
      position: static;
      width: 100%;
      max-width: 100%;
    }

    .rail-card {
      padding: 1rem;
      margin-bottom: 0;
      border-radius: 12px;
    }

    .rail-card h3 {
      font-size: 16px;
      margin-bottom: 0.75rem;
    }

    .top-authors {
      margin-top: 0.5rem;
    }

    .top-authors li + li {
      margin-top: 0.75rem;
    }

    .author-row {
      padding: 0;
    }

    .avatar {
      width: 42px;
      height: 42px;
    }

    .author-link {
      gap: 0.75rem;
      padding: 0.5rem;
    }

    .author-name {
      font-size: 14px;
    }

    .author-stats {
      font-size: 12px;
    }
  }

  /* Extra small devices */
  @media (max-width: 375px) {
    .rail-card {
      padding: 0.875rem;
    }

    .rail-card h3 {
      font-size: 15px;
    }

    .avatar {
      width: 38px;
      height: 38px;
    }

    .author-name {
      font-size: 13px;
    }

    .author-stats {
      font-size: 11px;
    }
  }
</style>
