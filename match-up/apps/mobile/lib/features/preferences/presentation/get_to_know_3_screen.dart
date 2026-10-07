import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/providers/profile_providers.dart';
import '../../../core/providers/repository_providers.dart';
import '../../../core/storage/secure_token_store.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/pill_buttons.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../tour/presentation/tour_controller.dart';
import 'get_to_know_1_screen.dart' show OnboardingProgressHeader;

/// Final onboarding step — collects the physical details on [UserModel].
/// Best-practice notes (why this looks different from a naive form): Sensible defaults (175 cm / 70 kg / 25 yrs ago).
class GetToKnow3Screen extends ConsumerStatefulWidget {
  const GetToKnow3Screen({super.key});

  @override
  ConsumerState<GetToKnow3Screen> createState() => _GetToKnow3ScreenState();
}

class _GetToKnow3ScreenState extends ConsumerState<GetToKnow3Screen> {
  static const _minHeight = 100;
  static const _maxHeight = 250;
  static const _minWeight = 30;
  static const _maxWeight = 200;
  static const _minYear = 1940;

  /// 13+ to hold an account.
  static DateTime get _maxDob {
    final now = DateTime.now();
    return DateTime(now.year - 13, now.month, now.day);
  }

  int _heightCm = 175;
  int _weightKg = 70;

  /// Sensible default (25 yrs ago) — always valid, user adjusts if needed.
  late DateTime _dob = DateTime(
    DateTime.now().year - 25,
    DateTime.now().month,
    DateTime.now().day,
  );

  bool _saving = false;

  int get _ageYears {
    final now = DateTime.now();
    var age = now.year - _dob.year;
    if (now.month < _dob.month ||
        (now.month == _dob.month && now.day < _dob.day)) {
      age -= 1;
    }
    return age;
  }

  Future<void> _pickDob() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _dob,
      firstDate: DateTime(_minYear),
      lastDate: _maxDob,
    );
    if (picked != null && mounted) {
      setState(() => _dob = picked);
    }
  }

  Future<void> _onNext() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      await ref
          .read(userRepositoryProvider)
          .updateProfile(
            heightCm: _heightCm,
            weightKg: _weightKg,
            dateOfBirth: _dob,
          );
      ref.invalidate(myProfileProvider);
      // Onboarding complete — splash must not resume GTK on next cold start.
      try {
        final prefs = await SharedPreferences.getInstance();
        final uid = await SecureTokenStore.instance
            .readUserId()
            // A hung Keystore read must not pin the onboarding flow on "Saving…" — fail open after a bounded wait.
            .timeout(const Duration(seconds: 3));
        if (uid != null && uid.isNotEmpty) {
          await prefs.setBool(gtkDoneKeyFor(uid), true);
        }
      } catch (_) {
        // Fail-open: next splash treats missing as done for old accounts, and new accounts will simply resume GTK.
      }
      if (!mounted) return;
      // Arm the first-run tour for the next Discovery visit.
      ref.read(tourControllerProvider.notifier).armFirstRun();
      context.go('/discovery');
    } catch (_) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: 'Could not save your details. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return AppScaffold(
      showHomeIndicator: true,
      backgroundColor: context.colors.surface,
      body: Column(
        children: [
          OnboardingProgressHeader(step: 3, total: 3),

          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.x5,
                AppSpacing.x4,
                AppSpacing.x5,
                AppSpacing.x5,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Almost done — a few quick details',
                    style: AppTypography.titleScreen(context),
                  ),
                  const SizedBox(height: AppSpacing.x2),
                  Text(
                    'Helps us match you with the right games. Defaults are set — adjust what\'s wrong.',
                    style: AppTypography.bodyMedium(
                      context,
                    ).copyWith(color: context.colors.textSecondary),
                  ),
                  const SizedBox(height: AppSpacing.x5),

                  _MeasureCard(
                    icon: Icons.straighten_rounded,
                    label: 'Height',
                    displayValue: '$_heightCm',
                    unit: 'cm',
                    onDecrease: _heightCm > _minHeight
                        ? () => setState(() => _heightCm -= 1)
                        : null,
                    onIncrease: _heightCm < _maxHeight
                        ? () => setState(() => _heightCm += 1)
                        : null,
                    decreaseLabel: 'Decrease height',
                    increaseLabel: 'Increase height',
                  ),
                  const SizedBox(height: AppSpacing.x3),

                  _MeasureCard(
                    icon: Icons.monitor_weight_outlined,
                    label: 'Weight',
                    displayValue: '$_weightKg',
                    unit: 'kg',
                    onDecrease: _weightKg > _minWeight
                        ? () => setState(() => _weightKg -= 1)
                        : null,
                    onIncrease: _weightKg < _maxWeight
                        ? () => setState(() => _weightKg += 1)
                        : null,
                    decreaseLabel: 'Decrease weight',
                    increaseLabel: 'Increase weight',
                  ),
                  const SizedBox(height: AppSpacing.x3),

                  _DobCard(date: _dob, ageYears: _ageYears, onTap: _pickDob),
                ],
              ),
            ),
          ),

          // Pinned CTA (same chrome as step 2).
          Container(
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: context.colors.border)),
            ),
            padding: EdgeInsets.fromLTRB(
              AppSpacing.x5,
              AppSpacing.x4,
              AppSpacing.x5,
              bottomPad + AppSpacing.x3,
            ),
            child: PrimaryPillButton(
              label: _saving ? 'Saving…' : 'Complete Profile',
              onPressed: _saving ? null : _onNext,
            ),
          ),
        ],
      ),
    );
  }
}

