part of '../edit_profile_screen.dart';

class _SportEntry {
  const _SportEntry({required this.name, required this.level});
  final String name;

  /// 0 = Beginner, 1 = Intermediate, 2 = Advanced
  final int level;
}

class _SportCard extends StatelessWidget {
  const _SportCard({
    required this.entry,
    required this.onLevelChanged,
    required this.onRemove,
  });
  final _SportEntry entry;
  final ValueChanged<int> onLevelChanged;
  final VoidCallback onRemove;

  static const _levels = ['Beginner', 'Intermediate', 'Advanced'];

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.x3),
      decoration: BoxDecoration(
        color: context.colors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: context.colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  entry.name,
                  style: AppTypography.labelField(
                    context,
                  ).copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              AppTappable(
                semanticLabel: 'Remove ${entry.name}',
                feedback: AppTapFeedback.scale,
                minSize: 32,
                onTap: onRemove,
                child: Container(
                  width: 26,
                  height: 26,
                  decoration: BoxDecoration(
                    color: context.colors.surface,
                    shape: BoxShape.circle,
                    border: Border.all(color: context.colors.border),
                  ),
                  child: Icon(
                    Icons.close_rounded,
                    size: 14,
                    color: context.colors.textTertiary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.x2),
          // Level segmented toggle
          Container(
            height: 36,
            decoration: BoxDecoration(
              color: context.colors.surface,
              borderRadius: BorderRadius.circular(AppRadius.pill),
              border: Border.all(color: context.colors.border),
            ),
            child: Row(
              children: List.generate(_levels.length, (i) {
                final selected = i == entry.level;
                return Expanded(
                  child: PressableScale(
                    onTap: () => onLevelChanged(i),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      curve: Curves.easeOut,
                      margin: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        gradient: selected
                            ? const LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [
                                  AppColors.primary,
                                  AppColors.primaryDark,
                                ],
                              )
                            : null,
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                        boxShadow: selected ? AppShadows.glowPrimary : null,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        _levels[i],
                        style: AppTypography.metaSub(context).copyWith(
                          fontSize: 11,
                          color: selected
                              ? AppColors.textOnPrimary
                              : context.colors.textSecondary,
                          fontWeight: selected
                              ? FontWeight.w700
                              : FontWeight.w500,
                        ),
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),
        ],
      ),
    );
  }
}

// Save bar.
