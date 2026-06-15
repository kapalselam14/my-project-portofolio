<script>
  import { theme } from "../stores/theme.js";


  function toggleTheme() {
    theme.set($theme === "dark" ? "light" : "dark");
  }
</script>

<header>
  <img class="logo invert-on-dark" src="/Images/Team_logo.png" alt="tryCatchMe_Logo" />
  <nav>
    <a href="/" class="home-button">Home</a>
    <button class="toggle" on:click={toggleTheme} aria-label="Toggle dark mode">
      {#if $theme === "dark"}
        🌙
      {:else}
        ☀️
      {/if}
    </button>
  </nav>
</header>

<style>
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
    background-color: var(--bg-layout);
    height: 10vh;
    border-bottom: 2px solid ;
  }
  nav{
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }
  .logo:hover {
    transform: scale(1.1);
  }
  .logo {
    height: 60px;
    margin-right: 20px;
    transition: transform 0.2s;
  }
  .home-button {
    background-color: #333;
    color: white;
    padding: 0.5rem 1rem;
    text-decoration: none;
    border-radius: 4px;
  }
  .toggle {
    background: transparent;
    border: none;
    padding: 0;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1.5rem;
    line-height: 1;
    color: var(--text);
  }

  /* Mobile responsive styles */
  @media (max-width: 768px) {
    header {
      padding: 0.75rem 1rem;
      
    }

    nav {
      gap: 0.5rem;
    }

    .logo {
      height: 60px;
      margin-right: 0.5rem;
    }

    .home-button {
      padding: 0.375rem 0.75rem;
      font-size: 1.5rem;
      margin-right: 0px;
    }

    .toggle {
      font-size: 2rem;
    }
  }

  /* Extra small devices */
  @media (max-width: 375px) {
    header {
      padding: 0.625rem 0.75rem;
    }

    nav {
      gap: 0.75rem;
    }

    .logo {
      height: 36px;
      margin-right: 0.25rem;
    }

    .home-button {
      padding: 0.313rem 0.625rem;
      font-size: 0.813rem;
    }

    .toggle {
      font-size: 1.125rem;
    }
  }
</style>