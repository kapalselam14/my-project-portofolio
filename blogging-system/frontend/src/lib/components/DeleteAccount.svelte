<script>
  import { createEventDispatcher } from 'svelte';
  export let open = false;

  import Notification from './Notification.svelte';
  import { user } from '../stores/user.js';
  import { auth } from '../stores/auth.js';
  const dispatch = createEventDispatcher();

  let step = 1; // 1: confirm, 2: password, 3: countdown
  let password = '';
  let errorMsg = '';
  let notifMsg = '';
  let notifType = 'success';
  let notifShow = false;
  let loading = false;
  let countdown = 5;
  let countdownActive = false;
  let deleteEnabled = false;

  function handleCancel() {
    step = 1;
    password = '';
    errorMsg = '';
    notifShow = false;
    loading = false;
    dispatch('close');
  }

  async function handlePasswordSubmit() {
    errorMsg = '';
    loading = true;
    // Get username from store or localStorage
    let username = null;
    if (user && user.subscribe) {
      let u;
      user.subscribe(val => u = val)();
      username = u?.username;
    }
    if (!username && typeof localStorage !== 'undefined') {
      try {
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        username = storedUser.username;
      } catch {}
    }
    if (!username) {
      errorMsg = 'Not authenticated.';
      loading = false;
      return;
    }
    // Validate password using login endpoint
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
      errorMsg = 'Invalid password.';
      loading = false;
      return;
    }
    // Password valid, start countdown
    step = 3;
    countdownActive = true;
    deleteEnabled = false;
    countdown = 5;
    loading = false;
    startCountdown();
  }

  function startCountdown() {
    const timer = setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) {
        clearInterval(timer);
        countdownActive = false;
        deleteEnabled = true;
      }
    }, 1000);
  }

  async function handleDelete() {
    loading = true;
    errorMsg = '';
    let token = null;
    let userId = null;
    if (typeof localStorage !== 'undefined') {
      token = localStorage.getItem('token');
      const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
      userId = storedUser.user_id || storedUser.id;
    }
    if (!userId || !token) {
      errorMsg = 'Not authenticated.';
      loading = false;
      return;
    }
    // Soft delete endpoint (assume DELETE /api/users/:id)
    const res = await fetch(`/api/users/${userId}?mode=soft`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ password, softDelete: true })
    });
    if (!res.ok) {
      errorMsg = 'Failed to delete account.';
      loading = false;
      return;
    }
    notifMsg = 'Account Deletion Successful.';
    notifType = 'success';
    notifShow = true;
    // Log out user and redirect
    user.set(null);
    auth.set({ token: null });
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setTimeout(() => {
      notifShow = false;
      dispatch('deleted');
      window.location.href = '/login';
    }, 1800);
    loading = false;
  }
</script>

<svelte:window on:keydown={(e) => { if (e.key === 'Escape') handleCancel(); }} />
<Notification message={notifMsg} type={notifType} duration={2200} show={notifShow} />
{#if open}
  <div class="modal-overlay" on:click|self={handleCancel}>
    <div class="modal-card">
      {#if step === 1}
        <h2>Delete Account</h2>
        <p class="confirm-text">Are you sure you want to delete your account? This action cannot be undone.</p>
        <div class="actions">
          <button on:click={handleCancel} class="btn-secondary">Cancel</button>
          <button on:click={() => step = 2} class="btn-danger">Continue</button>
        </div>
      {:else if step === 2}
        <h2>Enter Password</h2>
        <p class="confirm-text">Please enter your password to confirm account deletion.</p>
        <input type="password" placeholder="Password" bind:value={password} class="input-field" />
        {#if errorMsg}
          <div class="error-msg">{errorMsg}</div>
        {/if}
        <div class="actions">
          <button on:click={handleCancel} class="btn-secondary">Cancel</button>
          <button on:click={handlePasswordSubmit} class="btn-danger" disabled={loading || !password}>Validate</button>
        </div>
      {:else if step === 3}
        <h2>Final Confirmation</h2>
        <p class="confirm-text">Account deletion will be enabled in {countdownActive ? countdown : 0} seconds.</p>
        <div class="actions">
          <button on:click={handleCancel} class="btn-secondary">Cancel</button>
          <button
            on:click={handleDelete}
            class="btn-danger delete-countdown-btn {deleteEnabled ? 'enabled' : 'disabled'}"
            disabled={!deleteEnabled || loading}
          >
            {#if loading}
              Deleting...
            {:else if !deleteEnabled}
              Delete Account ({countdown})
            {:else}
              Delete Account
            {/if}
          </button>
        </div>
      {/if}
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
    text-align: left;
    font-size: 1.6rem;
    margin-top: 0;
    margin-bottom: 1rem;
    color: var(--text);
  }
  .confirm-text {
    text-align: left;
    font-size: 1.2rem;
    color: var(--text);
    margin-bottom: 2rem;
  }
  .actions {
    margin-top: 2rem;
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }
  .btn-secondary, .btn-danger {
    padding: 0.6rem 1rem;
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s, color 0.2s;
  }
  .btn-secondary {
    background-color: transparent;
    color: var(--text);
    border: 1px solid var(--border);
  }
  .btn-secondary:hover {
    background-color: var(--button-hover, #eee);
  }
  .btn-danger {
    background-color: var(--button-bg, #3c3c3c);
    color: white;
    transition: background 0.2s, color 0.2s, opacity 0.2s;
  }
  .btn-danger.enabled {
    opacity: 1;
    cursor: pointer;
    filter: none;
    background-color: #e35d5b;
    color: #fff;
    border: 2px solid #e35d5b;
    box-shadow: 0 0 8px #e35d5b44;
  }
  .btn-danger.disabled,
  .btn-danger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    background-color: #888;
    color: #eee;
    border: 2px solid #bbb;
    box-shadow: none;
  }
  .btn-danger.enabled:hover {
    background-color: #c0392b;
    border-color: #c0392b;
    opacity: 0.95;
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
  .error-msg {
    color: #c00;
    background: #fff0f0;
    border: 1px solid #fbb;
    border-radius: 6px;
    padding: 0.5rem 1rem;
    margin-bottom: 1rem;
    text-align: center;
    font-size: 0.98rem;
  }
</style>