part of '../create_activity_screen.dart';

class _CheckRow extends StatelessWidget {
  const _CheckRow(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(
          Icons.check_circle_rounded,
          size: 20,
          color: context.colors.successText,
        ),
        const SizedBox(width: AppSpacing.x2),
        Expanded(
          child: Text(
            text,
            style: AppTypography.bodyMedium(
              context,
            ).copyWith(color: context.colors.textPrimary),
          ),
        ),
      ],
    );
  }
}

// ───────────────────────────────────────────────────────────────────────────── Setting card (step 1 rows).

class _SettingCard extends StatelessWidget {
  const _SettingCard({
    required this.icon,
    required this.label,
    this.value,
    this.trailing,
    this.onTap,
    this.error,
  });

  final IconData icon;
  final String label;
  final Widget? value;
  final Widget? trailing;
  final VoidCallback? onTap;

  /// Inline validation message.
  final String? error;

  @override
  Widget build(BuildContext context) {
    final card = Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.x3),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.x4,
        vertical: AppSpacing.x3,
      ),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(
          color: error != null
              ? context.colors.errorText
              : context.colors.border,
          width: error != null ? 1.5 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _IconBox(icon),
              const SizedBox(width: AppSpacing.x3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label, style: AppTypography.metaSub(context)),
                    if (value != null) ...[const SizedBox(height: 2), value!],
                  ],
                ),
              ),
              if (trailing != null) ...[
                const SizedBox(width: AppSpacing.x2),
                trailing!,
              ],
            ],
          ),
          if (error != null) ...[
            const SizedBox(height: AppSpacing.x2),
            Text(
              error!,
              style: AppTypography.metaSub(context).copyWith(
                color: context.colors.errorText,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ],
      ),
    );

    if (onTap == null) return card;
    return PressableScale(onTap: onTap, child: card);
  }
}

class _IconBox extends StatelessWidget {
  const _IconBox(this.icon);
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: context.colors.primarySoft,
        borderRadius: BorderRadius.circular(AppRadius.input),
      ),
      alignment: Alignment.center,
      child: Icon(icon, size: 19, color: context.colors.primaryOnSurface),
    );
  }
}

// ───────────────────────────────────────────────────────────────────────────── Cover photo uploader.

class _FieldLabel extends StatelessWidget {
  const _FieldLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) =>
      Text(text, style: AppTypography.labelField(context));
}

const double _kLabelGap = 6;

TextStyle _inputStyle(BuildContext context) => AppTypography.bodyFormSecondary(
  context,
).copyWith(color: context.colors.textPrimary);

InputDecoration _dec(BuildContext context, String hint) => InputDecoration(
  hintText: hint,
  hintStyle: AppTypography.bodyFormSecondary(
    context,
  ).copyWith(color: context.colors.textTertiary),
  // No fill — the field blends into its white setting card.
  filled: false,
  border: InputBorder.none,
  enabledBorder: InputBorder.none,
  focusedBorder: InputBorder.none,
  isDense: true,
  contentPadding: EdgeInsets.zero,
);

/// Stepper button — decrement is a neutral outlined circle, increment is a filled `primarySoft` circle.

class _CounterBtn extends StatelessWidget {
  const _CounterBtn({
    required this.icon,
    required this.enabled,
    required this.onTap,
    required this.emphasised,
    required this.semanticLabel,
  });

  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;
  final bool emphasised;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    final Color fill;
    final Color iconColor;
    final BoxBorder? border;

    if (!enabled) {
      fill = context.colors.surfaceSubtle;
      iconColor = context.colors.textTertiary;
      border = Border.all(color: context.colors.border);
    } else if (emphasised) {
      fill = context.colors.primarySoft;
      iconColor = context.colors.primaryOnSurface;
      border = null;
    } else {
      fill = context.colors.surfaceSubtle;
      iconColor = context.colors.textPrimary;
      border = Border.all(color: context.colors.border);
    }

    return Semantics(
      button: true,
      enabled: enabled,
      label: semanticLabel,
      child: PressableScale(
        onTap: enabled ? onTap : null,
        child: SizedBox(
          width: 44,
          height: 44,
          child: Center(
            child: Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: fill,
                border: border,
              ),
              alignment: Alignment.center,
              child: Icon(icon, size: 16, color: iconColor),
            ),
          ),
        ),
      ),
    );
  }
}

/// Whole price block in one clean card: amount field on top, min stepper below the divider.
/// The amount reads like a payment app (32 px ExtraBold, primary `$`) instead of a plain small text row.

class _ChoiceCard extends StatelessWidget {
  const _ChoiceCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final accent = selected ? c.primaryOnSurface : c.textSecondary;
    return Semantics(
      button: true,
      selected: selected,
      label: title,
      child: PressableScale(
        onTap: onTap,
        child: AnimatedContainer(
          duration: AppDurations.fast,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.x4,
            vertical: AppSpacing.x3,
          ),
          decoration: BoxDecoration(
            color: selected ? c.primarySoft : c.surface,
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(
              color: selected ? c.primaryOnSurface : c.border,
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              Icon(icon, size: 22, color: accent),
              const SizedBox(width: AppSpacing.x3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppTypography.bodyMedium(context).copyWith(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: selected ? c.primaryOnSurface : c.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      subtitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.metaSub(context),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
