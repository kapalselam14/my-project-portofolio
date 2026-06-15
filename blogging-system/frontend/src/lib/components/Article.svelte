<script>
  import { createEventDispatcher } from "svelte";
  import Comment from "./Comment.svelte";
  import { goto } from "$app/navigation";
  import { user } from "../stores/user.js";
  import { onMount, onDestroy } from "svelte";
  import ImageLightbox from "./ImageLightbox.svelte";
  import ArticleMenu from "./ArticleMenu.svelte";

  export let post; // { id, author, avatar, timeAgo, title, body[], stats, comments[] }
  export let refreshArticle = null;
  export let full = false; // whether to show full content
  let liked = false;
  let checkingLike = false;
  export let showMenu = false;
  export let isOwner = false;

  let menuOpen = false;

  // lightbox state
  let lightboxOpen = false;
  let lightboxImages = [];
  let lightboxIndex = 0;

  // carousel state
  let carouselIndex = 0;
  let carouselContainer;

  // separate header and embedded images
  $: headerImage = post.images && post.images.length > 0 ? post.images[0] : null;
  $: embeddedImages = post.images && post.images.length > 1 ? post.images.slice(1) : [];

  // open lightbox
  function openLightbox(images, index) {
    lightboxImages = images;
    lightboxIndex = index;
    lightboxOpen = true;
  }

  // carousel navigation
  function nextSlide() {
    if (embeddedImages.length === 0) return;
    carouselIndex = (carouselIndex + 1) % embeddedImages.length;
    scrollToSlide();
  }

  function prevSlide() {
    if (embeddedImages.length === 0) return;
    carouselIndex = (carouselIndex - 1 + embeddedImages.length) % embeddedImages.length;
    scrollToSlide();
  }

  function scrollToSlide() {
    if (!carouselContainer) return;
    const slideWidth = carouselContainer.offsetWidth;
    carouselContainer.scrollTo({
      left: slideWidth * carouselIndex,
      behavior: "smooth"
    });
  }

  const dispatch = createEventDispatcher();
  // const like = () => dispatch("like", { id: post.id });
  // const onReply = (e) => dispatch("reply", { postId: post.id, commentId: e.detail.id });
  // const onLikeComment = (e) => dispatch("likeComment", { postId: post.id, commentId: e.detail.id });

  // Helper: Truncate title to 120 chars
  function getTruncatedTitle(title) {
    if (!title) return "";
    return title.length > 120 ? title.slice(0, 117) + "..." : title;
  }

  // Helper: Truncate content to 350 chars
  function getTruncatedContent(content) {
    if (!content) return "";
    if (content.length > 350) {
      // Trim trailing whitespace and ensure inline display
      const truncated = content.slice(0, 350).trimEnd();
      return (
        truncated +
        `<span class="read-more-btn" style="color:var(--primary-color,#1d9bf0);cursor:pointer;font-weight:600;margin-left:4px;white-space:nowrap;display:inline;" onclick="window.dispatchEvent(new CustomEvent('readmore-${post.id}'))"> ...Read More</span>`
      );
    }
    return content;
  }

  function handleReadMore() {
    goto(`/articles/${post.id}`);
  }

  // Handle username click to profile
  function handleUsernameClick(username, userId) {
    // If not logged in, redirect to login
    let currentUser;
    user.subscribe((val) => (currentUser = val))();
    if (!currentUser) {
      goto("/login");
      return;
    }
    // If userId is available, use it; else fallback to username
    if (userId) {
      goto(`/profile/${userId}`);
    } else if (username) {
      goto(`/search?authorId=${encodeURIComponent(username)}`);
    }
  }

  // Check if user has liked this article
  async function checkLiked() {
    if (checkingLike) return;
    checkingLike = true;

    const token = localStorage.getItem("token");

    try {
      if (token && post.id) {
        // Logged-in user: check like status
        const res = await fetch(`/api/articles/${post.id}/likes`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });
        if (res.ok) {
          const data = await res.json();
          liked = data.liked ?? false;
          if (typeof data.likesCount === "number") {
            post.stats.likes = data.likesCount;
          }
        }
      } else if (post.id) {
        // Guest user: show like count from initial data
        // Like count already comes from backend in post.stats.likes
        liked = false;
      }
    } catch (err) {
      console.error("Error checking like status:", err);
    } finally {
      checkingLike = false;
    }
  }

  // Toggle like/unlike
  async function toggleLike() {
    const token = localStorage.getItem("token");
    if (!token || !post.id) {
      goto("/login");
      return;
    }

    try {
      if (!liked) {
        // Authorization header
        const res = await fetch(`/api/articles/${post.id}/likes`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });

        if (res.ok) {
          liked = true;
          post.stats.likes += 1;
          post = post;
          if (refreshArticle) await refreshArticle();
        } else {
          const error = await res.json();
          console.error("Like failed:", error);
          if (res.status === 401) goto("/login");
        }
      } else {
        // Authorization header
        const res = await fetch(`/api/articles/${post.id}/likes`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });

        if (res.ok || res.status === 204) {
          liked = false;
          post.stats.likes -= 1;
          post = post;
          if (refreshArticle) await refreshArticle();
        } else {
          const error = await res.json();
          console.error("Unlike failed:", error);
        }
      }
    } catch (err) {
      console.error("Error toggling like:", err);
    }
  }

  function openComments() {
    if (!localStorage.getItem("token")) {
      goto("/login");
      return;
    }
    goto(`/articles/${post.id}`);
  }

  // dispatch edit/delete events to parent
  function handleEdit() {
    dispatch("edit", { article: post });
  }

  function handleDelete() {
    dispatch("delete", { article: post });
  }

  // onMount(() => {
  //   checkLiked();
  // });
  onMount(() => {
    checkLiked();
    window.addEventListener(`readmore-${post.id}`, handleReadMore);
  });
  onDestroy(() => {
    window.removeEventListener(`readmore-${post.id}`, handleReadMore);
  });
