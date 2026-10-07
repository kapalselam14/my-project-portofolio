import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/repository_providers.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../data/report_repository.dart';
import 'report_evidence_picker.dart';
import 'report_sheet_widgets.dart';

/// Bottom sheet for reporting an activity — replaces the old full-screen
/// [ReportScreen] route. The route form crashed with `Navigator` assertion
/// `'!keyReservation.contains(key)'` when double-tapped or when two pushes
/// raced; a modal sheet sidesteps that because the bottom sheet is rendered
/// inside an [Overlay] (no [Page] lifecycle, no key reservation).
///
/// Design: keeps the existing info card + reason-list + submit button but
/// in a scrollable sheet that respects the keyboard. Reasons list shrinks
/// to 5 (most common — activity-specific), the "Other" free-form path is
/// handled by the optional details field instead of a dedicated tile.
class ReportActivitySheet extends ConsumerStatefulWidget {
  const ReportActivitySheet({
    super.key,
    required this.activityId,
    required this.activityTitle,
  });

  /// Backend activity id — sent as the report target. Never the title.
  final String activityId;
  final String activityTitle;

  /// Convenience launcher — handles the drag handle, scrollable body, and
  /// the dismiss-on-tap-outside semantics so call sites stay terse:
  ///
  /// ```dart
  /// showModalBottomSheet(
  ///   context: ctx,
  ///   isScrollControlled: true,
  ///   backgroundColor: Colors.transparent,
  ///   builder: (_) => ReportActivitySheet(
  ///     activityId: ...,
  ///     activityTitle: ...,
  ///   ),
  /// );
  /// ```
  static Future<void> show(
    BuildContext context, {
    required String activityId,
    required String activityTitle,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black54,
      builder: (_) => ReportActivitySheet(
        activityId: activityId,
        activityTitle: activityTitle,
      ),
    );
  }

  @override
  ConsumerState<ReportActivitySheet> createState() =>
      _ReportActivitySheetState();
}

class _ReportActivitySheetState extends ConsumerState<ReportActivitySheet> {
  final _detailsController = TextEditingController();
  String? _reason;
  bool _submitting = false;
  List<String> _evidenceUrls = [];
  bool _evidenceBusy = false;

  static const _reasons = [
    'Inappropriate content',
    'Spam / Fake activity',
    'Misleading information',
    'No-show host',
    'Other',
  ];

  @override
  void dispose() {
    _detailsController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_reason == null) {
      HapticFeedback.lightImpact();
      AppSnackbar.show(
        context,
        message: 'Please select a reason.',
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    if (_evidenceBusy) {
      AppSnackbar.show(
        context,
        message: 'Evidence is still uploading — please wait.',
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      await ref
          .read(reportRepositoryProvider)
          .submit(
            targetId: widget.activityId,
            targetType: ReportTargetType.activity,
            reason: _reason!,
            details: _detailsController.text.trim().isEmpty
                ? null
                : _detailsController.text.trim(),
            evidenceUrls: _evidenceUrls.isEmpty ? null : _evidenceUrls,
          );
    } catch (_) {
      // Surface the failure and keep the sheet open — a failed report
      // must never be presented as submitted.
      if (!mounted) return;
      setState(() => _submitting = false);
      AppSnackbar.show(
        context,
        message:
            'Could not submit report. Check your connection and try again.',
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    if (!mounted) return;
    setState(() => _submitting = false);
    Navigator.of(context).pop();
    AppSnackbar.show(
      context,
      message: 'Report submitted. Thank you.',
      variant: AppSnackbarVariant.success,
    );
  }

  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    return Padding(
      // Lift the sheet above the on-screen keyboard when the details field
      // is focused. `viewInsets.bottom` is the keyboard height.
      padding: EdgeInsets.only(bottom: mq.viewInsets.bottom),
      child: Container(
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(AppRadius.xl),
          ),
          boxShadow: AppShadows.sheet,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ReportSheetHeader(
              title: 'Report Activity',
              onClose: () => Navigator.of(context).pop(),
            ),
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.x5,
                  AppSpacing.x2,
                  AppSpacing.x5,
                  AppSpacing.x4,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ReportTargetCard(
                      heading: 'Reporting this activity',
                      targetName: widget.activityTitle,
                      icon: Icons.flag_rounded,
                    ),
                    const SizedBox(height: AppSpacing.x5),
                    Text(
                      "What's the issue?",
                      style: AppTypography.labelField(
                        context,
                      ).copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: AppSpacing.x3),
                    ReportReasonsCard(
                      reasons: _reasons,
                      selected: _reason,
                      onSelect: (r) => setState(() => _reason = r),
                    ),
                    const SizedBox(height: AppSpacing.x4),
                    ReportDetailsField(controller: _detailsController),
                    const SizedBox(height: AppSpacing.x4),
                    ReportEvidencePicker(
                      onChanged: (urls) => setState(() => _evidenceUrls = urls),
                      onBusyChanged: (busy) =>
                          setState(() => _evidenceBusy = busy),
                    ),
                    const SizedBox(height: AppSpacing.x4),
                    const ReportDisclaimer(),
                  ],
                ),
              ),
            ),
            ReportSubmitBar(submitting: _submitting, onSubmit: _submit),
          ],
        ),
      ),
    );
  }
}
