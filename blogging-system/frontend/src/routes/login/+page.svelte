<script>
    import { page } from '$app/stores';
  import { onMount } from 'svelte';
  
  let accountDeletedMessage = '';
  
  onMount(() => {
      // Check if user was redirected due to account deletion
      const reason = $page.url.searchParams.get('reason');
      const message = $page.url.searchParams.get('message');
      
      if (reason === 'account_deleted') {
          accountDeletedMessage = decodeURIComponent(message || 'Your account has been deactivated');
      }
  });
  import LoginForm from '$lib/components/LoginForm.svelte';
</script>

{#if accountDeletedMessage}
    <div class="deletion-alert">
        <div class="alert-icon">⚠️</div>
        <div class="alert-content">
            <strong>Account Deactivated</strong>
            <p>{accountDeletedMessage}</p>
        </div>
    </div>
{/if}

<LoginForm />

<svelte:head>
  <title>Log In</title>
</svelte:head>

<style>
  .deletion-alert {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    max-width: 500px;
    margin: 2rem auto 1.5rem;
    padding: 1.25rem 1.5rem;
    background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
    border: 2px solid #ffc107;
    border-left: 5px solid #ff9800;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(255, 152, 0, 0.15);
    animation: slideDown 0.4s ease-out;
  }

  .alert-icon {
    font-size: 2rem;
    flex-shrink: 0;
    animation: pulse 2s ease-in-out infinite;
  }

  .alert-content {
    flex: 1;
  }

  .alert-content strong {
    display: block;
    color: #856404;
    font-size: 1.1rem;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .alert-content p {
    margin: 0;
    color: #856404;
    font-size: 0.95rem;
    line-height: 1.5;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
  }

  /* Dark mode support */
  :global(body.dark) .deletion-alert {
    background: linear-gradient(135deg, #4a3800 0%, #5c4500 100%);
    border-color: #ff9800;
    box-shadow: 0 4px 12px rgba(255, 152, 0, 0.25);
  }

  :global(body.dark) .alert-content strong,
  :global(body.dark) .alert-content p {
    color: #ffc107;
  }
</style>

