<script>
  import EditProfile from "./EditProfile.svelte";
  import { createEventDispatcher } from "svelte";
  import { updateUserProfile } from "$lib/api/profile-api.js";
  import { user as userStore } from "$lib/stores/user.js";

  const dispatch = createEventDispatcher();

  export let user;
  let showEditProfile = false;
  let isSaving = false;
  let errorMsg = "";
  
  // Banner images array
  const banners = [
    '/Images/banner1.jpg',
    '/Images/banner2.png',
    '/Images/banner3.jpg',
    '/Images/banner4.jpg',
    '/Images/banner5.png'
  ];
  
  // Get banner based on user ID (consistent for same user)
  $: userBanner = user?.header || banners[(user?.id || 0) % banners.length];

  function handleEdit() {
    showEditProfile = true;
    dispatch("edit");
  }

  function handleEditProfileClose() {
    showEditProfile = false;
  }

  async function handleEditProfileSave(e) {
    showEditProfile = false;
    isSaving = true;
    errorMsg = "";
    try {
      const { avatarFile, selectedAvatarUrl, firstName, lastName, bio } = e.detail;
      // bio is undefined if not changed (handled in EditProfile component)
      const updated = await updateUserProfile(user.id, {
        firstName,
        lastName,
        bio,
        avatarFile,
        selectedAvatarUrl
      });

      // Helper to convert relative paths to full URLs
      const getImageUrl = (path) => {
        if (!path) return null;
        if (path.startsWith("http")) return path;
        if (path.startsWith("/")) return `http://localhost:3000${path}`;
        return `http://localhost:3000/${path}`;
      };

      // Update local user state
      user = {
        ...user,
        id: updated.id || user.id,
        name: updated.real_name || `${firstName} ${lastName}`.trim(),
        avatar: getImageUrl(updated.avatar_url) || user.avatar,
        avatar_url: updated.avatar_url || user.avatar_url,
        // Only update bio if it was actually changed and returned from backend
        bio: updated.description !== undefined ? updated.description : user.bio
      };
      
      // Update user store if this is the logged-in user
      if ($userStore && $userStore.id === user.id) {
        const updatedStoreUser = {
          ...$userStore,
          username: user.handle || $userStore.username,
          real_name: user.name,
          avatar_url: updated.avatar_url || $userStore.avatar_url,
          description: user.bio
        };
        userStore.set(updatedStoreUser);
        localStorage.setItem('user', JSON.stringify(updatedStoreUser));
      }
      
      dispatch("profile-updated", { user });
    } catch (err) {
      console.error("Profile update error:", err);
      errorMsg = err.message || "Failed to update profile.";
      alert(errorMsg);
    } finally {
      isSaving = false;
    }
  }
  // console.log("User bio:", user.bio);
</script>

<div class="profile-header">
  <div class="cover" style="background-image: url({userBanner})" aria-hidden="true"></div>

  <div class="meta-row">
    <img class="avatar" src={user.avatar} alt={user.name} />

    <div class="info">
      <div class="handle">@{user.handle}</div>
      <h1 class="name">{user.name}</h1>
    </div>

    {#if user.isOwner}
      <div class="actions">
        <button class="edit" on:click={handleEdit}><span>Edit Profile</span></button>
      </div>
    {/if}
  </div>
  {#if user.bio}
    <div class="bio-section">
      <p class="bio-text">{user.bio}</p>
    </div>
  {/if}
</div>

{#if showEditProfile}
  <EditProfile
    open={showEditProfile}
    currentAvatarUrl={user?.avatar_url || user?.avatar || ""}
    currentFirstName={user?.name?.split(" ")[0] || ""}
    currentLastName={user?.name?.split(" ")[1] || ""}
    currentBio={user?.bio || ""}
    on:close={handleEditProfileClose}
    on:save={handleEditProfileSave}
  />
{/if}

<style>
  .profile-header {
    margin: 0 0 24px;
  }

  span {
    color: var(--text);
  }

  .cover {
    width: 100%;
    height: 180px;
    background-size: cover;
    background-position: center;
    border-radius: 10px;
    border: 1px solid var(--border, #e6e6e6);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
  }

  .meta-row {
    display: flex;
    align-items: center;
    gap: 18px;
    margin-top: -1rem; /* pull avatar up */
    padding: 0 8px;
  }

  .avatar {
    width: 88px;
    height: 88px;
    border-radius: 50%;
    border: 4px solid var(--card, #fff);
    object-fit: cover;
    background: var(--card, #fff);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
  }

  .info {
    min-width: 0;
  }

  .handle {
    color: var(--muted, #6b7280);
    font-weight: 600;
    font-size: 14px;
  }

  .name {
    margin: 2px 0 0;
    font-size: 26px;
    line-height: 1;
    color: var(--text, #111827);
    font-weight: 800;
  }

  .actions {
    margin-left: auto;
  }

  .edit {
    background: var(--card, #fff);
    border: 1px solid var(--border, #e6e6e6);
    padding: 8px 12px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 700;
  }
  .edit:hover {
    background: var(--button-hover, #f3f4f6);
  }

  .bio-section {
    margin-top: 20px;
    padding: 16px 8px 0 8px;
    border-top: 1px solid var(--border, #e6e6e6);
    max-height: 300px;
    word-break: break-word;
    white-space: pre-line;
    margin-bottom: 8px;
  }

  .bio-text {
    font-size: 1rem;
    line-height: 1.5;
    font-style: italic;
    color: var(--text, #2d3748);
    margin: 0;
    white-space: pre-wrap;
  }
</style>
