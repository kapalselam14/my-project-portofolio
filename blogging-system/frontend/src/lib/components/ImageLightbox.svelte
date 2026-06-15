<!-- Popup to handle viewing of images when user clicks on it -->
<script>
  import { createEventDispatcher } from "svelte";

  export let images = [];
  export let currentIndex = 0;
  export let isOpen = false;

  const dispatch = createEventDispatcher();

  function close() {
    dispatch("close");
  }

  function next() {
    currentIndex = (currentIndex + 1) % images.length;
  }

  function prev() {
    currentIndex = (currentIndex - 1 + images.length) % images.length;
  }

  function handleKeydown(e) {
    if (!isOpen) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="lightbox-overlay" on:click={close}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="lightbox-content" on:click|stopPropagation>
      <button class="lightbox-close" on:click={close} aria-label="Close"> ✕ </button>

      {#if images.length > 1}
        <button class="lightbox-nav lightbox-prev" on:click={prev} aria-label="Previous">
          ‹
        </button>
        <button class="lightbox-nav lightbox-next" on:click={next} aria-label="Next"> › </button>
      {/if}

      <img src={images[currentIndex]} alt="Full size" class="lightbox-image" />

      {#if images.length > 1}
        <div class="lightbox-counter">
          {currentIndex + 1} / {images.length}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .lightbox-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.9);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .lightbox-content {
    position: relative;
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .lightbox-image {
    max-width: 100%;
    max-height: 90vh;
    object-fit: contain;
    border-radius: 8px;
  }

  .lightbox-close {
    position: absolute;
    top: -40px;
    right: 0;
    background: none;
    border: none;
    color: white;
    font-size: 36px;
    cursor: pointer;
    padding: 8px 16px;
    transition: opacity 0.2s;
  }

  .lightbox-close:hover {
    opacity: 0.7;
  }

  .lightbox-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: white;
    font-size: 48px;
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border-radius: 50%;
    transition: background 0.2s;
  }

  .lightbox-nav:hover {
    background: rgba(255, 255, 255, 0.2);
  }

  .lightbox-prev {
    left: -80px;
  }

  .lightbox-next {
    right: -80px;
  }

  .lightbox-counter {
    position: absolute;
    bottom: -40px;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    font-size: 16px;
    font-weight: 600;
  }

  @media (max-width: 768px) {
    .lightbox-nav {
      width: 50px;
      height: 50px;
      font-size: 36px;
    }

    .lightbox-prev {
      left: 10px;
    }

    .lightbox-next {
      right: 10px;
    }
  }
</style>
