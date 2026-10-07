import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/network/api_client.dart';
import '../../../core/providers/auth_state_provider.dart';
import '../../../core/providers/repository_providers.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../domain/appeal_model.dart';

/// Interstitial for suspended accounts — the ONLY screen a suspended user can reach (see the router's auth redirect).
/// Best-practice notes, enforced here: The session stays alive: signing out would strand the user with no way back.
class SuspendedScreen extends ConsumerStatefulWidget {
  const SuspendedScreen({super.key});

  @override
  ConsumerState<SuspendedScreen> createState() => _SuspendedScreenState();
}

class _SuspendedScreenState extends ConsumerState<SuspendedScreen> {
  final _statementController = TextEditingController();

  bool _loading = true;
  bool _submitting = false;
  bool _checking = false;
  List<AppealModel> _appeals = [];

  static const _draftKey = 'appeal_draft';

  @override
  void initState() {
    super.initState();
    _statementController.addListener(_persistDraft);
    _loadDraft();
    _reload();
  }

  Future<void> _loadDraft() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final draft = prefs.getString(_draftKey);
      if (draft != null && draft.isNotEmpty && mounted) {
        _statementController.text = draft;
      }
    } catch (_) {
      // Fail-open: draft restore is best-effort.
    }
  }

  Future<void> _persistDraft() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_draftKey, _statementController.text);
    } catch (_) {
      // Best-effort only.
    }
  }

  Future<void> _clearDraft() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_draftKey);
    } catch (_) {
      // Best-effort only.
    }
  }

  @override
  void dispose() {
    _statementController.removeListener(_persistDraft);
    _statementController.dispose();
    super.dispose();
  }

  AppealModel? get _pending {
    try {
      return _appeals.firstWhere((a) => a.status == AppealStatus.pending);
    } catch (_) {
      return null;
    }
  }

  AppealModel? get _latestDecided {
    final decided = _appeals
        .where((a) => a.status != AppealStatus.pending)
        .toList();
    if (decided.isEmpty) return null;
    decided.sort(
      (a, b) => (b.decidedAt ?? DateTime.fromMillisecondsSinceEpoch(0))
          .compareTo(a.decidedAt ?? DateTime.fromMillisecondsSinceEpoch(0)),
    );
    return decided.first;
  }

  Future<void> _reload() async {
    setState(() => _loading = true);
    try {
      final appeals = await ref.read(appealRepositoryProvider).myAppeals();
      if (mounted) setState(() => _appeals = appeals);
    } on ApiException catch (e) {
      if (mounted && !e.isAccountSuspended) {
        AppSnackbar.show(
          context,
          message: e.userMessage,
          variant: AppSnackbarVariant.error,
        );
      }
      // Suspended-token errors are expected here (this IS the suspended screen).
    } catch (_) {
      if (mounted) {
        AppSnackbar.show(
          context,
          message: 'Could not load your appeals. Please try again.',
          variant: AppSnackbarVariant.error,
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    final statement = _statementController.text.trim();
    if (statement.isEmpty) {
      AppSnackbar.show(
        context,
        message: 'Please explain what happened before submitting.',
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    if (statement.length < 20) {
      AppSnackbar.show(
        context,
        message: 'Please write at least 20 characters so we can review.',
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    setState(() => _submitting = true);
    HapticFeedback.mediumImpact();
    try {
      final created = await ref
          .read(appealRepositoryProvider)
          .submitSuspensionAppeal(statement: statement);
      _statementController.clear();
      await _clearDraft();
      if (!mounted) return;
      setState(() => _appeals = [created, ..._appeals]);
      AppSnackbar.show(
        context,
        message: 'Appeal submitted. We\'ll notify you of the decision.',
        variant: AppSnackbarVariant.success,
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.statusCode == 409) {
        // A pending appeal already exists — show it instead of erroring.
        await _reload();
        if (!mounted) return;
        AppSnackbar.show(
          context,
          message: 'You already have an appeal under review.',
          variant: AppSnackbarVariant.info,
        );
      } else if (!e.isAccountSuspended) {
        AppSnackbar.show(
          context,
          message: e.userMessage,
          variant: AppSnackbarVariant.error,
        );
      }
    } catch (_) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: 'Could not submit your appeal. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _checkAgain() async {
    setState(() => _checking = true);
    try {
      final result = await ref
          .read(authStateProvider.notifier)
          .refreshSuspension();
      if (!mounted) return;
      switch (result) {
        case SuspensionCheck.clear:
          // Router redirect (suspended → authenticated) moves us along.
          AppSnackbar.show(
            context,
            message: 'Welcome back! Your account is active again.',
            variant: AppSnackbarVariant.success,
          );
        case SuspensionCheck.suspended:
          await _reload();
        case SuspensionCheck.unknown:
          AppSnackbar.show(
            context,
            message: "Couldn't reach the server. Check your connection.",
            variant: AppSnackbarVariant.error,
          );
      }
    } catch (_) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: "Couldn't reach the server. Check your connection.",
        variant: AppSnackbarVariant.error,
      );
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      showHomeIndicator: false,
      body: SafeArea(
        child: _loading
            ? Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const CircularProgressIndicator(),
                    const SizedBox(height: AppSpacing.x4),
                    Text(
                      'Checking your account…',
                      style: AppTypography.bodyMedium(
                        context,
                      ).copyWith(color: context.colors.textSecondary),
                    ),
                    const SizedBox(height: AppSpacing.x3),
                    TextButton(onPressed: _reload, child: const Text('Retry')),
                  ],
                ),
              )
            : ListView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.x5,
                  AppSpacing.x8,
                  AppSpacing.x5,
                  AppSpacing.x8,
                ),
                children: [
                  _HeaderIcon(),
                  const SizedBox(height: AppSpacing.x5),
                  Text(
                    'Your account is suspended',
                    style: AppTypography.headlineSmall(context),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.x2),
                  Text(
                    'You can\'t join or host activities right now. '
                    'If you believe this is a mistake, submit one appeal '
                    'below — our team reviews every appeal.',
                    style: AppTypography.bodyMedium(
                      context,
                    ).copyWith(color: context.colors.textSecondary),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.x5),
                  ..._statusSection(context),
                  const SizedBox(height: AppSpacing.x5),
                  AppButton(
                    label: 'Check again',
                    onPressed: _checking ? null : _checkAgain,
                    loading: _checking,
                  ),
                  const SizedBox(height: AppSpacing.x3),
                  Text(
                    'Stay signed in to appeal. '
                    'Your session is required to submit an appeal.',
                    style: AppTypography.metaSub(context),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
      ),
    );
  }

  List<Widget> _statusSection(BuildContext context) {
    final pending = _pending;
    if (pending != null) return [_PendingCard(appeal: pending)];

    final decided = _latestDecided;
    if (decided != null && decided.status == AppealStatus.rejected) {
      return [
        _DecisionCard(appeal: decided),
        const SizedBox(height: AppSpacing.x4),
        ..._appealForm(context, heading: 'Submit a new appeal'),
      ];
    }
    if (decided != null && decided.status == AppealStatus.approved) {
      return [
        _DecisionCard(appeal: decided),
        const SizedBox(height: AppSpacing.x4),
      ];
    }

    // No appeals yet — the form.
    return [
      _GuidelinesCard(),
      const SizedBox(height: AppSpacing.x4),
      ..._appealForm(context, heading: 'Your appeal'),
    ];
  }

  List<Widget> _appealForm(BuildContext context, {required String heading}) {
    return [
      Row(
        children: [
          Expanded(
            child: Text(heading, style: AppTypography.labelField(context)),
          ),
          // Live character count lives in the heading row: the default maxLength counter renders BELOW the field.
          ValueListenableBuilder<TextEditingValue>(
            valueListenable: _statementController,
            builder: (context, value, _) => Text(
              '${value.text.trim().length}/2000',
              style: AppTypography.metaSub(context),
            ),
          ),
        ],
      ),
      const SizedBox(height: 6),
      Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.x4,
          vertical: AppSpacing.x3,
        ),
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: BorderRadius.circular(AppRadius.input),
          border: Border.all(color: context.colors.border),
        ),
        child: TextField(
          controller: _statementController,
          style: AppTypography.bodyFormSecondary(
            context,
          ).copyWith(color: context.colors.textPrimary),
          maxLines: 5,
          minLines: 4,
          maxLength: 2000,
          // Hide the built-in counter (it renders outside the box); the count lives in the heading row above instead.
          buildCounter:
              (
                _, {
                required int currentLength,
                required bool isFocused,
                required int? maxLength,
              }) => null,
          decoration: InputDecoration.collapsed(
            hintText:
                'Explain what happened and why you believe this was a mistake…',
          ),
        ),
      ),
      const SizedBox(height: AppSpacing.x3),
      AppButton(
        label: 'Submit appeal',
        onPressed: _submitting ? null : _submit,
        loading: _submitting,
      ),
    ];
  }
}

