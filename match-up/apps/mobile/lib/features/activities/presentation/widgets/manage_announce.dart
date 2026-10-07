part of '../manage_activity_screen.dart';

class _AnnounceSheet extends ConsumerStatefulWidget {
  const _AnnounceSheet({required this.activityId});
  final String activityId;

  @override
  ConsumerState<_AnnounceSheet> createState() => _AnnounceSheetState();
}

class _AnnounceSheetState extends ConsumerState<_AnnounceSheet> {
  final _msgCtrl = TextEditingController();
  bool _sending = false;

  @override
  void initState() {
    super.initState();
    _msgCtrl.addListener(_onTextChanged);
  }

  void _onTextChanged() {
    // Rebuild so Send disables while the field is empty.
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _msgCtrl.removeListener(_onTextChanged);
    _msgCtrl.dispose();
    super.dispose();
  }

  bool get _canSend => !_sending && _msgCtrl.text.trim().isNotEmpty;

  Future<void> _send() async {
    final text = _msgCtrl.text.trim();
    if (text.isEmpty || _sending) return;
    final nav = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _sending = true);
    try {
      await ref
          .read(chatRepositoryProvider)
          .send(activityId: widget.activityId, text: text);
      if (!mounted) return;
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text('Announcement sent to group chat.'),
            backgroundColor: AppColors.success,
          ),
        );
      nav.pop();
    } catch (_) {
      if (!mounted) return;
      setState(() => _sending = false);
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(
          const SnackBar(
            content: Text('Could not send announcement. Please try again.'),
            backgroundColor: AppColors.error,
          ),
        );
    }
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
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(AppRadius.xl),
          ),
        ),
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.x5,
          AppSpacing.x3,
          AppSpacing.x5,
          AppSpacing.x6,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: AppSpacing.x4),
                decoration: BoxDecoration(
                  color: context.colors.border,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                ),
              ),
            ),
            Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: context.colors.warningBg,
                    borderRadius: BorderRadius.circular(AppRadius.sm),
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    Icons.campaign_outlined,
                    size: 20,
                    color: context.colors.warningText,
                  ),
                ),
                const SizedBox(width: AppSpacing.x3),
                Text(
                  'Announce to participants',
                  style: AppTypography.titleSheet(context),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.x2),
            Text(
              'Your message will be sent to the group chat.',
              style: AppTypography.metaSub(context),
            ),
            const SizedBox(height: AppSpacing.x4),
            Container(
              decoration: BoxDecoration(
                color: context.colors.surface,
                borderRadius: BorderRadius.circular(AppRadius.card),
                border: Border.all(color: context.colors.border),
              ),
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.x4,
                vertical: AppSpacing.x3,
              ),
              child: TextField(
                controller: _msgCtrl,
                minLines: 3,
                maxLines: 5,
                autofocus: true,
                cursorColor: AppColors.primary,
                cursorWidth: 1.5,
                decoration: InputDecoration(
                  hintText:
                      "e.g. 'Reminder: we're playing at Court B tomorrow at 4pm!'",
                  hintStyle: AppTypography.bodyReading(
                    context,
                  ).copyWith(color: context.colors.textTertiary),
                  filled: true,
                  fillColor: Colors.transparent,
                  border: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  isDense: true,
                  contentPadding: EdgeInsets.zero,
                ),
                style: AppTypography.bodyReading(context),
              ),
            ),
            const SizedBox(height: AppSpacing.x4),
            _SheetPrimaryBtn(
              label: 'Send Announcement',
              loading: _sending,
              onTap: _canSend ? _send : () {},
            ),
          ],
        ),
      ),
    );
  }
}

// Shared sheet widgets.

class _SheetPrimaryBtn extends StatelessWidget {
  const _SheetPrimaryBtn({
    required this.label,
    required this.onTap,
    this.loading = false,
  });
  final String label;
  final VoidCallback onTap;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: loading ? null : onTap,
      child: Container(
        width: double.infinity,
        height: 52,
        decoration: BoxDecoration(
          color: loading
              ? AppColors.primary.withValues(alpha: 0.6)
              : AppColors.primary,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          boxShadow: loading ? null : AppShadows.glowPrimary,
        ),
        alignment: Alignment.center,
        child: loading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation(AppColors.textOnPrimary),
                ),
              )
            : Text(label, style: AppTypography.buttonPrimary),
      ),
    );
  }
}

// Participants section.
