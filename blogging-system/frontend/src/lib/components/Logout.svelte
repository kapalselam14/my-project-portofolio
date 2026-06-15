<script>
  import { createEventDispatcher } from 'svelte';
  import { logout } from '../stores/user.js';
  import Notification from './Notification.svelte';
  
  export let open = false;

  const dispatch = createEventDispatcher();
  
  // Notification state
  let notifMsg = '';
  let notifType = 'success';
  let notifShow = false;

  function handleConfirm() {
    logout();
    notifMsg = 'You have successfully logged out!';
    notifType = 'success';
    notifShow = true;
    setTimeout(() => {
      notifShow = false;
      dispatch('confirm'); // Send a 'confirm' event
    }, 2000);
  }

  function handleCancel() {
    dispatch('close'); // Send a 'close' event
  }

  // Close modal on 'Escape' key
  function handleKeydown(e) {
    if (e.key === 'Escape') handleCancel();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<Notification message={notifMsg} type={notifType} duration={2200} show={notifShow} />

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click|self={handleCancel}>
    <div class="modal-card">
      <h2>Log Out</h2>
      
      <p class="confirm-text">Are you sure you want to log out?</p>

      <div class="actions">
        <button on:click={handleCancel} class="btn-secondary">Cancel</button>

        <button on:click={handleConfirm} class="btn-danger">Log Out</button>

      </div>
    </div>
  </div>
{/if}

<style>
  /* Style is copied from ChangePasswordModal */
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
    font-size: 1.4rem;
    color: var(--text);
    margin-bottom: 2rem;
  }
  
  .actions {
    margin-top: 4rem;
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

  /* New style for the danger button */
  .btn-danger {
    background-color: var(--button-bg, #3c3c3c); /* Use your theme's 'like' color */
    color: white;
  }
  .btn-danger:hover {
    opacity: 0.85;
  }
</style>