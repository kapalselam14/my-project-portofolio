import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/repository_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/pressable_scale.dart';

/// Bottom sheet for creating a single-choice group-chat poll ("Play at 4 or 5?").
class PollCreateSheet extends ConsumerStatefulWidget {
  const PollCreateSheet({super.key, required this.activityId});
  final String activityId;

  static Future<bool?> show(
    BuildContext context, {
    required String activityId,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PollCreateSheet(activityId: activityId),
    );
  }

  @override
  ConsumerState<PollCreateSheet> createState() => _PollCreateSheetState();
}

class _PollCreateSheetState extends ConsumerState<PollCreateSheet> {
  static const _maxOptions = 6;
  static const _maxQuestionLength = 200;
  static const _maxOptionLength = 100;

  final _questionCtrl = TextEditingController();
  final _optionCtrls = [TextEditingController(), TextEditingController()];
  bool _saving = false;

  @override
  void dispose() {
    _questionCtrl.dispose();
    for (final c in _optionCtrls) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _create() async {
    if (_saving) return;
    final question = _questionCtrl.text.trim();
    final options = _optionCtrls
        .map((c) => c.text.trim())
        .where((o) => o.isNotEmpty)
        .toList();
    if (question.isEmpty || options.length < 2) {
      AppSnackbar.show(
        context,
        message: 'Add a question and at least 2 options.',
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    if (question.length > _maxQuestionLength) {
      AppSnackbar.show(
        context,
        message: 'Keep the question under $_maxQuestionLength characters.',
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    if (options.any((o) => o.length > _maxOptionLength)) {
      AppSnackbar.show(
        context,
        message: 'Keep each option under $_maxOptionLength characters.',
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    final seen = <String>{};
    final hasDuplicate = options.any((o) => !seen.add(o.toLowerCase()));
    if (hasDuplicate) {
      AppSnackbar.show(
        context,
        message: 'Options must be unique.',
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    setState(() => _saving = true);
    final pollId = await ref
        .read(chatRepositoryProvider)
        .createPoll(
          activityId: widget.activityId,
          question: question,
          options: options,
        );
    if (!mounted) return;
    if (pollId == null) {
      setState(() => _saving = false);
      AppSnackbar.show(
        context,
        message: 'Could not create the poll. Please try again.',
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        decoration: BoxDecoration(
          color: context.colors.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: EdgeInsets.fromLTRB(
          AppSpacing.x5,
          AppSpacing.x3,
          AppSpacing.x5,
          AppSpacing.x5 + MediaQuery.of(context).viewPadding.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: context.colors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.x3),
            Text('Create Poll', style: AppTypography.titleMedium(context)),
            const SizedBox(height: AppSpacing.x3),
            _SheetTextBox(
              controller: _questionCtrl,
              hint: 'What time shall we play? ⚽',
              label: 'QUESTION',
              maxLength: _maxQuestionLength,
            ),
            const SizedBox(height: AppSpacing.x3),
            Text(
              'OPTIONS (${_optionCtrls.length}/$_maxOptions)',
              style: AppTypography.metaSub(context).copyWith(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
              ),
            ),
            const SizedBox(height: 6),
            Flexible(
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    for (var i = 0; i < _optionCtrls.length; i++)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Row(
                          children: [
                            Expanded(
                              child: _SheetTextBox(
                                controller: _optionCtrls[i],
                                hint: 'Option ${i + 1}',
                                maxLength: _maxOptionLength,
                              ),
                            ),
                            if (_optionCtrls.length > 2) ...[
                              const SizedBox(width: 8),
                              GestureDetector(
                                onTap: () => setState(() {
                                  _optionCtrls.removeAt(i).dispose();
                                }),
                                child: Icon(
                                  Icons.remove_circle_outline_rounded,
                                  color: context.colors.textTertiary,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
            if (_optionCtrls.length < _maxOptions)
              PressableScale(
                onTap: () =>
                    setState(() => _optionCtrls.add(TextEditingController())),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.add_circle_outline_rounded,
                        size: 18,
                        color: context.colors.primaryOnSurface,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Add option',
                        style: AppTypography.bodyMedium(context).copyWith(
                          color: context.colors.primaryOnSurface,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            const SizedBox(height: AppSpacing.x3),
            PressableScale(
              onTap: _saving ? null : _create,
              child: Container(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.x4),
                decoration: BoxDecoration(
                  color: _saving
                      ? context.colors.surfaceMuted
                      : AppColors.primary,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
                alignment: Alignment.center,
                child: _saving
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.textOnPrimary,
                        ),
                      )
                    : Text(
                        'Create Poll',
                        style: AppTypography.buttonPrimary.copyWith(
                          color: AppColors.textOnPrimary,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SheetTextBox extends StatelessWidget {
  const _SheetTextBox({
    required this.controller,
    required this.hint,
    this.label,
    this.maxLength,
  });
  final TextEditingController controller;
  final String hint;
  final String? label;
  final int? maxLength;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (label != null) ...[
          Text(
            label!,
            style: AppTypography.metaSub(context).copyWith(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 6),
        ],
        Container(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.x4),
          decoration: BoxDecoration(
            color: context.colors.surface,
            borderRadius: BorderRadius.circular(AppRadius.input),
            border: Border.all(color: context.colors.border),
          ),
          child: TextField(
            controller: controller,
            style: AppTypography.bodyMedium(context),
            cursorColor: AppColors.primary,
            maxLength: maxLength,
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: AppTypography.bodyMedium(
                context,
              ).copyWith(color: context.colors.textTertiary),
              border: InputBorder.none,
              counterText: '',
            ),
          ),
        ),
      ],
    );
  }
}
