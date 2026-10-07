part of '../edit_activity_screen.dart';

/// ✕ button that cancels the edit — same 44px circle treatment as the standard back button so the header keeps its.
class _CloseButton extends StatelessWidget {
  const _CloseButton({required this.onPressed});
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Close',
      child: PressableScale(
        onTap: () {
          HapticFeedback.lightImpact();
          onPressed();
        },
        child: SizedBox(
          width: 44,
          height: 44,
          child: Center(
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: context.colors.surfaceSubtle,
                borderRadius: BorderRadius.circular(AppRadius.pill),
                border: Border.all(color: context.colors.border),
              ),
              child: Icon(
                Icons.close_rounded,
                size: 18,
                color: context.colors.textPrimary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Trailing "Save" text action — mirrors `AppScaffold.sheet`'s trailing slot.

/// Trailing "Save" text action — mirrors `AppScaffold.sheet`'s trailing slot.
class _SaveAction extends StatelessWidget {
  const _SaveAction({required this.enabled, required this.onTap});
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Save',
      enabled: enabled,
      child: PressableScale(
        onTap: enabled ? onTap : null,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.x2,
            vertical: AppSpacing.x3,
          ),
          child: Text(
            'Save',
            style: AppTypography.labelField(context).copyWith(
              color: enabled
                  ? context.colors.primaryOnSurface
                  : context.colors.textTertiary,
            ),
          ),
        ),
      ),
    );
  }
}

class _SectionHeading extends StatelessWidget {
  const _SectionHeading({required this.title, required this.subtitle});
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: AppTypography.titleMedium(context)),
        const SizedBox(height: 2),
        Text(
          subtitle,
          style: AppTypography.bodyMedium(
            context,
          ).copyWith(color: context.colors.textSecondary),
        ),
      ],
    );
  }
}
