<script>
  export let error;
  export let status;
  $: displayStatus = status ?? 404;
</script>

<div class="error-page">
  <h1>{displayStatus === 404 ? '404 - Page Not Found' : `Error ${displayStatus}`}</h1>
  <p>
    {displayStatus === 404
      ? "You are not supposed to be here 🤷‍♂️"
      : error?.message || "An unexpected error occurred."}
  </p>
  <a href="/" class="home-link">Go to Home ◀️</a>
</div>

<style>
  .error-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
    text-align: center;
    color: var(--text, #222);
  }
  .error-page h1 {
    font-size: 2.5rem;
    margin-bottom: 1rem;
  }
  .error-page p {
    font-size: 1.2rem;
    margin-bottom: 2rem;
  }
  .home-link {
    display: inline-block;
    padding: 0.7em 2em;
    background: var(--button-bg, #3b82f6);
    color: var(--text);
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
    font-size: 1.1rem;
    transition: background 0.2s;
  }
  .home-link:hover {
    background: var(--button-hover, #2563eb);
  }
</style>
