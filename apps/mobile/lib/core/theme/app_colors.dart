import 'package:flutter/material.dart';

/// Figma-based color palette for MatchUp.
class AppColors {
  AppColors._();

  // Primary blue — `#0B1F8A`.
  static const Color primary = Color(0xFF0B1F8A);
  static const Color primaryDark = Color(0xFF0B1F8A);
  static const Color primaryDarker = Color(0xFF0B1F8A); // primary-dark token
  static const Color primaryLight = Color(0xFFDBEAFE);

  // Splash gradient endpoints
  static const Color splashTop = Color(0xFF0B1F8A);
  static const Color splashBottom = Color(0xFF0B1F8A);

  // Accent orange
  static const Color accent = Color(0xFFFF6B00);
  static const Color accentLight = Color(0xFFFFE5D0);

  // Backgrounds
  static const Color background = Color(0xFFF5F7FA);
  static const Color surface = Colors.white;
  static const Color card = Colors.white;

  // Text (Figma tokens)
  static const Color textPrimary = Color(0xFF0F172A); // Figma text-primary
  static const Color textLabel = Color(0xFF334155); // Figma text-label
  static const Color textSecondary = Color(
    0xFF475569,
  ); // Figma text-secondary (slate-600, AA on white)

  /// Contrast on white is only 2.54:1 — fails WCAG AA for text (needs 4.5:1).
  static const Color textTertiary = Color(0xFF9CA3AF);
  static const Color textOnPrimary = Colors.white;

  // Status
  static const Color success = Color(0xFF22C55E);
  static const Color successLight = Color(0xFFDCFCE7);
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningLight = Color(0xFFFEF3C7);

  /// Stronger amber for icon/text on a light warning background.
  static const Color warningStrong = Color(0xFFB45309);
  static const Color error = Color(0xFFEF4444);
  static const Color errorLight = Color(0xFFFEE2E2);

  /// Darker red for icon/text on a light error background.
  static const Color errorStrong = Color(0xFFB91C1C);

  // UI
  static const Color border = Color(0xFFE2E8F0); // Figma border-default
  static const Color borderMuted = Color(0xFFE5E7EB);
  static const Color divider = Color(0xFFE5E7EB);
  static const Color shadow = Color(0x1A000000);
  static const Color iconPrimary = Color(
    0xFF1E293B,
  ); // Figma icon-primary (home indicator)
  static const Color scrim = Color(
    0x660F172A,
  ); // 40% black overlay on onboarding illustrations

  /// 65% slate overlay on full-bleed onboarding illustrations (Figma).
  static const Color scrimIllustration = Color(0xA60F172A);

  /// 80% black gradient stop for the diagonal onboarding overlay.
  static const Color scrimGradient = Color(0xCC000000);

  /// Fully transparent stop for gradient ends.
  static const Color scrimTransparent = Color(0x00000000);

  /// Scrim for a control sitting *on top of* [scrim].
  static const Color scrimControl = Color(0x4D0F172A);

  // Semantic status colors.
  /// Success text on soft backgrounds (e.g. "Open" status chip).
  static const Color statusSuccessText = Color(0xFF04694A);

  /// Soft success background for status chips.
  static const Color statusSuccessBg = Color(0xFFD1FAE5);

  /// Danger / dislike action.
  static const Color danger = Color(0xFFCC3333);

  /// Like stamp green.
  static const Color likeGreen = Color(0xFF22C55E);

  /// Nope stamp red.
  static const Color nopeRed = Color(0xFFEF4444);

  /// Secondary avatar color for the participant avatar stack.
  static const Color avatarSecondary = Color(0xFF097044);

  /// Avatar ring / neutral avatar bg.
  static const Color avatarNeutral = Color(0xFFE2E8F0);

  // Shadows glows.
  /// Soft blue glow under primary action buttons & cards.
  static const Color glowPrimary = Color(0x402D7FF9);

  /// Card drop shadow (Figma: #2D7FF9 @ 10%).
  static const Color shadowCard = Color(0x1A2D7FF9);

  /// Soft blue tint for selected/active fills (Figma: #E6F0FF).
  static const Color primarySoft = Color(0xFFE6F0FF);

  /// Subtle off-white fill for inactive/disabled surfaces (Figma: #F8FAFC).
  static const Color surfaceSubtle = Color(0xFFF8FAFC);

  /// Input border — slightly stronger than default border (Figma: #CBD5E1).
  static const Color borderInput = Color(0xFFCBD5E1);

  /// Muted surface — segmented-control track, attachment button, neutral badge (Figma: #F1F5F9).
  static const Color surfaceMuted = Color(0xFFF1F5F9);

  /// `ColorScheme.surfaceContainerHighest` — a step darker than.
  static const Color surfaceContainerHighest = Color(0xFFF3F4F6);

  /// Muted slate (Figma: #94A3B8).
  static const Color textMuted = Color(0xFF94A3B8);

  /// Destructive sign-out / log out accent (Figma: #F43F5E).
  static const Color dangerAccent = Color(0xFFF43F5E);

  /// Warning background (Figma: #FFFBEB).
  static const Color warningBg = Color(0xFFFFFBEB);

  /// Success background variant (Figma: #E1F9F1).
  static const Color successBg = Color(0xFFE1F9F1);

  /// Dark canvas for media placeholders (empty cover-photo dropzone, image upload wells).
  static const Color surfaceInverse = Color(0xFF1E293B);
}
