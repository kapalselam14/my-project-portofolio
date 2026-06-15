<script>
  import Article from "./Article.svelte";
  import { onMount } from "svelte";

  let articles = [];
  let loading = true;
  let errorMsg = "";

  // Get user ID from JWT
  let userId = null;
  function getUserIdFromToken() {
    const token = localStorage.getItem("token");
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      // access user_id directly from payload
      return payload.user_id || payload.id || null;
    } catch {
      return null;
    }
  }

  // Format time ago
  function formatTimeAgo(dateString) {
    let date;
    if (typeof dateString === "string" && dateString.length === 19) {
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

  // Get username and avatar from user ID
  async function getAuthorInfo(author_id) {
    try {
      const res = await fetch(`/api/users/${author_id}/public`);
      if (res.ok) {
        const user = await res.json();
        if (user) {
          // Helper to convert avatar_url to full URL
          const getAvatarUrl = (avatarPath) => {
            if (!avatarPath) return "http://localhost:3000/default-avatars/arcane-magic.png";
            if (avatarPath.startsWith("http")) return avatarPath;
            if (avatarPath.startsWith("/")) return `http://localhost:3000${avatarPath}`;
            return `http://localhost:3000/${avatarPath}`;
          };

          return {
            username: user.username || "",
            avatar: getAvatarUrl(user.avatar_url)
          };
        }
      }
    } catch (e) {
      console.error("Failed to fetch author info for author_id:", author_id, e);
    }
    return {
      username: "",
      avatar: "http://localhost:3000/default-avatars/arcane-magic.png"
    };
  }

  // Map API article to component format
  async function mapArticle(apiArticle) {
    const API_BASE = "http://localhost:3000/";
    let images = [];

    // Fetch additional images
    try {
      const imgRes = await fetch(`${API_BASE}api/articles/${apiArticle.id}/images`);
      if (imgRes.ok) {
        const imgData = await imgRes.json();
        images = imgData.map((img) => API_BASE + img.url.replace(/^\/+/, ""));
      }
    } catch (e) {
      console.error("Failed to fetch images:", e);
    }

    // Add header image
    if (apiArticle.header_image_url) {
      const headerUrl = API_BASE + apiArticle.header_image_url.replace(/^\/+/, "");
      if (!images.includes(headerUrl)) {
        images.unshift(headerUrl);
      }
    }

    // Fetch author info (username and avatar)
    const authorInfo = await getAuthorInfo(apiArticle.author_id);

    // Fetch top 2 comments for preview
    let comments = [];
    let totalCommentsCount = 0;
    try {
      const commentsRes = await fetch(`/api/articles/${apiArticle.id}/comments?limit=2`);
      if (commentsRes.ok) {
        const allComments = await commentsRes.json();
        totalCommentsCount = allComments.length;
        const rootComments = allComments.filter((c) => !c.parent_comment_id);
        // map comments with author_id
        comments = rootComments.slice(0, 2).map((c) => ({
          id: c.id,
          username: c.username || `user${c.author_id}`,
          author_id: c.author_id,
          avatar: c.avatar_url
            ? c.avatar_url.startsWith("http")
              ? c.avatar_url
              : `http://localhost:3000/${c.avatar_url.replace(/^\/+/, "")}`
            : "http://localhost:3000/default-avatars/arcane-magic.png",
          created_at: c.created_at,
          content: c.content,
          article_id: apiArticle.id
        }));
      }
    } catch (e) {
      console.error("Failed to fetch comments:", e);
    }

    return {
      id: apiArticle.id,
      author: authorInfo.username,
      avatar: authorInfo.avatar,
      timeAgo: formatTimeAgo(apiArticle.created_at || apiArticle.updated_at),
      title: apiArticle.title,
      body: [apiArticle.content],
      images,
      stats: {
        likes: apiArticle.likes ?? 0,
        comments: totalCommentsCount || (apiArticle.comments ?? 0)
      },
      comments
    };
  }

  // Fetch liked articles
  async function fetchLikedArticles() {
    loading = true;
    errorMsg = "";
    userId = getUserIdFromToken();

    if (!userId) {
      errorMsg = "You must be logged in to view favourites.";
      loading = false;
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/articles/liked/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const apiArticles = await res.json();
        // Map each article to the format expected by Article component
        articles = await Promise.all(apiArticles.map(mapArticle));
      } else {
        const err = await res.json();
        errorMsg = err.error || "Failed to fetch liked articles.";
      }
    } catch (e) {
      errorMsg = "Network error. Please try again.";
      console.error("Fetch liked articles error:", e);
    }
    loading = false;
  }

  onMount(fetchLikedArticles);
</script>

<div class="favourites-container">
  <h1>Your Liked Articles</h1>

  {#if loading}
    <div class="loading">
      <p>Loading your favourites...</p>
    </div>
  {:else if errorMsg}
    <div class="error">
      <p>{errorMsg}</p>
    </div>
  {:else if articles.length === 0}
    <div class="empty">
      <p>You haven't liked any articles yet.</p>
      <p class="hint">Start exploring and like articles to see them here!</p>
    </div>
  {:else}
    <div class="liked-articles">
      {#each articles as post (post.id)}
        <Article {post} refreshArticle={fetchLikedArticles} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .favourites-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  h1 {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 2rem;
    border-bottom: 2px solid var(--border);
    padding-bottom: 0.75rem;
  }

  .liked-articles {
    display: flex;
    flex-direction: column;
    gap: 2rem;
    margin-top: 1rem;
  }

  .loading,
  .error,
  .empty {
    text-align: center;
    padding: 3rem 1rem;
  }

  .loading p {
    color: var(--text-secondary);
    font-size: 1.1rem;
  }

  .error p {
    color: var(--like, #e35d5b);
    font-size: 1.1rem;
  }

  .empty p {
    color: var(--text-secondary);
    font-size: 1.1rem;
    margin-bottom: 0.5rem;
  }

  .empty .hint {
    font-size: 0.95rem;
    font-style: italic;
  }
</style>
