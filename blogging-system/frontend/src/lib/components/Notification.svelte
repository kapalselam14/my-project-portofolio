<script>
  import { onMount } from 'svelte';
  export let message = '';
  export let type = 'success'; // 'success' | 'error' | 'info'
  export let duration = 3000;
  export let show = false;

  let visible = false;
  let timeoutId;

  $: {
    if (show && message) {
      visible = true;
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        visible = false;
      }, duration);
    } else if (!show) {
      visible = false;
      clearTimeout(timeoutId);
    }
  }

  onMount(() => {
    return () => clearTimeout(timeoutId);
  });
</script>

{#if visible}
  <div class="notification {type}">
    {message}
  </div>
{/if}

<style>
  .notification {
    position: fixed;
    top: 2rem;
    right: 2rem;
    z-index: 3000;
    min-width: 220px;
    max-width: 350px;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    font-size: 1.05rem;
    box-shadow: 0 4px 24px rgba(0,0,0,0.13);
    color: #fff;
    background: #333;
    opacity: 0.97;
    transition: opacity 0.2s;
  }
  .notification.success {
    background: #27ae60;
  }
  .notification.error {
    background: #e74c3c;
  }
  .notification.info {
    background: #2980b9;
  }
</style>
