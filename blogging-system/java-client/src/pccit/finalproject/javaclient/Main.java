package pccit.finalproject.javaclient;

import javax.imageio.ImageIO;
import javax.swing.SwingUtilities;
import javax.swing.UIManager;

public class Main {

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            try {
                UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
            } catch (Exception ignored) {}

            // Allow ImageIO to discover additional plugins (e.g., WebP) if present in classpath
            try {
                ImageIO.scanForPlugins();
            } catch (Throwable t) {
                // non-fatal
                System.err.println("ImageIO.scanForPlugins failed: " + t.getMessage());
            }

            String base = null;
            if (args != null && args.length > 0 && args[0] != null && !args[0].isEmpty()) base = args[0];
            if (base == null || base.isEmpty()) base = System.getenv("BACKEND_URL");
            if (base == null || base.isEmpty()) base = "http://localhost:3000";
            System.out.println("Using backend URL: " + base);

            AdminClient client = new AdminClient(base);
            AdminFrame frame = new AdminFrame(client);
            frame.setVisible(true);
        });
    }
}
