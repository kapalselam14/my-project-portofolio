<script>
  import { onMount } from "svelte";
  import { user } from "$lib/stores/user.js";
  import { loadUserFromStorage } from "$lib/stores/user.js";
  import SearchBar from './SearchBar.svelte';
  import SortControls from './SortControls.svelte';
  import UserActions from './UserActions.svelte';

  onMount(() => {
    loadUserFromStorage();
  });
</script>

<div class="header">
  <a href="/"><img class="logo invert-on-dark" src="/Images/Team_logo.png" alt="tryCatchMe_Logo" /></a>
  
  <div class="search-sort-wrapper">
    <SearchBar />
    <SortControls />
  </div>
  
  <UserActions />
</div>

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-layout);
    padding: 1rem 2rem;
    border-bottom: 2px solid;
    border-color: var(--border-layout);
    height: 80px;
    position: sticky;
    top: 0;
    z-index: 100;
    gap: 20px;
  }

  /* Search & Sort Wrapper */
  .search-sort-wrapper {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 900px;
  }

  .logo {
    height: 60px;
    margin-right: 20px;
    transition: transform 0.2s;
  }

  .logo:hover {
    transform: scale(1.1);
  }



  /* Mobile-First Responsive Design (≤768px) */
  @media (max-width: 768px) {
    .header {
      /* Layout */
      flex-wrap: wrap;
      height: 120px;
      
      /* Spacing - optimized for mobile */
      padding: 0.625rem 0.75rem; /* 10px 12px */
      gap: 0.5rem; /* 8px vertical gap between rows */
      
      /* Prevent horizontal scroll */
      width: 100%;
      max-width: 100vw;
      box-sizing: border-box;
      overflow-x: hidden;
    }

    /* Logo - First element in row 1 */
    .logo {
      height: 36px;
      margin-right: auto; /* Push icons to the right */
      order: 1;
      flex-shrink: 0;
    }

    /* User Actions (Notification + Profile) - Right side of row 1 */
    .header :global(.icons) {
      order: 2;
      gap: 0.75rem; /* 12px between notification and profile */
      flex-shrink: 0;
      margin-left: auto;
    }
    
    /* Search & Sort - Full width row 2 */
    .search-sort-wrapper {
      /* Full width on new row */
      width: 100%;
      flex-basis: 100%;
      order: 3;
      
      /* Layout */
      flex-wrap: nowrap;
      gap: 0.5rem; /* 8px between search and sort */
      
      /* Prevent overflow */
      min-width: 0;
      max-width: 100%;
      box-sizing: border-box;
    }

    /* SearchBar - Takes remaining space */
    .search-sort-wrapper :global(> *:first-child) {
      flex: 1 1 0;
      min-width: 0;
      max-width: 100%;
    }

    /* SortControls - Auto width, wraps if needed */
    .search-sort-wrapper :global(> *:last-child) {
      flex: 0 0 auto;
      min-width: fit-content;
    }
  }

  /* Extra small devices (phones < 375px) */
  @media (max-width: 375px) {
    .header {
      padding: 0.5rem 0.625rem; /* 8px 10px */
    }

    .logo {
      height: 32px;
    }

    .header :global(.icons) {
      gap: 0.625rem; /* 10px */
    }

    .search-sort-wrapper {
      flex-wrap: wrap;
      gap: 0.375rem; /* 6px */
    }

    /* Stack search and sort vertically on very small screens */
    .search-sort-wrapper :global(> *) {
      flex: 1 1 100%;
      width: 100%;
    }
  }
</style>
