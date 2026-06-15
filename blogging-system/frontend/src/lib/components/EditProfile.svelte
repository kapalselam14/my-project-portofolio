<script>
  import { createEventDispatcher, onMount } from "svelte";
  export let open = false;

  const dispatch = createEventDispatcher();

  let avatarFile = null;
  let avatarPreview = "";
  let selectedAvatarUrl = null;
  let defaultAvatars = [];
  let isAvatarSectionOpen = true;
  let firstName = "";
  let lastName = "";
  let bio = "";
  let originalBio = "";
  let bioChanged = false;
  const bioMaxLength = 500;

  onMount(async () => {
    try {
      const resAvatars = await fetch("http://localhost:3000/api/users/avatars");
      if (resAvatars.ok) {
        defaultAvatars = await resAvatars.json();
      }
    } catch (error) {
      console.error("Failed to fetch avatars:", error);
    }
  });

  function handleAvatarChange(event) {
    const file = event.target.files[0];
    if (file) {
      avatarFile = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        avatarPreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  function handleSave() {
    dispatch("save", {
      avatarFile,
      selectedAvatarUrl,
      firstName,
      lastName,
      bio: bioChanged ? bio : undefined
    });
    dispatch("close");
  }

  function handleCancel() {
    dispatch("close");
  }

  function handleKeydown(e) {
    if (e.key === "Escape") handleCancel();
  }

  let prevOpen = false;
  $: if (open && !prevOpen) {
    avatarFile = null;
    avatarPreview = "";
    selectedAvatarUrl = currentAvatarUrl?.replace("http://localhost:3000", "") || null;
    firstName = currentFirstName;
    lastName = currentLastName;
    bio = currentBio;
    originalBio = currentBio;
    bioChanged = false;
  }
  $: prevOpen = open;
  
  // Track bio changes
  $: bioChanged = bio !== originalBio;
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div class="modal-overlay" on:click|self={handleCancel}>
    <div class="modal-card">
      <h2>Edit Profile</h2>

      <!-- Avatar Section -->
      <button type="button" class="avatar-section-toggle {isAvatarSectionOpen ? 'open' : ''}"
        on:click={() => (isAvatarSectionOpen = !isAvatarSectionOpen)} >
        <span>Choose Your Avatar</span>
      </button>

      {#if isAvatarSectionOpen}
        <div class="avatar-content">
          <div class="avatar-section-label">Select a predefined avatar:</div>
          <div class="avatar-grid">
            {#each defaultAvatars as avatar}
              <button type="button" class="avatar-option {selectedAvatarUrl === avatar.url ? 'selected' : ''}"
                on:click={() => {
                  selectedAvatarUrl = avatar.url;
                  avatarFile = null;
                  avatarPreview = "";
                }} 
                title={avatar.name} >
                <img src={"http://localhost:3000" + avatar.url} alt={avatar.name} />
              </button>
            {/each}
          </div>

          {#if selectedAvatarUrl || avatarFile}
            <button type="button" class="btn-cancel-avatar"
              on:click={() => {
                selectedAvatarUrl = null;
                avatarFile = null;
                avatarPreview = "";
              }} >
              ✕ Clear Avatar Selection
            </button>
          {/if}
          
          <div class="divider">OR</div>
          <label class="file-label" for="avatar-upload">Upload your own custom avatar:</label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            on:change={handleAvatarChange}
            style="display: none;"
          />
          <label class="btn-file-upload" for="avatar-upload">
            <span>{avatarFile ? avatarFile.name : "Choose a file..."}</span>
          </label>
          
          {#if avatarPreview}
            <div class="avatar-preview-container">
              <img src={avatarPreview} alt="Avatar Preview" class="avatar-preview" />
            </div>
          {/if}
        </div>
      {/if}

      <!-- Other column -->
      <div class="input-row">
        <input type="text" placeholder="First Name" bind:value={firstName} class="input-field" />
        <input type="text" placeholder="Last Name" bind:value={lastName} class="input-field" />
      </div>

      <textarea
        placeholder="Bio (max {bioMaxLength} characters)"
        bind:value={bio}
        class="input-field bio-field"
        maxlength={bioMaxLength}
        rows="4"
      />

      <div class="bio-count">{bio.length}/{bioMaxLength}</div>
      <div class="actions">
        <button on:click={handleCancel} class="btn-cancel">Cancel</button>
        <button on:click={handleSave} class="btn-save">Save Changes</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(1px);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .modal-card {
    min-width: 35vw;
    display: flex;
    flex-direction: column;
    background: var(--card);
    border-radius: 12px;
    padding: 2rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
    max-height: 90vh;
    max-width: 40vw;
    overflow-y: auto;
  }

  h2 {
    text-align: center;
    font-size: 1.5rem;
    margin-top: 0;
    margin-bottom: 1.5rem;
    color: var(--text);
  }

  .input-field {
    width: 100%;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background-color: var(--input-bg);
    font-size: 0.8rem;
    box-sizing: border-box;
    color: var(--text);
  }
  .input-field:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(60, 60, 60, 0.3);
  }
  .input-row .input-field {
    margin-bottom: 1rem;
  }

  .bio-field {
    min-height: 100px;
    max-height: 200px;
    resize: vertical;
    margin-bottom: 0.5rem;
    min-width: 100%;
    box-sizing: border-box;
  }

  .bio-count {
    text-align: right;
    font-size: 0.85rem;
    color: #888;
    margin-bottom: 1rem;
  }

  .actions {
    margin-top: 1.5rem;
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .btn-save,
  .btn-cancel {
    padding: 0.6rem 1rem;
    border: none;
    border-radius: 8px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .btn-save {
    background-color: var(--button-bg, #3c3c3c);
    color: white;
  }
  .btn-save:hover {
    background-color: rgb(13, 13, 241);
  }

  .btn-cancel {
    background-color: transparent;
    color: var(--text);
    border: 1px solid var(--border);
  }
  .btn-cancel:hover {
    background-color: var(--button-hover, #eee);
  }

  .avatar-section-toggle {
    width: 100%;
    padding: 0.875rem 1rem;
    padding-right: 2.5rem;
    margin-bottom: 1rem;
    border: 2px solid var(--border-layout);
    border-radius: 8px;
    background-color: var(--input-bg);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23888' d='M8 11L3 6h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 1rem center;
    background-size: 12px;
    color: var(--text);
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s ease;
    text-align: left;
  }
  .avatar-section-toggle.open {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23888' d='M8 5L3 10h10z'/%3E%3C/svg%3E");
  }
  .avatar-content {
    padding: 1rem;
    border: 1px solid var(--border-layout);
    border-radius: 8px;
    background-color: rgba(60, 60, 60, 0.02);
    margin-bottom: 1rem;
    animation: slideDown 0.3s ease;
  }
  @keyframes slideDown {
    from {
      opacity: 0;
      max-height: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      max-height: 1000px;
      transform: translateY(0);
    }
  }
  .avatar-section-label {
    display: block;
    font-size: 0.9rem;
    color: var(--text);
    margin-bottom: 0.75rem;
    font-weight: 500;
  }
  .avatar-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  .avatar-option {
    background: var(--input-bg);
    border: 2px solid transparent;
    border-radius: 50%;
    padding: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
    aspect-ratio: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .avatar-option:hover {
    border-color: var(--muted);
    transform: scale(1.05);
  }
  .avatar-option.selected {
    border-color: #3c3c3c;
    background-color: rgba(60, 60, 60, 0.1);
    transform: scale(1.1);
  }
  .avatar-option img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 50%;
  }
  .btn-cancel-avatar {
    width: 100%;
    padding: 0.5rem 1rem;
    margin-bottom: 1rem;
    border: none;
    border-radius: 6px;
    background-color: rgba(239, 68, 68, 0.1);
    color: #ef4444;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  .btn-cancel-avatar:hover {
    background-color: rgba(239, 68, 68, 0.2);
    transform: translateY(-1px);
  }
  .btn-cancel-avatar:active {
    transform: translateY(0);
  }
  .divider {
    text-align: center;
    color: var(--muted);
    font-size: 0.85rem;
    font-weight: 600;
    margin: 1.5rem 0;
    position: relative;
  }
  .divider::before,
  .divider::after {
    content: "";
    position: absolute;
    top: 50%;
    width: 40%;
    height: 1px;
    background-color: var(--border-layout);
  }
  .divider::before {
    left: 0;
  }
  .divider::after {
    right: 0;
  }
  .file-label {
    display: block;
    font-size: 0.9rem;
    color: var(--text);
    margin-bottom: 0.5rem;
    font-weight: 500;
  }
  .btn-file-upload {
    display: inline-block;
    background-color: var(--muted);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 500;
    margin-bottom: 1rem;
    width: 100%;
    box-sizing: border-box;
    text-align: left;
  }
  .btn-file-upload:hover {
    transform: scale(1.02);
    background-color: #6781f2;
  }
  .avatar-preview-container {
    text-align: center;
    margin-bottom: 1rem;
  }
  .avatar-preview {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--border);
  }
</style>
