import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Design tokens for corner radii — keeps every rounded surface consistent.
/// Use the closest token instead of raw `BorderRadius.circular(n)`.
class AppRadius {
  AppRadius._();

  /// 8 — active segment inside a segmented control (Figma 43:325).
  static const double xs = 8;
  static const double sm = 10;

  /// 12 — text inputs, select fields, report button (Figma 43:298).
  static const double input = 12;
  static const double md = 14;

  /// 16 — cards, option pills, meta chips (Figma 49:12).
  static const double card = 16;
  static const double lg = 20;
  static const double xl = 28;
  static const double pill = 100;

  static final BorderRadius xsR = BorderRadius.circular(xs);
  static final BorderRadius smR = BorderRadius.circular(sm);
  static final BorderRadius inputR = BorderRadius.circular(input);
  static final BorderRadius mdR = BorderRadius.circular(md);
  static final BorderRadius cardR = BorderRadius.circular(card);
  static final BorderRadius lgR = BorderRadius.circular(lg);
  static final BorderRadius xlR = BorderRadius.circular(xl);
  static final BorderRadius pillR = BorderRadius.circular(pill);
}

/// 4pt spacing scale — the backbone of a minimal, rhythmic layout.
class AppSpacing {
  AppSpacing._();

  static const double x1 = 4;
  static const double x2 = 8;
  static const double x3 = 12;
  static const double x4 = 16;
  static const double x5 = 20;
  static const double x6 = 24;
  static const double x8 = 32;
  static const double x10 = 40;
}

/// Soft, low-alpha shadows — "modern minimal" means shadows you barely see.
class AppShadows {
  AppShadows._();

  /// Resting cards — two-layer shadow (contact + ambient) that matches how modern iOS/Figma cards read: a tight.
  static const List<BoxShadow> card = [
    BoxShadow(
      color: Color(0x0F0F172A), // 6% slate — contact shadow, tight
      blurRadius: 3,
      offset: Offset(0, 1),
    ),
    BoxShadow(
      color: Color(0x1A0F172A), // 10% slate — ambient, softer & wider
      blurRadius: 12,
      offset: Offset(0, 4),
    ),
  ];

  /// Floating elements: pinned buttons, bottom bars, FABs.
  static const List<BoxShadow> floating = [
    BoxShadow(
      color: Color(0x140F172A), // 8% slate
      blurRadius: 24,
      offset: Offset(0, 8),
    ),
  ];

  /// Primary CTA glow (blue tint, on-brand).
  static const List<BoxShadow> glowPrimary = [
    BoxShadow(
      color: AppColors.glowPrimary,
      blurRadius: 20,
      offset: Offset(0, 6),
    ),
  ];

  /// Separates a pinned bottom bar from scrollable content above it.
  static const List<BoxShadow> bottomBar = [
    BoxShadow(
      color: Color(0x140F172A), // 8% slate
      blurRadius: 16,
      offset: Offset(0, -4),
    ),
  ];

  /// Slightly lifted variant of [card] — for a card mid-press or under the pointer.
  static const List<BoxShadow> cardHover = [
    BoxShadow(
      color: Color(0x140F172A), // 8% slate — contact
      blurRadius: 4,
      offset: Offset(0, 2),
    ),
    BoxShadow(
      color: Color(0x260F172A), // 15% slate — ambient
      blurRadius: 20,
      offset: Offset(0, 8),
    ),
  ];

  /// Modal / bottom-sheet shadow — upward-biased since sheets sit above the content they cover rather than resting.
  static const List<BoxShadow> sheet = [
    BoxShadow(
      color: Color(0x1F0F172A), // 12% slate
      blurRadius: 32,
      offset: Offset(0, -8),
    ),
  ];
}

/// Motion duration tokens — use these instead of raw Duration literals.
class AppDurations {
  AppDurations._();

  /// Very short: icon state change, badge pop.
  static const Duration fast = Duration(milliseconds: 150);

  /// Standard: button press, card scale, route transition.
  static const Duration base = Duration(milliseconds: 250);

  /// Emphasized: full-screen transition, match celebration, hero.
  static const Duration emphasized = Duration(milliseconds: 320);

  /// Skeleton shimmer cycle.
  static const Duration shimmer = Duration(milliseconds: 1200);
}
