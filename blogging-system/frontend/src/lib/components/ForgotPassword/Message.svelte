<script>
  export let successMessage = "";
</script>

<div class="success-container">
  <div class="success-icon">✓</div>
  <h2>Password Reset Successful!</h2>
  <p class="success-text">{successMessage}</p>
  <p class="redirect-text">Closing in 2 seconds...</p>
</div>

<style>
  .success-container {
    text-align: center;
    padding: 2rem 0;
  }

  .success-icon {
    width: 80px;
    height: 80px;
    margin: 0 auto 1.5rem;
    background-color: #4caf50;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 3rem;
    font-weight: bold;
  }

  h2 {
    text-align: center;
    font-size: 2rem;
    margin-bottom: 0.5rem;
    color: var(--text);
    font-weight: 600;
  }

  .success-text {
    color: var(--text);
    margin-bottom: 1rem;
    font-size: 1rem;
  }

  .redirect-text {
    color: var(--text-secondary);
    font-size: 0.9rem;
    font-style: italic;
  }

  /* Mobile responsive styles (≤768px) */
  @media (max-width: 768px) {
    .success-container {
      padding: 1.5rem 0;
    }

    .success-icon {
      width: 70px;
      height: 70px;
      font-size: 2.5rem;
      margin-bottom: 1.25rem;
    }

    h2 {
      font-size: 1.75rem;
      margin-bottom: 0.375rem;
    }

    .success-text {
      font-size: 0.938rem;
      margin-bottom: 0.875rem;
    }

    .redirect-text {
      font-size: 0.85rem;
    }
  }

  /* Extra small devices (≤375px) */
  @media (max-width: 375px) {
    .success-container {
      padding: 1.25rem 0;
    }

    .success-icon {
      width: 60px;
      height: 60px;
      font-size: 2rem;
      margin-bottom: 1rem;
    }

    h2 {
      font-size: 1.5rem;
      margin-bottom: 0.25rem;
    }

    .success-text {
      font-size: 0.875rem;
      margin-bottom: 0.75rem;
    }

    .redirect-text {
      font-size: 0.813rem;
    }
  }
</style>

