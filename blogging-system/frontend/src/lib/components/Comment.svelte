<script>
  import { createEventDispatcher } from "svelte";
  import { user } from "../stores/user.js";
  import { goto } from "$app/navigation";

  export let articleAuthorId;
  let currentUser;
  user.subscribe((val) => (currentUser = val));

  function canDelete() {
    return (
      currentUser &&
      (
        currentUser.id === comment.author_id ||
        currentUser.id === articleAuthorId ||
        currentUser.is_admin
      )
    );
  }

  let showDeleteModal = false;
  function openDeleteModal() {
    showDeleteModal = true;
  }
  function closeDeleteModal() {
    showDeleteModal = false;
  }

  import { refreshHomeArticles } from "../stores/refreshHomeArticles.js";
  import { showNotification } from "../stores/notification.js";

  async function confirmDeleteComment() {
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`/api/articles/${comment.article_id}/comments/${comment.id}?hard=true`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok || res.status === 204) {
        dispatch("refresh");
        refreshHomeArticles.set(true);
        showNotification({ message: "Comment deleted successfully.", type: "success" });
      }
    } catch (err) {
      showNotification({ message: "Failed to delete comment.", type: "error" });
      console.error("Error deleting comment:", err);
    } finally {
      showDeleteModal = false;
    }
  }

  export let comment;
  export let depth = 0;

  const dispatch = createEventDispatcher();

  let showReplyBox = false;
  let replyText = "";
  let liked = false;
  let likeCount = 0;

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

  // Handle username click to profile
  function handleUsernameClick(username, userId) {
    let currentUser;
    user.subscribe((val) => (currentUser = val))();
    if (!currentUser) {
      goto("/login");
      return;
    }
    if (userId) {
      goto(`/profile/${userId}`);
    } else if (username) {
      goto(`/search?authorId=${encodeURIComponent(username)}`);
    }
  }

  // check if user liked this comment
  async function checkLiked() {
    const token = localStorage.getItem("token");
    if (!token || !comment.id) return;

    try {
      const res = await fetch(`/api/comments/${comment.id}/likes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        liked = data.liked ?? false;
        likeCount = data.likesCount ?? 0;
      }
    } catch (err) {
      console.error("Error checking comment like status:", err);
    }
  }

  // Toggle like/unlike
  async function toggleLike() {
    const token = localStorage.getItem("token");
    if (!token) {
      goto("/login");
      return;
    }

    if (!liked) {
      const res = await fetch(`/api/comments/${comment.id}/likes`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (res.ok) {
        liked = true;
        likeCount += 1;
      }
    } else {
      const res = await fetch(`/api/comments/${comment.id}/likes`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (res.ok || res.status === 204) {
        liked = false;
        likeCount -= 1;
      }
    }
  }

  // Post reply
  async function postReply() {
    const token = localStorage.getItem("token");
    if (!token) {
      goto("/login");
      return;
    }

    if (!replyText.trim()) return;

    try {
      const res = await fetch(`/api/articles/${comment.article_id}/comments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          content: replyText,
          parent_comment_id: comment.id
        })
      });

      if (res.ok) {
        replyText = "";
        showReplyBox = false;
        // Dispatch event to parent to refresh comments
        dispatch("refresh");
      }
    } catch (err) {
      console.error("Error posting reply:", err);
    }
  }

  // Initialize like status
  $: if (comment.id) {
    checkLiked();
  }
</script>

