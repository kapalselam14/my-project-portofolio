package pccit.finalproject.javaclient;

import javax.imageio.ImageIO;
import javax.swing.*;
import javax.swing.event.ListSelectionEvent;
import javax.swing.event.ListSelectionListener;
import javax.swing.border.EmptyBorder;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;
import java.awt.Desktop;

public class AdminFrame extends JFrame {
    private final AdminClient client;

    private final JTextField usernameField = new JTextField(15);
    private final JPasswordField passwordField = new JPasswordField(15);
    private final JButton loginButton = new JButton("Login");
    private final JButton logoutButton = new JButton("Logout");
    private final JButton deleteButton = new JButton("Delete User");
    private final JButton refreshButton = new JButton("Refresh");

    private final UserTableModel tableModel = new UserTableModel();
    private final JTable userTable = new JTable(tableModel);

    // Inline profile UI (avatar + name)
    private final JPanel profilePanel = new JPanel(new BorderLayout());
    private final JLabel avatarLabel = new JLabel();
    private final JLabel nameLabel = new JLabel("No user selected", SwingConstants.CENTER);
    private final int thumbSize = 100;

    private final JLabel statusLabel = new JLabel("Not logged in");
    private final JLabel userCountLabel = new JLabel("");

    public AdminFrame(AdminClient client) {
        super("Admin Client");
        this.client = client;
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setSize(800, 500);
        setLocationRelativeTo(null);

        createProfileComponents();
        createLayout();
        attachListeners();
        updateControlsForLoggedOut();
    }

    private void createProfileComponents() {
        avatarLabel.setHorizontalAlignment(SwingConstants.CENTER);
        avatarLabel.setPreferredSize(new Dimension(thumbSize, thumbSize));
        nameLabel.setBorder(BorderFactory.createEmptyBorder(8, 8, 8, 8));
        profilePanel.add(avatarLabel, BorderLayout.CENTER);
        profilePanel.add(nameLabel, BorderLayout.SOUTH);
    }

    private void createLayout() {
        JPanel top = new JPanel(new FlowLayout(FlowLayout.LEFT));
        top.add(new JLabel("Username:"));
        top.add(usernameField);
        top.add(new JLabel("Password:"));
        top.add(passwordField);
        top.add(loginButton);
        top.add(logoutButton);
        top.add(refreshButton);

        JScrollPane tableScroll = new JScrollPane(userTable);
        userTable.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);

        JPanel leftPanel = new JPanel(new BorderLayout());
        leftPanel.add(tableScroll, BorderLayout.CENTER);
        JPanel leftBottom = new JPanel(new FlowLayout(FlowLayout.LEFT));
        leftBottom.add(deleteButton);
        leftPanel.add(leftBottom, BorderLayout.SOUTH);

        profilePanel.setPreferredSize(new Dimension(220, 200));

