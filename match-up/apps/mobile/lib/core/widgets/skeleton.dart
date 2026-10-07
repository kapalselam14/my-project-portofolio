import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';
import '../theme/dark_colors.dart';

/// A single shimmering skeleton block.
class SkeletonBox extends StatefulWidget {
  const SkeletonBox({super.key, this.width, this.height = 16, this.radius = 8});

  final double? width;
  final double height;
  final double radius;

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: AppDurations.shimmer,
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        // Sweep runs from -1.5..1.5 so the highlight band fully enters and exits the box rather than snapping.
        final t = _controller.value;
        final start = -1.5 + 3.0 * t;
        return ShaderMask(
          blendMode: BlendMode.srcATop,
          shaderCallback: (rect) {
            return LinearGradient(
              begin: Alignment(start - 0.5, 0),
              end: Alignment(start + 0.5, 0),
              colors: [
                context.colors.surfaceSubtle,
                context.colors.surfaceMuted,
                context.colors.surfaceSubtle,
              ],
            ).createShader(rect);
          },
          child: Container(
            width: widget.width,
            height: widget.height,
            decoration: BoxDecoration(
              color: context.colors.surfaceSubtle,
              borderRadius: BorderRadius.circular(widget.radius),
              border: Border.all(color: context.colors.border),
            ),
          ),
        );
      },
    );
  }
}

/// Skeleton mirroring the discovery activity card silhouette.
class ActivityCardSkeleton extends StatelessWidget {
  const ActivityCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.xl),
        border: Border.all(color: context.colors.border),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              SkeletonBox(width: 40, height: 40, radius: 12),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SkeletonBox(width: 160, height: 14),
                    SizedBox(height: 8),
                    SkeletonBox(width: 100, height: 10),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          const SkeletonBox(width: double.infinity, height: 200, radius: 16),
          const SizedBox(height: 20),
          const SkeletonBox(width: 220, height: 18),
          const SizedBox(height: 12),
          const SkeletonBox(width: 150, height: 12),
          const SizedBox(height: 20),
          const Row(
            children: [
              SkeletonBox(width: 90, height: 28, radius: 100),
              SizedBox(width: 8),
              SkeletonBox(width: 70, height: 28, radius: 100),
            ],
          ),
        ],
      ),
    );
  }
}

/// Skeleton for a compact list row — avatar/thumbnail + two lines of text.
class ListRowSkeleton extends StatelessWidget {
  const ListRowSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(horizontal: 20, vertical: 10),
      child: Row(
        children: [
          SkeletonBox(width: 44, height: 44, radius: 12),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBox(width: 180, height: 14),
                SizedBox(height: 8),
                SkeletonBox(width: 120, height: 10),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Skeleton for the My Activities compact card shape — thumbnail, chip row, title, meta row.
class ActivityListCardSkeleton extends StatelessWidget {
  const ActivityListCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    // Mirrors _CompactCard (My Games) exactly: x3 outer padding, 72px thumbnail, x3 gaps.
    return Container(
      padding: const EdgeInsets.all(AppSpacing.x3),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: context.colors.border),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SkeletonBox(width: 72, height: 72, radius: 14),
          SizedBox(width: AppSpacing.x3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    SkeletonBox(width: 70, height: 20, radius: 100),
                    Spacer(),
                    SkeletonBox(width: 60, height: 20, radius: 100),
                  ],
                ),
                SizedBox(height: AppSpacing.x2),
                SkeletonBox(width: 180, height: 15),
                SizedBox(height: AppSpacing.x2),
                SkeletonBox(width: 140, height: 12),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Renders [count] [ListRowSkeleton] items as a loading placeholder for scrollable lists.
class SkeletonList extends StatelessWidget {
  const SkeletonList({super.key, this.count = 5});

  final int count;

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.x5,
        vertical: AppSpacing.x2,
      ),
      physics: const NeverScrollableScrollPhysics(),
      itemCount: count,
      itemBuilder: (_, _) => const Padding(
        padding: EdgeInsets.only(bottom: AppSpacing.x3),
        child: ListRowSkeleton(),
      ),
    );
  }
}
