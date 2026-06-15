// API helpers to get backend endpoints for profile-related operations
import { PUBLIC_API_BASE_URL } from '$env/static/public';

// function to ensure proper URL joining
function joinUrl(base, path) {
  const cleanBase = base.replace(/\/+$/, ''); // Remove trailing slashes
  const cleanPath = path.replace(/^\/+/, ''); // Remove leading slashes
  return `${cleanBase}/${cleanPath}`; // Join with single slash
}

// get user info from localStorage token
export async function getCurrentUser() {
  const token = localStorage.getItem('token');
  if (!token) {
    return null;
  }

  // Decode JWT to get user ID
  const payloadRaw = atob(token.split('.')[1]);
  const payload = JSON.parse(payloadRaw);
  const userId = payload.user_id || payload.id || payload.userId;
  if (!userId) throw new Error("Cannot find user id from token!");

  const res = await fetch(`${PUBLIC_API_BASE_URL}/users/${userId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!res.ok) {
    throw new Error('Failed to fetch current user');
  }

  return await res.json();
}

// get user by ID
export async function getUserById(userId) {
  const token = localStorage.getItem('token');
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  const res = await fetch(`${PUBLIC_API_BASE_URL}/users/${userId}`, { headers });
  if (!res.ok) {
    throw new Error('Failed to fetch user');
  }

  return await res.json();
}

// get user's all articles (call GET /api/articles?authorId=:id)
export async function getArticlesByAuthor(authorId, { sortBy = "date", sortOrder = "desc" } = {}) {
  const params = new URLSearchParams({
    authorId,
    sortBy,
    sortOrder
  });

  const res = await fetch(`/api/articles?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch articles");

  const apiArticles = await res.json();

  // map articles with images and comment previews like home page
  const mappedArticles = await Promise.all(
    apiArticles.map(async (apiArticle) => {
      let images = [];

      // Fetch additional images
      try {
        const imgRes = await fetch(joinUrl(PUBLIC_API_BASE_URL, `/articles/${apiArticle.id}/images`));
        if (imgRes.ok) {
          const imgData = await imgRes.json();
          // URL construction
          images = imgData.map((img) => {
            if (img.url.startsWith('http')) {
              return img.url; // Already absolute URL
            }
            // Remove /api from PUBLIC_API_BASE_URL for static assets
            const baseUrl = PUBLIC_API_BASE_URL.replace(/\/api\/?$/, '');
            return joinUrl(baseUrl, img.url);
          });
        }
      } catch (e) {
        console.error("Failed to fetch images:", e);
      }

      // Add header image
      if (apiArticle.header_image_url) {
        let headerUrl;
        if (apiArticle.header_image_url.startsWith('http')) {
          headerUrl = apiArticle.header_image_url;
        } else {
          // Remove /api from base URL for static assets
          const baseUrl = PUBLIC_API_BASE_URL.replace(/\/api\/?$/, '');
          headerUrl = joinUrl(baseUrl, apiArticle.header_image_url);
        }
        if (!images.includes(headerUrl)) {
          images.unshift(headerUrl);
        }
      }

      // Fetch top 2 comments for preview
      let comments = [];
      try {
        const commentsRes = await fetch(joinUrl(PUBLIC_API_BASE_URL, `/articles/${apiArticle.id}/comments`));
        if (commentsRes.ok) {
          const apiComments = await commentsRes.json();
          const rootComments = apiComments.filter((c) => !c.parent_comment_id).slice(0, 2);
          comments = rootComments.map((c) => {
            let commentAvatar = "";
            if (c.avatar_url) {
              if (c.avatar_url.startsWith("http")) {
                commentAvatar = c.avatar_url;
              } else {
                // Remove /api from base URL for avatars
                const baseUrl = PUBLIC_API_BASE_URL.replace(/\/api\/?$/, '');
                commentAvatar = joinUrl(baseUrl, c.avatar_url);
              }
            } else {
              // Default avatar URL
              const baseUrl = PUBLIC_API_BASE_URL.replace(/\/api\/?$/, '');
              commentAvatar = joinUrl(baseUrl, "/default-avatars/arcane-magic.png");
            }
            return {
              id: c.id,
              username: c.username || `user${c.author_id}`,
              author_id: c.author_id,
              avatar: commentAvatar,
              created_at: c.created_at,
              content: c.content,
              article_id: apiArticle.id
            };
          });
        }
      } catch (e) {
        console.error("Failed to fetch comments for article", apiArticle.id, e);
      }

      return {
        ...apiArticle,
        images,
        comments
      };
    })
  );

  return mappedArticles;
}

// get article count by author ID
export async function getArticleCountByAuthor(authorId) {
  const res = await fetch(`${PUBLIC_API_BASE_URL}/articles/author/${authorId}/count`);

  if (!res.ok) {
    throw new Error('Failed to fetch article count');
  }

  return await res.json();
}

// get likes count for an article
export async function getLikesCountForArticle(articleId) {
  const response = await fetch(`${PUBLIC_API_BASE_URL}/articles/${articleId}/likes`);
  if (!response.ok) {
    throw new Error('Failed to fetch likes count for article ' + articleId);
  }
  const data = await response.json();
  return data.likesCount ?? 0;
}

export async function fetchTopAuthors(limit = 3) {
  const response = await fetch(`${PUBLIC_API_BASE_URL}/users/top-authors?limit=${limit}`);
  if (!response.ok) {
    throw new Error('Failed to fetch top authors');
  }
  return await response.json();
}

export async function getUserStats(userId) {
  const res = await fetch(`${PUBLIC_API_BASE_URL}/users/${userId}/stats`);
  if (!res.ok) {
    throw new Error('Failed to fetch user statistics');
  }
  return await res.json();
}

// Update user profile
export async function updateUserProfile(userId, { firstName, lastName, bio, avatarFile, selectedAvatarUrl }) {
  const token = localStorage.getItem('token');
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
  
  // Upload custom avatar, then update profile
  if (avatarFile) {
    const formData = new FormData();
    formData.append('avatar', avatarFile);
    const avatarRes = await fetch(`${PUBLIC_API_BASE_URL}/users/${userId}/avatar`, {
      method: 'POST',
      headers,
      body: formData
    });
    if (!avatarRes.ok) throw new Error('Failed to upload avatar');
    const avatarData = await avatarRes.json();
    
    // Update the rest of the profile with the new avatar_url
    const body = {};
    if (firstName || lastName) {
      body.real_name = `${firstName} ${lastName}`.trim();
    }
    if (bio !== undefined) {
      body.description = bio;
    }
    body.avatar_url = avatarData.avatar_url;

    const res = await fetch(`${PUBLIC_API_BASE_URL}/users/${userId}`, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('Failed to update profile');
    const result = await res.json();
    return result.user || result;
  } else {
    // Use default avatar or just update text fields
    const body = {};
    if (firstName || lastName) {
      body.real_name = `${firstName} ${lastName}`.trim();
    }
    if (bio !== undefined) {
      body.description = bio;
    }
    if (selectedAvatarUrl) {
      body.avatar_url = selectedAvatarUrl;
    }

    const res = await fetch(`${PUBLIC_API_BASE_URL}/users/${userId}`, {
      method: 'PUT',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || 'Failed to update profile');
    }
    const result = await res.json();
    return result.user || result;
  }
}