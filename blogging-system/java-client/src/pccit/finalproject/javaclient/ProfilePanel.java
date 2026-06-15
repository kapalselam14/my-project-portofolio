package pccit.finalproject.javaclient;

import javax.imageio.ImageIO;
import javax.swing.*;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;

/**
 * Displays the selected user's profile: avatar (thumbnail) and username.
 */
public class ProfilePanel extends JPanel {
    private final JLabel avatarLabel = new JLabel();
    private final JLabel nameLabel = new JLabel("No user selected", SwingConstants.CENTER);
    private final int thumbSize = 100;

    public ProfilePanel() {
        setLayout(new BorderLayout());
        avatarLabel.setHorizontalAlignment(SwingConstants.CENTER);
        avatarLabel.setPreferredSize(new Dimension(thumbSize, thumbSize));
        add(avatarLabel, BorderLayout.CENTER);
        nameLabel.setBorder(BorderFactory.createEmptyBorder(8, 8, 8, 8));
        add(nameLabel, BorderLayout.SOUTH);
    }

    public void showPlaceholder() {
        nameLabel.setText("No user selected");
        avatarLabel.setIcon(null);
    }

    public void showUser(String username, byte[] avatarBytes) {
        nameLabel.setText(username);
        if (avatarBytes == null || avatarBytes.length == 0) {
            avatarLabel.setIcon(createDefaultIcon());
            return;
        }
        try (ByteArrayInputStream bais = new ByteArrayInputStream(avatarBytes)) {
            BufferedImage img = ImageIO.read(bais);
            if (img == null) {
                avatarLabel.setIcon(createDefaultIcon());
                return;
            }
            Image scaled = img.getScaledInstance(thumbSize, thumbSize, Image.SCALE_SMOOTH);
            avatarLabel.setIcon(new ImageIcon(scaled));
        } catch (IOException e) {
            avatarLabel.setIcon(createDefaultIcon());
        }
    }

    private Icon createDefaultIcon() {
        BufferedImage img = new BufferedImage(thumbSize, thumbSize, BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        try {
            g.setColor(Color.LIGHT_GRAY);
            g.fillRect(0, 0, thumbSize, thumbSize);
            g.setColor(Color.DARK_GRAY);
            g.drawString("No Image", 10, thumbSize/2);
        } finally {
            g.dispose();
        }
        return new ImageIcon(img);
    }
}