// Measure card (height weight).

/// Uniform stepper card: label + unit header, − / big value / + row.
class _MeasureCard extends StatelessWidget {
  const _MeasureCard({
    required this.icon,
    required this.label,
    required this.displayValue,
    required this.unit,
    required this.onDecrease,
    required this.onIncrease,
    required this.decreaseLabel,
    required this.increaseLabel,
  });

  final IconData icon;
  final String label;
  final String displayValue;
  final String unit;
  final VoidCallback? onDecrease;
  final VoidCallback? onIncrease;
  final String decreaseLabel;
  final String increaseLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.x4),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: context.colors.divider),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: context.colors.primarySoft,
                  borderRadius: BorderRadius.circular(AppRadius.input),
                ),
                alignment: Alignment.center,
                child: Icon(
                  icon,
                  size: 19,
                  color: context.colors.primaryOnSurface,
                ),
              ),
              const SizedBox(width: AppSpacing.x3),
              Text(
                label,
                style: AppTypography.labelField(
                  context,
                ).copyWith(fontSize: 15, fontWeight: FontWeight.w700),
              ),
              const Spacer(),
              Text(
                unit,
                style: AppTypography.bodyMedium(
                  context,
                ).copyWith(color: context.colors.textSecondary),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.x3),
          Row(
            children: [
              _StepButton(
                icon: Icons.remove_rounded,
                enabled: onDecrease != null,
                emphasised: false,
                onTap: onDecrease ?? () {},
                semanticLabel: decreaseLabel,
              ),
              Expanded(
                child: Text(
                  displayValue,
                  textAlign: TextAlign.center,
                  style: AppTypography.titleScreen(context).copyWith(
                    fontSize: 28,
                    fontWeight: FontWeight.w800,
                    color: context.colors.primaryOnSurface,
                  ),
                ),
              ),
              _StepButton(
                icon: Icons.add_rounded,
                enabled: onIncrease != null,
                emphasised: true,
                onTap: onIncrease ?? () {},
                semanticLabel: increaseLabel,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// Date of birth card.

/// One tappable row opening the native date picker.
class _DobCard extends StatelessWidget {
  const _DobCard({
    required this.date,
    required this.ageYears,
    required this.onTap,
  });

  final DateTime date;
  final int ageYears;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Change date of birth',
      child: PressableScale(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.x4),
          decoration: BoxDecoration(
            color: context.colors.surface,
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(color: context.colors.divider),
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: context.colors.primarySoft,
                  borderRadius: BorderRadius.circular(AppRadius.input),
                ),
                alignment: Alignment.center,
                child: Icon(
                  Icons.calendar_today_outlined,
                  size: 19,
                  color: context.colors.primaryOnSurface,
                ),
              ),
              const SizedBox(width: AppSpacing.x3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Date of Birth',
                      style: AppTypography.labelField(
                        context,
                      ).copyWith(fontSize: 15, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      DateFormat('d MMMM yyyy').format(date),
                      style: AppTypography.bodyMedium(
                        context,
                      ).copyWith(color: context.colors.textSecondary),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.x3,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: context.colors.primarySoft,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                child: Text(
                  '$ageYears yrs',
                  style: AppTypography.chipLabel(
                    context,
                  ).copyWith(color: context.colors.primaryOnSurface),
                ),
              ),
              const SizedBox(width: AppSpacing.x2),
              Icon(
                Icons.chevron_right_rounded,
                size: 20,
                color: context.colors.textTertiary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StepButton extends StatelessWidget {
  const _StepButton({
    required this.icon,
    required this.enabled,
    required this.emphasised,
    required this.onTap,
    required this.semanticLabel,
  });

  final IconData icon;
  final bool enabled;

  /// The `+` button carries a primary-tinted border in the design; `−` is plain grey.
  final bool emphasised;
  final VoidCallback onTap;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    final tint = emphasised
        ? context.colors.primaryOnSurface
        : context.colors.textSecondary;
    return Semantics(
      button: true,
      label: semanticLabel,
      enabled: enabled,
      child: PressableScale(
        onTap: enabled ? onTap : null,
        child: Opacity(
          opacity: enabled ? 1 : 0.4,
          child: Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: emphasised
                    ? context.colors.primaryOnSurface
                    : context.colors.divider,
              ),
            ),
            alignment: Alignment.center,
            child: Icon(icon, size: 20, color: tint),
          ),
        ),
      ),
    );
  }
}
