import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../theme/dark_colors.dart';

/// Token sizes for [AppIcon].
enum AppIconSize {
  /// 16 — inline with 12–13px caption/meta text.
  sm,

  /// 18 — inline with 14px body/label text. Most common size.
  md,

  /// 20 — inline with 15–16px text, standalone small icon buttons.
  lg,

  /// 24 — header actions, nav icons, standalone emphasis.
  xl,
}

extension _AppIconSizeX on AppIconSize {
  double get px => switch (this) {
    AppIconSize.sm => 16,
    AppIconSize.md => 18,
    AppIconSize.lg => 20,
    AppIconSize.xl => 24,
  };
}

/// Single entry point for every icon in the app.
/// The app mixes Material Icons and a 45-glyph SVG set with different stroke weights and optical sizing.
/// dart AppIcon(AppIcons.clock, size: AppIconSize.sm, color: AppColors.textSecondary).
class AppIcon extends StatelessWidget {
  const AppIcon(this.asset, {super.key, this.size = AppIconSize.md, this.color})
    : materialIcon = null;

  /// Escape hatch for glyphs the SVG set does not cover.
  const AppIcon.material(
    IconData icon, {
    super.key,
    this.size = AppIconSize.md,
    this.color,
  }) : asset = '',
       materialIcon = icon;

  final String asset;
  final IconData? materialIcon;
  final AppIconSize size;

  /// Icon tint.
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final px = size.px;
    final tint = color ?? context.colors.textSecondary;
    if (materialIcon != null) {
      return Icon(materialIcon, size: px, color: tint);
    }
    return SvgPicture.asset(
      asset,
      width: px,
      height: px,
      colorFilter: ColorFilter.mode(tint, BlendMode.srcIn),
    );
  }
}

/// Named catalogue of `assets/images/discovery/icons/*.svg` — the single source of truth for icon asset paths.
class AppIcons {
  AppIcons._();

  static const _base = 'assets/images/discovery/icons';

  static const alertCircle = '$_base/alert_circle.svg';
  static const arrowLeft = '$_base/arrow_left.svg';
  static const bell = '$_base/bell.svg';
  static const calendar = '$_base/calendar.svg';
  static const calendar2 = '$_base/calendar_2.svg';
  static const check = '$_base/check.svg';
  static const checkCircle = '$_base/check_circle.svg';
  static const chevronLeft = '$_base/chevron-left.svg';
  static const chevronRight = '$_base/chevron-right.svg';
  static const chevronDown = '$_base/chevron_down.svg';
  static const circle = '$_base/circle.svg';
  static const clock = '$_base/clock.svg';
  static const compass = '$_base/compass.svg';
  static const crown = '$_base/crown.svg';
  static const dollarSign = '$_base/dollar_sign.svg';
  static const edit = '$_base/edit.svg';
  static const fileSearch = '$_base/file_search.svg';
  static const handle = '$_base/handle.svg';
  static const heart = '$_base/heart.svg';
  static const line = '$_base/line.svg';
  static const loader = '$_base/loader.svg';
  static const mailOpen = '$_base/mail-open.svg';
  static const mapPin = '$_base/map_pin.svg';
  static const messageCircle = '$_base/message_circle.svg';
  static const messageSquare = '$_base/message_square.svg';
  static const minus = '$_base/minus.svg';
  static const moreHorizontal = '$_base/more_horizontal.svg';
  static const notification = '$_base/notification.svg';
  static const notification2 = '$_base/notification_2.svg';
  static const plus = '$_base/plus.svg';
  static const plusSquare = '$_base/plus_square.svg';
  static const power = '$_base/power.svg';
  static const preferences = '$_base/preferences.svg';
  static const share = '$_base/share.svg';
  static const shieldCheck = '$_base/shield-check.svg';
  static const star = '$_base/star.svg';
  static const starEmpty = '$_base/star_empty.svg';
  static const starSmall = '$_base/star_small.svg';
  static const starSmallEmpty = '$_base/star_small_empty.svg';
  static const thumbsUp = '$_base/thumbs_up.svg';
  static const thumbsUpFilled = '$_base/thumbs_up_filled.svg';
  static const trash = '$_base/trash.svg';
  static const user = '$_base/user.svg';
  static const users = '$_base/users.svg';
  static const xCircle = '$_base/x_circle.svg';
  static const zap = '$_base/zap.svg';
}
