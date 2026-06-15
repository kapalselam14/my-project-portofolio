<script>
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import ProfileHeader from "$lib/components/ProfileHeader.svelte";
  import ProfileSidebar from "$lib/components/ProfileSidebar.svelte";
  import EditArticleModal from "$lib/components/EditArticleModal.svelte";
  import DeleteArticleModal from "$lib/components/DeleteArticleModal.svelte";
  import Article from "$lib/components/Article.svelte";
  import { sortBy, sortOrder } from "$lib/stores/sort.js";
  import { searchScope, userChoseGlobalScope } from "$lib/stores/searchScope.js";
  import {
    getCurrentUser,
    getArticlesByAuthor,
    getUserStats,
    getArticleCountByAuthor
  } from "$lib/api/profile-api.js";

  $: id = $page.params.id;
  let active = "posts";

  let user = null;
  let stats = { posts: 0, likes: 0 };
  let topArticles = [];
  let posts = [];
  let loading = true;
  let error = "";
  let showEditModal = false;
  let showDeleteModal = false;
  let selectedArticle = null;

  let isOwner = false; // is profile owner

  // Loading state for posts
  let isLoadingPosts = false;

  function onSelectTab(k) {
    active = k;
    // filter posts / fetch different data depending on active tab
  }

  function onEditProfile() {
    // open editor modal or navigate to /profile/edit
    console.log("edit profile");
  }

  // handle edit article
  function handleEditArticle(event) {
    selectedArticle = event.detail.article;
    showEditModal = true;
  }

  // handle delete article
  function handleDeleteArticle(event) {
    selectedArticle = event.detail.article;
    showDeleteModal = false;
    setTimeout(() => {
      showDeleteModal = true;
    }, 0);
  }

  // refresh articles after edit/delete
  async function refreshArticles() {
    try {
      const apiPosts = await getArticlesByAuthor(id);
      const API_BASE = "http://localhost:3000/";

      posts = await Promise.all(
        apiPosts.map(async (apiArticle) => {
          let images = [];

          try {
            const imgRes = await fetch(`${API_BASE}api/articles/${apiArticle.id}/images`);
            if (imgRes.ok) {
              const imgData = await imgRes.json();
              images = imgData.map((img) => API_BASE + img.url.replace(/^\/+/, ""));
            }
          } catch (e) {
            console.error("Failed to fetch images:", e);
          }

          if (apiArticle.header_image_url) {
            const headerUrl = API_BASE + apiArticle.header_image_url.replace(/^\/+/, "");
            if (!images.includes(headerUrl)) {
              images.unshift(headerUrl);
            }
          }

          let comments = [];
          let totalCommentsCount = 0;
          try {
            const commentsRes = await fetch(`${API_BASE}api/articles/${apiArticle.id}/comments`);
            if (commentsRes.ok) {
              const apiComments = await commentsRes.json();
              totalCommentsCount = apiComments.length;
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
                  id: c.id,
                  username: c.username || `user${c.author_id}`,
                  author_id: c.author_id,
                  avatar: commentAvatar,
                  created_at: c.created_at,
                  content: c.content,
                  article_id: apiArticle.id
                };
              });
            }
          } catch (e) {
            console.error("Failed to fetch comments for article", apiArticle.id, e);
          }

          // fetch like count for this article
          let likesCount = 0;
          try {
            const likesRes = await fetch(`${API_BASE}api/articles/${apiArticle.id}/likes/count`);
            if (likesRes.ok) {
              const likesData = await likesRes.json();
              likesCount = likesData.likesCount || 0;
            }
          } catch (e) {
            console.error("Failed to fetch likes for article", apiArticle.id, e);
          }

          // include stats with actual counts
          return {
            ...apiArticle,
            images,
            comments,
            stats: {
              likes: likesCount,
              comments: totalCommentsCount || apiArticle.comments || 0
            }
          };
        })
      );

      const countData = await getArticleCountByAuthor(id);
      stats.posts = countData.articleCount ?? posts.length;
    } catch (e) {
      console.error("Failed to refresh articles:", e);
    }
  }

  // Helper to format time ago
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

  // Article component expects `post.author` to be a simple handle/string and `post.avatar` to be a string.
  // Profile posts use `author` as a user object; normalize for Article rendering without mutating original data.
  $: displayPosts = posts.map((p) => {
    // Use username from backend, fallback to handle or "Unknown Author"
    const author =
      p.username && p.username.trim()
        ? p.username
        : (typeof p.author === "object" ? p.author.handle || p.author.name : p.author) ||
          user?.handle ||
          "Unknown Author";
    // Use the logged-in user's avatar for all posts and comments
    const avatarUrl = p.avatar_url
      ? p.avatar_url.startsWith("http")
        ? p.avatar_url
        : `http://localhost:3000/${p.avatar_url.replace(/^\/+/, "")}`
      : user?.avatar || "http://localhost:3000/default-avatars/arcane-magic.png";

    // Format time ago
    const timeAgo = formatTimeAgo(p.created_at || p.updated_at);

    // Helper to convert avatar_url to full URL
    const getCommentAvatarUrl = (avatarPath) => {
      if (!avatarPath) return "http://localhost:3000/default-avatars/arcane-magic.png";
      if (avatarPath.startsWith("http")) return avatarPath;
      if (avatarPath.startsWith("/")) return `http://localhost:3000${avatarPath}`;
      return `http://localhost:3000/${avatarPath}`;
    };

    // Update comments to use the profile owner's avatar if they are the author
    const updatedComments = Array.isArray(p.comments)
      ? p.comments.map((c) => {
          // If comment author matches profile owner, update avatar
          if (c.user_id === user?.id || c.username === user?.handle || c.author_id === user?.id) {
            return { ...c, avatar: avatarUrl };
          }
          // Otherwise use comment's avatar_url
          return { ...c, avatar: getCommentAvatarUrl(c.avatar_url || c.avatar) };
        })
      : [];

    return {
      ...p,
      author,
      avatar: avatarUrl,
      timeAgo,
      body: Array.isArray(p.body) ? p.body : p.content ? [p.content] : p.body ? [p.body] : [],
      stats: p.stats || { likes: 0, comments: 0 },
      comments: updatedComments,
      title: p.title || "Untitled",
      images: p.images || []
    };
  });

  function handleReply(e) {
    // e.detail: { postId, commentId }
    console.log("reply requested", e.detail);
  }

  function handleLike(e) {
    console.log("post like", e.detail);
  }

  function handleLikeComment(e) {
    console.log("comment like", e.detail);
  }

  // Fetch posts with sort (no search - handled by scope)
  async function fetchPosts() {
    isLoadingPosts = true;
    try {
      posts = await getArticlesByAuthor(id, {
        sortBy: $sortBy,
        sortOrder: $sortOrder
      });
      // Update count after re-fetching
      stats.posts = posts.length;
    } catch (e) {
      console.error("Failed to fetch posts:", e);
      posts = [];
    } finally {
      isLoadingPosts = false;
    }
  }

  // Track if initial mount is complete to prevent double-fetch
  let initialMountComplete = false;

  // Reactive: re-fetch immediately when sort changes (but NOT on initial mount)
  $: if (initialMountComplete && ($sortBy || $sortOrder) && user) {
    fetchPosts();
  }

  // Mark initial mount as complete after onMount finishes
  $: if (user && posts.length >= 0 && !initialMountComplete) {
    initialMountComplete = true;
  }

  // Reset to global scope when leaving the page
  onDestroy(() => {
    searchScope.set("global");
    // Reset the preference flag when leaving profile pages
    userChoseGlobalScope.set(false);
  });

  // fetch profile data whenever 'id' changes
  async function loadProfile() {
    loading = true;
    error = "";
    posts = [];
    user = null;
    stats = { posts: 0, likes: 0, followers: 0, following: 0 };
    
    // Reset the user preference flag when loading a different profile
    // This allows the new profile to set its scope
    userChoseGlobalScope.set(false);

    try {
      let userId = Number(id);
      if (!userId || isNaN(userId)) {
        throw new Error("Invalid user id");
      }

      const token = localStorage.getItem("token");
      let currentUser = null;

      if (token) {
        try {
          currentUser = await getCurrentUser();
          isOwner = currentUser && currentUser.id === parseInt(id);
        } catch (e) {
          console.error("Failed to get current user:", e);
        }
      }

      const profileRes = await fetch(`/api/users/${id}/public`);
      if (!profileRes.ok) {
        const errorData = await profileRes.json().catch(() => ({}));
        if (errorData.message === "This account has been deleted") {
          throw new Error("USER_DELETED");
        }
        throw new Error("Failed to fetch user");
      }
      const profileUser = await profileRes.json();

      const getImageUrl = (path) => {
        if (!path) return null;
        if (path.startsWith("http")) return path;
        if (path.startsWith("/")) return `http://localhost:3000${path}`;
        return `http://localhost:3000/${path}`;
      };

      user = {
        id: parseInt(id),
        name: profileUser.real_name || profileUser.username || "Unknown User",
        handle: profileUser.username || `user${id}`,
        avatar:
          getImageUrl(profileUser.avatar_url) ||
          "http://localhost:3000/default-avatars/arcane-magic.png",
        header: profileUser.header ? getImageUrl(profileUser.header) : null,
        bio: profileUser.description || "",
        isOwner
      };

      // Only set user scope if user hasn't explicitly chosen global scope
      // Get current value of userChoseGlobalScope
      let userExplicitlyChoseGlobal = false;
      const unsubscribe = userChoseGlobalScope.subscribe((value) => {
        userExplicitlyChoseGlobal = value;
      });
      unsubscribe();

      if (!userExplicitlyChoseGlobal) {
        searchScope.set({
          type: "user",
          userId: parseInt(id),
          username: user.handle
        });
      }

      const apiPosts = await getArticlesByAuthor(id);
      const API_BASE = "http://localhost:3000/";

      posts = await Promise.all(
        apiPosts.map(async (apiArticle) => {
          let images = [];

          try {
            const imgRes = await fetch(`${API_BASE}api/articles/${apiArticle.id}/images`);
            if (imgRes.ok) {
              const imgData = await imgRes.json();
              images = imgData.map((img) => API_BASE + img.url.replace(/^\/+/, ""));
            }
          } catch (e) {
            console.error("Failed to fetch images:", e);
          }

          if (apiArticle.header_image_url) {
            const headerUrl = API_BASE + apiArticle.header_image_url.replace(/^\/+/, "");
            if (!images.includes(headerUrl)) {
              images.unshift(headerUrl);
            }
          }

          let comments = [];
          let totalCommentsCount = 0;
          try {
            const commentsRes = await fetch(`${API_BASE}api/articles/${apiArticle.id}/comments`);
            if (commentsRes.ok) {
              const apiComments = await commentsRes.json();
              totalCommentsCount = apiComments.length;
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
                  id: c.id,
                  username: c.username || `user${c.author_id}`,
                  author_id: c.author_id,
                  avatar: commentAvatar,
                  created_at: c.created_at,
                  content: c.content,
                  article_id: apiArticle.id
                };
              });
            }
          } catch (e) {
            console.error("Failed to fetch comments for article", apiArticle.id, e);
          }

          return {
            ...apiArticle,
            images,
            comments,
            stats: {
              likes: apiArticle.likes || 0,
              comments: totalCommentsCount || apiArticle.comments || 0
            }
          };
        })
      );

      const userStats = await getUserStats(id);
      stats.posts = userStats.total_posts || 0;
      stats.likes = userStats.total_likes || 0;
      topArticles = userStats.top_articles || [];

      loading = false;
    } catch (e) {
      error = e.message;
      loading = false;
    }
  }

  // reactive statement - triggers when 'id' changes
  $: if (id) {
    loadProfile();
  }

  onMount(() => {
    // Initial load is handled by reactive statement above
    
    // Listen for article created event
    const handleArticleCreated = () => {
      if (user && isOwner) {
        refreshArticles();
      }
    };

    window.addEventListener("article-created", handleArticleCreated);

    return () => {
      window.removeEventListener("article-created", handleArticleCreated);
    };
  });
