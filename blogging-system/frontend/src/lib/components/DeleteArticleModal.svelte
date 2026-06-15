<script>
  import { createEventDispatcher } from "svelte";
  import { showNotification } from "../stores/notification.js";

  export let open = false;
  export let article = null;

  const dispatch = createEventDispatcher();

  let deleting = false;
  let errorMsg = "";

  function getTruncatedTitle(title) {
    if (!title) return "this article";
    if (title.length > 35) {
      return title.slice(0, 35) + "...";
    }
    return title;
  }

  async function handleConfirm() {
    errorMsg = "";
    deleting = true;

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        errorMsg = "You must be logged in to delete articles";
        showNotification({ message: errorMsg, type: "error" });
        deleting = false;
        return;
      }

      // Soft delete (is_active = 0)
      const res = await fetch(`/api/articles/${article.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok || res.status === 204) {
        showNotification({ message: "Article deleted successfully", type: "success" });
        dispatch("success");
        dispatch("close");
      } else {
        const err = await res.json();
        errorMsg = err.error || "Failed to delete article";
        showNotification({ message: errorMsg, type: "error" });
        deleting = false;
      }
    } catch (e) {
      errorMsg = "Network error. Please try again.";
      showNotification({ message: errorMsg, type: "error" });
      deleting = false;
    }
  }

  function handleCancel() {
    dispatch("close");
  }

  function handleKeydown(e) {
    if (e.key === "Escape") handleCancel();
  }

  $: if (open) {
    deleting = false;
    errorMsg = "";
  }

</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click|self={handleCancel}>
    <div class="modal-card">
      <h2>Delete Article</h2>

      <p class="confirm-text">
        Are you sure you want to delete "<strong>{getTruncatedTitle(article?.title) || "this article"}</strong>"?
      </p>

      <p class="warning-text">
        This action cannot be undone. The article will be permanently removed.
      </p>

      {#if errorMsg}
        <div class="error-msg">{errorMsg}</div>
      {/if}

      <div class="actions">
        <button on:click={handleCancel} class="btn-secondary" disabled={deleting}> Cancel </button>

        <button on:click={handleConfirm} class="btn-danger" disabled={deleting}>
          {deleting ? "Deleting..." : "Delete Article"}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(1px);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-card {
    max-width: 450px;
    width: 100%;
    background: var(--card);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  }

  h2 {
    text-align: left;
    font-size: 1.6rem;
    margin-top: 0;
    margin-bottom: 1rem;
    color: var(--text);
  }

  .confirm-text {
    text-align: left;
    font-size: 1.1rem;
    color: var(--text);
    margin-bottom: 1rem;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .confirm-text strong {
    color: var(--accent);
    word-break: break-all;
  }

  .warning-text {
    text-align: left;
    font-size: 0.95rem;
    color: var(--like, #e35d5b);
    margin-bottom: 1.5rem;
    font-style: italic;
  }

  .error-msg {
    color: var(--like, #e35d5b);
    background: rgba(227, 93, 91, 0.1);
    border: 1px solid var(--like, #e35d5b);
    border-radius: 6px;
    padding: 0.5rem 1rem;
    margin-bottom: 1rem;
    text-align: center;
    font-size: 0.95rem;
  }

  .actions {
    margin-top: 2rem;
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .btn-secondary,
  .btn-danger {
    padding: 0.6rem 1rem;
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      background-color 0.2s,
      opacity 0.2s;
  }

  .btn-secondary {
    background-color: transparent;
    color: var(--text);
    border: 1px solid var(--border);
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: var(--button-hover, #eee);
  }

  .btn-danger {
    background-color: var(--like, #e35d5b);
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background-color: #c0392b;
  }

  .btn-secondary:disabled,
  .btn-danger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
</style>
