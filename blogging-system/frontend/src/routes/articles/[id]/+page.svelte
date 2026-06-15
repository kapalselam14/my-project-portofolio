<script>
  import Article from "$lib/components/Article.svelte";
  import RightRail from "$lib/components/RightRail.svelte";
  import Comment from "$lib/components/Comment.svelte";
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { user } from "$lib/stores/user.js";
  import { goto } from "$app/navigation";

  export let data;
  $: id = data.id;

  let post = null;
  let comments = [];
  let newCommentText = "";
  let loading = true;
  let posting = false;
  let showComments = true;

  const API_BASE = "http://localhost:3000/";

  // Helper function to get avatar URL
  function getUserAvatarUrl(user) {
    if (!user || !user.avatar_url) {
      return "http://localhost:3000/default-avatars/arcane-magic.png";
    }
    const avatarUrl = user.avatar_url;
    // If already a full URL, use it
    if (avatarUrl.startsWith("http")) {
      return avatarUrl;
    }
    // If relative path, add backend URL
    return `${API_BASE}${avatarUrl.replace(/^\/+/, "")}`;
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

  // Fetch article with images
  async function refreshArticle() {
    try {
      const res = await fetch(`/api/articles/${id}`);
      if (res.ok) {
        const data = await res.json();
        const article = data.article;
        const images = data.images || [];

        // Fetch author username and avatar
        const authorRes = await fetch(`/api/users/${article.author_id}/public`);
        let authorUsername = "";
        let authorAvatar = "http://localhost:3000/default-avatars/arcane-magic.png";
        if (authorRes.ok) {
          const authorData = await authorRes.json();
          authorUsername = authorData.username || "";
          // Process author avatar URL
          if (authorData.avatar_url) {
            if (authorData.avatar_url.startsWith("http")) {
              authorAvatar = authorData.avatar_url;
            } else {
              authorAvatar = API_BASE + authorData.avatar_url.replace(/^\/+/, "");
            }
          }
        }

        // Map images with full URL
        const fullImages = images.map((img) => API_BASE + img.url.replace(/^\/+/, ""));

        // Add header image if exists
        if (
          article.header_image_url &&
          !fullImages.includes(API_BASE + article.header_image_url.replace(/^\/+/, ""))
        ) {
          fullImages.unshift(API_BASE + article.header_image_url.replace(/^\/+/, ""));
        }

        // Preserve existing comment count when refreshing
        const existingCommentCount = post?.stats?.comments || 0;

        post = {
          id: article.id,
          author: authorUsername,
          author_id: article.author_id,
          avatar: authorAvatar,
          timeAgo: formatTimeAgo(article.created_at || article.updated_at),
          title: article.title,
          body: [article.content],
          images: fullImages,
          stats: { likes: 0, comments: existingCommentCount }
        };

        // Fetch like count
        try {
          const likeRes = await fetch(`/api/articles/${id}/likes/count`);
          if (likeRes.ok) {
            const likeData = await likeRes.json();
            post.stats.likes = likeData.likesCount ?? 0;
          }
        } catch (e) {}
      }
    } catch (err) {
      console.error("Error fetching article:", err);
    }
  }

  // Build comment tree from flat list
  function buildCommentTree(flatComments) {
    const commentMap = new Map();
    const rootComments = [];

    // First pass: create map of all comments
    flatComments.forEach((comment) => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: build tree structure
    flatComments.forEach((comment) => {
      const commentNode = commentMap.get(comment.id);
      if (comment.parent_comment_id) {
        const parent = commentMap.get(comment.parent_comment_id);
        if (parent) {
          parent.replies.push(commentNode);
        }
      } else {
        rootComments.push(commentNode);
      }
    });

    return rootComments;
  }

  // Fetch all comments with nested structure
  async function fetchComments() {
    try {
      const res = await fetch(`/api/articles/${id}/comments`);
      if (res.ok) {
        const rawComments = await res.json();
        // Process avatar URLs for each comment
        const flatComments = rawComments.map((c) => {
          let avatarUrl = "";
          if (c.avatar_url) {
            if (c.avatar_url.startsWith("http")) {
              avatarUrl = c.avatar_url;
            } else {
              avatarUrl = API_BASE + c.avatar_url.replace(/^\/+/, "");
            }
          } else {
            avatarUrl = "http://localhost:3000/default-avatars/arcane-magic.png";
          }
          return {
            ...c,
            avatar: avatarUrl
          };
        });

        comments = buildCommentTree(flatComments);

        // Update comment count
        if (post) {
          post.stats.comments = flatComments.length;
          post = post;
        }
      }
    } catch (err) {
      console.error("Error fetching comments:", err);
      comments = [];
    }
  }

  // Fetch article and comments
  async function fetchArticleAndComments() {
    loading = true;
    await refreshArticle();
    await fetchComments();
    loading = false;
  }

  // Add comment
  async function addComment() {
    const token = localStorage.getItem("token");
    if (!token) {
      goto("/login");
      return;
    }

    if (!id || !newCommentText.trim()) return;

    posting = true;
    try {
      const res = await fetch(`/api/articles/${id}/comments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: newCommentText
        })
      });

      if (res.ok) {
        newCommentText = "";
        await fetchComments();
      } else {
        const error = await res.json();
        console.error("Failed to post comment:", error);
      }
    } catch (err) {
      console.error("Error adding comment:", err);
    } finally {
      posting = false;
    }
  }

  onMount(fetchArticleAndComments);
</script>

<svelte:head>
  <title>{post?.title || "Article"}</title>
</svelte:head>

<div class="content-shell">
  <main class="feed" aria-label="Article">
    {#if loading}
      <div class="loading">
        <p>Loading article...</p>
      </div>
    {:else if post}
      <Article {post} full={true} {refreshArticle} />

      <!-- Comments Section -->
      <div class="comments-section">
        <div class="comments-header">
          <div class="comments-title">
            <svg viewBox="0 0 24 24" width="24" height="24" class="comment-icon">
              <path
                d="M20 2H4a2 2 0 0 0-2 2v14l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"
                fill="currentColor"
              />
            </svg>
            <div class="comments-prompt">
              <a href="#comment-form" class="comments-link">Comments ({post.stats.comments})</a>
            </div>
          </div>
          <button
            class="toggle-comments-btn"
            on:click={() => (showComments = !showComments)}
            aria-label={showComments ? "Hide comments section" : "Show comments section"}
          >
            {showComments ? "Hide Comments Section" : "Show Comments Section"}
          </button>
        </div>

        {#if showComments}
          <div class="comments-container" transition:slide={{ duration: 300 }}>
            {#if comments.length === 0}
              <p class="no-comments">No comments yet. Be the first to share your thoughts!</p>
            {:else}
              <div class="comments-list">
                {#each comments as comment (comment.id)}
                  <Comment
                    {comment}
                    depth={0}
                    articleAuthorId={post.author_id}
                    on:refresh={fetchComments}
                  />
                {/each}
              </div>
            {/if}
          </div>
        {/if}

        <div class="comment-form-container" id="comment-form">
          {#if $user}
            <form class="comment-form" on:submit|preventDefault={addComment}>
              <div class="form-header">
                <img src={getUserAvatarUrl($user)} alt={$user.username} class="user-avatar" />
                <span class="username">@{$user.username}</span>
              </div>
              <textarea
                bind:value={newCommentText}
                placeholder="Share your thoughts..."
                rows="3"
                disabled={posting}
              />
              <div class="form-actions">
                <button type="submit" class="post-btn" disabled={!newCommentText.trim() || posting}>
                  {posting ? "Posting..." : "Post Comment"}
                </button>
              </div>
            </form>
          {:else}
            <div class="login-prompt">
              <svg viewBox="0 0 24 24" width="48" height="48" class="lock-icon">
                <path
                  d="M12 1a5 5 0 0 0-5 5v4H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V12a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm0 2a3 3 0 0 1 3 3v4H9V6a3 3 0 0 1 3-3z"
                  fill="currentColor"
                />
              </svg>
              <p>You must <a href="/login">log in</a> to comment</p>
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <div class="error">
        <p>Ope! Hold your horses 🐎, You are trying to find something that doesn't exist.</p>
        <a href="/" class="back-link">← Back to Home</a>
      </div>
    {/if}
  </main>
  <RightRail />
</div>

<style>
  .content-shell {
    --header-height: 64px;
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
  }

  .loading,
  .error {
    text-align: center;
    padding: 3rem;
    color: var(--text-secondary);
  }

  .back-link {
    display: inline-block;
    margin-top: 1rem;
    color: var(--primary-color);
    text-decoration: none;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  .comments-section {
    margin-top: 2rem;
    padding: 2rem;
    background: var(--card);
    border-radius: 16px;
    border: 1px solid var(--border);
  }

  .comments-list {
    min-width: 100%;
    overflow-x: auto;
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 2px solid var(--border);
  }

  .comments-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 2rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text);
    padding-bottom: 1rem;
    border-bottom: 2px solid var(--border);
  }

  .comments-title {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text);
  }

  .toggle-comments-btn {
    padding: 0.5rem 1.25rem;
    background: var(--accent, #1d9bf0);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.4s ease;
    white-space: nowrap;
  }

  .toggle-comments-btn:hover {
    background: var(--accent-hover, #1a8cd8);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  .toggle-comments-btn:active {
    transform: translateY(0);
  }

  .comments-container {
    overflow: hidden;
  }

  .comment-icon {
    color: var(--primary-color);
  }

  .no-comments {
    text-align: center;
    padding: 3rem 2rem;
    color: var(--text-secondary);
    font-style: italic;
    font-size: 1.05rem;
  }

  .comment-form-container {
    margin-top: 2rem;
  }

  .comment-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .user-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--border);
  }

  .username {
    font-weight: 600;
    color: var(--text);
  }

  .comment-form textarea {
    min-height: 100px;
    padding: 1rem;
    border-radius: 12px;
    border: 2px solid var(--border);
    font-size: 1rem;
    font-family: inherit;
    line-height: 1.6;
    resize: vertical;
    background: var(--input-bg);
    color: var(--text);
    transition: border-color 0.2s;
  }

  .comment-form textarea:focus {
    outline: none;
    border-color: var(--primary-color);
  }

  .comment-form textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
  }

  .post-btn {
    padding: 0.75rem 2rem;
    border-radius: 24px;
    background: var(--accent, #1d9bf0);
    color: #fff;
    border: none;
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.4s ease;
  }

  .post-btn:hover:not(:disabled) {
    background: var(--accent-hover, #1a8cd8);
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  }

  .post-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }

  .login-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    text-align: center;
    padding: 3rem 2rem;
    background: var(--input-bg);
    border-radius: 12px;
    border: 2px dashed var(--border);
  }

  .lock-icon {
    color: var(--text-secondary);
    opacity: 0.5;
  }

  .login-prompt p {
    color: var(--text-secondary);
    font-size: 1.05rem;
  }

  .login-prompt a {
    color: var(--primary-color);
    text-decoration: none;
    font-weight: 600;
  }

  .login-prompt a:hover {
    text-decoration: underline;
  }

  .comments-link {
    color: var(--primary-color);
    text-decoration: none;
  }
  
  .comments-link:hover {
    color: var(--accent-hover);
    text-decoration: none;
  }

  .comments-prompt::after {
    position: absolute;
    bottom: -25px;
    right: -40%;
    background-color: rgba(98, 97, 97, 0.5);
    border-radius: 10px;
    padding: 4px 10px;
    font-size: 11px;
    color: white;
    content: "click to leave a comment";
    opacity: 0;
    pointer-events: none;
    white-space: nowrap;
    z-index: 100;
    font-weight: normal;
  }

  .comments-prompt {
    position: relative;
    display: inline-block;
  }

  .comments-prompt:hover::after {
    opacity: 1;
  }

  @media (max-width: 960px) {
    .content-shell {
      grid-template-columns: 1fr;
    }

    .comments-section {
      padding: 1.5rem;
    }

    .comments-header {
      font-size: 1.25rem;
    }
  }
</style>