</script>

<article class="card" aria-labelledby={"post-title-" + post.id}>
  <header class="post-header">
    <img class="avatar" src={post.avatar} alt="" />
    <div class="meta">
      <div class="author-row">
        <span class="author">
          <!-- svelte-ignore a11y-invalid-attribute -->
          <a
            href="#"
            class="username-link"
            on:click|preventDefault={() => handleUsernameClick(post.author, post.author_id)}
          >
            @{post.author}
          </a>
        </span>
        <span class="dot">•</span>
        <span class="time">{post.timeAgo}</span>
      </div>
      <h2 id={"post-title-" + post.id} class="title">
        <a href={`/articles/${post.id}`} class="title-link" class:full-title={full}>
          {#if full}
            {post.title}
          {:else}
            {getTruncatedTitle(post.title)}
          {/if}
        </a>
      </h2>
    </div>
    <!-- Article menu for owners -->
    {#if showMenu && isOwner}
      <div class="menu-wrapper">
        <ArticleMenu
          bind:isOpen={menuOpen}
          {isOwner}
          on:edit={handleEdit}
          on:delete={handleDelete}
        />
      </div>
    {/if}
  </header>

  <div class="post-body">
    {#if post.body && post.body[0]}
      {#if full}
        <p class="article-content">
          {@html post.body[0]}
        </p>
      {:else}
        <p class="article-content">
          {@html getTruncatedContent(post.body[0])}
        </p>
      {/if}
    {/if}

    <!-- image layout -->
    {#if post.images && post.images.length > 0}
      <div class="article-images">
        <!-- Header Image -->
        {#if headerImage}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
          <img
            src={headerImage}
            alt="Header"
            class="header-image"
            on:click={() => openLightbox(post.images, 0)}
          />
        {/if}

        <!-- Embedded Images Carousel -->
        {#if embeddedImages.length > 0}
          <div class="carousel-wrapper">
            <div class="carousel-container" bind:this={carouselContainer}>
              {#each embeddedImages as img, i}
                <!-- svelte-ignore a11y-click-events-have-key-events -->
                <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
                <img
                  src={img}
                  alt={`Embedded ${i + 1}`}
                  class="carousel-image"
                  on:click={() => openLightbox(post.images, i + 1)}
                />
              {/each}
            </div>

            <!-- show nav only for 3+ images -->
            {#if embeddedImages.length > 2}
              <button class="carousel-nav carousel-prev" on:click={prevSlide} aria-label="Previous">
                ‹
              </button>
              <button class="carousel-nav carousel-next" on:click={nextSlide} aria-label="Next">
                ›
              </button>

              <div class="carousel-dots">
                {#each embeddedImages as _, i}
                  <button
                    class="carousel-dot"
                    class:active={i === carouselIndex}
                    on:click={() => {
                      carouselIndex = i;
                      scrollToSlide();
                    }}
                    aria-label={`Slide ${i + 1}`}
                  />
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <div class="actions">
    <button class="icon-btn" title="Like" aria-label="Like" on:click={toggleLike}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41.81 4.5 2.09C12.09 4.81 13.76 4 15.5 4 18 4 20 6 20 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          fill={liked ? "#e35d5b" : "currentColor"}
        />
      </svg>
      <span>{post.stats?.likes}</span>
    </button>
    <button class="icon-btn" title="Comments" aria-label="Comments" on:click={openComments}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M20 2H4a2 2 0 0 0-2 2v14l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"
          fill="currentColor"
        />
      </svg>
      <span>{post.stats?.comments}</span>
    </button>
    <slot name="actions" />
  </div>

  {#if post.comments && post.comments.length > 0}
    <section class="comments-preview" aria-label="Comments preview">
      {#each post.comments.slice(0, 2) as c}
        <Comment comment={c} articleAuthorId={post.author_id} on:refresh = {async () => {if (refreshArticle) await refreshArticle()}}/>
      {/each}
      {#if post.stats.comments > 2}
        <div class="more-comments">
          <button on:click={openComments} class="view-more-btn">
            View all {post.stats.comments} comments
          </button>
        </div>
      {/if}
    </section>
  {/if}
</article>

<!-- Lightbox rendered outside article to avoid stacking context issues -->
<ImageLightbox
  images={lightboxImages}
  bind:currentIndex={lightboxIndex}
  bind:isOpen={lightboxOpen}
  on:close={() => (lightboxOpen = false)}
/>

<style>
  .username-link {
    color: var(--text);
    text-decoration: none;
    font-weight: 600;
    cursor: pointer;
    transition: color 0.15s;
  }
  .username-link:hover {
    text-decoration: none;
    color: var(--accent-hover, #1d9bf0);
  }
  .title {
    margin: 6px 0 2px;
    font-size: 28px;
    line-height: 1.2;
    font-weight: 800;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    word-break: break-word;
  }
  .title-link {
    color: var(--text);
    text-decoration: none;
    cursor: pointer;
    transition: color 0.15s;
    max-width: 100%;
    display: inline-block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    word-break: break-word;
  }

  .title-link:hover {
    text-decoration: none;
    color: var(--accent-hover, #1d9bf0);
  }

  .full-title {
    white-space: normal !important;
    overflow: visible !important;
    text-overflow: unset !important;
  }
  .article-content {
    max-width: 100%;
    overflow-wrap: break-word;
    word-break: break-word;
    white-space: pre-line;
    font-size: 16px;
    line-height: 1.6;
    color: var(--text);
    position: relative;
  }
  .read-more-btn {
    color: var(--primary-color, #1d9bf0);
    cursor: pointer;
    font-weight: 600;
    margin-left: 4px;
    white-space: nowrap;
    display: inline;
  }

  .read-more-btn:hover {
    text-decoration: underline;
  }

  .card {
    background: var(--card, #fff);
    border: 1px solid var(--border, #e6e6e6);
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
    position: relative;
    transition: box-shadow 0.2s;
    z-index: 1;
  }
  
  .post-header {
    display: grid;
    grid-template-columns: 48px 1fr;
    gap: 12px;
    align-items: start;
    position: relative;
  }
  .menu-wrapper {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 100;
  }
  .avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
  }
  .meta {
    min-width: 0;
  }
  .author-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }
  .author {
    font-weight: 600;
  }
  .title {
    margin: 6px 0 2px;
    font-size: 28px;
    line-height: 1.2;
    font-weight: 800;
  }

  .post-body {
    margin-top: 8px;
  }
  .post-body p {
    margin: 0 0 8px;
    font-size: 16px;
    line-height: 1.6;
    color: var(--text);
  }

  .article-images {
    margin-top: 12px;
  }

  .header-image {
    width: 100%;
    max-height: 320px;
    object-fit: cover;
    border-radius: 12px;
    cursor: pointer;
    transition:
      transform 0.2s,
      box-shadow 0.2s;
    margin-bottom: 8px;
  }

  .header-image:hover {
    transform: scale(1.01);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .carousel-wrapper {
    position: relative;
    width: 100%;
    margin-top: 8px;
  }

  .carousel-container {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(300px, 1fr);
    gap: 12px;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding: 8px 0;
  }

  .carousel-container::-webkit-scrollbar {
    display: none;
  }

  /* Dynamic handling based on number of images */
  .carousel-container {
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  }

  /* 1 image: Center and limit width */
  .carousel-container:has(.carousel-image:only-child) {
    justify-content: center;
    grid-template-columns: minmax(280px, 500px);
  }

  /* 2 images: Show both side by side on desktop */
  .carousel-container:has(.carousel-image:nth-child(2):last-child) {
    grid-template-columns: repeat(2, minmax(240px, 1fr));
  }

  /* 3+ images: Scrollable carousel */
  .carousel-container:has(.carousel-image:nth-child(3)) {
    grid-auto-flow: column;
    grid-auto-columns: minmax(280px, 380px);
    justify-content: flex-start;
  }

  .carousel-image {
    width: 100%;
    height: 280px;
    object-fit: cover;
    border-radius: 12px;
    scroll-snap-align: start;
    cursor: pointer;
    transition:
      transform 0.2s,
      box-shadow 0.2s;
  }

  .carousel-image:hover {
    transform: scale(1.02);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .carousel-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(0, 0, 0, 0.5);
    border: none;
    color: white;
    font-size: 32px;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 50%;
    transition: background 0.2s;
    z-index: 10;
  }

  .carousel-nav:hover {
    background: rgba(0, 0, 0, 0.7);
  }

  .carousel-prev {
    left: 8px;
  }

  .carousel-next {
    right: 8px;
  }

  .carousel-dots {
    display: flex;
    justify-content: center;
    gap: 8px;
    margin-top: 12px;
  }

  .carousel-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--border, #e0e0e0);
    border: none;
    cursor: pointer;
    transition:
      background 0.2s,
      transform 0.2s;
    padding: 0;
  }

  .carousel-dot.active {
    background: var(--accent, #2563eb);
    transform: scale(1.3);
  }

  .carousel-dot:hover {
    background: var(--accent-hover, #1d4ed8);
  }

  .actions {
    display: flex;
    gap: 8px;
    padding: 8px 0 12px;
    color: #374151;
  }
  .icon-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text);
    cursor: pointer;
  }
  .icon-btn:hover {
    background: var(--button-hover);
    border-color: var(--border);
  }

  .comments-preview {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border);
    overflow-x: auto;
  }

  .more-comments {
    margin-top: 0.5rem;
  }

  .view-more-btn {
    background: none;
    border: none;
    color: var(--primary-color, #1d9bf0);
    cursor: pointer;
    font-size: 0.9rem;
    padding: 0;
  }

  .view-more-btn:hover {
    text-decoration: underline;
  }

  @media (max-width: 1024px) {
    .carousel-container:has(.carousel-image:nth-child(2):last-child) {
      grid-template-columns: 1fr;
      grid-auto-flow: column;
      grid-auto-columns: minmax(240px, 100%);
    }

    .header-image {
      max-height: 280px;
    }

    .carousel-image {
      height: 240px;
    }
  }

  @media (max-width: 768px) {
    .carousel-image {
      height: 220px;
    }

    .carousel-nav {
      width: 40px;
      height: 40px;
      font-size: 24px;
    }

    .header-image {
      max-height: 240px;
    }

    .carousel-container {
      grid-auto-columns: 100%;
    }

    .carousel-container:has(.carousel-image:only-child) {
      grid-template-columns: 100%;
    }
  }

  @media (max-width: 480px) {
    .carousel-image {
      height: 200px;
    }

    .header-image {
      max-height: 220px;
    }

    .carousel-wrapper {
      margin-top: 6px;
    }

    .header-image {
      margin-bottom: 6px;
    }
  }
</style>
