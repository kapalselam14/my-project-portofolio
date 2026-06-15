<script>
  import "$lib/css/app.css";
  import AuthHeader from "../lib/components/AuthHeader.svelte";
  import { page } from "$app/stores";
  import { onMount, onDestroy } from "svelte";
  import { theme } from "../lib/stores/theme.js";
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";
  import FabButton from "$lib/components/FabButton.svelte";
  import ArticleEditor from "$lib/components/ArticleEditor.svelte";
  import Header from "../lib/components/Header.svelte";
  import NavBar from "../lib/components/NavBar.svelte";
  import { user } from "../lib/stores/user.js";
  import { loadUserFromStorage } from "../lib/stores/user.js";
  import { restoreAuthFromStorage, logout as authLogout } from '../lib/stores/auth.js';
  // Import notification store to ensure SSE connection is established globally
  import "../lib/stores/notification.js";
  import Notification from "$lib/components/Notification.svelte";
  import { notificationPopup } from "$lib/stores/notification.js";
  import { refreshHomeArticles } from "$lib/stores/refreshHomeArticles.js";
  import ScrollToTop from "$lib/components/ScrollToTop.svelte";


  let showEditor = false;
  let unsub;
  
  // 🔒 Global fetch interceptor - catches ALL 401 responses app-wide
  if (browser) {
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const response = await originalFetch(...args);
      
      // Intercept 401 Unauthorized responses
      if (response.status === 401) {
        try {
          const clone = response.clone();
          const data = await clone.json();
          
          // Check if account was deleted/disabled
          if (data.code === 'ACCOUNT_DELETED' || data.code === 'ACCOUNT_NOT_FOUND') {
            console.warn('Account deleted, logging out:', data.message);
            authLogout();
            goto('/login?reason=account_deleted&message=' + encodeURIComponent(data.message || 'Your account has been deactivated'));
          }
        } catch (e) {
          // If response is not JSON, ignore
        }
      }
      
      return response;
    };
  }
  
  onMount(() => {
    if (!browser) return;
    restoreAuthFromStorage(); // Ensure token/user is restored before notification logic
    unsub = theme.subscribe((t) => {
      document.body.classList.toggle("dark", t === "dark");
    });
  });
  
  onDestroy(() => unsub && unsub());
  
  $: path = $page.url.pathname;
  $: isAuthPage = path === "/login" || path === "/register";
  $: isProfileOrSetting = path.startsWith("/profile") || path.startsWith("/settings");

  // Show FAB only on Home, Profile, Favourites, and Article pages
  $: showFab =
    path === "/" ||
    path.startsWith("/profile") ||
    path === "/favourite" ||
    (path.startsWith("/articles/") && path !== "/articles");

  function logout() {
    authLogout();
    localStorage.removeItem('token');
    goto("/");
  }

  function handleCreate() {
    showEditor = true;
  }

  // Notify profile page to refresh or redirect to homepage
  function handleArticleCreated() {
    showEditor = false;
    if (browser) {
      const currentPath = $page.url.pathname;
      // If on profile page, notify to refresh
      if (currentPath.startsWith('/profile')) {
        window.dispatchEvent(new CustomEvent('article-created'));
      } 
      // If on homepage, trigger refresh
      else if (currentPath === '/') {
        refreshHomeArticles.set(true);
      }
      else {
        goto('/');
      }
    }
  }

  loadUserFromStorage(); // if refresh, auto load user from localStorage, which means login state is preserved
</script>

{#if isAuthPage}
  <AuthHeader />
  <main>
    <slot />
  </main>
{:else}
  <div class="app-layout">
    <Header />
    <div class="layout">
      <NavBar class="sidebar" {isProfileOrSetting} on:logout={logout} />
      <div class="container">
        <slot />
      </div>
    </div>
  </div>
  {#if showFab && $user}
    <FabButton on:click={handleCreate} />
  {/if}
{/if}


<!-- Article editor modal will be shown when showEditor is true -->
<ArticleEditor open={showEditor} on:close={() => (showEditor = false)} on:success={handleArticleCreated} />

<!-- Global notification popup -->
<Notification
  message={$notificationPopup.message}
  type={$notificationPopup.type}
  duration={$notificationPopup.duration}
  show={$notificationPopup.show}
/>

<ScrollToTop />

<style>
  .layout {
    display: flex;
    height: fit-content;
    width: 100vw;
  }
  .container {
    flex: 1;
    min-width: 0;
    padding: 1rem;
    height: fit-content;
  }


</style>
