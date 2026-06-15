package pccit.finalproject.javaclient;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Small HTTP client for the assumed backend API.
 */
public class AdminClient {
    private final String baseUrl;
    private String token;
    private boolean isAdmin;
    private String currentUsername; // Store logged-in user's username
    private final ObjectMapper mapper = new ObjectMapper();

    public AdminClient(String baseUrl) {
        this.baseUrl = baseUrl;
        // tolerate unknown properties from the backend (e.g. responses that include an "error" field)
        this.mapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class LoginResponse {
        public String token;
        public UserInfo user;
        public String message;
        public String error; // capture common error field if backend uses it
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class UserInfo {
        public String id;
        public String username;
        // support both snake_case and camelCase
        public Boolean is_admin;
        public Boolean isAdmin;

        public Boolean effectiveIsAdmin() {
            if (isAdmin != null) return isAdmin;
            return is_admin;
        }
    }

    public LoginResponse login(String username, String password) throws IOException {
        URL url = new URL(baseUrl + "/api/login");
        HttpURLConnection con = (HttpURLConnection) url.openConnection();
        con.setRequestMethod("POST");
        con.setRequestProperty("Content-Type", "application/json");
        con.setDoOutput(true);

        Map<String, String> payload = new HashMap<>();
        payload.put("username", username);
        payload.put("password", password);

        try (OutputStream os = con.getOutputStream()) {
            mapper.writeValue(os, payload);
        }

        int code = con.getResponseCode();
        byte[] bodyBytes = null;
        try {
            InputStream is = (code >= 200 && code < 300) ? con.getInputStream() : con.getErrorStream();
            if (is != null) {
                try (InputStream in = is; ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
                    byte[] buf = new byte[8192];
                    int r;
                    while ((r = in.read(buf)) != -1) baos.write(buf, 0, r);
                    bodyBytes = baos.toByteArray();
                }
            }
        } finally {
            con.disconnect();
        }

        // Read response into LoginResponse when possible, but handle unknown structures gracefully
        LoginResponse resp = null;
        String rawBody = null;
        if (bodyBytes != null && bodyBytes.length > 0) {
            try {
                resp = mapper.readValue(new ByteArrayInputStream(bodyBytes), LoginResponse.class);
            } catch (IOException e) {
                rawBody = new String(bodyBytes, StandardCharsets.UTF_8);
            }
        }

        if (code >= 200 && code < 300) {
            if (resp != null) {
                // If backend returned no token, treat as an error and surface the server message if any
                if (resp.token == null || resp.token.trim().isEmpty()) {
                    String errMsg = null;
                    if (resp.error != null && !resp.error.isEmpty()) errMsg = resp.error;
                    else if (resp.message != null && !resp.message.isEmpty()) errMsg = resp.message;
                    else if (rawBody != null && !rawBody.trim().isEmpty()) errMsg = rawBody.trim();
                    else errMsg = "Login failed: no token returned by server";
                    throw new IOException(errMsg);
                }
                this.token = resp.token;
                this.isAdmin = (resp.user != null && Boolean.TRUE.equals(resp.user.effectiveIsAdmin()));
                this.currentUsername = (resp.user != null) ? resp.user.username : null;
                return resp;
            } else {
                // Successful status but unable to parse body: likely backend returned an error object
                if (rawBody != null && !rawBody.trim().isEmpty()) {
                    throw new IOException(rawBody.trim());
                }
                // else fallback to generic error
                throw new IOException("Empty or invalid login response from server");
            }
        } else {
            // Non-2xx: construct an informative error message
            String errMsg = "Login failed (HTTP " + code + ")";
            if (resp != null && resp.message != null && !resp.message.isEmpty()) errMsg = resp.message;
            else if (resp != null && resp.error != null && !resp.error.isEmpty()) errMsg = resp.error;
            else if (rawBody != null && !rawBody.isEmpty()) errMsg = rawBody.trim();
            throw new IOException(errMsg);
        }
    }

    public List<User> listUsers() throws IOException {
        HttpURLConnection con = createConn("/api/users?is_active=1", "GET");
        int code = con.getResponseCode();
        if (code >= 200 && code < 300) {
            try (InputStream is = con.getInputStream()) {
                return mapper.readValue(is, new TypeReference<List<User>>() {});
            } finally {
                con.disconnect();
            }
        } else {
            try (InputStream is = con.getErrorStream()) {
                String err = readAll(is);
                throw new IOException("Failed to fetch users: " + code + " " + err);
            } finally {
                con.disconnect();
            }
        }
    }

    /** Fetch avatar bytes by user id. Avatar GET is public per your API, but will include token if present. */
    public byte[] fetchAvatarById(String id) throws IOException {
        String endpoint = "/api/users/" + URLEncoder.encode(id, StandardCharsets.UTF_8.toString()) + "/avatar";
        HttpURLConnection con = createConn(endpoint, "GET");
        int code = con.getResponseCode();
        try {
            if (code >= 200 && code < 300) {
                try (InputStream is = con.getInputStream(); ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
                    byte[] buf = new byte[8192];
                    int r;
                    while ((r = is.read(buf)) != -1) baos.write(buf, 0, r);
                    return baos.toByteArray();
                }
            } else if (code == 302 || code == 301) {
                // follow redirect to a URL (simple handling)
                String loc = con.getHeaderField("Location");
                if (loc != null) {
                    URL redirect = new URL(loc);
                    HttpURLConnection rcon = (HttpURLConnection) redirect.openConnection();
                    try {
                        try (InputStream is = rcon.getInputStream(); ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
                            byte[] buf = new byte[8192];
                            int r;
                            while ((r = is.read(buf)) != -1) baos.write(buf, 0, r);
                            return baos.toByteArray();
                        }
                    } finally {
                        rcon.disconnect();
                    }
                }
                return null;
            } else {
                try (InputStream is = con.getErrorStream()) {
                    String err = readAll(is);
                    throw new IOException("Failed to fetch avatar: " + code + " " + err);
                }
            }
        } finally {
            con.disconnect();
        }
    }

    /** Delete user by id. If hard==true uses mode=hard; otherwise mode=soft. */
    public boolean deleteUserById(String id, boolean hard) throws IOException {
        String endpoint = "/api/users/" + URLEncoder.encode(id, StandardCharsets.UTF_8.toString()) + "?mode=" + (hard ? "hard" : "soft");
        HttpURLConnection con = createConn(endpoint, "DELETE");
        int code = con.getResponseCode();
        try {
            InputStream is = (code >= 200 && code < 300) ? con.getInputStream() : con.getErrorStream();
            if (is != null) {
                try (InputStream ignored = is) {
                    // drain/close the stream to free native resources
                }
            }
            return (code >= 200 && code < 300);
        } finally {
            con.disconnect();
        }
    }

    /** Optionally call server-side logout endpoint to blacklist the token. Returns true on 2xx. */
    public boolean logoutServer() throws IOException {
        if (token == null) return true; // nothing to do
        URL url = new URL(baseUrl + "/api/logout");
        HttpURLConnection con = (HttpURLConnection) url.openConnection();
        con.setRequestMethod("POST");
        con.setRequestProperty("Authorization", "Bearer " + token);
        con.setDoOutput(true);
        int code = con.getResponseCode();
        try {
            InputStream is = (code >= 200 && code < 300) ? con.getInputStream() : con.getErrorStream();
            if (is != null) {
                try (InputStream ignored = is) {
                    // ensure closed
                }
            }
            return (code >= 200 && code < 300);
        } finally {
            con.disconnect();
        }
    }

    private HttpURLConnection createConn(String endpoint, String method) throws IOException {
        URL url = new URL(baseUrl + endpoint);
        HttpURLConnection con = (HttpURLConnection) url.openConnection();
        con.setRequestMethod(method);
        if (token != null) {
            con.setRequestProperty("Authorization", "Bearer " + token);
        }
        return con;
    }

    private String readAll(InputStream is) throws IOException {
        if (is == null) return "";
        try (BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) sb.append(line).append('\n');
            return sb.toString();
        }
    }

    public boolean isAdmin() {
        return isAdmin;
    }

    public boolean isLoggedIn() {
        return token != null && !token.trim().isEmpty();
    }

    public String getCurrentUsername() {
        return currentUsername;
    }

    /**
     * Local logout (clears token). Optionally, you can call the server logout endpoint before clearing.
     */
    public void logout() {
        this.token = null;
        this.isAdmin = false;
        this.currentUsername = null;
    }

    /** Fetch bytes from either an absolute URL or a path relative to baseUrl. */
    public byte[] fetchBytesFromUrl(String urlOrPath) throws IOException {
        if (urlOrPath == null || urlOrPath.trim().isEmpty()) return null;
        String trimmed = urlOrPath.trim();
        URL url;
        if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            url = new URL(trimmed);
        } else {
            // treat as relative path
            String path = trimmed.startsWith("/") ? trimmed : ("/" + trimmed);
            url = new URL(baseUrl + path);
        }
        HttpURLConnection con = (HttpURLConnection) url.openConnection();
        con.setRequestMethod("GET");
        if (token != null) con.setRequestProperty("Authorization", "Bearer " + token);
        int code = con.getResponseCode();
        try {
            if (code >= 200 && code < 300) {
                try (InputStream is = con.getInputStream(); ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
                    byte[] buf = new byte[8192];
                    int r;
                    while ((r = is.read(buf)) != -1) baos.write(buf, 0, r);
                    return baos.toByteArray();
                }
            } else if (code == 302 || code == 301) {
                String loc = con.getHeaderField("Location");
                if (loc != null) {
                    URL redirect = new URL(loc);
                    HttpURLConnection rcon = (HttpURLConnection) redirect.openConnection();
                    try {
                        try (InputStream is = rcon.getInputStream(); ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
                            byte[] buf = new byte[8192];
                            int r;
                            while ((r = is.read(buf)) != -1) baos.write(buf, 0, r);
                            return baos.toByteArray();
                        }
                    } finally {
                        rcon.disconnect();
                    }
                }
                return null;
            } else {
                try (InputStream is = con.getErrorStream()) {
                    String err = readAll(is);
                    throw new IOException("Failed to fetch resource: " + code + " " + err);
                }
            }
        } finally {
            con.disconnect();
        }
    }
}