<div class="comment-wrapper" class:has-depth={depth > 0}> 
  <div class="comment">
    <div class="comment-header">
      <div class="user-info">
        <img
          src={comment.avatar || "http://localhost:3000/default-avatars/arcane-magic.png"}
          alt={comment.username || "unknown"}
          class="avatar-small"
        />
        <span class="username">
          <a
            href="#"
            class="username username-link"
            on:click|preventDefault={() => handleUsernameClick(comment.username, comment.author_id)}
          >
            @{comment.username || "unknown"}
          </a>
        </span>
        <span class="dot">•</span>
        <span class="timestamp">{formatTimeAgo(comment.created_at)}</span>
      </div>
    </div>

    <div class="comment-content">
      {comment.content}
    </div>

    <div class="comment-actions">
      <button class="action-btn" on:click={toggleLike}>
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 6 4 4 6.5 4c1.74 0 3.41.81 4.5 2.09C12.09 4.81 13.76 4 15.5 4 18 4 20 6 20 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            fill={liked ? "#e35d5b" : "currentColor"}
          />
        </svg>
        <span>{likeCount}</span>
      </button>

    <button class="action-btn" on:click={() => (showReplyBox = !showReplyBox)}> Reply </button>

    {#if canDelete()}
      <button class="action-btn" on:click={openDeleteModal}>Delete</button>
    {/if}
  </div>

    {#if showReplyBox}
      <form class="reply-form" on:submit|preventDefault={postReply}>
        <textarea bind:value={replyText} placeholder="Write a reply..." rows="2" />
        <div class="reply-actions">
          <button type="button" class="cancel-btn" on:click={() => (showReplyBox = false)}>
            Cancel
          </button>
          <button type="submit" class="post-btn" disabled={!replyText.trim()}> Reply </button>
        </div>
      </form>
    {/if}
  </div>

  {#if comment.replies && comment.replies.length > 0}
    <div class="replies">
      {#each comment.replies as reply (reply.id)}
        <svelte:self comment={reply} depth={depth + 1} articleAuthorId={articleAuthorId} on:refresh />
      {/each}
    </div>
  {/if}
</div>

{#if showDeleteModal}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="modal-overlay" on:click={closeDeleteModal}>
    <div class="modal-content" on:click|stopPropagation>
      <h3>Delete Comment</h3>
      <p>Are you sure you want to delete this comment?</p>
      <div class="modal-actions">
        <button type="button" class="cancel-btn" on:click={closeDeleteModal}>Cancel</button>
        <button type="button" class="post-btn" on:click={confirmDeleteComment}>Delete</button>
      </div>
    </div>
  </div>
{/if}

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
    color: var(--accent-hover, #1d4ed8);
  }

  .comment-wrapper {
    display: flex;
    flex-direction: column;
    min-width: 100%;
  }

  .comment-wrapper.has-depth {
    margin-left: 2.5rem;
    padding-left: 1rem;
    border-left: 2px solid var(--border, #e5e7eb);
  }

  .comment {
    padding: 0.75rem 0;
    min-width: 500px;
    flex-shrink: 0;
  }

  .comment-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .avatar-small {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
  }

  .username {
    font-weight: 600;
    color: var(--text);
    font-size: 0.9rem;
  }

  .dot {
    color: var(--text-secondary);
    font-size: 0.8rem;
  }

  .timestamp {
    color: var(--text-secondary);
    font-size: 0.85rem;
  }

  .comment-content {
    padding: 0.5rem 0;
    color: var(--text);
    line-height: 1.5;
    font-size: 0.95rem;
  }

  .comment-actions {
    display: flex;
    gap: 1rem;
    padding: 0.5rem 0;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 0.85rem;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: var(--button-hover);
    color: var(--text);
  }

  .action-btn svg {
    transition: transform 0.2s;
  }

  .action-btn:hover svg {
    transform: scale(1.1);
  }

  .reply-form {
    margin-top: 0.75rem;
    padding: 0.75rem;
    background: var(--input-bg);
    border-radius: 8px;
    width: 75%;
  }


  .reply-form textarea {
    width: calc(100% - 1rem);
    padding: 0.5rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.9rem;
    resize: vertical;
    min-height: 60px;
    background: var(--bg);
    color: var(--text);
  }

  .reply-form textarea:focus {
    outline: none;
    border-color: var(--primary-color, #1d9bf0);
  }

  .reply-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .cancel-btn,
  .post-btn {
    padding: 0.4rem 1rem;
    border: none;
    border-radius: 6px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-btn {
    background: transparent;
    color: var(--text);
    border: 1px solid var(--border);
  }

  .cancel-btn:hover {
    background: var(--button-hover);
  }

  .post-btn {
    background: var(--primary-color, #1d9bf0);
    color: white;
  }

  .post-btn:hover:not(:disabled) {
    background: var(--primary-hover, #1a8cd8);
  }

  .post-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .replies {
    margin-top: 0.5rem;
  }

  /* Modal styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .modal-content {
    background: var(--bg, #fff);
    color: var(--text);
    padding: 1.5rem;
    border-radius: 10px;
    box-shadow: 0 2px 16px rgba(0,0,0,0.18);
    min-width: 320px;
    max-width: 90vw;
    text-align: center;
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1rem;
  }
</style>
