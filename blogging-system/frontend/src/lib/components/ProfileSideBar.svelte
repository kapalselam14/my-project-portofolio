<script>
  import {goto} from '$app/navigation';
  
   export let stats = {
    posts: 0,
    likes: 0
  };
  export let topArticles = [];
  export let active = 'posts';
  export let onSelect = (k) => {};
  
  function handleArticleClick(articleId) {
    goto(`/articles/${articleId}`);
  }
</script>

<aside class="profile-rail">
  <div class="rail-card">
    <h2>Statistics</h2>
    <div class="stats-grid">
      <div class="stat-item" class:active={active==='posts'}>
        <div class="stat-icon">📝</div>
        <div class="stat-content">
          <div class="stat-label">Posts</div>
          <div class="stat-value">{stats.posts}</div>
        </div>
      </div>
      <div class="stat-item" class:active={active==='likes'}>
        <div class="stat-icon">👍</div>
        <div class="stat-content">
          <div class="stat-label">Likes</div>
          <div class="stat-value">{stats.likes}</div>
        </div>
      </div>
    </div>
  </div>
  {#if topArticles.length > 0}
    <div class="rail-card">
      <h2>🏆 Top Article</h2>
      <div class="top-articles">
        {#each topArticles as article, index (article.id)}
          <div 
          class="article-item"
          on:click={() => handleArticleClick(article.id)}
          on:keypress={(e)=> e.key === 'Enter' && handleArticleClick(article.id)}
          role="button"
          tabindex="0"
          >
            <div class="article-rank">#{index + 1}</div>
            <div class="article-info">
              <div class="article-title">{article.title}</div>
              <div class="article-likes">👍 {article.like_count} {article.like_count === 1 ? 'like' : 'likes'}</div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</aside>

<style>
  .profile-rail {
    z-index: auto;
    align-self: flex-start;
  }

  .rail-card {
    background: var(--card, #fff);
    border: 1px solid var(--border, #e6e6e6);
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 16px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    transition: box-shadow 0.3s ease;
  }

  .rail-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .stats-grid {
    display: grid;
    gap: 12px;
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px;
    border-radius: 12px;
    background: var(--bg, #f9fafb);
    border: 2px solid black;
    transition: all 0.3s ease;
  }

  .stat-item.active .stat-label,
  .stat-item.active .stat-value {
    color: var(--text, #111827);
  }

  .stat-icon {
    font-size: 32px;
    line-height: 1;
    flex-shrink: 0;
  }

  .stat-item.active .stat-icon {
    filter: brightness(1.2);
  }

  .stat-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stat-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--muted, #6b7280);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--text, #111827);
    line-height: 1;
  }

  /* Add this to the <style> section at the bottom */

.top-articles {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.article-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: var(--bg, #f9fafb);
  border-radius: 8px;
  border: 1px solid var(--border, #e6e6e6);
  transition: all 0.2s ease;
  cursor: pointer;
}

.article-item:hover {
  background: var(--hover-bg, #f3f4f6);
  transform: translateX(4px);
  border-color: var(--accent, #2563eb);
}

.article-rank {
  font-size: 18px;
  font-weight: 700;
  color: var(--accent, #2563eb);
  min-width: 32px;
  text-align: center;
}

.article-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.article-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text, #111827);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.article-likes {
  font-size: 12px;
  color: var(--muted, #6b7280);
  font-weight: 500;
}

h2 {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text, #111827);
}
.article-item:focus {
    outline: 2px solid var(--accent, #2563eb);
    outline-offset: 2px;
  }
/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .rail-card {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .rail-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .stat-item {
    background: rgba(255, 255, 255, 0.05);
  }

  .stat-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  
  /* Fix top article hover in dark mode */
  .article-item:hover {
    background: rgba(255, 255, 255, 0.08);
  }
  
  .article-title {
    color: var(--text, #f9fafb);
  }
}

/* Mobile Responsive Design (≤768px) */
@media (max-width: 768px) {
  .profile-rail {
    width: 100%;
    max-width: 100%;
  }

  .rail-card {
    padding: 1rem;
    margin-bottom: 1rem;
    border-radius: 12px;
  }

  h2 {
    font-size: 15px;
    margin-bottom: 0.75rem;
  }

  /* Make stats horizontal on mobile */
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .stat-item {
    padding: 0.875rem;
    gap: 0.625rem;
  }

  .stat-icon {
    font-size: 28px;
  }

  .stat-label {
    font-size: 11px;
  }

  .stat-value {
    font-size: 20px;
  }

  /* Top articles - more compact on mobile */
  .top-articles {
    gap: 0.625rem;
  }

  .article-item {
    padding: 0.75rem;
    gap: 0.625rem;
  }

  .article-rank {
    font-size: 16px;
    min-width: 28px;
  }

  .article-title {
    font-size: 13px;
  }

  .article-likes {
    font-size: 11px;
  }
}

/* Extra small devices */
@media (max-width: 375px) {
  .rail-card {
    padding: 0.875rem;
  }

  .stats-grid {
    gap: 0.625rem;
  }

  .stat-item {
    padding: 0.75rem;
    gap: 0.5rem;
  }

  .stat-icon {
    font-size: 24px;
  }

  .stat-value {
    font-size: 18px;
  }
}
</style>