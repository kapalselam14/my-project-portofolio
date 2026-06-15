<script>
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { user } from "../stores/user.js";
  import { login } from "../stores/auth.js";

  let username = "";
  let firstAndLastName = "";
  let dateOfBirth = "";
  let password = "";
  let confirmPassword = "";
  let description = "";
  let avatarFile = null;
  let avatarPreview = "";
  let warningMessage = "";
  let defaultAvatars = [];
  let selectedAvatarUrl = null;
  let usernameStatus = null;
  let usernameMessage = "";
  let debounceTimer = null;
  let securityQuestions = [];
  let selectedQuestionId = "";
  let securityAnswer = "";
  let isAvatarSectionOpen = false; // Track if avatar section is expanded
  let isCustomDropdownOpen = false; // Track custom dropdown state for mobile
  let selectedQuestionText = "Select a security question *"; // Display text for custom dropdown

  // Get today's date in YYYY-MM-DD format for max date validation
  const today = new Date().toISOString().split("T")[0];

  function toggleCustomDropdown() {
    isCustomDropdownOpen = !isCustomDropdownOpen;
  }

  function selectQuestion(questionId, questionText) {
    selectedQuestionId = questionId;
    selectedQuestionText = questionText;
    isCustomDropdownOpen = false;
  }

  function toggleAvatarSection() {
    isAvatarSectionOpen = !isAvatarSectionOpen;
  }

  async function checkUsernameAvailability() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    //reset
    if (username.length < 3) {
      usernameStatus = null;
      usernameMessage = "";
      return;
    }
    usernameStatus = "checking";
    usernameMessage = "Checking...";

    //wait 500ms before checking username
    debounceTimer = setTimeout(async () => {
      try {
        //calling API
        const res = await fetch(
          `http://localhost:3000/api/check-username?username=${encodeURIComponent(username)}`
        );
        if (res.ok) {
          const data = await res.json();
          if (data.available) {
            usernameStatus = "available";
            usernameMessage = "✓ Username available";
          } else {
            usernameStatus = "taken";
            usernameMessage = "✗ Username already taken";
          }
        }
      } catch (error) {
        console.error("Username check failed:", error);
        usernameStatus = null;
        usernameMessage = "";
      }
    }, 500);
  }

  // Fetch avatars and security questions when component mounts
  onMount(async () => {
    // Fetch default avatars
    try {
      const resAvatars = await fetch("http://localhost:3000/api/users/avatars");
      if (resAvatars.ok) {
        defaultAvatars = await resAvatars.json();
      }
    } catch (error) {
      console.error("Failed to fetch avatars:", error);
    }

    // Fetch security questions
    try {
      const resQuestions = await fetch("http://localhost:3000/api/security-questions");
      if (resQuestions.ok) {
        securityQuestions = await resQuestions.json();
      }
    } catch (error) {
      console.error("Failed to fetch security questions:", error);
    }
  });

  function validatePassword(pw) {
    const errors = [];
    if (pw.length < 8) {
      errors.push("at least 8 characters");
    }
    if (!/[a-z]/.test(pw)) {
      errors.push("a lowercase letter");
    }
    if (!/[A-Z]/.test(pw)) {
      errors.push("an uppercase letter");
    }
    if (!/[0-9]/.test(pw)) {
      errors.push("a number");
    }
    if (!/[^a-zA-Z0-9]/.test(pw)) {
      errors.push("a symbol (e.g., !@#$)");
    }

    if (errors.length > 0) {
      return "Password must contain: " + errors.join(", ") + ".";
    }
    return null;
  }

  function handleAvatarChange(e) {
    const file = e.target.files[0];
    if (file) {
      avatarFile = file;
      avatarPreview = URL.createObjectURL(file);
    } else {
      avatarFile = null;
      avatarPreview = "";
    }
  }

  async function handleSubmit(event) {
    // Prevent default form submission if called from form submit
    if (event) event.preventDefault();
    
    warningMessage = "";

    // Validate required fields
    if (!username || username.length < 3) {
      warningMessage = "Username must be at least 3 characters.";
      return;
    }
    if (username.length > 32) {
      warningMessage = "Username must be 32 characters or less.";
      return;
    }
    if (!firstAndLastName || firstAndLastName.length < 2) {
      warningMessage = "Please enter your first and last name.";
      return;
    }
    if (!dateOfBirth) {
      warningMessage = "Please enter your date of birth.";
      return;
    }

    // Check for future date
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (birthDate > today) {
      warningMessage = "Date of birth cannot be in the future.";
      return;
    }

    // Check minimum age (13 years old)
    const thirteenYearsAgo = new Date();
    thirteenYearsAgo.setFullYear(thirteenYearsAgo.getFullYear() - 13);
    if (birthDate > thirteenYearsAgo) {
      warningMessage = "You must be at least 13 years old to register.";
      return;
    }

    // Validate password requirements first
    const passwordError = validatePassword(password);
    if (passwordError) {
      warningMessage = passwordError;
      return;
    }
    
    // Then check if passwords match
    if (password !== confirmPassword) {
      warningMessage = "Passwords do not match.";
      return;
    }

    // Then validate security question
    if (!selectedQuestionId) {
      warningMessage = "Please select a security question.";
      return;
    }
    if (!securityAnswer || securityAnswer.length < 2) {
      warningMessage = "Please provide an answer to the security question.";
      return;
    }

    // Call backend API to register user
    try {
      const formData = new FormData();
      formData.append("username", username);
      formData.append("password", password);
      formData.append("confirmPassword", confirmPassword);
      formData.append("real_name", firstAndLastName);
      formData.append("date_of_birth", dateOfBirth);
      formData.append("description", description);
      formData.append("security_question_id", selectedQuestionId);
      formData.append("security_answer", securityAnswer);

      // Add avatar (either file upload or selected URL)
      if (avatarFile) {
        formData.append("avatar", avatarFile);
      } else if (selectedAvatarUrl) {
        formData.append("avatar_url", selectedAvatarUrl);
      }

      const res = await fetch("http://localhost:3000/api/register", {
        method: "POST",
        // DON'T set Content-Type header - browser sets it automatically with boundary
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        // Update both user and auth stores
        user.set(data.user);
        login(data.user, data.token); // This will update auth store and localStorage
        goto("/");
      } else {
        const err = await res.json();
        // Show specific validation errors if available
        if (err.details && err.details.length > 0) {
          warningMessage = err.details.join(', ');
        } else {
          warningMessage = err.message || err.error || "Registration failed.";
        }
      }
    } catch (e) {
      warningMessage = "Network error. Please try again.";
    }
  }
</script>

<div class="signup-container">
  <div class="signup-card">
    <button class="btn-back" on:click={() => goto("/login")} aria-label="Back to The Login Page">
      ←
    </button>
    <h2>Sign Up</h2>
    <p class="required-note">*required field</p>

    <form on:submit={handleSubmit}>
      <input
        type="text"
        placeholder="username *"
        bind:value={username}
        on:input={(e) => {
          username = e.target.value.replace(/[^a-z0-9_.]/gi, "").toLowerCase();
          checkUsernameAvailability();
        }}
        class="input-field"
        maxlength="32"
      />
    <!-- Username availability indicator -->
    {#if usernameMessage}
      <div class="username-status {usernameStatus}">
        {usernameMessage}
      </div>
    {/if}

      <input
        type="text"
        placeholder="first & last name *"
        bind:value={firstAndLastName}
        class="input-field"
        maxlength="64"
      />

      <input
        type="text"
        placeholder="date of birth *"
        bind:value={dateOfBirth}
        class="input-field"
        max={today}
        on:focus={(e) => (e.target.type = "date")}
        on:blur={(e) => {
          if (!e.target.value) e.target.type = "text";
        }}
      />

      <input
        type="password"
        placeholder="password *"
        bind:value={password}
        class="input-field"
      />

      <input
        type="password"
        placeholder="confirm password *"
        bind:value={confirmPassword}
        class="input-field"
      />
      
      <textarea
        type="text"
        placeholder="Bio (500 characters max)"
        bind:value={description}
        class="input-field"
        id="bio-input"
        maxlength="500"
      />

      <!-- Collapsible Avatar Section -->
      <button
        type="button"
        class="avatar-section-toggle {isAvatarSectionOpen ? 'open' : ''}"
        on:click={toggleAvatarSection}
      >
        <span>Choose Your Avatar (Optional)</span>
      </button>

      {#if isAvatarSectionOpen}
        <!-- Default Avatar Selection -->
        <div class="avatar-content">
          <div class="avatar-section-label">Select a predefined avatar:</div>
          <div class="avatar-grid">
            {#each defaultAvatars as avatar}
              <button
                type="button"
                class="avatar-option {selectedAvatarUrl === avatar.url ? 'selected' : ''}"
                on:click={() => {
                  selectedAvatarUrl = avatar.url;
                  avatarFile = null;
                  avatarPreview = "";
                }}
                title={avatar.name}
              >
                <img src="http://localhost:3000{avatar.url}" alt={avatar.name} />
              </button>
            {/each}
          </div>

          <!-- Cancel Avatar Selection Button -->
          {#if selectedAvatarUrl || avatarFile}
            <button
              type="button"
              class="btn-cancel-avatar"
              on:click={() => {
                selectedAvatarUrl = null;
                avatarFile = null;
                avatarPreview = "";
              }}
            >
              ✕ Clear Avatar Selection
            </button>
          {/if}

          <div class="divider">OR</div>

          <label class="file-label" for="avatar-upload"> Upload your own custom avatar: </label>

          <input
            type="file"
            id="avatar-upload"
            accept="image/png, image/jpeg"
            on:change={handleAvatarChange}
            class="input-file"
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
      {#if warningMessage}
        <div class="warning-message">
          {warningMessage}
        </div>
      {/if}

      <!-- Native select for desktop -->
      <select bind:value={selectedQuestionId} class="input-field native-select" style="cursor: pointer;">
        <option value="" disabled selected>Select a security question *</option>
        {#each securityQuestions as q}
          <option value={q.id}>{q.question}</option>
        {/each}
      </select>

      <!-- Custom dropdown for mobile (≤768px) -->
      <div class="custom-dropdown">
        <button
          type="button"
          class="custom-dropdown-toggle input-field"
          on:click={toggleCustomDropdown}
        >
          <span class="selected-text">{selectedQuestionText}</span>
          <span class="dropdown-arrow">{isCustomDropdownOpen ? '▲' : '▼'}</span>
        </button>
        
        {#if isCustomDropdownOpen}
          <ul class="custom-dropdown-menu">
            {#each securityQuestions as q}
              <li
                class="custom-dropdown-item"
                on:click={() => selectQuestion(q.id, q.question)}
                on:keydown={(e) => e.key === 'Enter' && selectQuestion(q.id, q.question)}
                role="option"
                tabindex="0"
              >
                {q.question}
              </li>
            {/each}
          </ul>
        {/if}
      </div>
      
      <input
        type="text"
        placeholder="Your answer *"
        bind:value={securityAnswer}
        class="input-field"
        maxlength="255"
      />

      <button type="submit" class="btn-submit"> Submit </button>
    </form>
  </div>
</div>

<style>
  .signup-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 80vh;
    padding: 2rem;
  }

  .signup-card {
    position: relative; /* For absolute positioning of back button */
    background-color: var(--bg-layout);
    border-radius: 12px;
    padding: 2rem;
    width: 100%;
    max-width: 400px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    border: 1px solid var(--border-layout);
  }

  h2 {
    text-align: center;
    font-size: 2rem;
    margin-bottom: 0.5rem;
    color: var(--text);
    font-weight: 600;
  }

  .required-note {
    text-align: center;
    font-size: 0.85rem;
    color: var(--muted);
    margin-bottom: 1.5rem;
    font-style: italic;
  }

  /* Style asterisks in placeholders */
  .input-field::placeholder {
    color: var(--text);
    opacity: 0.6;
  }

  .input-field:required::placeholder {
    color: var(--text);
    opacity: 0.6;
  }

  .input-field {
    width: 100%;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    border: none;
    border-radius: 8px;
    background-color: var(--input-bg);
    color: var(--text);
    font-size: 1rem;
    box-sizing: border-box;
    appearance: none;
    transition: all 0.2s ease;
  }

  select.input-field {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23888' d='M8 11L3 6h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 1rem center;
    background-size: 12px;
    cursor: pointer !important;
    padding-right: 2.5rem;
  }

  /* Animated arrow and lift on hover */
  select.input-field:hover {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%233c3c3c' d='M8 11L3 6h10z'/%3E%3C/svg%3E");
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
    transform: translateY(-2px);
    cursor: pointer !important;
  }

  /* Focus state */
  select.input-field:focus {
    cursor: pointer !important;
  }

  /* Active/clicked state */
  select.input-field:active {
    cursor: pointer !important;
  }

  /* Add SVG arrow to select dropdown (same as avatar toggle) */
  select.input-field {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23888' d='M8 11L3 6h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 1rem center;
    background-size: 12px;
    padding-right: 2.5rem;
  }

  select.input-field:hover {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%233c3c3c' d='M8 11L3 6h10z'/%3E%3C/svg%3E");
  }

  /* Style dropdown options */
  /* Note: Some styling like cursor and hover effects on <option> elements 
     are limited by browser defaults and may not work consistently */
  select.input-field option {
    background-color: var(--bg-layout);
    color: var(--text);
    padding: 0.75rem 1rem;
    font-size: 1rem;
  }

  select.input-field option:hover {
    background-color: rgba(60, 60, 60, 0.1);
  }

  select.input-field option:checked {
    background-color: rgba(60, 60, 60, 0.2);
    font-weight: 600;
  }

  select.input-field option:disabled {
    color: var(--muted);
    font-style: italic;
  }

  #bio-input {
    min-height: 100px;
    resize: vertical;
    font-family: inherit;
  }

  #bio-input::placeholder {
    color: var(--text);
    opacity: 0.6;
  }

  .input-field:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transform: translateY(-1px);
  }

  .input-field:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(60, 60, 60, 0.3);
  }
  .file-label {
    display: block;
    font-size: 0.9rem;
    color: var(--text);
    margin-bottom: 0.5rem;
    font-weight: 500;
  }
  .input-file {
    opacity: 0;
    position: absolute;
    width: 0.1px;
    height: 0.1px;
    z-index: -1;
  }

  .btn-file-upload {
    display: inline-block;
    background-color: #333;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-family: inherit;
    font-size: 0.95rem;
    font-weight: 500;
    margin-bottom: 1rem;
    transition: background-color 0.2s;
    width: 100%; /* Buat agar lebarnya penuh */
    box-sizing: border-box; /* Pastikan padding tidak merusak lebar */
    text-align: left; /* Ratakan teks di kiri */
  }
  .btn-file-upload:hover {
    transform: scale(1.02);
    background-color: #2a2a2a;
  }
  .input-file {
    display: block;
    width: 100%;
    color: var(--text);
    font-size: 0.95rem;
    margin-bottom: 1rem;
  }

  .avatar-preview-container {
    text-align: center;
    margin-bottom: 1.5rem;
  }

  .avatar-preview {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--border);
  }

  .btn-submit {
    width: 100%;
    padding: 0.875rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
    background-color: #3c3c3c;
    color: white;
    margin-top: 1rem;
  }

  .btn-submit:hover {
    background-color: #2a2a2a;
  }
  .warning-message {
    color: var(--like, #e35d5b); /* Menggunakan warna merah dari tema Anda */
    font-size: 0.9rem;
    text-align: center;
    margin-bottom: 1rem;
    line-height: 1.4;
  }

  /* Collapsible Avatar Section Toggle Button */
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

  .avatar-section-toggle:hover {
    background-color: rgba(60, 60, 60, 0.05);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%233c3c3c' d='M8 11L3 6h10z'/%3E%3C/svg%3E");
    border-color: var(--text);
    transform: translateY(-1px);
  }

  /* Rotate arrow when open */
  .avatar-section-toggle.open {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23888' d='M8 5L3 10h10z'/%3E%3C/svg%3E");
  }

  .avatar-section-toggle.open:hover {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%233c3c3c' d='M8 5L3 10h10z'/%3E%3C/svg%3E");
  }

  /* Avatar Content Wrapper */
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

  /* Divider between predefined and custom upload */
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

  /* Avatar Selection Grid */
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
    transform: scale(2.05);
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

  /* Cancel Avatar Selection Button */
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

  /* Username Availability Status */
  .username-status {
    font-size: 0.85rem;
    margin-top: -0.5rem;
    margin-bottom: 1rem;
    padding: 0.25rem 0.5rem;
  }

  .username-status.checking {
    color: var(--muted);
  }

  .username-status.available {
    color: #22c55e; /* Green */
  }

  .username-status.taken {
    color: #ef4444; /* Red */
  }

  /* Back Button */
  .btn-back {
    position: absolute;
    top: 1rem;
    left: 1rem;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background-color: var(--input-bg);
    color: var(--text);
    font-size: 1.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .btn-back:hover {
    background-color: #3c3c3c;
    color: white;
    transform: translateX(-3px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .btn-back:active {
    transform: translateX(-3px) scale(0.95);
  }

  /* Custom Dropdown Styles (Mobile only) */
  .custom-dropdown {
    display: none; /* Hidden on desktop */
    position: relative;
    width: 100%;
  }

  .custom-dropdown-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    text-align: left;
    cursor: pointer;
    position: relative;
  }

  .selected-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dropdown-arrow {
    margin-left: 0.5rem;
    font-size: 0.75rem;
    transition: transform 0.2s;
  }

  .custom-dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background-color: var(--bg-layout);
    border: 1px solid var(--border-layout);
    border-radius: 8px;
    margin-top: 0.25rem;
    max-height: 250px;
    overflow-y: auto;
    z-index: 1000;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    list-style: none;
    padding: 0;
    animation: slideDown 0.2s ease;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .custom-dropdown-item {
    padding: 0.75rem 1rem;
    cursor: pointer;
    transition: background-color 0.15s;
    color: var(--text);
    font-size: 1rem;
    border-bottom: 1px solid var(--border-layout);
  }

  .custom-dropdown-item:last-child {
    border-bottom: none;
  }

  .custom-dropdown-item:hover {
    background-color: var(--input-bg);
  }

  .custom-dropdown-item:active {
    background-color: rgba(60, 60, 60, 0.15);
  }

  /* Native select - visible on desktop */
  .native-select {
    display: block;
  }

  /* Mobile responsive styles (≤768px) */
  @media (max-width: 768px) {
    .signup-container {
      padding: 1rem;
      min-height: 70vh;
    }

    .signup-card {
      padding: 1.5rem;
      max-width: 60%;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    }

    h2 {
      font-size: 1.75rem;
      margin-bottom: 0.5rem;
    }

    .required-note {
      font-size: 0.813rem;
      margin-bottom: 1.25rem;
    }

    .input-field {
      padding: 0.625rem 0.875rem;
      font-size: 0.938rem;
      margin-bottom: 0.875rem;
    }

    /* Hide native select on mobile */
    .native-select {
      display: none;
    }

    /* Show custom dropdown on mobile */
    .custom-dropdown {
      display: block;
    }

    .custom-dropdown-item {
      padding: 0.625rem 0.875rem;
      font-size: 0.875rem;
    }

    #bio-input {
      min-height: 80px;
    }

    .file-label {
      font-size: 0.85rem;
      margin-bottom: 0.375rem;
    }

    .btn-file-upload,
    .btn-signup,
    .btn-cancel-avatar {
      padding: 0.625rem 1rem;
      font-size: 0.875rem;
      min-height: 44px; /* Touch-friendly */
    }

    .avatar-section-header {
      font-size: 0.938rem;
      padding: 0.625rem;
      min-height: 44px;
    }

    .toggle-icon {
      font-size: 1rem;
    }

    .avatar-preview {
      width: 80px;
      height: 80px;
    }

    .default-avatars {
      gap: 0.5rem;
      padding: 0.75rem;
    }

    .avatar-option {
      width: 60px;
      height: 60px;
    }

    .avatar-option img {
      width: 40px;
      height: 40px;
    }

    .password-requirements {
      font-size: 0.813rem;
      padding: 0.625rem;
    }

    .username-status {
      font-size: 0.813rem;
      margin-top: -0.375rem;
      margin-bottom: 0.875rem;
    }

    .warning-message {
      font-size: 0.85rem;
      margin-bottom: 0.875rem;
    }

    .btn-back {
      width: 36px;
      height: 36px;
      font-size: 1.25rem;
      top: 0.75rem;
      left: 0.75rem;
    }
  }

  /* Extra small devices (≤375px) */
  @media (max-width: 375px) {
    .signup-container {
      padding: 0.75rem;
    }

    .signup-card {
      padding: 1.25rem 1rem;
    }

    h2 {
      font-size: 1.5rem;
      margin-bottom: 0.375rem;
    }

    .required-note {
      font-size: 0.75rem;
      margin-bottom: 1rem;
    }

    .input-field {
      padding: 0.563rem 0.75rem;
      font-size: 0.875rem;
      margin-bottom: 0.75rem;
    }

    .custom-dropdown-item {
      padding: 0.563rem 0.75rem;
      font-size: 0.813rem;
    }

    select.input-field {
      padding-right: 2rem;
      background-size: 9px;
      width: 60%;
      max-width: 60%;
      box-sizing: border-box;
    }

    select.input-field option {
      font-size: 0.813rem;
      padding: 0.438rem;
    }

    #bio-input {
      min-height: 70px;
    }

    .file-label {
      font-size: 0.813rem;
    }

    .btn-file-upload,
    .btn-signup,
    .btn-cancel-avatar {
      padding: 0.563rem 0.875rem;
      font-size: 0.813rem;
    }

    .avatar-section-header {
      font-size: 0.875rem;
      padding: 0.563rem;
    }

    .toggle-icon {
      font-size: 0.938rem;
    }

    .avatar-preview {
      width: 70px;
      height: 70px;
    }

    .default-avatars {
      gap: 0.375rem;
      padding: 0.625rem;
    }

    .avatar-option {
      width: 50px;
      height: 50px;
    }

    .avatar-option img {
      width: 35px;
      height: 35px;
    }

    .password-requirements {
      font-size: 0.75rem;
      padding: 0.5rem;
    }

    .username-status {
      font-size: 0.75rem;
    }

    .warning-message {
      font-size: 0.813rem;
    }

    .btn-back {
      width: 32px;
      height: 32px;
      font-size: 1.125rem;
      top: 0.625rem;
      left: 0.625rem;
    }
  }
</style>
