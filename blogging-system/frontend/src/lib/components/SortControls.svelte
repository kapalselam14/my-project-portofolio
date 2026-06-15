<script>
  import { sortBy, sortOrder } from '$lib/stores/sort.js';
  
  // Custom dropdown state
  let isDropdownOpen = false;
  let dropdownToggleElement;
  let dropdownMenuStyle = '';
  
  // Sort options
  const sortOptions = [
    { value: 'date', label: 'Date Posted' },
    { value: 'title', label: 'Title' },
    { value: 'username', label: 'Username' }
  ];
  
  // Get display text for selected sort
  $: selectedSortText = sortOptions.find(opt => opt.value === $sortBy)?.label || 'Date Posted';
  
  function toggleDropdown(event) {
    event.stopPropagation();
    isDropdownOpen = !isDropdownOpen;
    
    // Calculate position when opening
    if (isDropdownOpen && dropdownToggleElement) {
      const rect = dropdownToggleElement.getBoundingClientRect();
      dropdownMenuStyle = `
        top: ${rect.bottom + 4}px;
        left: ${rect.left}px;
        width: ${rect.width}px;
      `;
    }
  }
  
  function selectSort(value) {
    $sortBy = value;
    isDropdownOpen = false;
  }
  
  // Close dropdown when clicking outside
  function handleClickOutside(event) {
    const dropdown = event.target.closest('.custom-sort-dropdown');
    if (!dropdown && isDropdownOpen) {
      isDropdownOpen = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="sort-controls">
  <span class="sort-label">Sort By:</span>
  
  <!-- Custom Dropdown -->
  <div class="custom-sort-dropdown">
    <button 
      class="sort-dropdown-toggle"
      bind:this={dropdownToggleElement}
      on:click={toggleDropdown}
      aria-label="Sort articles by"
      aria-expanded={isDropdownOpen}
    >
      {selectedSortText}
      <span class="dropdown-arrow" class:open={isDropdownOpen}>▼</span>
    </button>
  </div>
  
  <div class="sort-order-buttons">
    <button
      class="sort-btn"
      class:active={$sortOrder === 'asc'}
      on:click={() => $sortOrder = 'asc'}
      title="Sort ascending (A-Z, oldest first)"
      aria-label="Sort ascending"
    >
      ↑
    </button>
    <button
      class="sort-btn"
      class:active={$sortOrder === 'desc'}
      on:click={() => $sortOrder = 'desc'}
      title="Sort descending (Z-A, newest first)"
      aria-label="Sort descending"
    >
      ↓
    </button>
  </div>
</div>

<!-- Dropdown menu rendered outside parent container with position: fixed -->
{#if isDropdownOpen}
  <ul class="sort-dropdown-menu" style={dropdownMenuStyle}>
    {#each sortOptions as option}
      <li 
        class="sort-dropdown-item"
        class:selected={$sortBy === option.value}
        on:click={() => selectSort(option.value)}
        on:keydown={(e) => e.key === 'Enter' && selectSort(option.value)}
        role="option"
        aria-selected={$sortBy === option.value}
        tabindex="0"
      >
        {option.label}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .sort-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .sort-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    white-space: nowrap;
  }

  /* Custom Dropdown Container */
  .custom-sort-dropdown {
    position: relative;
    z-index: 9999; /* Very high z-index to show in front of everything */
  }

  /* Dropdown Toggle Button */
  .sort-dropdown-toggle {
    padding: 10px 14px;
    border: 2px solid var(--searchbox-border);
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    background: var(--textbox-bg);
    color: var(--text);
    cursor: pointer;
    outline: none;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 140px;
    justify-content: space-between;
    position: relative;
    z-index: 10000;
  }

  .sort-dropdown-toggle:hover {
    border-color: var(--accent);
  }

  .sort-dropdown-toggle:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
  }

  /* Dropdown Arrow */
  .dropdown-arrow {
    font-size: 10px;
    transition: transform 0.2s ease;
    color: var(--text);
  }

  .dropdown-arrow.open {
    transform: rotate(180deg);
  }

  /* Dropdown Menu */
  .sort-dropdown-menu {
    position: fixed; /* Changed to fixed to break out of parent stacking context */
    top: auto;
    left: auto;
    right: auto;
    min-width: 140px;
    background: var(--bg-layout);
    border: 2px solid var(--searchbox-border);
    border-radius: 8px;
    list-style: none;
    margin: 0;
    padding: 4px 0;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    z-index: 10001; /* Highest z-index to ensure dropdown menu is on top of everything */
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

  /* Dropdown Items */
  .sort-dropdown-item {
    padding: 10px 14px;
    font-size: 14px;
    color: var(--text);
    cursor: pointer;
    transition: background 0.15s ease;
    user-select: none;
  }

  .sort-dropdown-item:hover {
    background: var(--button-hover);
  }

  .sort-dropdown-item.selected {
    background: var(--accent);
    color: white;
    font-weight: 600;
  }

  .sort-dropdown-item:focus {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  /* Sort Order Buttons */
  .sort-order-buttons {
    display: flex;
    border: 2px solid var(--searchbox-border);
    border-radius: 8px;
    overflow: hidden;
  }

  .sort-btn {
    padding: 6px 10px;
    border: none;
    background: var(--collapse-btn-bg);
    color: var(--text);
    cursor: pointer;
    font-size: 16px;
    font-weight: bold;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
  }

  .sort-btn:first-child {
    border-right: 1px solid var(--searchbox-border);
  }

  .sort-btn:hover {
    background: var(--button-hover);
  }

  .sort-btn.active {
    background: var(--accent);
    color: white;
  }

  /* Responsive Design */
  @media (max-width: 960px) {
    .sort-controls {
      flex: 1;
      justify-content: flex-end;
    }
    
    .sort-label {
      display: none;
    }
  }

  /* Mobile optimizations */
  @media (max-width: 768px) {
    .sort-dropdown-toggle {
      padding: 0.625rem 0.875rem;
      font-size: 0.875rem;
      min-width: 120px;
    }

    .sort-dropdown-item {
      padding: 0.625rem 0.875rem;
      font-size: 0.875rem;
    }

    .dropdown-arrow {
      font-size: 9px;
    }

    .sort-btn {
      padding: 5px 8px;
      font-size: 14px;
      min-width: 32px;
    }
  }

  /* Extra small devices */
  @media (max-width: 375px) {
    .sort-dropdown-toggle {
      padding: 0.5rem 0.75rem;
      font-size: 0.813rem;
      min-width: 100px;
    }

    .sort-dropdown-item {
      padding: 0.5rem 0.75rem;
      font-size: 0.813rem;
    }

    .dropdown-arrow {
      font-size: 8px;
    }

    .sort-btn {
      padding: 4px 6px;
      font-size: 12px;
      min-width: 28px;
    }
  }
</style>

