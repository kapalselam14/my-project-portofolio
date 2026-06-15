<script>
  import { createEventDispatcher } from "svelte";
  import Notification from './Notification.svelte';
  
  export let open = false;

  const dispatch = createEventDispatcher();

  let oldPassword = "";
  let newPassword = "";
  let confirmPassword = "";

  let errorMsg = "";
  let showErrorMsg = false;
  let loading = false;

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

  // Live password feedback
  $: passwordChecks = [
    { label: "At least 8 characters", valid: newPassword.length >= 8 },
    { label: "Contains uppercase", valid: /[A-Z]/.test(newPassword) },
    { label: "Contains lowercase", valid: /[a-z]/.test(newPassword) },
    { label: "Contains number", valid: /[0-9]/.test(newPassword) },
    { label: "Contains symbol", valid: /[^a-zA-Z0-9]/.test(newPassword) }
  ];
  $: passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;

  async function handleSubmit() {
    errorMsg = "";
    if (!oldPassword || !newPassword || !confirmPassword) {
      errorMsg = "All fields are required.";
      showErrorMsg = true;
      setTimeout(() => { showErrorMsg = false; }, 5000);
      showNotification(errorMsg, 'error');
      return;
    }
    if (oldPassword && newPassword && oldPassword === newPassword) {
      errorMsg = "New password must be different from the old password.";
      showErrorMsg = true;
      setTimeout(() => { showErrorMsg = false; }, 5000);
      showNotification(errorMsg, 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      return;
    }
    loading = true;
    try {
      // Only get token and userId from localStorage
      let token = null;
      let userId = null;
      if (typeof localStorage !== "undefined") {
        token = localStorage.getItem("token");
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
        userId = storedUser.user_id || storedUser.id;
      }
      if (!userId || !token) {
        errorMsg = "Not authenticated.";
        showErrorMsg = true;
        setTimeout(() => { showErrorMsg = false; }, 5000);
        loading = false;
        showNotification(errorMsg, 'error');
        return;
      }
      const res = await fetch(`/api/users/${userId}/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          oldPassword,
          newPassword
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        errorMsg = data.message || "Failed to change password.";
        showErrorMsg = true;
        setTimeout(() => { showErrorMsg = false; }, 5000);
        loading = false;
        showNotification(errorMsg, 'error');
        return;
      }
      showNotification('Password changed successfully!', 'success');
      setTimeout(() => {
        notifShow = false;
        dispatch("close");
      }, 1500);
    } catch (e) {
      errorMsg = "Network error.";
      showErrorMsg = true;
      setTimeout(() => { showErrorMsg = false; }, 5000);
      showNotification(errorMsg, 'error');
    } finally {
      loading = false;
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

  $: if (open) {
    oldPassword = "";
    newPassword = "";
    confirmPassword = "";
    // Do not reset notifShow, notifMsg, notifType here
  }
</script>

<svelte:window on:keydown={handleKeydown} />
<Notification message={notifMsg} type={notifType} duration={2200} show={notifShow} />
{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="modal-overlay" on:click|self={handleCancel}>
    <div class="modal-card">
      <h2>Change Password</h2>

      <input
        type="password"
        placeholder="Current Password"
        bind:value={oldPassword}
        class="input-field"
      />

      <input
        type="password"
        placeholder="New Password"
        bind:value={newPassword}
        class="input-field"
      />
      <input
        type="password"
        placeholder="Confirm New Password"
        bind:value={confirmPassword}
        class="input-field"
      />
      <div class="pw-checks">
        {#each passwordChecks as check}
          <div class:valid={check.valid} class:invalid={!check.valid}>{check.label}</div>
        {/each}
      </div>
      {#if confirmPassword}
        <div class:valid={passwordsMatch} class:invalid={!passwordsMatch}>
          {#if passwordsMatch}Passwords match!{:else}Passwords do not match{/if}
        </div>
      {/if}

      <div class="actions">
        <button on:click={handleCancel} class="btn-secondary" disabled={loading}>Cancel</button>
        <button on:click={handleSubmit} class="btn-primary" disabled={loading}>
          {#if loading}Saving...{:else}Save Changes{/if}
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

  .pw-checks {
    margin-bottom: 0.5rem;
    font-size: 0.95rem;
  }
  .pw-checks div {
    margin-bottom: 2px;
    padding-left: 1.2em;
    position: relative;
  }
  .pw-checks .valid::before {
    content: "✔";
    color: #2a9d4b;
    position: absolute;
    left: 0;
  }
  .pw-checks .invalid::before {
    content: "✖";
    color: #c00;
    position: absolute;
    left: 0;
  }
  .valid {
    color: #2a9d4b;
  }
  .invalid {
    color: #c00;
  }
</style>
