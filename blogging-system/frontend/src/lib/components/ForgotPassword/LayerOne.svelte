<script>
  import { createEventDispatcher } from "svelte";
  
  const dispatch = createEventDispatcher();

  export let username = "";
  export let errorMessage = "";
  export let loading = false;

  function handleContinue() {
    dispatch("continue", { username });
  }

  function handleCancel() {
    dispatch("cancel");
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !loading) {
      handleContinue();
    }
  }
</script>

<h2>Forgot Password?</h2>
<p class="subtitle">Enter your username to reset your password</p>

<input
  type="text"
  placeholder="Username"
  bind:value={username}
  class="input-field"
  disabled={loading}
  on:keydown={handleKeyDown}
/>

{#if errorMessage}
  <div class="error-message">{errorMessage}</div>
{/if}

<button
  type="button"
  on:click={handleContinue}
  class="btn-primary"
  disabled={loading}
>
  {loading ? "Loading..." : "Continue"}
</button>

<button
  type="button"
  on:click={handleCancel}
  class="btn-secondary"
>
  Cancel
</button>

<style>
  h2 {
    text-align: center;
    font-size: 2rem;
    margin-bottom: 0.5rem;
    color: var(--text);
    font-weight: 600;
  }

  .subtitle {
    text-align: center;
    color: var(--text-secondary);
    margin-bottom: 1.5rem;
    font-size: 0.95rem;
  }

  .input-field {
    width: 100%;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    border: none;
    border-radius: 8px;
    background-color: var(--input-bg);
    color: var(--text);
    font-size: 1rem;
    box-sizing: border-box;
  }

  .input-field:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(60, 60, 60, 0.3);
  }

  .input-field:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary,
  .btn-secondary {
    width: 100%;
    padding: 0.875rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
    margin-bottom: 0.75rem;
  }

  .btn-primary {
    background-color: #3c3c3c;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #2a2a2a;
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: transparent;
    color: var(--text);
    border: 1px solid var(--border-layout);
  }

  .btn-secondary:hover {
    background-color: var(--input-bg);
  }

  .error-message {
    color: var(--like, #e35d5b);
    font-size: 0.9rem;
    text-align: center;
    margin-bottom: 1rem;
    line-height: 1.4;
  }

  /* Mobile responsive styles (≤768px) */
  @media (max-width: 768px) {
    h2 {
      font-size: 1.75rem;
      margin-bottom: 0.375rem;
    }

    .subtitle {
      font-size: 0.875rem;
      margin-bottom: 1.25rem;
    }

    .input-field {
      padding: 0.625rem 0.875rem;
      font-size: 0.938rem;
      margin-bottom: 0.875rem;
    }

    .btn-primary,
    .btn-secondary {
      padding: 0.75rem 1.25rem;
      font-size: 0.938rem;
      margin-bottom: 0.625rem;
      min-height: 44px; /* Touch-friendly */
    }

    .error-message {
      font-size: 0.85rem;
      margin-bottom: 0.875rem;
    }
  }

  /* Extra small devices (≤375px) */
  @media (max-width: 375px) {
    h2 {
      font-size: 1.5rem;
      margin-bottom: 0.25rem;
    }

    .subtitle {
      font-size: 0.813rem;
      margin-bottom: 1rem;
    }

    .input-field {
      padding: 0.563rem 0.75rem;
      font-size: 0.875rem;
      margin-bottom: 0.75rem;
    }

    .btn-primary,
    .btn-secondary {
      padding: 0.688rem 1rem;
      font-size: 0.875rem;
      margin-bottom: 0.5rem;
    }

    .error-message {
      font-size: 0.813rem;
    }
  }
</style>

