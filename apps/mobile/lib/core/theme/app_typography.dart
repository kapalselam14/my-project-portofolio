import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'dark_colors.dart';

/// Typography system for MatchUp — three-font hierarchy.
/// Outfit (Black / ExtraBold / Bold) provides a sporty-geometric, high-impact character for all headings.
/// Line height 1.26 is the natural line height of both Outfit and Geist for UI text.
/// Letter spacing Outfit at display sizes benefits from slight negative tracking.
/// Theme-aware colour Methods that take a [BuildContext] resolve colour from the live theme (`context.colors.*`).
class AppTypography {
  AppTypography._();

  // Font families.

  /// Heading & Display: sporty-geometric, high-impact.
  static const String _heading = 'Outfit';

  /// Body & Metadata: neutral, highly readable at all sizes.
  static const String _body = 'Geist';

  /// Accent / Highlight: badges, sport tags, small standout elements.
  static const String _accent = 'Plus Jakarta Sans';

  /// Back-compat alias — external callers that still reference `AppTypography.fontFamily` continue to compile.
  static const String fontFamily = _heading;

  // Line heights.

  /// Standard UI line height (1.26) — works for Outfit, Geist, and PJS alike.
  static const double uiLineHeight = 1.26;

  /// Looser leading for multi-line reading copy (descriptions, chat bubbles).
  static const double readingLineHeight = 1.5;

  // Tracking helpers.

  /// Negative tracking for display/title text (18 px+).
  static double _displayTracking(double fontSize) => fontSize * -0.02;

  /// Positive tracking for small UPPERCASE accent labels (badges, chips).
  static const double _capsTracking = 0.5;

  // ═══════════════════════════════════════════════════════════════════════════ HEADING TIER — Outfit.

  // Theme invariant (fixed white on brand blue backgrounds).

  /// 44 px Black — splash wordmark. Always white-on-blue; theme-invariant.
  static TextStyle get wordmarkSplash => TextStyle(
    fontFamily: _heading,
    fontSize: 44,
    fontWeight: FontWeight.w900,
    letterSpacing: _displayTracking(44),
    height: uiLineHeight,
    color: AppColors.textOnPrimary,
  );

  /// 30 px ExtraBold — onboarding heading (line-height 1.25 per Figma).
  static TextStyle get headingOnboarding => TextStyle(
    fontFamily: _heading,
    fontSize: 30,
    fontWeight: FontWeight.w800,
    letterSpacing: _displayTracking(30),
    height: 1.25,
    color: AppColors.textOnPrimary,
  );

  // Theme aware.

  /// 32 px ExtraBold — celebration headings ("It's a Match!", "Spots Filled!").
  static TextStyle headlineLarge(BuildContext context) => TextStyle(
    fontFamily: _heading,
    fontSize: 32,
    fontWeight: FontWeight.w800,
    letterSpacing: _displayTracking(32),
    height: uiLineHeight,
    color: context.colors.textPrimary,
  );

  /// 28 px ExtraBold — welcome / signin / signup headings.
  static TextStyle headingDisplay(BuildContext context) => TextStyle(
    fontFamily: _heading,
    fontSize: 28,
    fontWeight: FontWeight.w800,
    letterSpacing: _displayTracking(28),
    height: uiLineHeight,
    color: context.colors.textPrimary,
  );

  /// 24 px ExtraBold — recovery-flow headings, OTP digit display.
  static TextStyle headlineMedium(BuildContext context) => TextStyle(
    fontFamily: _heading,
    fontSize: 24,
    fontWeight: FontWeight.w800,
    letterSpacing: _displayTracking(24),
    height: uiLineHeight,
    color: context.colors.textPrimary,
  );

  /// 22 px ExtraBold — screen titles and activity titles (Figma 43:224).
  static TextStyle titleScreen(BuildContext context) => TextStyle(
    fontFamily: _heading,
    fontSize: 22,
    fontWeight: FontWeight.w800,
    letterSpacing: _displayTracking(22),
    height: uiLineHeight,
    color: context.colors.textPrimary,
  );

  /// 20 px ExtraBold — sheet titles, profile name.
  static TextStyle headlineSmall(BuildContext context) => TextStyle(
    fontFamily: _heading,
    fontSize: 20,
    fontWeight: FontWeight.w800,
    letterSpacing: _displayTracking(20),
    height: uiLineHeight,
    color: context.colors.textPrimary,
  );

  /// 18 px ExtraBold — "Create Activity", "Edit Profile" (Figma 43:293).
  static TextStyle titleSheet(BuildContext context) => TextStyle(
    fontFamily: _heading,
    fontSize: 18,
    fontWeight: FontWeight.w800,
    letterSpacing: _displayTracking(18),
    height: uiLineHeight,
    color: context.colors.textPrimary,
  );

  /// 18 px Bold — softer 18 px title variant.
  static TextStyle titleLarge(BuildContext context) => TextStyle(
    fontFamily: _heading,
    fontSize: 18,
    fontWeight: FontWeight.w700,
    letterSpacing: _displayTracking(18),
    height: uiLineHeight,
    color: context.colors.textPrimary,
  );

  /// 16 px Bold — section headers, card titles.
  static TextStyle titleMedium(BuildContext context) => TextStyle(
    fontFamily: _heading,
    fontSize: 16,
    fontWeight: FontWeight.w700,
    height: uiLineHeight,
    color: context.colors.textPrimary,
  );

  // ═══════════════════════════════════════════════════════════════════════════ BODY TIER — Geist.

  /// 16 px Regular — standard body text.
  static TextStyle bodyLarge(BuildContext context) => TextStyle(
    fontFamily: _body,
    fontSize: 16,
    fontWeight: FontWeight.normal,
    height: uiLineHeight,
    color: context.colors.textLabel,
  );