        JSplitPane split = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT, leftPanel, profilePanel);
        split.setResizeWeight(0.7);

        JPanel bottom = new JPanel(new BorderLayout());
        bottom.add(statusLabel, BorderLayout.WEST);
        
        // Set fixed size for user count label to prevent clipping
        userCountLabel.setPreferredSize(new Dimension(150, 20));
        userCountLabel.setMinimumSize(new Dimension(150, 20));
        
        JPanel userCountPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT, 10, 0));
        userCountPanel.add(userCountLabel);
        bottom.add(userCountPanel, BorderLayout.EAST);
        
        bottom.setBorder(BorderFactory.createEmptyBorder(4, 4, 4, 4));

        // add padding around the entire frame content
        JComponent content = (JComponent) getContentPane();
        content.setBorder(new EmptyBorder(12, 12, 12, 12));
        content.setLayout(new BorderLayout(8,10));
        content.add(top, BorderLayout.NORTH);
        content.add(split, BorderLayout.CENTER);
        content.add(bottom, BorderLayout.SOUTH);
    }

    private void attachListeners() {
        loginButton.addActionListener(e -> doLogin());
        logoutButton.addActionListener(e -> doLogout());
        deleteButton.addActionListener(e -> doDeleteSelectedUser());
        refreshButton.addActionListener(e -> fetchUsers());

        userTable.getSelectionModel().addListSelectionListener(new ListSelectionListener() {
            @Override
            public void valueChanged(ListSelectionEvent e) {
                if (!e.getValueIsAdjusting()) {
                    onSelectionChanged();
                }
            }
        });
    }

    private void doLogin() {
        final String user = usernameField.getText().trim();
        final String pass = new String(passwordField.getPassword());
        if (user.isEmpty() || pass.isEmpty()) {
            JOptionPane.showMessageDialog(this, "Enter username and password", "Validation", JOptionPane.WARNING_MESSAGE);
            return;
        }
        setStatus("Logging in...");
        setControlsEnabled(false);

        SwingWorker<AdminClient.LoginResponse, Void> worker = new SwingWorker<AdminClient.LoginResponse, Void>() {
            private Exception exc;
            @Override
            protected AdminClient.LoginResponse doInBackground() throws Exception {
                try {
                    return client.login(user, pass);
                } catch (Exception e) {
                    this.exc = e;
                    return null;
                }
            }

            @Override
            protected void done() {
                setControlsEnabled(true);
                if (exc != null) {
                    JOptionPane.showMessageDialog(AdminFrame.this, "Login failed: " + exc.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
                    client.logout();
                    updateControlsForLoggedOut();
                    setStatus("Not logged in");
                    return;
                }
                try {
                    AdminClient.LoginResponse resp = get();
                    if (resp == null) {
                        JOptionPane.showMessageDialog(AdminFrame.this, "Empty response from server", "Error", JOptionPane.ERROR_MESSAGE);
                        client.logout();
                        updateControlsForLoggedOut();
                        setStatus("Not logged in");
                        return;
                    }
                    boolean isAdmin = client.isAdmin();
                    if (!isAdmin) {
                        JOptionPane.showMessageDialog(AdminFrame.this, "Authenticated but not an admin", "Access denied", JOptionPane.ERROR_MESSAGE);
                        client.logout();
                        updateControlsForLoggedOut();
                        setStatus("Not logged in");
                        return;
                    }
                    setStatus("Fetching users...");
                    fetchUsers();
                } catch (Exception ex) {
                    JOptionPane.showMessageDialog(AdminFrame.this, "Login processing error: " + ex.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
                    client.logout();
                    updateControlsForLoggedOut();
                    setStatus("Not logged in");
                }
            }
        };
        worker.execute();
    }

    private void fetchUsers() {
        setControlsEnabled(false);
        SwingWorker<List<User>, Void> worker = new SwingWorker<List<User>, Void>() {
            private Exception exc;
            @Override
            protected List<User> doInBackground() throws Exception {
                try {
                    return client.listUsers();
                } catch (IOException e) {
                    this.exc = e;
                    return null;
                }
            }

            @Override
            protected void done() {
                setControlsEnabled(true);
                if (exc != null) {
                    JOptionPane.showMessageDialog(AdminFrame.this, "Failed to load users: " + exc.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
                    client.logout();
                    updateControlsForLoggedOut();
                    setStatus("Not logged in");
                    return;
                }
                try {
                    List<User> users = get();
                    // Debug print: show all users received from backend
                    System.out.println("Fetched users:");
                    for (User u : users) {
                        System.out.println("  " + u.getUsername());
                    }
                    tableModel.setUsers(users);
                    tableModel.fireTableDataChanged(); // Force table refresh
                    setStatus("Logged in as admin");
                    setUserCount(users.size());
                    updateControlsForLoggedIn();
                } catch (Exception e) {
                    JOptionPane.showMessageDialog(AdminFrame.this, "Error processing users: " + e.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
                    client.logout();
                    updateControlsForLoggedOut();
                    setStatus("Not logged in");
                }
            }
        };
        worker.execute();
    }

    private void onSelectionChanged() {
        int row = userTable.getSelectedRow();
        if (row < 0) {
            deleteButton.setEnabled(false);
            showPlaceholder();
            setStatus("Logged in as admin"); // Always reset status if nothing selected
            return;
        }
        deleteButton.setEnabled(true);
        User u = tableModel.getUserAt(row);
        // prefer realName if present
        final String nameToShow = u.getRealName() != null && !u.getRealName().isEmpty() ? u.getRealName() : u.getUsername();
        showUser(nameToShow, null); // show name while loading image

        // Load avatar asynchronously: prefer avatarUrl from the user object if available,
        // otherwise fall back to the API endpoint /api/users/{id}/avatar
        setStatus("Loading avatar...");
        SwingWorker<byte[], Void> worker = new SwingWorker<byte[], Void>() {
            private Exception exc;
            @Override
            protected byte[] doInBackground() throws Exception {
                try {
                    String avatarUrl = u.getAvatarUrl();
                    if (avatarUrl != null && !avatarUrl.trim().isEmpty()) {
                        System.out.println("Fetching avatar from avatarUrl: " + avatarUrl);
                        return client.fetchBytesFromUrl(avatarUrl);
                    } else {
                        System.out.println("No avatarUrl found for user " + u.getId() + "; using /avatar endpoint");
                        return client.fetchAvatarById(u.getId());
                    }
                } catch (IOException e) {
                    this.exc = e;
                    return null;
                }
            }

            @Override
            protected void done() {
                try {
                    if (exc != null) {
                        JOptionPane.showMessageDialog(AdminFrame.this, "Error loading avatar: " + exc.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
                        // keep the selected name visible even if loading failed
                        showUser(nameToShow, null);
                    } else {
                        byte[] imageData = get();
                        if (imageData != null) {
                            // pass the selected name so it doesn't become "No user selected"
                            showUser(nameToShow, imageData);
                        } else {
                            // no image bytes — keep the selected name and show default avatar
                            showUser(nameToShow, null);
                        }
                    }
                } catch (Exception e) {
                    JOptionPane.showMessageDialog(AdminFrame.this, "Error displaying avatar: " + e.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
                    showUser(nameToShow, null);
                } finally {
                    setStatus("Logged in as admin"); // Always reset status after avatar load
                }
            }
        };
        worker.execute();
    }

    private void showUser(String name, byte[] imageData) {
         nameLabel.setText(name != null ? name : "No user selected");
         avatarLabel.setIcon(null);

         if (imageData != null) {
             try {
                 // First try to decode with ImageIO (works if WebP plugin is present)
                 BufferedImage img = ImageIO.read(new ByteArrayInputStream(imageData));
                 if (img != null) {
                     Image scaled = img.getScaledInstance(thumbSize, thumbSize, Image.SCALE_SMOOTH);
                     avatarLabel.setIcon(new ImageIcon(scaled));
                     return;
                 }
             } catch (IOException ioe) {
                 // fallthrough to other handling
                 System.err.println("ImageIO.read failed: " + ioe.getMessage());
             }
            }}
            //  // Detect WebP by RIFF header and 'WEBP' at offset 8
            //  boolean isWebP = false;
            //  if (imageData.length >= 12) {
            //      isWebP = (imageData[0] == (byte) 'R' && imageData[1] == (byte) 'I' && imageData[2] == (byte) 'F' && imageData[3] == (byte) 'F'
            //              && imageData[8] == (byte) 'W' && imageData[9] == (byte) 'E' && imageData[10] == (byte) 'B' && imageData[11] == (byte) 'P');
            //  }

            //  if (isWebP) {
            //      // write to temp .webp and open with OS default viewer if possible
            //      try {
            //          Path tmp = Files.createTempFile("user_avatar_", ".webp");
            //          Files.write(tmp, imageData);
            //          File tmpFile = tmp.toFile();
            //          tmpFile.deleteOnExit();
            //          if (Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.OPEN)) {
            //              try {
            //                  Desktop.getDesktop().open(tmpFile);
            //              } catch (Exception openEx) {
            //                  // Opening may fail due to security or missing association — show message but keep UI stable
            //                  JOptionPane.showMessageDialog(this, "WebP image detected but failed to open external viewer: " + openEx.getMessage(), "Info", JOptionPane.INFORMATION_MESSAGE);
            //              }
            //              // show a default thumbnail in the UI while external viewer may be open
            //              avatarLabel.setIcon(createDefaultIcon());
            //              return;
            //          } else {
            //              JOptionPane.showMessageDialog(this, "WebP image detected but cannot open external viewer on this platform.", "Info", JOptionPane.INFORMATION_MESSAGE);
            //              avatarLabel.setIcon(createDefaultIcon());
            //              return;
            //          }
            //      } catch (IOException e) {
            //         JOptionPane.showMessageDialog(this, "Failed to open WebP image: " + e.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
            //         avatarLabel.setIcon(createDefaultIcon());
            //         return;
            //      }
            //  }

            //  // Fallback: try to decode again or show placeholder
            //  try (ByteArrayInputStream bais = new ByteArrayInputStream(imageData)) {
            //      BufferedImage img2 = ImageIO.read(bais);
            //      if (img2 != null) {
            //          Image scaled = img2.getScaledInstance(thumbSize, thumbSize, Image.SCALE_SMOOTH);
            //          avatarLabel.setIcon(new ImageIcon(scaled));
            //      } else {
            //          // couldn't decode
            //          avatarLabel.setIcon(createDefaultIcon());
            //      }
            //  } catch (IOException e) {
            //      avatarLabel.setIcon(createDefaultIcon());
            //  }
    private void showPlaceholder() {
        nameLabel.setText("No user selected");
        avatarLabel.setIcon(null);
    }

    private void setStatus(String message) {
        statusLabel.setText(message);
    }

    private void setUserCount(int count) {
        userCountLabel.setText("Users loaded: " + count);
    }

    private void clearUserCount() {
        userCountLabel.setText("");
    }

    private void setControlsEnabled(boolean enabled) {
        usernameField.setEnabled(enabled);
        passwordField.setEnabled(enabled);
        // Only enable login if not logged in
        loginButton.setEnabled(enabled && !client.isLoggedIn());
        // Only enable logout if logged in
        logoutButton.setEnabled(client.isLoggedIn());
        // Delete and refresh only enabled if logged in
        deleteButton.setEnabled(enabled && client.isLoggedIn() && userTable.getSelectedRow() >= 0);
        refreshButton.setEnabled(enabled && client.isLoggedIn());
        userTable.setEnabled(enabled && client.isLoggedIn());
    }

    private void updateControlsForLoggedOut() {
        usernameField.setEnabled(true);
        passwordField.setEnabled(true);
        loginButton.setEnabled(true);
        logoutButton.setEnabled(false);
        deleteButton.setEnabled(false);
        refreshButton.setEnabled(false);
        userTable.setEnabled(false);
        tableModel.setUsers(Collections.emptyList()); // Clear the table on logout
        tableModel.fireTableDataChanged(); // Ensure table view is refreshed and cleared
        showPlaceholder();
        setStatus("Not logged in");
        clearUserCount();
    }

    private void updateControlsForLoggedIn() {
        usernameField.setEnabled(false);
        passwordField.setEnabled(false);
        loginButton.setEnabled(false);
        logoutButton.setEnabled(true);
        deleteButton.setEnabled(userTable.getSelectedRow() >= 0);
        refreshButton.setEnabled(true);
        userTable.setEnabled(true);
        setStatus("Logged in as admin");
    }

    private void doLogout() {
        int confirm = JOptionPane.showConfirmDialog(this, "Are you sure you want to logout?", "Confirm Logout", JOptionPane.YES_NO_OPTION);
        if (confirm != JOptionPane.YES_OPTION) {
            return;
        }
        setStatus("Logging out...");
        setControlsEnabled(false);

        SwingWorker<Void, Void> worker = new SwingWorker<Void, Void>() {
            private Exception exc;
            @Override
            protected Void doInBackground() throws Exception {
                try {
                    client.logout();
                } catch (Exception e) {
                    this.exc = e;
                }
                return null;
            }

            @Override
            protected void done() {
                setControlsEnabled(true);
                if (exc != null) {
                    JOptionPane.showMessageDialog(AdminFrame.this, "Logout failed: " + exc.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
                    setStatus("Logged in as admin");
                } else {
                    updateControlsForLoggedOut();
                }
            }
        };
        worker.execute();
    }

    private void doDeleteSelectedUser() {
        int row = userTable.getSelectedRow();
        if (row < 0) {
            return; // No user selected
        }
        User userToDelete = tableModel.getUserAt(row);

        // Prevent admin from deleting themselves
        String currentUsername = client.getCurrentUsername();
        if (currentUsername != null && currentUsername.equals(userToDelete.getUsername())) {
            JOptionPane.showMessageDialog(this,
                    "You cannot delete your own admin account while logged in.\nPlease use another admin account to perform this action.",
                    "Self-Deletion Not Allowed",
                    JOptionPane.WARNING_MESSAGE);
            return;
        }

        int confirm = JOptionPane.showConfirmDialog(this,
                "Are you sure you want to delete user " + userToDelete.getUsername() + "?",
                "Confirm Delete",
                JOptionPane.YES_NO_OPTION);

        if (confirm != JOptionPane.YES_OPTION) {
            return;
        }

        setStatus("Deleting user...");
        setControlsEnabled(false);

        boolean hardDelete = false; // Use hard delete if admin

        SwingWorker<Void, Void> worker = new SwingWorker<Void, Void>() {
            private Exception exc;
            @Override
            protected Void doInBackground() throws Exception {
                try {
                    client.deleteUserById(userToDelete.getId(), hardDelete);
                } catch (Exception e) {
                    this.exc = e;
                }
                return null;
            }

            @Override
            protected void done() {
                setControlsEnabled(true);
                if (exc != null) {
                    JOptionPane.showMessageDialog(AdminFrame.this, "Delete failed: " + exc.getMessage(), "Error", JOptionPane.ERROR_MESSAGE);
                } else {
                    JOptionPane.showMessageDialog(AdminFrame.this, "User deleted successfully", "Success", JOptionPane.INFORMATION_MESSAGE);
                    fetchUsers();
                    userTable.clearSelection(); // Clear selection after refresh
                    showPlaceholder(); // Clear profile panel
                }
            }
        };
        worker.execute();
    }

    private ImageIcon createDefaultIcon() {
        // Create a simple gray circle as a placeholder avatar
        int size = thumbSize;
        BufferedImage img = new BufferedImage(size, size, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g2 = img.createGraphics();
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2.setColor(Color.LIGHT_GRAY);
        g2.fillOval(0, 0, size, size);
        g2.setColor(Color.GRAY);
        g2.drawOval(0, 0, size - 1, size - 1);
        g2.dispose();
        return new ImageIcon(img);
    }
}
