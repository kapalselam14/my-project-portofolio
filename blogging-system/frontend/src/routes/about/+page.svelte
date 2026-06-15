<script>
  import About from "../../lib/components/About.svelte";
  import SmallGames from "../../lib/components/SmallGames.svelte";
</script>


<div class="about-games-container">
  <div class="about-section">
    <About />
  </div>
  <div class="games-section">
    <SmallGames />
  </div>
</div>

<svelte:head>
    <title>About Us</title>
</svelte:head>

<style>
.about-games-container {
  display: flex;
  gap: 2rem;
  align-items: center;
  justify-content: center;
  width: 100%;
  box-sizing: border-box;
  margin: auto;
  padding: 0 0.5rem;
  max-width: 1400px;
  height: calc(100vh - 10vh - 4rem - 2px); 
  overflow: hidden;
}
.about-section {
  flex: 0 0 58%;
  background: var(--card, #fff);
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  padding: 2rem 2rem;
  box-sizing: border-box;
  border: 1px solid var(--border, #ececec);
  color: var(--text, #222);
  height: 480px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.games-section {
  flex: 0 0 38%;
  background: var(--card, #fff);
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  padding: 2rem 1.5rem;
  box-sizing: border-box;
  border: 1px solid var(--border, #ececec);
  color: var(--text, #222);
  height: 480px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

@media (max-width: 1100px) {
  .about-games-container {
    flex-direction: column;
    gap: 1.5rem;
    height: auto;
    overflow: auto;
    padding: 1.5rem 1rem;
  }
  .about-section, .games-section {
    flex: unset;
    width: 100%;
    max-width: 700px;
    height: auto;
    min-height: 320px;
    padding: 1.5rem 1rem;
  }
}
</style>

