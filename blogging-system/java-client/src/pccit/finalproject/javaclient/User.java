package pccit.finalproject.javaclient;

import com.fasterxml.jackson.annotation.JsonProperty;

public class User {
    // id from your API may be a number or string; keep as String for simplicity
    public String id;

    // common JSON names: username
    public String username;

    @JsonProperty("display_name")
    public String displayName;

    @JsonProperty("avatar_url")
    public String avatarUrl;

    @JsonProperty("real_name")
    public String realName;

    public User() {}

    public User(String id, String username, String displayName, String avatarUrl, String realName) {
        this.id = id;
        this.username = username;
        this.displayName = displayName;
        this.avatarUrl = avatarUrl;
        this.realName = realName;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public String getRealName() { return realName; }
    public void setRealName(String realName) { this.realName = realName; }

    @Override
    public String toString() { return realName != null ? realName : username; }
}
