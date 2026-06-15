<script>
  import { createEventDispatcher } from "svelte";
  import LayerOne from "./LayerOne.svelte";
  import LayerTwo from "./LayerTwo.svelte";
  import Message from "./Message.svelte";
  
  const dispatch = createEventDispatcher();

  // Props
  export let isOpen = false;

  // Form steps
  let step = 1; // 1: LayerOne, 2: LayerTwo, 3: Message
  
  // Form data
  let username = "";
  let securityQuestion = "";
  let securityAnswer = "";
  let newPassword = "";
  let confirmPassword = "";
  
  // UI states
  let errorMessage = "";
  let loading = false;
  let successMessage = "";

  // Step 1: Get security question for username
  async function handleLayerOneContinue(event) {
    username = event.detail.username;
    errorMessage = "";
    
    if (!username.trim()) {
      errorMessage = "Please enter your username";
      return;
    }

    loading = true;
    try {
      const res = await fetch("http://localhost:3000/api/forgot-password/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() })
      });

      if (res.ok) {
        const data = await res.json();
        securityQuestion = data.question;
        step = 2;
        errorMessage = "";
      } else {
        const err = await res.json();
        errorMessage = err.message || "User not found";
      }
    } catch (e) {
      errorMessage = "Network error. Please try again.";
    } finally {
      loading = false;
    }
  }

  // Step 2: Verify security answer and reset password
  async function handleLayerTwoSubmit(event) {
    securityAnswer = event.detail.securityAnswer;
    newPassword = event.detail.newPassword;
    confirmPassword = event.detail.confirmPassword;
    errorMessage = "";
    
    // Validation
    if (!securityAnswer.trim()) {
      errorMessage = "Please enter your security answer";
      return;
    }
    if (!newPassword) {
      errorMessage = "Please enter a new password";
      return;
    }
    if (newPassword.length < 8) {
      errorMessage = "Password must be at least 8 characters";
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      errorMessage = "Password must contain at least one UPPERCASE letter";
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      errorMessage = "Password must contain at least one lowercase letter";
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      errorMessage = "Password must contain at least one number";
      return;
    }
    if (!/[^a-zA-Z0-9]/.test(newPassword)) {
      errorMessage = "Password must contain at least one special character (symbol)";
      return;
    }
    if (newPassword !== confirmPassword) {
      errorMessage = "Passwords do not match";
      return;
    }

    loading = true;
    try {
      const res = await fetch("http://localhost:3000/api/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          security_answer: securityAnswer.trim(),
          new_password: newPassword,
          confirm_password: confirmPassword
        })
      });

      if (res.ok) {
        const data = await res.json();
        successMessage = data.message;
        step = 3;
        // Close modal and reset after 2 seconds
        setTimeout(() => {
          closeModal();
          dispatch("success");
        }, 2000);
      } else {
        const err = await res.json();
        errorMessage = err.message || "Password reset failed";
      }
    } catch (e) {
      errorMessage = "Network error. Please try again.";
    } finally {
      loading = false;
    }
  }

  function handleLayerTwoBack() {
    errorMessage = "";
    step = 1;
    securityQuestion = "";
    securityAnswer = "";
    newPassword = "";
    confirmPassword = "";
  }

  function closeModal() {
    // Reset all form data
    step = 1;
    username = "";
    securityQuestion = "";
    securityAnswer = "";
    newPassword = "";
    confirmPassword = "";
    errorMessage = "";
    successMessage = "";
    loading = false;
    
    dispatch("close");
  }
</script>

{#if isOpen}
  <div class="modal-backdrop">
    <div class="forgot-password-card">
      <button class="close-button" on:click={closeModal} type="button">
        ✕
      </button>
    
      {#if step === 1}
        <LayerOne 
          bind:username
          {errorMessage}
          {loading}
          on:continue={handleLayerOneContinue}
          on:cancel={closeModal}
        />
      {:else if step === 2}
        <LayerTwo 
          {username}
          {securityQuestion}
          bind:securityAnswer
          bind:newPassword
          bind:confirmPassword
          {errorMessage}
          {loading}
          on:submit={handleLayerTwoSubmit}
          on:back={handleLayerTwoBack}
        />
      {:else if step === 3}
        <Message {successMessage} />
      {/if}

    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    padding: 2rem;
    backdrop-filter: blur(4px);
  }

  .forgot-password-card {
    background-color: var(--bg-layout);
    border-radius: 12px;
    padding: 2rem;
    width: 100%;
    max-width: 450px;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    border: 1px solid var(--border-layout);
    position: relative;
    animation: slideIn 0.3s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .close-button {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: var(--text-secondary);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
    z-index: 10;
  }

  .close-button:hover {
    background-color: var(--input-bg);
    color: var(--text);
  }

  /* Mobile responsive styles (≤768px) */
  @media (max-width: 768px) {
    .modal-backdrop {
      padding: 1rem;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .forgot-password-card {
      padding: 1.5rem;
      width: 90%;
      max-width: 380px;
      max-height: 85vh;
      margin: 0 auto;
    }

    .close-button {
      top: 0.75rem;
      right: 0.75rem;
      width: 36px;
      height: 36px;
      font-size: 1.25rem;
    }
  }

</style>

