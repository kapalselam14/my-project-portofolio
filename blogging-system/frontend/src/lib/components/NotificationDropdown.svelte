<script>
  import { notifications, unreadCount, markAllAsRead } from "$lib/stores/notification.js";
  import { auth } from "$lib/stores/auth.js";
  export let showDropdown = false;
  let token = null;
  $: authVal = $auth;
  $: token = authVal?.token;

  // Mark all as read when dropdown is opened
  $: if (showDropdown && $unreadCount && $notifications.length) {
    markAllAsRead(token);
  }
  $:console.log($notifications[0]);  

</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
{#if showDropdown}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="notification-dropdown" on:click|stopPropagation>
    <div class="dropdown-header">Notifications</div>
    {#if $notifications.length === 0}
      <div class="dropdown-empty">No notifications</div>
    {:else}
      {#each $notifications.slice(0, 20) as notif}
          <a href="/articles/{notif.article_id}" class="dropdown-item {notif.read || notif.is_read ? 'read' : 'unread'}" tabindex="0">
          {#if notif.type === "article.like"}
            <span class="notif-type">
              <strong class="notif-username"
                >{notif.actor_username
                  ? notif.actor_username
                  : `User ${notif.actorId ?? notif.actor_id}`}</strong
              >
              liked your article{notif.article_title ? `: "${notif.article_title}"` : ""}
            </span>
          {:else if notif.type === "comment.like"}
            <span class="notif-type">
              <strong class="notif-username"
                >{notif.actor_username
                  ? notif.actor_username
                  : `User ${notif.actorId ?? notif.actor_id}`}</strong
              >
              liked your comment on {notif.article_title
                ? `"${notif.article_title}"`
                : "an article"}
            </span>
          {:else if notif.type === "article.comment"}
            <span class="notif-type">
              <strong class="notif-username"
                >{notif.actor_username
                  ? notif.actor_username
                  : `User ${notif.actorId ?? notif.actor_id}`}</strong
              >
              commented on your article{notif.article_title ? `: "${notif.article_title}"` : ""}
            </span>
          {:else if notif.type === "comment.reply"}
            <span class="notif-type">
              <strong class="notif-username"
                >{notif.actor_username
                  ? notif.actor_username
                  : `User ${notif.actorId ?? notif.actor_id}`}</strong
              >
              replied to your comment on {notif.article_title
                ? `"${notif.article_title}"`
                : "an article"}
            </span>
          {:else}
            <span class="notif-type"
              >{notif.type ? notif.type.replace(".", " ") : "Notification"}</span
            >
          {/if}
          <span class="notif-meta">
            {notif.created_at
              ? new Date(notif.created_at.replace(' ', 'T') + 'Z').toLocaleString("en-NZ", { timeZone: "Pacific/Auckland" })
              : ""}
          </span>
          {#if !(notif.read || notif.is_read)}
            <span class="unread-dot"></span>
          {/if}
          </a>
      {/each}
    {/if}
  </div>
{/if}

<style>
  a{
    text-decoration: none;
    color: inherit;
  }
  .notification-dropdown {
    position: absolute;
    right: 30px;
    width: 320px;
    max-height: 400px;
    background: var(--bg, #fff);
    border: 1px solid #ccc;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
    z-index: 10100;
    overflow-y: auto;
  }

  .dropdown-header {
    background-color: var(--bg);
    font-weight: bold;
    text-align: center;
    font-size: 1.2rem;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid #eee;
    position: sticky;
    top: 0;
    z-index: 10101;
  }
  .dropdown-empty {
    padding: 1rem;
    color: #888;
    text-align: center;
  }
  .dropdown-item {
    color: var(--text);
    padding: 0.5rem 1rem;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    border-bottom: 1px solid #f3f3f3;
    transition: background 0.15s;
  }
  .dropdown-item:last-child {
    border-bottom: none;
  }
  .dropdown-item.unread {
    background: #f9f6f2;
    font-weight: bold;
  }
  .dropdown-item.read {
    color: var(--text);
  }

  .notif-username {
    font-weight: bold;
  }

  .dropdown-item:hover {
    background: #f0f0f0;
    color: black;
    transition: 0.2s;
  }
  .notif-type {
    flex: 1;
    display: block;
    width: 100%;
    font-size: 0.9rem;
    text-align: left;
  }
  .notif-meta {
    display: block;
    width: 100%;
    text-align: right;
    font-size: 0.7em;
  }
  .unread-dot {
    width: 8px;
    height: 8px;
    background: #e74c3c;
    border-radius: 50%;
    display: inline-block;
    margin-left: 4px;
  }

  /* Mobile responsive styles */
  @media (max-width: 768px) {
    .notification-dropdown {
      position: fixed;
      right: 0.5rem;
      width: calc(100vw - 1rem);
      max-width: 320px;
      max-height: 60vh;
      z-index: 10100;
    }

    .dropdown-header {
      z-index: 10101;
      font-size: 1rem;
      padding: 0.75rem 1rem;
    }

    .dropdown-item {
      padding: 0.75rem 1rem;
    }

    .notif-type {
      font-size: 0.875rem;
    }

    .notif-meta {
      font-size: 0.688rem;
    }
  }

  @media (max-width: 375px) {
    .notification-dropdown {
      right: 0.25rem;
      width: calc(100vw - 0.5rem);
      max-width: none;
    }

    .dropdown-header {
      font-size: 0.938rem;
      padding: 0.625rem 0.75rem;
    }

    .dropdown-item {
      padding: 0.625rem 0.75rem;
    }

    .notif-type {
      font-size: 0.813rem;
    }
  }
</style>
