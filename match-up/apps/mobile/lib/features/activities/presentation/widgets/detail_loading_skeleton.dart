import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/dark_colors.dart';
import '../../../../core/widgets/app_scaffold.dart';
import '../../../../core/widgets/pressable_scale.dart';
import '../../../../core/widgets/skeleton.dart';

/// Shared loading skeleton for every activity detail screen (unjoined, joined, manage, pending-request, full view).
/// The back button pops when possible (with a Discover fallback for deep-link/stack-root entries): loading must.
class DetailLoadingSkeleton extends StatelessWidget {
  const DetailLoadingSkeleton({super.key, this.bottomBar = true});

  /// False for detail variants without a bottom action bar.
  final bool bottomBar;

  static const double heroHeight = 280;
  static const double overlap = 44;

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      safeAreaTop: false,
      bottomBar: bottomBar
          ? Container(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.x5,
                AppSpacing.x3,
                AppSpacing.x5,
                AppSpacing.x3,
              ),
              child: const SkeletonBox(
                width: double.infinity,
                height: 54,
                radius: 28,
              ),
            )
          : null,
      body: Stack(
        children: [
          // Layer 1: hero, same fixed height as every real detail.
          const SizedBox(
            height: heroHeight,
            width: double.infinity,
            child: SkeletonBox(width: double.infinity, height: 280, radius: 0),
          ),

          // Layer 2: white sheet overlapping the hero, same geometry (rounded top, sheet shadow) as the real cards.
          Positioned(
            top: heroHeight - overlap,
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              decoration: BoxDecoration(
                color: context.colors.surface,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(AppRadius.card),
                ),
                boxShadow: AppShadows.sheet,
              ),
              child: const SingleChildScrollView(
                physics: NeverScrollableScrollPhysics(),
                padding: EdgeInsets.fromLTRB(
                  AppSpacing.x5,
                  AppSpacing.x5,
                  AppSpacing.x5,
                  AppSpacing.x8,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SkeletonBox(width: double.infinity, height: 32, radius: 6),
                    SizedBox(height: AppSpacing.x5),
                    ListRowSkeleton(),
                    SizedBox(height: AppSpacing.x3),
                    ListRowSkeleton(),
                  ],
                ),
              ),
            ),
          ),

          // Layer 3: back + share affordances, same SafeArea row as real.
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.x5,
                  vertical: AppSpacing.x2,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _SkeletonCircleBtn(label: 'Back', pop: true),
                    _SkeletonCircleBtn(label: 'Share', pop: false),
                  ],
                ),
              ),
            ),
          ),

          // Layer 4: pill placeholders where sport/skill pills sit.
          const Positioned(
            left: AppSpacing.x5,
            bottom: AppSpacing.x4 + 20 + 20,
            child: Row(
              children: [
                SkeletonBox(width: 84, height: 28, radius: 6),
                SizedBox(width: AppSpacing.x2),
                SkeletonBox(width: 110, height: 28, radius: 6),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Circular skeleton button.
class _SkeletonCircleBtn extends StatelessWidget {
  const _SkeletonCircleBtn({required this.label, required this.pop});
  final String label;
  final bool pop;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: PressableScale(
        onTap: pop
            ? () async {
                if (!(await Navigator.of(context).maybePop())) {
                  if (context.mounted) context.go('/discovery');
                }
              }
            : null,
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: context.colors.scrim,
            shape: BoxShape.circle,
          ),
        ),
      ),
    );
  }
}
