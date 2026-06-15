<script>
  import ChangePassword from './ChangePassword.svelte';
  import ChangeUsername from './ChangeUsername.svelte';
  import DeleteAccount from './DeleteAccount.svelte';
  import { user } from '$lib/stores/user.js';
  function handleChangePassword() {
    showPasswordModal = true;
  }
  
  function handleChangeUsername() {
    showUsernameModal = true;
  }
  
  function handleDeleteAccount() {
        showDeleteModal = true;

  }
  let showPasswordModal = false;
  let showUsernameModal = false;
  let showDeleteModal = false;
</script>

<div class="settings-container">
  <h2 class="title">Settings</h2>
  
  <div class="settings-options">
    <button class="option-btn" on:click={handleChangePassword}>
      Change Password
    </button>
    
    <button class="option-btn" on:click={handleChangeUsername}>
      Change Username
    </button>
    
    <button class="option-btn delete-btn" on:click={handleDeleteAccount}>
      Delete Account
    </button>
  </div>
</div>
<ChangePassword 
  open={showPasswordModal} 
  on:close={() => showPasswordModal = false} 
/>
<ChangeUsername
  open={showUsernameModal}
  currentUsername={$user?.username || ''}
  on:close={() => showUsernameModal = false}
/>
  <DeleteAccount
open={showDeleteModal} 
  on:close={() => showDeleteModal = false}  
  />
<style>
  .settings-container {
    color: var(--text); 
    width: 100%;
    max-width: 500px;
    margin-left: 200px;
    flex: 1;
    min-width: 0;
  }

  .title {
    font-size: 2.25rem;
    font-weight: 600;
    padding-bottom: 0.5rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--border); 
  }

  .settings-options {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1.5rem;
  }

  .option-btn {
    background: none;
    border: none;
    padding: 0;
    
    font-size: 1.125rem;
    font-family: inherit;
    color: var(--text);
    
    cursor: pointer;
    transition: opacity 0.2s ease;
  }

  .option-btn:hover {
    opacity: 0.7;
  }

  .delete-btn {
    color: var(--like); 
    font-weight: 600;
  }
</style>