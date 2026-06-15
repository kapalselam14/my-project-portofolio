import { goto } from '$app/navigation';
import { logout } from '$lib/stores/auth';

/**
 * Enhanced fetch wrapper that handles authentication errors globally
 * Industry standard pattern for handling 401/403 responses
 */
export async function apiFetch(url, options = {}) {
    const response = await fetch(url, options);
    
    // Handle authentication errors
    if (response.status === 401) {
        const data = await response.json().catch(() => ({}));
        
        // Check if account was deleted/disabled
        if (data.code === 'ACCOUNT_DELETED' || data.code === 'ACCOUNT_NOT_FOUND') {
            // Clear auth state
            logout();
            
            // Redirect to login with message
            goto('/login?reason=account_deleted&message=' + encodeURIComponent(data.message || 'Your account has been deactivated'));
            
            // Throw error to stop further processing
            throw new Error(data.message || 'Account deactivated');
        }
        
        // Handle other 401 errors (expired token, etc.)
        if (data.code === 'Token expired' || response.status === 401) {
            logout();
            goto('/login?reason=session_expired');
            throw new Error('Session expired');
        }
    }
    
    return response;
}