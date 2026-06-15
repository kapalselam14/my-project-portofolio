<script>
  import { createEventDispatcher } from "svelte";
  
  const dispatch = createEventDispatcher();

  export let username = "";
  export let securityQuestion = "";
  export let securityAnswer = "";
  export let newPassword = "";
  export let confirmPassword = "";
  export let errorMessage = "";
  export let loading = false;

  function handleSubmit() {
    dispatch("submit", { 
      securityAnswer, 
      newPassword, 
      confirmPassword 
    });
  }

  function handleBack() {
    dispatch("back");
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !loading) {
      handleSubmit();
    }
  }
</script>

<h2>Reset Password</h2>
<p class="subtitle">Answer your security question</p>

<div class="username-display">
  <strong>Username:</strong> {username}
</div>

<div class="security-question-box">
  <div class="question-label">Security Question:</div>
  <p class="question-text">{securityQuestion}</p>
</div>

<input
  type="text"
  placeholder="Your answer"
  bind:value={securityAnswer}
  class="input-field"
  disabled={loading}
  on:keydown={handleKeyDown}
/>

<input
  type="password"
  placeholder="New password *"
  bind:value={newPassword}
  class="input-field"
  disabled={loading}
  on:keydown={handleKeyDown}
/>

<div class="password-requirements">
  Password must contain: uppercase, lowercase, number, symbol (min 8 characters)
</div>

<input
  type="password"
  placeholder="Confirm new password *"
  bind:value={confirmPassword}
  class="input-field"
  disabled={loading}
  on:keydown={handleKeyDown}
/>

{#if errorMessage}
  <div class="error-message">{errorMessage}</div>
{/if}

<button
  type="button"
  on:click={handleSubmit}
  class="btn-primary"
  disabled={loading}
>
  {loading ? "Resetting..." : "Reset Password"}
</button>

<button
  type="button"
  on:click={handleBack}
  class="btn-secondary"
  disabled={loading}
>
  Back
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

  .username-display {
    padding: 0.75rem;
    background-color: var(--input-bg);
    border-radius: 8px;
    margin-bottom: 1rem;
    color: var(--text);
  }

  .security-question-box {
    margin-bottom: 0.75rem;
    padding: 1rem;
    background-color: var(--input-bg);
    border-radius: 8px;
  }

  .question-label {
    display: block;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--text);
    font-size: 0.9rem;
  }

  .question-text {
    color: var(--text);
    font-size: 1rem;
    margin: 0;
    font-weight: 500;
  }

  .password-requirements {
    font-size: 0.85rem;
    color: var(--text-secondary, #666);
    margin: -0.5rem 0 1rem 0;
    line-height: 1.4;
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

  .btn-secondary:hover:not(:disabled) {
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

    .username-display {
      padding: 0.625rem;
      font-size: 0.938rem;
      margin-bottom: 0.875rem;
    }

    .security-question-box {
      padding: 0.875rem;
      margin-bottom: 0.875rem;
    }

    .question-label {
      font-size: 0.85rem;
      margin-bottom: 0.375rem;
    }

    .question-text {
      font-size: 0.938rem;
    }

    .password-requirements {
      font-size: 0.813rem;
      margin: -0.375rem 0 0.875rem 0;
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

    .username-display {
      padding: 0.563rem;
      font-size: 0.875rem;
      margin-bottom: 0.75rem;
    }

    .security-question-box {
      padding: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .question-label {
      font-size: 0.813rem;
      margin-bottom: 0.25rem;
    }

    .question-text {
      font-size: 0.875rem;
    }

    .password-requirements {
      font-size: 0.75rem;
      margin: -0.25rem 0 0.75rem 0;
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