class _HeaderIcon extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          color: context.colors.warningBg,
          shape: BoxShape.circle,
          border: Border.all(
            color: context.colors.warningText.withValues(alpha: 0.3),
          ),
        ),
        alignment: Alignment.center,
        child: Icon(
          Icons.gavel_outlined,
          size: 34,
          color: context.colors.warningText,
        ),
      ),
    );
  }
}

class _GuidelinesCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.x4),
      decoration: BoxDecoration(
        color: context.colors.surfaceSubtle,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: context.colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Make it count — you get one pending appeal',
            style: AppTypography.labelField(context),
          ),
          const SizedBox(height: AppSpacing.x2),
          for (final tip in const [
            'Say what happened, factually and briefly.',
            'Name the activity or message if you know what was flagged.',
            'Being polite goes further than protesting.',
          ])
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('•  ', style: AppTypography.bodyMedium(context)),
                  Expanded(
                    child: Text(
                      tip,
                      style: AppTypography.bodyMedium(
                        context,
                      ).copyWith(color: context.colors.textSecondary),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _PendingCard extends StatelessWidget {
  const _PendingCard({required this.appeal});
  final AppealModel appeal;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.x4),
      decoration: BoxDecoration(
        color: context.colors.primarySoft,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(
          color: context.colors.primaryOnSurface.withValues(alpha: 0.4),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.hourglass_top_rounded,
            color: context.colors.primaryOnSurface,
          ),
          const SizedBox(width: AppSpacing.x3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Appeal under review',
                  style: AppTypography.labelField(context),
                ),
                const SizedBox(height: 2),
                Text(
                  'We\'ll notify you as soon as there\'s a decision. '
                  'Submitting again won\'t speed things up.',
                  style: AppTypography.metaSub(context),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DecisionCard extends StatelessWidget {
  const _DecisionCard({required this.appeal});
  final AppealModel appeal;

  @override
  Widget build(BuildContext context) {
    final approved = appeal.status == AppealStatus.approved;
    final fg = approved ? context.colors.successText : context.colors.errorText;
    final bg = approved
        ? context.colors.statusSuccessBg
        : context.colors.errorLight;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.x4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: fg.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Icon(
            approved
                ? Icons.check_circle_outline_rounded
                : Icons.highlight_off_rounded,
            color: fg,
          ),
          const SizedBox(width: AppSpacing.x3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  approved ? 'Appeal approved' : 'Appeal not approved',
                  style: AppTypography.labelField(context),
                ),
                const SizedBox(height: 2),
                Text(
                  approved
                      ? 'Tap "Check again" below to get back in.'
                      : (appeal.adminNote != null &&
                            appeal.adminNote!.isNotEmpty)
                      ? 'Note from our team: ${appeal.adminNote}'
                      : 'Our decision is final for this appeal.',
                  style: AppTypography.metaSub(context),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
