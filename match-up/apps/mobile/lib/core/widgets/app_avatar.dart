import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../theme/app_typography.dart';
import '../theme/dark_colors.dart';
import '../utils/logger.dart';
import 'pressable_scale.dart';

/// Sizes for [AppAvatar].
enum AppAvatarSize { xs, sm, md, lg, xl }

extension _AvatarSizeX on AppAvatarSize {
  double get diameter => switch (this) {
    AppAvatarSize.xs => 24,
    AppAvatarSize.sm => 32,
    AppAvatarSize.md => 44,
    AppAvatarSize.lg => 56,
    AppAvatarSize.xl => 80,
  };
  double get fontSize => switch (this) {
    AppAvatarSize.xs => 10,
    AppAvatarSize.sm => 12,
    AppAvatarSize.md => 16,
    AppAvatarSize.lg => 20,
    AppAvatarSize.xl => 28,
  };
}

/// Circular avatar that renders a network/asset image, falling back to initials on error or when no image is provided.
/// dart AppAvatar(imageUrl: user.avatarUrl, name: user.name).
class AppAvatar extends StatelessWidget {
  const AppAvatar({
    super.key,
    this.imageUrl,
    this.assetPath,
    this.name,
    this.size = AppAvatarSize.md,
    this.borderColor,
    this.borderWidth = 0,
    this.backgroundColor,
    this.onTap,
  });

  const AppAvatar.asset(
    String path, {
    Key? key,
    AppAvatarSize size = AppAvatarSize.md,
    Color? borderColor,
    double borderWidth = 0,
    VoidCallback? onTap,
  }) : this(
         key: key,
         assetPath: path,
         size: size,
         borderColor: borderColor,
         borderWidth: borderWidth,
         onTap: onTap,
       );

  final String? imageUrl;
  final String? assetPath;
  final String? name;
  final AppAvatarSize size;
  final Color? borderColor;
  final double borderWidth;
  final Color? backgroundColor;
  final VoidCallback? onTap;

  String get _initials {
    if (name == null || name!.isEmpty) return '?';
    final parts = name!.trim().split(' ');
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts.last[0]}'.toUpperCase();
    }
    return name![0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final d = size.diameter;
    final hasBorder = borderWidth > 0 && borderColor != null;

    Widget avatar = CircleAvatar(
      radius: d / 2,
      backgroundColor: backgroundColor ?? context.colors.primaryLight,
      child: _buildContent(context, d),
    );

    if (hasBorder) {
      avatar = Container(
        width: d + borderWidth * 2,
        height: d + borderWidth * 2,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: borderColor!, width: borderWidth),
        ),
        child: ClipOval(child: avatar),
      );
    }

    if (onTap != null) {
      avatar = PressableScale(onTap: onTap, child: avatar);
    }

    return avatar;
  }

  Widget _buildContent(BuildContext context, double d) {
    // Asset image
    if (assetPath != null) {
      return ClipOval(
        child: Image.asset(
          assetPath!,
          width: d,
          height: d,
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => _fallback(context, d),
        ),
      );
    }

    // Network image — disk + memory cache.
    if (imageUrl != null && imageUrl!.isNotEmpty) {
      final dpr = MediaQuery.devicePixelRatioOf(context);
      final cacheSize = (d * dpr).round().clamp(1, 400);
      return ClipOval(
        child: CachedNetworkImage(
          imageUrl: imageUrl!,
          width: d,
          height: d,
          fit: BoxFit.cover,
          memCacheWidth: cacheSize,
          memCacheHeight: cacheSize,
          fadeInDuration: const Duration(milliseconds: 150),
          fadeOutDuration: Duration.zero,
          placeholder: (context, url) => _fallback(context, d),
          errorWidget: (context, url, error) {
            logWarning('[AppAvatar] failed: $url ($error)');
            return _fallback(context, d);
          },
        ),
      );
    }

    return _fallback(context, d);
  }

  Widget _fallback(BuildContext context, double d) => Text(
    _initials,
    style: AppTypography.chipLabel(
      context,
    ).copyWith(fontSize: size.fontSize, color: context.colors.primaryOnSurface),
  );
}
