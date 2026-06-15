<script>
  import { goto } from "$app/navigation";
  import { user } from "$lib/stores/user.js";
  import { notifications, unreadCount, markAllAsRead } from '$lib/stores/notification.js';
  import { auth } from '$lib/stores/auth.js';
  import NotificationDropdown from './NotificationDropdown.svelte';

  let showDropdown = false;
  let dropdownRef;
  let notifBtnRef;

  function handleClickOutside(event) {
    if (
      showDropdown &&
      dropdownRef &&
      !dropdownRef.contains(event.target) &&
      notifBtnRef &&
      !notifBtnRef.contains(event.target)
    ) {
      showDropdown = false;
    }
  }

  $: if (showDropdown) {
    document.addEventListener('mousedown', handleClickOutside);
  } else {
    document.removeEventListener('mousedown', handleClickOutside);
  }

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
    return `http://localhost:3000/${avatarUrl.replace(/^\/+/, "")}`;
  }

  $: userAvatar = getUserAvatarUrl($user);
</script>

<div class="icons">
  {#if $user}
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div class="notification-wrapper">
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <img
        class="Notification_icon invert-on-dark"
        src="/Images/Notification_icon.png"
        alt="notification_icon"
        bind:this={notifBtnRef}
        on:click={() => {
          showDropdown = !showDropdown;
          if (!showDropdown || !$unreadCount || !$notifications.length) return;
          // Mark all as read when opening dropdown
          markAllAsRead($auth?.token);
        }}
      />
      <span class="notif-tooltip">Notifications</span>
      {#if $unreadCount > 0}
        <span class="notification-badge">{$unreadCount}</span>
      {/if}
      <div bind:this={dropdownRef} style="position: absolute; top: 48px; right: 0;">
        <NotificationDropdown {showDropdown} />
      </div>
    </div>
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div class="profile-prompt">
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <img
        on:click={() => goto(`/profile/${$user.id}`)}
        class="user-avatar"
        src={userAvatar}
        alt={$user.username || "User avatar"}
      />
    </div>
  {:else}
    <button class="signin-btn" on:click={() => goto("/login")}>Sign In</button>
    <button class="register-btn" on:click={() => goto("/register")}>Register</button>
  {/if}
</div>

<style>
  .icons {
    display: flex;
    align-items: baseline;
    gap: 35px;
  }

  .Notification_icon {
    height: 40px;
    width: 50px;
    cursor: pointer;
    transition: box-shadow 0.2s, filter 0.2s;
  }

  .Notification_icon:hover {
    /* box-shadow: 0 0 12px 2px #3b82f6, 0 0 2px #fff; */
    filter: brightness(1.2) invert(0.8);
  }

  .notification-badge {
    position: absolute;
    top: 2px;
    right: 8px;
    background: #e74c3c;
    color: white;
    border-radius: 50%;
    padding: 2px 7px;
    font-size: 14px;
    font-weight: bold;
    z-index: 2;
    min-width: 22px;
    text-align: center;
    box-shadow: 0 0 2px #333;
  }

  .user-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
    cursor: pointer;
    border: 2px solid var(--border, #e5e7eb);
    transition: transform 0.2s, border-color 0.2s;
  }

  .user-avatar:hover {
    transform: scale(1.05);
    border-color: var(--primary, #3b82f6);
  }

  .profile-prompt::after {
    position: absolute;
    bottom: -25px;
    right: -40%;
    background-color: rgba(98, 97, 97, 0.5);
    border-radius: 10px;
    padding: 4px 10px;
    font-size: 11px;
    color: white;
    content: "Go to the profile page";
    opacity: 0;
    pointer-events: none;
    white-space: nowrap;
    z-index: 10001;
  }

  .profile-prompt {
    position: relative;
    display: inline-block;
  }

  .profile-prompt:hover::after {
    opacity: 1;
  }

  .signin-btn,
  .register-btn {
    font-size: 1rem;
    padding: 8px 24px;
    border-radius: 14px;
    border: 1px solid var(--searchbox-border);
    background: var(--bg);
    color: var(--text);
    cursor: pointer;
    margin-left: 10px;
    transition:
      background 0.2s,
      color 0.2s;
  }

  .signin-btn:hover {
    background: #cfcbc6;
  }

  .register-btn {
    background: #8a251b;
    color: #fff;
    border: none;
  }

  .register-btn:hover {
    background: #a32a1a;
  }

  .notification-wrapper {
    position: relative;
    display: inline-block;
  }

  .notification-wrapper ::after {
    z-index: 10001;
  }
  .notification-wrapper .notif-tooltip {
    position: absolute;
    bottom: -28px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(98, 97, 97, 0.5);
    border-radius: 10px;
    padding: 4px 12px;
    font-size: 12px;
    color: white;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    z-index: 10001;
    transition: opacity 0.18s;
  }

  .notification-wrapper:hover .notif-tooltip {
    opacity: 1;
  }

  /* Mobile Responsive Design (≤768px) */
  @media (max-width: 768px) {
    .icons {
      gap: 0.75rem; /* 12px */
      flex-shrink: 0;
    }

    /* Touch-optimized notification icon (min 44x44px Apple HIG) */
    .Notification_icon {
      height: 36px;
      width: 44px;
      padding: 0.25rem; /* Extra tap area */
    }

    /* Touch-optimized avatar */
    .user-avatar {
      width: 36px;
      height: 36px;
      min-width: 36px;
      min-height: 36px;
      cursor: pointer;
    }

    /* Notification badge - visible and readable */
    .notification-badge {
      top: -2px;
      right: 2px;
      padding: 0.125rem 0.375rem; /* 2px 6px */
      font-size: 11px;
      font-weight: 600;
      min-width: 18px;
      line-height: 1.2;
    }

    /* Hide tooltip on mobile (not needed for touch) */
    /* .notif-tooltip {

    } */

    /* Touch-friendly buttons */
    .signin-btn,
    .register-btn {
      padding: 0.5rem 0.875rem; /* 8px 14px */
      font-size: 13px;
      min-height: 36px;
      font-weight: 500;
      white-space: nowrap;
    }

    /* Ensure dropdown is properly positioned */
    .notification-wrapper > div {
      right: -0.5rem;
      top: 44px;
    }
  }

  /* Extra small devices */
  @media (max-width: 375px) {
    .icons {
      gap: 0.625rem; /* 10px */
    }

    .Notification_icon {
      height: 32px;
      width: 40px;
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      min-width: 32px;
      min-height: 32px;
    }

    .signin-btn,
    .register-btn {
      padding: 0.375rem 0.75rem; /* 6px 12px */
      font-size: 12px;
      min-height: 32px;
    }
  }
</style>

