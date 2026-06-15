<script>
  import { createEventDispatcher } from "svelte";
  import { showNotification } from "../stores/notification.js";
  import Editor from "@tinymce/tinymce-svelte";

  export let open = false;
  export let article = null;

  const dispatch = createEventDispatcher();

  let title = "";
  let content = "";
  let saving = false;
  let errorMsg = "";

  // Image management
  let existingHeaderImage = null;
  let existingEmbeddedImages = [];
  let newHeaderImageFile = null;
  let newEmbeddedImageFiles = [];
  let imagesToDelete = [];
  let removeHeaderImage = false;

  const API_BASE = "http://localhost:3000";

  // Reset form when modal opens
  $: if (open && article) {
    resetForm();
  }

  async function resetForm() {
    title = article.title || "";
    content = article.body?.[0] || article.content || "";
    errorMsg = "";
    newHeaderImageFile = null;
    newEmbeddedImageFiles = [];
    imagesToDelete = [];
    removeHeaderImage = false;

    await fetchExistingImages();
  }

  async function fetchExistingImages() {
    try {
      // Get header image
      if (article.header_image_url) {
        const headerUrl = article.header_image_url.startsWith("http")
          ? article.header_image_url
          : `${API_BASE}/${article.header_image_url.replace(/^\/+/, "")}`;
        existingHeaderImage = { url: headerUrl };
      } else {
        existingHeaderImage = null;
      }

      // Get embedded images
      const res = await fetch(`${API_BASE}/api/articles/${article.id}/images`);
      if (res.ok) {
        const images = await res.json();
        existingEmbeddedImages = images.map((img) => ({
          id: img.id,
          url: img.url.startsWith("http") ? img.url : `${API_BASE}/${img.url.replace(/^\/+/, "")}`
        }));
      } else {
        existingEmbeddedImages = [];
      }
    } catch (e) {
      console.error("Failed to fetch images:", e);
      existingEmbeddedImages = [];
    }
  }

  function handleRemoveExistingHeader() {
    removeHeaderImage = true;
    existingHeaderImage = null;
  }

  function handleRemoveExistingEmbedded(imageId, index) {
    imagesToDelete.push(imageId);
    existingEmbeddedImages.splice(index, 1);
    existingEmbeddedImages = existingEmbeddedImages;
  }

  function handleRemoveNewHeader() {
    newHeaderImageFile = null;
  }

  function handleRemoveNewEmbedded(index) {
    newEmbeddedImageFiles.splice(index, 1);
    newEmbeddedImageFiles = newEmbeddedImageFiles;
  }

  function handleHeaderImageChange(e) {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      newHeaderImageFile = file;
      errorMsg = "";
    } else if (file) {
      errorMsg = "Please select a valid image file";
    }
  }

  function handleEmbeddedImagesChange(e) {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((f) => f.type.startsWith("image/"));
    if (validFiles.length !== files.length) {
      errorMsg = "Some files were not images and were skipped";
    }
    newEmbeddedImageFiles = [...newEmbeddedImageFiles, ...validFiles];
  }

  async function handleSubmit() {
    errorMsg = "";

    if (!title.trim()) {
      errorMsg = "Title is required";
      return;
    }

    if (!content.trim()) {
      errorMsg = "Content is required";
      return;
    }

    saving = true;

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        errorMsg = "You must be logged in to edit articles";
        saving = false;
        return;
      }

      // delete removed embedded images
      for (const imageId of imagesToDelete) {
        await fetch(`${API_BASE}/api/articles/${article.id}/images/${imageId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      // handle header image
      let updatedHeaderImageUrl = article.header_image_url;

      // If user uploaded a new header image, upload it first
      if (newHeaderImageFile) {
        const formData = new FormData();
        formData.append("headerImage", newHeaderImageFile);

        const uploadRes = await fetch(`${API_BASE}/api/articles/upload-images`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });

        if (uploadRes.ok) {
          const data = await uploadRes.json();
          if (data.headerImageUrl) {
            updatedHeaderImageUrl = data.headerImageUrl;
            removeHeaderImage = false;
          }
        } else {
          const err = await uploadRes.json();
          errorMsg = err.error || "Failed to upload header image";
          saving = false;
          return;
        }
      }

      // If user removed header and didn't upload new one, set to null
      if (removeHeaderImage && !newHeaderImageFile) {
        updatedHeaderImageUrl = null;
      }

      // upload new embedded images if provided
      if (newEmbeddedImageFiles.length > 0) {
        const formData = new FormData();
        newEmbeddedImageFiles.forEach((file) => formData.append("images", file));

        const uploadRes = await fetch(`${API_BASE}/api/articles/upload-images`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        });

        if (uploadRes.ok) {
          const data = await uploadRes.json();

          // Link uploaded images to article
          for (const imageUrl of data.embeddedImageUrls) {
            await fetch(`${API_BASE}/api/articles/${article.id}/images`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({
                article_id: article.id,
                url: imageUrl
              })
            });
          }
        } else {
          const err = await uploadRes.json();
          errorMsg = err.error || "Failed to upload embedded images";
          saving = false;
          return;
        }
      }

      // update article content and header image
      const updatePayload = {
        title: title.trim(),
        content: content.trim(),
        header_image_url: updatedHeaderImageUrl
      };

      const res = await fetch(`${API_BASE}/api/articles/${article.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updatePayload)
      });

      if (res.ok) {
        showNotification({ message: "Article updated successfully", type: "success" });
        dispatch("success");
        dispatch("close");
      } else {
        const err = await res.json();
        errorMsg = err.error || "Failed to update article";
        showNotification({ message: errorMsg, type: "error" });
      }
    } catch (e) {
      console.error("Update error:", e);
      errorMsg = "Network error. Please try again.";
      showNotification({ message: errorMsg, type: "error" });
    } finally {
      saving = false;
    }
  }

  function handleCancel() {
    dispatch("close");
  }

  function handleKeydown(e) {
    if (e.key === "Escape" && !saving) handleCancel();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <div class="editor-overlay">
    <div class="editor-page">
      <h2>Edit Article</h2>

      <!-- Title Input -->
      <input
        type="text"
        placeholder="Title"
        bind:value={title}
        maxlength="150"
        required
        class="title-input"
        disabled={saving}
      />

      <!-- Header Image Section -->
      <div class="image-section">
        <h3>Header Image</h3>

        {#if existingHeaderImage && !removeHeaderImage}
          <div class="image-preview">
            <img src={existingHeaderImage.url} alt="Current header" class="preview-img" />
            <button
              type="button"
              class="remove-btn"
              on:click={handleRemoveExistingHeader}
              disabled={saving}
              title="Remove header image"
            >
              ✕
            </button>
          </div>
        {/if}

        {#if newHeaderImageFile}
          <div class="image-preview">
            <img
              src={URL.createObjectURL(newHeaderImageFile)}
              alt="New header"
              class="preview-img"
            />
            <button
              type="button"
              class="remove-btn"
              on:click={handleRemoveNewHeader}
              disabled={saving}
              title="Remove new header"
            >
              ✕
            </button>
            <span class="new-badge">NEW</span>
          </div>
        {/if}

        {#if !existingHeaderImage && !newHeaderImageFile}
          <label class="file-label">
            <input
              type="file"
              accept="image/*"
              on:change={handleHeaderImageChange}
              disabled={saving}
              class="file-input"
            />
            <span class="file-label-text">📷 Choose Header Image</span>
          </label>
        {/if}
      </div>

      <!-- Embedded Images Section -->
      <div class="image-section">
        <h3>Embedded Images</h3>

        <div class="images-grid">
          <!-- Existing embedded images -->
          {#each existingEmbeddedImages as img, i (img.id)}
            <div class="image-preview-small">
              <img src={img.url} alt="Embedded {i + 1}" class="preview-img-small" />
              <button
                type="button"
                class="remove-btn-small"
                on:click={() => handleRemoveExistingEmbedded(img.id, i)}
                disabled={saving}
                title="Remove image"
              >
                ✕
              </button>
            </div>
          {/each}

          <!-- New embedded images -->
          {#each newEmbeddedImageFiles as file, i (i)}
            <div class="image-preview-small">
              <img src={URL.createObjectURL(file)} alt="New {i + 1}" class="preview-img-small" />
              <button
                type="button"
                class="remove-btn-small"
                on:click={() => handleRemoveNewEmbedded(i)}
                disabled={saving}
                title="Remove new image"
              >
                ✕
              </button>
              <span class="new-badge-small">NEW</span>
            </div>
          {/each}
        </div>

        <label class="file-label secondary">
          <input
            type="file"
            accept="image/*"
            multiple
            on:change={handleEmbeddedImagesChange}
            disabled={saving}
            class="file-input"
          />
          <span class="file-label-text">🖼️ Add More Images</span>
        </label>
      </div>

      <!-- TinyMCE Editor -->
      <div class="editor-wrapper">
        <h3>Content</h3>
        <Editor
          apiKey="lxwq00yqadktchp8i5lc25urmtkm5vmeou6tzvntdvhgxa95"
          bind:value={content}
          disabled={saving}
          init={{
            height: 100,
            menubar: false,
            plugins: ["lists", "link", "code"],
            toolbar:
              "undo redo | formatselect | bold italic underline | bullist numlist | link | code | removeformat",
            branding: false,
            content_style: "body { font-family: Arial, sans-serif; font-size: 14px; }",
            resize: true,
            setup: (editor) => {
              editor.on("init", () => {
                console.log("TinyMCE initialized successfully");
              });
            }
          }}
        />
      </div>

      {#if errorMsg}
        <div class="error">{errorMsg}</div>
      {/if}

      <div class="actions">
        <button on:click={handleSubmit} disabled={saving} class="btn-save">
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button on:click={handleCancel} class="btn-cancel" disabled={saving}> Cancel </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .editor-overlay {
    position: fixed;
    inset: 0;
    z-index: 2000;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(2px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .editor-page {
    max-width: 800px;
    width: 100%;
    background: var(--bg);
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    max-height: 90vh;
    overflow-y: auto;
  }

  h2 {
    margin-top: 0;
    margin-bottom: 1.5rem;
    color: var(--text);
    font-size: 1.8rem;
  }

  h3 {
    font-size: 1rem;
    color: var(--text);
    margin-bottom: 0.75rem;
    margin-top: 0;
    font-weight: 600;
  }

  .title-input {
    width: 100%;
    font-size: 1.2rem;
    margin-bottom: 1.5rem;
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--input-bg);
    color: var(--text);
    box-sizing: border-box;
  }

  .title-input:focus {
    outline: none;
    border-color: var(--accent);
  }

  .title-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Image Sections */
  .image-section {
    margin-bottom: 1.5rem;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
  }

  .image-preview {
    position: relative;
    max-width: 100%;
    margin-bottom: 1rem;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid var(--border);
  }

  .preview-img {
    width: 100%;
    max-height: 300px;
    object-fit: cover;
    display: block;
  }

  .remove-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: rgba(227, 93, 91, 0.9);
    color: white;
    font-size: 20px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }

  .remove-btn:hover:not(:disabled) {
    background: #c0392b;
  }

  .remove-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .new-badge {
    position: absolute;
    bottom: 8px;
    left: 8px;
    background: var(--accent, #2563eb);
    color: white;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: bold;
  }

  /* Embedded Images Grid */
  .images-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .image-preview-small {
    position: relative;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid var(--border);
  }

  .preview-img-small {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .remove-btn-small {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: none;
    background: rgba(227, 93, 91, 0.9);
    color: white;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  }

  .remove-btn-small:hover:not(:disabled) {
    background: #c0392b;
  }

  .remove-btn-small:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .new-badge-small {
    position: absolute;
    bottom: 4px;
    left: 4px;
    background: var(--accent, #2563eb);
    color: white;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.65rem;
    font-weight: bold;
  }

  /* File Input */
  .file-label {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    background: var(--accent, #2563eb);
    color: white;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
    font-weight: 600;
  }

  .file-label.secondary {
    background: var(--button-bg, #3c3c3c);
  }

  .file-label:hover {
    background: var(--accent-hover, #1d4ed8);
  }

  .file-label.secondary:hover {
    background: var(--button-hover, #2a2a2a);
  }

  .file-input {
    display: none;
  }

  .file-label-text {
    font-size: 0.95rem;
  }

  /* Editor Wrapper */
  .editor-wrapper {
    margin-bottom: 1.5rem;
    min-height: 100px;
  }

  .editor-wrapper :global(.tox-tinymce) {
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  /* Error */
  .error {
    color: var(--like, #e35d5b);
    background: rgba(227, 93, 91, 0.1);
    border: 1px solid var(--like, #e35d5b);
    border-radius: 6px;
    padding: 0.75rem;
    margin-bottom: 1rem;
    text-align: center;
  }

  /* Actions */
  .actions {
    margin-top: 2rem;
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
  }

  .btn-save,
  .btn-cancel {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
  }

  .btn-save {
    background: var(--accent, #2563eb);
    color: white;
  }

  .btn-save:hover:not(:disabled) {
    background: var(--accent-hover, #1d4ed8);
  }

  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-cancel {
    background: #eee;
    color: #333;
  }

  .btn-cancel:hover:not(:disabled) {
    background: #ddd;
  }

  .btn-cancel:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .editor-page {
      padding: 1.5rem;
    }

    .images-grid {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    }

    h2 {
      font-size: 1.5rem;
    }
  }
</style>
