<script>
  import { createEventDispatcher } from 'svelte';
  import { theme } from "../stores/theme.js";
  import { goto } from "$app/navigation";
  import Logout from "./Logout.svelte";

  const dispatch = createEventDispatcher();

  let dark = false;
  let collapsed = false;
  let showLogoutModal = false;

  export let isProfileOrSetting = false;

  function toggleTheme() {
    theme.set($theme === "dark" ? "light" : "dark");
  }
  function onConfirmLogout() {
    showLogoutModal = false; 
    dispatch('logout');      
  }
</script>

<div class="sidebar" class:collapsed>
  <button class="collapse-btn" on:click={() => (collapsed = !collapsed)}>
    {#if collapsed}<span>↬</span>
    {:else}<span>↫</span>{/if}
  </button>

  <nav class="nav">
    <ul class="nav-list">
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
      <li on:click={() => goto("/")}>
        <img
          src="/Images/Home_icon.png"
          alt="Home"
          class="nav-icon invert-on-dark"
        />{#if !collapsed}<span>Home</span>{/if}
      </li>
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
      <li on:click={() => goto("/favourite")}>
        <img
          src="/Images/Favorite_icon.png"
          alt="Favorite"
          class="nav-icon invert-on-dark"
        />{#if !collapsed}<span>Favourites</span>{/if}
      </li>
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
      <li on:click={() => goto("/about")}>
        <img
          src="/Images/AboutUs_icon.png"
          alt="AboutUs"
          class="nav-icon invert-on-dark"
        />{#if !collapsed}<span>About</span>{/if}
      </li>
      {#if isProfileOrSetting}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
        <li on:click={() => goto("/settings")} class="settings">
          <img
            src="/Images/Setting_icon.png"
            alt="Setting"
            class="nav-icon invert-on-dark"
          />{#if !collapsed}<span>Settings</span>{/if}
        </li>
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
        <li on:click={() => showLogoutModal = true}>
          <img
            src="/Images/Logout_icon.png"
            alt="LogOut"
            class="nav-icon invert-on-dark"
          />{#if !collapsed}<span>Log Out</span>{/if}
        </li>
      {/if}
    </ul>
  </nav>

  <div class="darkmode">
    {#if !collapsed}<span>Dark Theme</span>{/if}
    <button class="toggle" on:click={toggleTheme} aria-label="Toggle dark mode">
      {#if $theme === "dark"}
        🌙
      {:else}
        ☀️
      {/if}
    </button>
  </div>
</div>

<Logout
  open={showLogoutModal}
  on:close={() => showLogoutModal = false}
  on:confirm={onConfirmLogout}
/>

<style>
  .sidebar {
    background: var(--bg-layout);
    border-right: 1.5px solid #3b3a38;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: space-between;
    height: calc(100vh - 2rem - 82px);
    width: 220px;
    font-size: 18px;
    padding: 40px 0 30px 0;
    box-sizing: border-box;
    transition:
      width 0.2s,
      background 0.3s;
    position: sticky;
    top: calc(82px + 2rem); /* Height of header + padding */
  }

  .nav-list {
    list-style: none;
    align-items: flex-start;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  li.settings {
    margin-top: 40px;
  }

  li span {
    display: inline-block;
    margin-left: 10px;
  }

  .nav-icon {
    height: 20px;
    width: 20px;
  }

  li {
    display: flex;
    align-items: center;
    padding: 10px 25px;
    cursor: pointer;
    margin: 0px 0px 0px 30px;
    border-bottom: 1px solid rgb(90, 90, 90, 0.15);
    transition:
      filter 150ms ease,
      background-color 150ms ease,
      transform 150ms ease;
  }

  li:hover {
    filter: brightness(1.08);
    background-color: var(--navbar-hover);
    transform: translateX(4px);
  }

  .darkmode {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 12px 16px;
    width: 100%;
    box-sizing: border-box;
  }
  .toggle {
    background: transparent;
    border: none;
    padding: 0;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1.5rem;
  }

  .sidebar.collapsed {
    width: 80px;
  }
  .sidebar.collapsed .nav-icon {
    width: 25px;
    height: 25px;
  }

  .sidebar.collapsed .darkmode {
    padding: 0px 0px 0px 10px;
  }

  .sidebar.collapsed li {
    padding: 10px;
    margin-left: 18px;
    border-bottom: none;
  }

  .collapse-btn {
    position: absolute; /* Position the button absolutely within the sidebar */
    /* top: calc(10vh + 2rem + 2px + 15px); Distance from the top of the sidebar */
    right: -15px; /* Slightly outside the right edge of the sidebar */
    z-index: 10; /* Ensure the button stays top layer of other sidebar content */
    background: var(--collapse-btn-bg);
    border: 1px solid rgb(90, 90, 90);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 25px;
    color: var(--text);
    width: 28px;
    height: 28px;
    line-height: 0;
    & span {
      display: block;
    }
  }

  .collapse-btn:hover {
    border: 1px solid whitesmoke;
    background-color: var(--bg-layout);
  }

  @media (max-width: 768px) {
    /* Hide collapse button on mobile */
    .collapse-btn {
      display: none;
    }

    /* Force sidebar to always be collapsed on mobile */
    .sidebar {
      width: 60px;
      top: 120px;
      height: calc(100vh - 120px);
    }
    
    .sidebar li {
      padding: 10px;
      margin-left: 10px;
      border-bottom: none;
    }

    .sidebar .nav-icon {
      width: 25px;
      height: 25px;
    }

    .sidebar .darkmode {
      padding: 0px 0px 0px 5px;
    }

    /* Hide text labels on mobile - show only icons */
    .sidebar li span,
    .sidebar .darkmode span {
      display: none;
    }
  }
</style>