  /// 14 px Regular — default body / list-item text.
  static TextStyle bodyMedium(BuildContext context) => TextStyle(
    fontFamily: _body,
    fontSize: 14,
    fontWeight: FontWeight.normal,
    height: uiLineHeight,
    color: context.colors.textSecondary,
  );

  /// 12 px Regular.
  static TextStyle bodySmall(BuildContext context) => TextStyle(
    fontFamily: _body,
    fontSize: 12,
    fontWeight: FontWeight.normal,
    height: uiLineHeight,
    color: context.colors.textSecondary,
  );

  /// 14 px Regular, leading **1.5** — multi-line reading copy such as "About this Activity".
  static TextStyle bodyReading(BuildContext context) => TextStyle(
    fontFamily: _body,
    fontSize: 14,
    fontWeight: FontWeight.normal,
    height: readingLineHeight,
    color: context.colors.textPrimary,
  );

  /// 16 px Regular line-height 1.5 — onboarding description (Figma 42:42).
  static TextStyle get bodyOnboarding => const TextStyle(
    fontFamily: _body,
    fontSize: 16,
    fontWeight: FontWeight.normal,
    height: readingLineHeight,
    color: AppColors.textOnPrimary,
  );

  /// 15 px Regular — signin/signup supporting copy.
  static TextStyle bodyFormSecondary(BuildContext context) => TextStyle(
    fontFamily: _body,
    fontSize: 15,
    fontWeight: FontWeight.normal,
    height: uiLineHeight,
    color: context.colors.textSecondary,
  );

  // Labels & meta (Geist).

  /// 14 px SemiBold — form field label (Figma 43:297).
  static TextStyle labelField(BuildContext context) => TextStyle(
    fontFamily: _body,
    fontSize: 14,
    fontWeight: FontWeight.w600,
    height: uiLineHeight,
    color: context.colors.textPrimary,
  );

  /// 14 px Medium — Figma input label (signin/signup).
  static TextStyle inputLabel(BuildContext context) => TextStyle(
    fontFamily: _body,
    fontSize: 14,
    fontWeight: FontWeight.w500,
    height: uiLineHeight,
    color: context.colors.textLabel,
  );

  /// 13 px Medium — compact input label (signup).
  static TextStyle inputLabelSmall(BuildContext context) => TextStyle(
    fontFamily: _body,
    fontSize: 13,
    fontWeight: FontWeight.w500,
    height: uiLineHeight,
    color: context.colors.textLabel,
  );

  /// 12 px Regular — meta-row sub text (Figma 43:239).
  /// Note: Figma renders this `#0f172a`, identical to the row title, which flattens the hierarchy.
  static TextStyle metaSub(BuildContext context) => TextStyle(
    fontFamily: _body,
    fontSize: 12,
    fontWeight: FontWeight.normal,
    height: uiLineHeight,
    color: context.colors.textSecondary,
  );

  /// 11 px Medium — bottom navigation label (Figma 43:336).
  static TextStyle tabLabel(BuildContext context) => TextStyle(
    fontFamily: _body,
    fontSize: 11,
    fontWeight: FontWeight.w500,
    letterSpacing: 0.2,
    height: uiLineHeight,
    color: context.colors.textSecondary,
  );

  /// 12 px Medium — general captions.
  static TextStyle caption(BuildContext context) => TextStyle(
    fontFamily: _body,
    fontSize: 12,
    fontWeight: FontWeight.w500,
    height: uiLineHeight,
    color: context.colors.textSecondary,
  );

  // ═══════════════════════════════════════════════════════════════════════════ ACCENT TIER — Plus Jakarta Sans.

  /// 13 px SemiBold — counts such as "6 joined / 10 total" (Figma 43:252).
  static TextStyle countAccent(BuildContext context) => TextStyle(
    fontFamily: _accent,
    fontSize: 13,
    fontWeight: FontWeight.w600,
    height: uiLineHeight,
    color: context.colors.primaryOnSurface,
  );

  /// 12 px ExtraBold — skill chip / status chip text (Figma 57:9).
  static TextStyle chipLabel(BuildContext context) => TextStyle(
    fontFamily: _accent,
    fontSize: 12,
    fontWeight: FontWeight.w800,
    letterSpacing: _capsTracking,
    height: uiLineHeight,
    color: context.colors.textPrimary,
  );

  /// 11 px ExtraBold — sport tag badge (Figma 75:5).
  static TextStyle badgeSport(BuildContext context) => TextStyle(
    fontFamily: _accent,
    fontSize: 11,
    fontWeight: FontWeight.w800,
    letterSpacing: _capsTracking,
    height: uiLineHeight,
    color: context.colors.primaryOnSurface,
  );

  // ═══════════════════════════════════════════════════════════════════════════ BUTTON TIER.

  /// 16 px Bold — primary pill button (Figma 43:332).
  static TextStyle get buttonPrimary => const TextStyle(
    fontFamily: _heading,
    fontSize: 16,
    fontWeight: FontWeight.w700,
    height: uiLineHeight,
    color: AppColors.textOnPrimary,
  );

  /// 15 px SemiBold — social pill button (sits on the theme's surface).
  static TextStyle buttonSocial(BuildContext context) => TextStyle(
    fontFamily: _heading,
    fontSize: 15,
    fontWeight: FontWeight.w600,
    height: uiLineHeight,
    color: context.colors.textPrimary,
  );

  /// 16 px SemiBold — generic button (no fixed colour).
  static TextStyle get button => const TextStyle(
    fontFamily: _heading,
    fontSize: 16,
    fontWeight: FontWeight.w600,
    height: uiLineHeight,
  );
}
