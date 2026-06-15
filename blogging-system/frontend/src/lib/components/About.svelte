<script>
  import { onMount, onDestroy } from 'svelte';
  let gifSrc = '/Images/TryCatchMe_icon.gif';
  let interval;
  onMount(() => {
    interval = setInterval(() => {
      gifSrc = `/Images/TryCatchMe_icon.gif?${Date.now()}`;
    }, 1000); // refresh every 1 seconds
  });
  onDestroy(() => {
    clearInterval(interval);
  });
</script>

<div class="about-grid">
  <h3 class="title">About the Page</h3>
  <div class="content">
    <p>
      This project was developed for COMPSCI 718 & 719 (Postgraduate Certificate, University of
      Auckland). It demonstrates full-stack web development through a blogging platform that allows
      users to register, post articles, and comment on others. A Java-based admin client complements
      the website, communicating with the same Node.js/Express backend to manage content and users.
      The project combines required features with optional enhancements, showcasing teamwork,
      creativity, and applied technical skills across the frontend, backend, and API integration.
    </p>
  </div>
  <div class="team">
    <img src={gifSrc} alt="TryCatchMe Icon" class="team-icon" />
    <label class="madetext" for="developer">Developed by<img src="/Images/Team_logo.png" alt="Team Logo" class="logo invert-on-dark" /></label>
    
  </div>
</div>

<style>
  .about-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
    background: transparent;
    padding: 0;
  }

  .title {
    font-size: 2rem;
    font-weight: bold;
    color: var(--text, #444);
    margin: 0;
  }

  .content {
    font-size: 1.05rem;
    color: var(--text, #444);
    line-height: 1.6;
    flex: 1;
    margin-top: 0.5rem;
    text-align: justify;
  }

  .content p {
    margin: 0;
  }

  .team {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-right: 1rem;
    justify-content: space-between;
    width: 100%;
    position: relative;
  }

  .team-icon {
    height: 100px;
    width: 200px;
    border-radius: 8px;
    object-fit: cover;
    margin-right: 0;
    margin-left: 0;
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }

  .madetext {
    display: flex;
    gap: 0.5rem;
    font-size: 1.05rem;
    color: var(--text, #666);
  }

  .logo {
    position: relative;
    top: 1.5rem;
    height: 48px;
    width: auto;
    border-radius: 8px;
  }
</style>
