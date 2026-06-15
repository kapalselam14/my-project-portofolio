<script>
  import { createEventDispatcher } from "svelte";
  import {PUBLIC_API_BASE_URL} from '$env/static/public';
  import { user } from '$lib/stores/user.js';
  import { auth } from '$lib/stores/auth.js';
  import { get } from 'svelte/store';
  import Notification from './Notification.svelte';
  // Notification state
  let notifMsg = '';
  let notifType = 'success';
  let notifShow = false;

  function showNotification(msg, type = 'success') {
    notifShow = false;
    setTimeout(() => {
      notifMsg = msg;
      notifType = type;
      notifShow = true;
    }, 10);
  }

  export let open = false;
  export let currentUsername = "";

  const dispatch = createEventDispatcher();

  let oldUsername = "";
  let newUsername = "";

  let usernameCheck = null; // null | 'checking' | 'available' | 'taken' | 'error'
  let usernameCheckMsg = '';

  async function handleSubmit() {
    if (!newUsername || usernameCheck !== 'available') return;
    // Try to get user id and token from store, fallback to localStorage
    let userVal = get(user);
    console.log(userVal);
    let authVal = get(auth);
    let userId = userVal?.user_id || userVal?.id;
    let token = authVal?.token;
    if ((!userId || !token) && typeof localStorage !== 'undefined') {
      try {
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        userId = storedUser.user_id || storedUser.id;
        token = localStorage.getItem('token');
      } catch {}
    }
    if (!userId || !token) return;
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ username: newUsername })
      });
      if (res.ok) {
        // Log out user after username change
        showNotification('Username changed successfully.', 'success');
        setTimeout(() => {
          notifShow = false;
          dispatch('close');
        }, 2000);
      } else {
        const err = await res.json();
        usernameCheck = 'error';
        usernameCheckMsg = err.message || 'Failed to update username.';
        showNotification(usernameCheckMsg, 'error');
      }
    } catch (e) {
      usernameCheck = 'error';
      usernameCheckMsg = 'Failed to update username.';
      showNotification(usernameCheckMsg, 'error');
    }
  }

  function handleCancel() {
    notifShow = false;
    notifMsg = '';
    notifType = 'success';
    dispatch("close");
  }

  function handleKeydown(e) {
    if (e.key === "Escape") handleCancel();
  }

  async function checkUsernameAvailability(username) {
    if (!username || username.length < 3) {
      usernameCheck = null;
      usernameCheckMsg = '';
      return;
    }
    usernameCheck = 'checking';
    usernameCheckMsg = 'Checking username...';
    try {
      const res = await fetch(`${PUBLIC_API_BASE_URL}/check-username?username=${String(username)}`);
      const data = await res.json();
      if (res.ok && data.available) {
        usernameCheck = 'available';
        usernameCheckMsg = 'Username is available!';
      } else {
        usernameCheck = 'taken';
        usernameCheckMsg = 'Username is already taken.';
      }
    } catch (e) {
      usernameCheck = 'error';
      usernameCheckMsg = 'Could not check username.';
    }
  }

  $: if (newUsername && newUsername !== oldUsername) {
    checkUsernameAvailability(newUsername);
  } else {
    usernameCheck = null;
    usernameCheckMsg = '';
  }

  $: if (open) {
    oldUsername = currentUsername;
    newUsername = "";
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<Notification message={notifMsg} type={notifType} duration={2200} show={notifShow} />

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click|self={handleCancel}>
    <div class="modal-card">
      <h2>Change Username</h2>
      <label class="input-label" for="current-username">Current Username</label>
      <input
        id="current-username"
        type="text"
        placeholder={currentUsername ? `Current: ${currentUsername}` : "Current Username"}
        value={currentUsername}
        class="input-field"
        disabled
      />
      <input type="text" placeholder="New Username" bind:value={newUsername} class="input-field" autocomplete="off" />
      {#if usernameCheckMsg}
        <div class="username-check {usernameCheck}">{usernameCheckMsg}</div>
      {/if}
      <div class="actions">
        <button on:click={handleCancel} class="btn-secondary">Cancel</button>
        <button on:click={handleSubmit} class="btn-primary">Save Changes</button>
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
    max-width: 400px;
    width: 100%;
    background: var(--card);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  }

  h2 {
    text-align: center;
    font-size: 1.5rem;
    margin-top: 0;
    margin-bottom: 1.5rem;
    color: var(--text);
  }

  .input-field {
    width: 100%;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background-color: var(--input-bg);
    font-size: 1rem;
    box-sizing: border-box;
    color: var(--text);
  }
  .input-field:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(60, 60, 60, 0.3);
  }

  .input-label {
    display: block;
    margin-bottom: 0.25rem;
    font-size: 0.98rem;
    color: var(--text);
    font-weight: 500;
  }

  .actions {
    margin-top: 1.5rem;
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .btn-primary,
  .btn-secondary {
    padding: 0.6rem 1rem;
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .btn-primary {
    background-color: var(--button-bg, #3c3c3c);
    color: white;
  }
  .btn-primary:hover {
    background-color: var(--button-hover, #2a2a2a);
  }

  .btn-secondary {
    background-color: transparent;
    color: var(--text);
    border: 1px solid var(--border);
  }
  .btn-secondary:hover {
    background-color: var(--button-hover, #eee);
  }

  .username-check {
    font-size: 0.95rem;
    margin-bottom: 0.5rem;
  }
  .username-check.available {
    color: #27ae60;
  }
  .username-check.taken {
    color: #e74c3c;
  }
  .username-check.checking {
    color: #888;
  }
  .username-check.error {
    color: #e67e22;
  }
</style>
