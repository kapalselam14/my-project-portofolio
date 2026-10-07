import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/repository_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/utils/nav_guard.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/app_tappable.dart';
import '../../../core/widgets/pill_buttons.dart';
import '../../../core/widgets/pressable_scale.dart';

class GetToKnow1Screen extends ConsumerStatefulWidget {
  const GetToKnow1Screen({super.key});

  @override
  ConsumerState<GetToKnow1Screen> createState() => _GetToKnow1ScreenState();
}

class _GetToKnow1ScreenState extends ConsumerState<GetToKnow1Screen> {
  /// Null until the user picks an option — nothing is pre-selected.
  int? _selected;
  bool _saving = false;

  static const _options = [
    ('Stay active with new sports', Icons.directions_run_rounded),
    ('Build consistent workout habits', Icons.fitness_center_rounded),
    ('Find a motivating sports community', Icons.group_rounded),
    ('Meet new sports partners', Icons.handshake_rounded),
    ('Other reasons', Icons.more_horiz_rounded),
  ];

  /// Persists the selected reason to the backend profile before advancing.
  Future<void> _onNext() async {
    final selected = _selected;
    if (selected == null || _saving) return;
    setState(() => _saving = true);
    try {
      await ref
          .read(userRepositoryProvider)
          .updateProfile(joinReason: _options[selected].$1);
      if (!mounted) return;
      // Guarded: double-tap would push two /get-to-know-2 pages with the same Page key →.
      NavGuard.push(context, '/get-to-know-2');
    } catch (_) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: 'Could not save your answer. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      // Outside ShellRoute (post-signup flow, no tab bar) — draws its own.
      showHomeIndicator: true,
      body: Column(
        children: [
          OnboardingProgressHeader(step: 1, total: 3, showBack: false),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.x6,
                AppSpacing.x6,
                AppSpacing.x6,
                0,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "What's your primary\nreason for joining MatchUp?",
                    style: AppTypography.titleScreen(context),
                  ),
                  const SizedBox(height: AppSpacing.x3),
                  Text(
                    'Pick one that resonates most.',
                    style: AppTypography.bodyMedium(
                      context,
                    ).copyWith(color: context.colors.textSecondary),
                  ),
                  const SizedBox(height: AppSpacing.x5),
                  Expanded(
                    child: ListView.separated(
                      itemCount: _options.length,
                      separatorBuilder: (_, _) =>
                          const SizedBox(height: AppSpacing.x3),
                      itemBuilder: (_, i) => _OptionTile(
                        icon: _options[i].$2,
                        label: _options[i].$1,
                        selected: i == _selected,
                        onTap: () => setState(() => _selected = i),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.x4),
                  PrimaryPillButton(
                    label: 'Next',
                    onPressed: (_selected == null || _saving) ? null : _onNext,
                  ),
                  const SizedBox(height: AppSpacing.x5),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Shared widgets used by both get-to-know screens ─────────────────────────

/// Minimal step progress bar shown across all onboarding steps.
class OnboardingProgressHeader extends StatelessWidget {
  const OnboardingProgressHeader({
    super.key,
    required this.step,
    required this.total,
    this.showBack = true,
  });

  final int step;
  final int total;

  /// False on step 1: it is reached via go() (register / onboarding).
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.x5,
        AppSpacing.x3,
        AppSpacing.x5,
        AppSpacing.x2,
      ),
      child: Column(
        children: [
          Row(
            children: [
              if (showBack)
                Semantics(
                  button: true,
                  label: 'Back',
                  child: PressableScale(
                    onTap: () => Navigator.of(context).maybePop(),
                    child: SizedBox(
                      width: 40,
                      height: 40,
                      child: Icon(
                        Icons.arrow_back_ios_new_rounded,
                        size: 18,
                        color: context.colors.textPrimary,
                      ),
                    ),
                  ),
                )
              else
                const SizedBox(width: 40, height: 40),
              Expanded(
                child: Text(
                  "LET'S GET TO KNOW YOU",
                  textAlign: TextAlign.center,
                  style: AppTypography.caption(context).copyWith(
                    color: context.colors.primaryOnSurface,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.0,
                    fontSize: 11,
                  ),
                ),
              ),
              // Step counter — grey pill badge, as in the mock.
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: context.colors.surfaceMuted,
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                child: Text(
                  '$step/$total',
                  style: AppTypography.caption(context).copyWith(
                    color: context.colors.textSecondary,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.x3),
          // Step progress bar
          ClipRRect(
            borderRadius: AppRadius.pillR,
            child: LinearProgressIndicator(
              value: step / total,
              minHeight: 6,
              backgroundColor: context.colors.border,
              valueColor: const AlwaysStoppedAnimation(AppColors.primary),
            ),
          ),
        ],
      ),
    );
  }
}

class _OptionTile extends StatelessWidget {
  const _OptionTile({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AppTappable(
      semanticLabel: label,
      minSize: 0,
      borderRadius: AppRadius.lg,
      onTap: onTap,
      child: AnimatedContainer(
        duration: AppDurations.fast,
        curve: Curves.easeOut,
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.x5,
          vertical: AppSpacing.x4,
        ),
        decoration: BoxDecoration(
          color: selected ? context.colors.primarySoft : context.colors.surface,
          borderRadius: AppRadius.lgR,
          border: Border.all(
            color: selected ? AppColors.primary : context.colors.border,
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: selected
                    ? AppColors.primary
                    : context.colors.surfaceSubtle,
                borderRadius: AppRadius.mdR,
              ),
              child: Icon(
                icon,
                size: 20,
                color: selected
                    ? AppColors.textOnPrimary
                    : context.colors.textSecondary,
              ),
            ),
            const SizedBox(width: AppSpacing.x3),
            Expanded(
              child: Text(
                label,
                style: AppTypography.bodyMedium(context).copyWith(
                  color: context.colors.textPrimary,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                  fontSize: 15,
                ),
              ),
            ),
            // Radio dot
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? AppColors.primary : Colors.transparent,
                border: Border.all(
                  color: selected
                      ? AppColors.primary
                      : context.colors.borderInput,
                  width: 2,
                ),
              ),
              child: selected
                  ? const Icon(
                      Icons.check_rounded,
                      size: 13,
                      color: AppColors.textOnPrimary,
                    )
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}
