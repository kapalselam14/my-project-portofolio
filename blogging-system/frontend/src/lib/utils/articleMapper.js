// Shared article mapping utility
// Converts API article format to component format

const API_BASE = "http://localhost:3000/";

/**
 * Maps a single article from API format to component format
 * @param {Object} apiArticle - Article from backend API
 * @returns {Promise<Object>} - Formatted article for Article component
 */
export async function mapArticle(apiArticle) {
  // Fetch additional images for this article
  let images = [];
  try {
    const imgRes = await fetch(`${API_BASE}api/articles/${apiArticle.id}/images`);
    if (imgRes.ok) {
      const imgData = await imgRes.json();
      images = imgData.map((img) => API_BASE + img.url.replace(/^\/+/, ""));
    }
  } catch (e) {
    // Skip if image fetch fails
  }

  // Add header image as the first image if present
  if (apiArticle.header_image_url) {
    const headerUrl = API_BASE + apiArticle.header_image_url.replace(/^\/+/, "");
    if (!images.includes(headerUrl)) {
      images.unshift(headerUrl);
    }
  }

  // Handle both null/undefined and empty string cases for username
  const authorUsername = (apiArticle.username && apiArticle.username.trim()) 
    ? apiArticle.username 
    : `user${apiArticle.author_id}`;

  // Map user avatar properly
  let authorAvatar = "";
  if (apiArticle.avatar_url) {
    // If avatar_url is a full URL (starts with http), use it directly
    if (apiArticle.avatar_url.startsWith("http")) {
      authorAvatar = apiArticle.avatar_url;
    } else {
      // Otherwise, prepend the backend base URL
      authorAvatar = API_BASE + apiArticle.avatar_url.replace(/^\/+/, "");
    }
  } else {
    // Fallback to default avatar if user has no avatar
    authorAvatar = "http://localhost:3000/default-avatars/arcane-magic.png";
  }

  return {
    id: apiArticle.id,
    author: (apiArticle.username && apiArticle.username.trim())
    ? apiArticle.username
    : `user${apiArticle.author_id}`,
    author_id: apiArticle.author_id,
    avatar: authorAvatar,
    timeAgo: formatTimeAgo(apiArticle.created_at || apiArticle.updated_at),
    title: apiArticle.title || "Untitled",
    body: [apiArticle.content],
    images,
    stats: {
      likes: apiArticle.likes || 0,
      comments: apiArticle.comments || 0
    },
    comments: []
  };
}

/**
 * Maps multiple articles in parallel
 * @param {Array} apiArticles - Array of articles from backend
 * @returns {Promise<Array>} - Array of formatted articles
 */
export async function mapArticles(apiArticles) {
  if (!apiArticles || apiArticles.length === 0) {
    return [];
  }
  return Promise.all(apiArticles.map(mapArticle));
}

/**
 * Formats a date string to "time ago" format
 * @param {string} dateString - Date string from backend
 * @returns {string} - Formatted time ago string
 */
function formatTimeAgo(dateString) {
  let date;
  // Handle SQLite datetime format: 'YYYY-MM-DD HH:MM:SS'
  if (typeof dateString === "string" && dateString.length === 19) {
    date = new Date(dateString.replace(" ", "T") + "Z");
  } else {
    date = new Date(dateString);
  }
  
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  return date.toLocaleDateString();
}

