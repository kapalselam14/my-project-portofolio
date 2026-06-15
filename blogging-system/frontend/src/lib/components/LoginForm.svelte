<script>
  import { goto } from "$app/navigation";
  import { user } from "$lib/stores/user.js";
  import { login } from "$lib/stores/auth.js";
  import ForgotPasswordMain from "./ForgotPassword/ForgotPasswordMain.svelte";

  let username = "";
  let password = "";
  let warningMessage = "";
  let successMessage = "";
  let showForgotPasswordModal = false;

  async function handleLogin(event) {
    // Prevent default form submission if called from form submit
    if (event) event.preventDefault();
    
    warningMessage = "";
    successMessage = "";
    
    if (!username || !password) {
      warningMessage = "Please enter both username and password.";
      return;
    }
    try {
      const res = await fetch("http://localhost:3000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const data = await res.json();
        // Update both user and auth stores
        user.set(data.user);
        login(data.user, data.token); // This will update auth store and localStorage
        
        // Show success message
        successMessage = "Login successful! Redirecting...";
        
        // Auto-hide message and redirect after 1.5 seconds
        setTimeout(() => {
          successMessage = "";
          goto("/"); // Redirect to home after successful login
        }, 1500);
      } else {
        const err = await res.json();
        warningMessage = err.error || "Login failed.";
      }
    } catch (e) {
      warningMessage = "Network error. Please try again.";
    }
  }

  function handleRegister() {
    console.log("Navigate to register");
    goto("/register");
  }
</script>

<div class="login-container">
  <div class="login-card">
    <h2>Log In</h2>

    <form on:submit={handleLogin}>
      <input type="text" placeholder="username" bind:value={username} class="input-field" />

      <input type="password" placeholder="password" bind:value={password} class="input-field" />

      <div class="forgot-password-link">
        <button type="button" class="forgot-password-btn" on:click={() => showForgotPasswordModal = true}>
          Forgot Password?
        </button>
      </div>

      {#if warningMessage}
        <div class="warning-message">{warningMessage}</div>
      {/if}

      {#if successMessage}
        <div class="success-message">{successMessage}</div>
      {/if}

      <button type="submit" class="btn-login"> Log In </button>
    </form>

    <div class="separator">
      <div class="line"></div>
      <span>OR</span>
      <div class="line"></div>
    </div>

    <button type="button" on:click={handleRegister} class="btn-register"> Create Account </button>
  </div>
</div>

<!-- Forgot Password Modal -->
<ForgotPasswordMain 
  isOpen={showForgotPasswordModal} 
  on:close={() => showForgotPasswordModal = false}
  on:success={() => {
    showForgotPasswordModal = false;
    warningMessage = "";
  }}
/>

<style>
  .login-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 80vh;
    padding: 2rem;
  }

  .login-card {
    background-color: var(--bg-layout);
    border-radius: 12px;
    padding: 2rem;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    border: 1px solid var(--border-layout);
  }

  h2 {
    text-align: center;
    font-size: 2rem;
    margin-bottom: 1.5rem;
    color: var(--text);
    font-weight: 600;
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

  .btn-login,
  .btn-register {
    width: 100%;
    padding: 0.875rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .btn-login {
    background-color: #3c3c3c;
    color: white;
    margin-bottom: 1rem;
  }

  .btn-login:hover {
    background-color: #2a2a2a;
  }

  .separator {
    display: flex;
    align-items: center;
    margin: 1.5rem 0;
    color: #666;
    font-size: 0.9rem;
  }

  .separator .line {
    flex: 1;
    height: 1px;
    background-color: #ccc;
  }

  .separator span {
    padding: 0 1rem;
  }

  .btn-register {
    background-color: #3c3c3c;
    color: white;
  }

  .btn-register:hover {
    background-color: #2a2a2a;
  }
  .warning-message {
    color: var(--like, #e35d5b);
    font-size: 0.9rem;
    text-align: center;
    margin-bottom: 1rem;
    line-height: 1.4;
  }

  .success-message {
    color: #10b981;
    background-color: rgba(16, 185, 129, 0.1);
    font-size: 0.9rem;
    text-align: center;
    margin-bottom: 1rem;
    padding: 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(16, 185, 129, 0.3);
    line-height: 1.4;
    animation: slideDown 0.3s ease;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .forgot-password-link {
    text-align: right;
    margin-bottom: 1rem;
  }

  .forgot-password-btn {
    background: none;
    border: none;
    color: var(--text-secondary, #666);
    font-size: 0.9rem;
    text-decoration: none;
    cursor: pointer;
    padding: 0;
    transition: color 0.2s;
  }

  .forgot-password-btn:hover {
    color: var(--text, #000);
    text-decoration: underline;
  }

  /* Mobile responsive styles (≤768px) */
  @media (max-width: 768px) {
    .login-container {
      padding: 1rem;
      min-height: 70vh;
    }

    .login-card {
      padding: 1.5rem;
      max-width: 60%;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    }

    h2 {
      font-size: 1.75rem;
      margin-bottom: 1.25rem;
    }

    .input-field {
      padding: 0.625rem 0.875rem;
      font-size: 0.938rem;
    }

    .btn-login,
    .btn-register {
      padding: 0.75rem 1.25rem;
      font-size: 0.938rem;
      min-height: 44px; /* Touch-friendly */
    }

    .separator {
      margin: 1.25rem 0;
      font-size: 0.85rem;
    }

    .separator span {
      padding: 0 0.75rem;
    }

    .forgot-password-btn {
      font-size: 0.85rem;
      min-height: 36px; /* Touch-friendly tap area */
      padding: 0.25rem 0;
    }

    .warning-message {
      font-size: 0.85rem;
    }

    .success-message {
      font-size: 0.875rem;
      padding: 0.625rem;
    }
  }

  /* Extra small devices (≤375px) */
  @media (max-width: 375px) {
    .login-container {
      padding: 0.75rem;
    }

    .login-card {
      padding: 1.25rem;
    }

    h2 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
    }

    .input-field {
      padding: 0.563rem 0.75rem;
      font-size: 0.875rem;
    }

    .btn-login,
    .btn-register {
      padding: 0.688rem 1rem;
      font-size: 0.875rem;
    }

    .separator {
      margin: 1rem 0;
      font-size: 0.813rem;
    }

    .forgot-password-btn {
      font-size: 0.813rem;
    }
  }
</style>