</script>

<div class="profile-shell">
  <main class="main-col">
    {#if loading}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading profile...</p>
      </div>
    {:else if error}
      <div class="error-state">
        {#if error === "USER_DELETED"}
          <div class="error-icon">🚫</div>
          <h2>Account Not Found</h2>
          <p class="error-message">
            This account has been deleted by administrator and is no longer available.
          </p>
          <a href="/" class="back-button">← Back to Home</a>
        {:else}
          <div class="error-icon">⚠️</div>
          <h2>404 Not Found</h2>
          <p class="error-message">{error}</p>
          <button class="retry-button" on:click={loadProfile}>Try Again</button>
        {/if}
      </div>
    {:else if user}
      <ProfileHeader
        {user}
        on:edit={onEditProfile}
        on:profile-updated={(e) => {
          user = { ...e.detail.user };
        }}
      />

      <!-- single post-list container -->
      <div class="post-list">
        {#if displayPosts.length === 0}
          <div class="no-articles-text">
            No articles yet.
            {#if isOwner}
              <p class="create-tip">
                Click the <span class="create">+</span> button to create your first article!
              </p>
            {/if}
          </div>
        {:else}
          {#each displayPosts as p (p.id)}
            <Article
              post={p}
              showMenu={isOwner}
              {isOwner}
              on:reply={handleReply}
              on:like={handleLike}
              on:likeComment={handleLikeComment}
              on:edit={handleEditArticle}
              on:delete={handleDeleteArticle}
            />
          {/each}
        {/if}
      </div>
    {/if}
  </main>

  <aside class="side-col">
    <ProfileSidebar {stats} {topArticles} {active} on:select={(e) => onSelectTab(e.detail)} />
  </aside>
</div>

<!-- modals outside main layout -->
<EditArticleModal
  open={showEditModal}
  article={selectedArticle}
  on:close={() => (showEditModal = false)}
  on:success={refreshArticles}
/>

<DeleteArticleModal
  open={showDeleteModal}
  article={selectedArticle}
  on:close={() => {
    showDeleteModal = false;
    selectedArticle = null;
  }}
  on:success={() => {
    showDeleteModal = false;
    selectedArticle = null;
    refreshArticles();
  }}
/>

<style>
  .profile-shell {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 28px;
    max-width: 1100px;
    margin: 0 auto;
    padding: 24px 16px;
  }

  .main-col {
    min-width: 0;
  }

  .side-col {
    min-width: 0;
  }

  .post-list {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  /* Loading State */
  .loading-state {
    text-align: center;
    padding: 80px 24px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
    margin-top: 24px;
  }

  .loading-state p {
    font-size: 18px;
    color: var(--muted);
    margin-top: 16px;
  }

  .spinner {
    margin: 0 auto;
    width: 48px;
    height: 48px;
    border: 4px solid var(--border);
    border-top-color: var(--button-bg, #2563eb);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Error State */
  .error-state {
    text-align: center;
    padding: 80px 32px;
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(220, 38, 38, 0.02) 100%);
    border: 2px solid rgba(239, 68, 68, 0.2);
    border-radius: 16px;
    margin-top: 24px;
    animation: fadeIn 0.3s ease-in;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .error-icon {
    font-size: 64px;
    margin-bottom: 16px;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
  }

  .error-state h2 {
    font-size: 28px;
    font-weight: 700;
    color: var(--text);
    margin-bottom: 12px;
  }

  .error-message {
    font-size: 16px;
    color: var(--muted);
    margin-bottom: 24px;
    line-height: 1.6;
  }

  .back-button {
    display: inline-block;
    padding: 12px 28px;
    background: var(--button-bg, #2563eb);
    color: white;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .back-button:hover {
    background: var(--button-hover, #1d4ed8);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  }

  .retry-button {
    padding: 12px 28px;
    background: var(--button-bg, #2563eb);
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .retry-button:hover {
    background: var(--button-hover, #1d4ed8);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  }

  .retry-button:active {
    transform: translateY(0);
  }

  /* Dark mode support */
  :global(.dark-mode) .error-state {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(220, 38, 38, 0.04) 100%);
    border-color: rgba(239, 68, 68, 0.3);
  }

  /* No articles text */
  .no-articles-text {
    text-align: center;
    padding: 48px 24px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
    color: var(--muted);
    font-size: 16px;
  }
  
  .side-col {
    align-self: start;
    z-index: auto; /* adjust to match your header height + padding */
  }
  @media (max-width: 960px) {
    .profile-shell {
      grid-template-columns: 1fr;
    }
    .side-col {
      order: -1;
    }
  }

  .no-articles-text {
    text-align: center;
    color: #888;
    font-size: 1.2rem;
    margin: 2rem 0;
    background: var(--bg);
    border-radius: 12px;
    padding: 2rem 1rem;
    border: 1px dashed #ccc;
  }
  .create-tip {
    color: var(--text, #111827);
    font-size: 1rem;
  }
  .create {
    color: var(--accent, #2563eb);
    text-decoration: none;
    font-weight: bold;
  }
  .create:hover {
    color: #5e87dd;
  }

  /* Mobile Responsive Design (≤768px) */
  @media (max-width: 768px) {
    .profile-shell {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem 0.75rem;
    }

    /* Main column - keep ProfileHeader and posts but we'll reorder */
    .main-col {
      display: contents;
    }

    /* Order 1: ProfileHeader */
    .main-col :global(.profile-header) {
      order: 1;
    }

    /* Order 2: Sidebar (Statistics & Top Articles) */
    .side-col {
      order: 2;
      width: 100%;
      max-width: 100%;
    }

    /* Order 3: Post list */
    .post-list {
      order: 3;
      gap: 1.5rem;
    }

    /* Loading and error states */
    .loading-state,
    .error-state {
      order: 1;
    }

    /* Make sidebar full width on mobile */
    .side-col :global(.profile-rail) {
      width: 100%;
      max-width: 100%;
    }
  }

  /* Extra small devices */
  @media (max-width: 375px) {
    .profile-shell {
      padding: 0.75rem 0.5rem;
      gap: 0.75rem;
    }

    .post-list {
      gap: 1rem;
    }
  }
</style>
