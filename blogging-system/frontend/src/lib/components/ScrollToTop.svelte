<script>
  import { onMount, onDestroy } from 'svelte';
  let showButton = false;

  // Show button after scrolling down 500px
  function handleScroll() {
    showButton = window.scrollY > 500;
  }

  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth' // smooth scroll to top
    });
  }

  onMount(() => {
    window.addEventListener('scroll', handleScroll);
    handleScroll();
  });

  onDestroy(() => {  
    window.removeEventListener('scroll', handleScroll);
  });
</script>

{#if showButton}
  <button class="scroll-to-top" on:click={scrollToTop}>
    <svg 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      stroke-width="2" >
      <path d="M18 15l-6-6-6 6"/> <!-- draw the icon -->
    </svg> 
  </button>
{/if}

<style>
  .scroll-to-top {
    position: fixed;
    bottom: 105px;
    right: 47px;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--accent, #adadad);
    color: white;
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    transition: all 0.3s ease;
    z-index: 999;
    animation: fadeIn 0.3s ease;
  }
  .scroll-to-top:hover {
    transform: translateY(-4px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    background: var(--accent-hover, #2563eb);
  }
  .scroll-to-top:active {
    transform: translateY(-2px);
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  :global(body.dark) .scroll-to-top {
    background: var(--accent, #F2C76E);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }


  @media (max-width: 768px) {
    .scroll-to-top {
      bottom: 105px;
      right: 47px;
      width: 30px;
      height: 30px;
    }
  }
</style>

