<!-- home page -->
<script>
  import Article from "$lib/components/Article.svelte";
  import RightRail from "$lib/components/RightRail.svelte";
  import { sortBy, sortOrder } from "$lib/stores/sort.js";
  import { onMount } from "svelte";
  import { refreshHomeArticles } from "$lib/stores/refreshHomeArticles.js";
  import { get } from "svelte/store";
  // Reactively refresh articles if refreshHomeArticles is set to true
  $: if ($refreshHomeArticles) {
    fetchArticles();
    refreshHomeArticles.set(false);
  }

  let articles = [];
  let isLoading = false;

  // Backend base URL for images
  const API_BASE = "http://localhost:3000/";

  // to fetch username by author_id
  async function getAuthorUsername(author_id) {
    try {
      const res = await fetch(`/api/users/${author_id}/public`);
      if (res.ok) {
        const user = await res.json();
        if (user && typeof user.username === "string" && user.username.length > 0) {
          return user.username;
        }
      }
    } catch (e) {
      console.error("Failed to fetch username for author_id:", author_id, e);
    }
    // return `user${author_id}`;
    return "";
  }

  async function mapArticle(apiArticle) {
    let images = [];
    try {
      const imgRes = await fetch(`${API_BASE}api/articles/${apiArticle.id}/images`);
      if (imgRes.ok) {
        const imgData = await imgRes.json();
        images = imgData.map((img) => API_BASE + img.url.replace(/^\/+/, ""));
      }
    } catch (e) {}

    if (apiArticle.header_image_url) {
      const headerUrl = API_BASE + apiArticle.header_image_url.replace(/^\/+/, "");
      if (!images.includes(headerUrl)) {
        images.unshift(headerUrl);
      }
    }

    // Fetch username for author_id
    // Use username from backend (provided via JOIN in search endpoint)
    const authorUsername = apiArticle.username || (await getAuthorUsername(apiArticle.author_id));

    // Get author avatar from backend or fallback
    let authorAvatar = "";
    if (apiArticle.avatar_url) {
      if (apiArticle.avatar_url.startsWith("http")) {
        authorAvatar = apiArticle.avatar_url;
      } else {
        authorAvatar = API_BASE + apiArticle.avatar_url.replace(/^\/+/, "");
      }
    } else {
      authorAvatar = "http://localhost:3000/default-avatars/arcane-magic.png";
    }

    // Fetch top 2 root comments for preview, mapping avatar URLs
    let comments = [];
    try {
      const commentsRes = await fetch(`${API_BASE}api/articles/${apiArticle.id}/comments`);
      if (commentsRes.ok) {
        const apiComments = await commentsRes.json();
        const rootComments = apiComments.filter((c) => !c.parent_comment_id).slice(0, 2);
        comments = rootComments.map((c) => {
          let commentAvatar = "";
          if (c.avatar_url) {
            if (c.avatar_url.startsWith("http")) {
              commentAvatar = c.avatar_url;
            } else {
              commentAvatar = API_BASE + c.avatar_url.replace(/^\/+/, "");
            }
          } else {
            commentAvatar = "http://localhost:3000/default-avatars/arcane-magic.png";
          }
          return {
            ...c,
            author: c.username || `user${c.author_id}`,
            avatar: commentAvatar,
            timeAgo: formatTimeAgo(c.created_at),
            text: [c.content],
            children: [] // For future nested comments
          };
        });
      }
    } catch (e) {
      console.error("Failed to fetch comments for article", apiArticle.id, e);
    }

    return {
      id: apiArticle.id,
      author: authorUsername,
      author_id: apiArticle.author_id,
      avatar: authorAvatar,
      timeAgo: formatTimeAgo(apiArticle.created_at || apiArticle.updated_at),
      title: apiArticle.title,
      body: [apiArticle.content],
      images,
      stats: {
        likes: apiArticle.likes ?? 0,
        comments: apiArticle.comments ?? 0
      },
      comments
    };
  }

  // to format time ago
  function formatTimeAgo(dateString) {
    // Parse as UTC and convert to local time
    // SQLite returns 'YYYY-MM-DD HH:MM:SS', so treat as UTC
    let date;
    if (typeof dateString === "string" && dateString.length === 19) {
      // Convert 'YYYY-MM-DD HH:MM:SS' to ISO format
      date = new Date(dateString.replace(" ", "T") + "Z");
    } else {
      date = new Date(dateString);
    }
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
    return date.toLocaleDateString();
  }
  // Fetch articles with sorting (no search on main page)

  // Fetch articles with search (case insensitive, searches title & content)
  async function fetchArticles() {
    isLoading = true;
    try {
      const params = new URLSearchParams();
      // Use sort from stores
      params.append("sortBy", $sortBy);
      params.append("sortOrder", $sortOrder);

      const url = `/api/articles?${params.toString()}`;
      const res = await fetch(url);

      if (res.ok) {
        let apiArticles = await res.json();
        articles = await Promise.all(apiArticles.map(mapArticle));
      } else {
        articles = [];
      }
    } catch (error) {
      console.error("Failed to fetch articles:", error);
      articles = [];
    } finally {
      isLoading = false;
    }
  }

  // Track if initial load is done to prevent double-fetch
  let initialLoadComplete = false;

  // Subscribe to sort changes (only after initial load)
  $: if (initialLoadComplete && ($sortBy || $sortOrder)) {
    fetchArticles();
  }

  onMount(async () => {
    await fetchArticles();
    initialLoadComplete = true;
  });
</script>

<svelte:head>
  <title>Home</title>
</svelte:head>

<div class="content-shell">
  <main class="feed" aria-label="Post feed">
    {#if isLoading}
      <div class="loading-state">
        <p>⏳ Loading articles...</p>
      </div>
    {:else if articles.length === 0}
      <p class="no-articles">No articles yet. Be the first to post!</p>
    {:else}
      {#each articles as post (post.id)}
        <Article {post} />
      {/each}
    {/if}
  </main>
  <RightRail />
</div>

<style>
  /* Layout shell: center content, right rail beside feed */
  .content-shell {
    --header-height: 64px; /* adjust to match your header */
    --rail-width: 320px; /* right sidebar width */
    --gap: 24px;

    max-width: 1100px;
    margin: 0 auto;
    padding: 16px 20px 48px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--rail-width);
    gap: var(--gap);
  }

  /* Main feed scrolls with the page; no special container needed */
  .feed {
    min-width: 0; /* allow content to shrink in grid */
    display: flex;
    flex-direction: column;
    gap: 32px;
    padding: 0; /* spacing handled by content-shell */
  }

  /* No articles message */
  .no-articles,
  .loading-state {
    text-align: center;
    padding: 48px 24px;
    color: var(--muted);
    font-size: 16px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  .loading-state p {
    color: var(--text);
    font-size: 18px;
    margin: 0;
  }

  /* Responsive: collapse right rail on small screens */
  @media (max-width: 960px) {
    .content-shell {
      grid-template-columns: 1fr;
    }
  }

  /* Mobile: Move Top Authors above articles */
  @media (max-width: 768px) {
    .content-shell {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem 0.75rem 2rem;
    }

    /* Order 1: Top Authors (RightRail) */
    .content-shell :global(.right-rail) {
      order: 1;
      width: 100%;
      max-width: 100%;
    }

    /* Order 2: Articles feed */
    .feed {
      order: 2;
      gap: 1.5rem;
    }
  }

  /* Extra small devices */
  @media (max-width: 375px) {
    .content-shell {
      padding: 0.75rem 0.5rem 1.5rem;
      gap: 0.75rem;
    }

    .feed {
      gap: 1rem;
    }
  }
</style>
