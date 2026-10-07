part of '../create_activity_screen.dart';

class _StepProgressBar extends StatelessWidget {
  const _StepProgressBar({required this.step});
  final int step;

  @override
  Widget build(BuildContext context) {
    final fraction = switch (step) {
      0 => 1 / 3,
      1 => 2 / 3,
      _ => 1.0,
    };
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.x5,
        0,
        AppSpacing.x5,
        AppSpacing.x3,
      ),
      child: ClipRRect(
        borderRadius: AppRadius.pillR,
        child: SizedBox(
          height: 5,
          child: Stack(
            children: [
              Positioned.fill(
                child: ColoredBox(color: context.colors.surfaceMuted),
              ),
              FractionallySizedBox(
                alignment: Alignment.centerLeft,
                widthFactor: fraction,
                child: const ColoredBox(color: AppColors.primary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StepHeading extends StatelessWidget {
  const _StepHeading({required this.title, required this.subtitle});
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: AppTypography.headlineSmall(context)),
        const SizedBox(height: 4),
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

/// Primary CTA with a small helper caption beneath it (steps 1 & 2).

class _PrimaryCta extends StatelessWidget {
  const _PrimaryCta({
    required this.label,
    required this.subtitle,
    required this.onPressed,
  });

  final String label;
  final String subtitle;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AppButton(label: label, onPressed: onPressed),
        const SizedBox(height: 6),
        Text(subtitle, style: AppTypography.metaSub(context)),
      ],
    );
  }
}

class _TipNote extends StatelessWidget {
  const _TipNote(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.x3),
      decoration: BoxDecoration(
        color: context.colors.surfaceSubtle,
        borderRadius: BorderRadius.circular(AppRadius.input),
      ),
      child: Row(
        children: [
          Icon(
            Icons.lightbulb_outline_rounded,
            size: 18,
            color: AppColors.accent,
          ),
          const SizedBox(width: AppSpacing.x2),
          Expanded(child: Text(text, style: AppTypography.metaSub(context))),
        ],
      ),
    );
  }
}
