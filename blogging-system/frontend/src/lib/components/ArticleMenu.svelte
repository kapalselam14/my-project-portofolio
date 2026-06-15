<script>
  import { createEventDispatcher } from "svelte";

  export let isOpen = false;
  export let isOwner = false;

  const dispatch = createEventDispatcher();

  let menuRef;

  function handleEdit() {
    dispatch("edit");
    isOpen = false;
  }

  function handleDelete() {
    dispatch("delete");
    isOpen = false;
  }

  function handleClickOutside(event) {
    if (menuRef && !menuRef.contains(event.target) && isOpen) {
      isOpen = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

{#if isOwner}
  <div class="menu-container">
    <button
      class="menu-trigger"
      on:click|stopPropagation={() => (isOpen = !isOpen)}
      aria-label="Article options"
    >
      ⋮
    </button>

    {#if isOpen}
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="menu-dropdown" bind:this={menuRef} on:click|stopPropagation>
        <button class="menu-item" on:click={handleEdit}> ✏️ Edit Article </button>
        <button class="menu-item delete" on:click={handleDelete}> 🗑️ Delete Article </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .menu-container {
    position: relative;
    display: inline-block;
    z-index: 2;
  }

  .menu-trigger {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--text);
    padding: 4px 8px;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .menu-trigger:hover {
    background: var(--accent, #f0f0f0);
  }

  .menu-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 160px;
    z-index: 10;
    margin-top: 4px;
  }

  .menu-item {
    display: block;
    width: 100%;
    padding: 12px 16px;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    color: var(--text);
    font-size: 14px;
    transition: background 0.2s;
  }

  .menu-item:hover {
    background: var(--button-hover, #f0f0f0);
  }

  .menu-item.delete {
    color: var(--like, #e35d5b);
  }

  .menu-item.delete:hover {
    background: rgba(227, 93, 91, 0.1);
  }

  .menu-item:first-child {
    border-radius: 8px 8px 0 0;
  }

  .menu-item:last-child {
    border-radius: 0 0 8px 8px;
  }
</style>
