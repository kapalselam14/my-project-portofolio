<!-- a floating action button in home and profile pages 
 to create a new article -->

<script>
  import { createEventDispatcher } from "svelte";
  const dispatch = createEventDispatcher();
</script>

<button class="fab" on:click={() => dispatch("click")} aria-label="Create Article"
  ><span>+</span></button
>

<style>
  .fab {
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    position: fixed;
    bottom: 32px;
    right: 32px;
    width: 60px;
    height: 60px;
    border: 2px solid;
    border-color: var(--border-layout);
    border-radius: 50%;
    background: var(--bg);
    color: var(--text);
    font-size: 2.5rem;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    cursor: pointer;
    z-index: 1000;
    transition: background 0.2s;
  }

  .fab span {
    display: block;
    font-size: 2.2rem;
    line-height: 1;
    margin: 0;
    padding: 0;
  }
  .fab:hover {
    background: #aaa299;
  }
</style>
