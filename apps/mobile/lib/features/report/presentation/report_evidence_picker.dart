import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/providers/auth_state_provider.dart';
import '../../../core/services/storage_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../activities/presentation/create/components/image_picker_modal.dart';

enum _EvidenceState { uploading, completed, failed }

class _EvidenceAttachment {
  _EvidenceAttachment({required this.localPath});

  final String localPath;
  _EvidenceState state = _EvidenceState.uploading;
  double progress = 0.0;
  String? url;
  String? error;

  /// False for a failure retrying can never fix (the file is simply too
  /// large) — retrying would just re-run the same size check against the
  /// same file and fail identically, so the tile offers remove-only
  /// instead of a pointless Retry tap.
  bool retryable = true;
}

/// Lets a reporter attach up to [maxAttachments] evidence photos to a
/// report, captured or selected via the same source-chooser cover uploads
/// use ([ImagePickerModal]).
///
/// The report this evidence attaches to doesn't exist yet at pick time
/// (it's created on submit), so each photo validates and uploads straight
/// to Firebase Storage independently the moment it's picked — progress,
/// failure, and retry are all tracked per-tile. [onChanged] fires with the
/// current list of successfully-uploaded download URLs whenever it
/// changes, and [onBusyChanged] reports whether anything is still
/// uploading, so the parent sheet can hold off on submitting.
class ReportEvidencePicker extends ConsumerStatefulWidget {
  const ReportEvidencePicker({
    super.key,
    required this.onChanged,
    required this.onBusyChanged,
    this.maxAttachments = 3,
  });

  final ValueChanged<List<String>> onChanged;
  final ValueChanged<bool> onBusyChanged;
  final int maxAttachments;

  @override
  ConsumerState<ReportEvidencePicker> createState() =>
      _ReportEvidencePickerState();
}

class _ReportEvidencePickerState extends ConsumerState<ReportEvidencePicker> {
  final _picker = ImagePicker();
  final List<_EvidenceAttachment> _items = [];

  bool get _busy => _items.any((i) => i.state == _EvidenceState.uploading);

  void _notify() {
    widget.onChanged(
      _items
          .where((i) => i.state == _EvidenceState.completed && i.url != null)
          .map((i) => i.url!)
          .toList(),
    );
    widget.onBusyChanged(_busy);
  }

  Future<void> _addEvidence() async {
    if (_items.length >= widget.maxAttachments) return;
    final choice = await showModalBottomSheet<ImageSourceChoice>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const ImagePickerModal(),
    );
    if (choice == null || !mounted) return;

    final source = choice == ImageSourceChoice.gallery
        ? ImageSource.gallery
        : ImageSource.camera;

    XFile? file;
    try {
      file = await _picker.pickImage(
        source: source,
        maxWidth: 1920,
        maxHeight: 1920,
        imageQuality: 85,
      );
    } on PlatformException {
      // Permission denied (or no camera on the device).
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: source == ImageSource.camera
            ? 'Could not access the camera. Check camera permissions and try again.'
            : 'Could not access your photos. Check photo permissions and try again.',
        variant: AppSnackbarVariant.error,
      );
      return;
    } catch (_) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: 'Could not attach evidence. Please try again.',
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    if (file == null || !mounted) return;

    final item = _EvidenceAttachment(localPath: file.path);
    setState(() => _items.add(item));
    await _upload(item);
  }

  Future<void> _upload(_EvidenceAttachment item) async {
    setState(() {
      item.state = _EvidenceState.uploading;
      item.progress = 0.0;
      item.error = null;
      item.retryable = true;
    });
    _notify();

    try {
      await StorageService.checkImageSize(item.localPath, kMaxEvidenceBytes);
    } on ImageTooLargeException catch (e) {
      if (!mounted) return;
      setState(() {
        item.state = _EvidenceState.failed;
        item.error = e.message;
        item.retryable = false;
      });
      _notify();
      return;
    }

    final uid = ref.read(authStateProvider).userId ?? '';
    if (uid.isEmpty) {
      if (!mounted) return;
      setState(() {
        item.state = _EvidenceState.failed;
        item.error = 'Evidence uploads are unavailable right now.';
      });
      _notify();
      return;
    }

    final url = await StorageService.instance.uploadReportEvidence(
      localPath: item.localPath,
      uid: uid,
      onProgress: (p) {
        if (!mounted) return;
        setState(() => item.progress = p);
      },
    );
    if (!mounted) return;
    if (url == null) {
      setState(() {
        item.state = _EvidenceState.failed;
        item.error = 'Upload failed. Check your connection and try again.';
      });
    } else {
      setState(() {
        item.state = _EvidenceState.completed;
        item.url = url;
        item.progress = 1.0;
      });
    }
    _notify();
  }

  void _remove(_EvidenceAttachment item) {
    setState(() => _items.remove(item));
    _notify();
  }

  @override
  Widget build(BuildContext context) {
    final atCap = _items.length >= widget.maxAttachments;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Evidence',
          style: AppTypography.labelField(
            context,
          ).copyWith(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 4),
        Text(
          'Optional — attach up to ${widget.maxAttachments} photos to support your report',
          style: AppTypography.metaSub(context),
        ),
        const SizedBox(height: AppSpacing.x3),
        Wrap(
          spacing: AppSpacing.x2,
          runSpacing: AppSpacing.x2,
          children: [
            for (final item in _items)
              _EvidenceTile(
                item: item,
                onRemove: () => _remove(item),
                onRetry: () => _upload(item),
              ),
            if (!atCap) _AddEvidenceTile(onTap: _addEvidence),
          ],
        ),
        for (final item in _items.where(
          (i) => i.state == _EvidenceState.failed,
        ))
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.x2),
            child: Text(
              item.error ?? 'Upload failed.',
              style: AppTypography.metaSub(
                context,
              ).copyWith(color: context.colors.errorText),
            ),
          ),
      ],
    );
  }
}

class _AddEvidenceTile extends StatelessWidget {
  const _AddEvidenceTile({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return PressableScale(
      onTap: onTap,
      child: Container(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          color: context.colors.surfaceMuted,
          borderRadius: BorderRadius.circular(AppRadius.card),
          border: Border.all(color: context.colors.border),
        ),
        alignment: Alignment.center,
        child: Icon(
          Icons.add_photo_alternate_outlined,
          color: context.colors.textSecondary,
        ),
      ),
    );
  }
}

class _EvidenceTile extends StatelessWidget {
  const _EvidenceTile({
    required this.item,
    required this.onRemove,
    required this.onRetry,
  });

  final _EvidenceAttachment item;
  final VoidCallback onRemove;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 72,
      height: 72,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.card),
            child: Image.file(
              File(item.localPath),
              width: 72,
              height: 72,
              fit: BoxFit.cover,
            ),
          ),
          if (item.state == _EvidenceState.uploading)
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.45),
                  borderRadius: BorderRadius.circular(AppRadius.card),
                ),
                alignment: Alignment.center,
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    value: item.progress > 0 ? item.progress : null,
                    valueColor: const AlwaysStoppedAnimation(Colors.white),
                  ),
                ),
              ),
            ),
          if (item.state == _EvidenceState.failed)
            Positioned.fill(
              child: GestureDetector(
                onTap: item.retryable ? onRetry : null,
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.danger.withValues(alpha: 0.55),
                    borderRadius: BorderRadius.circular(AppRadius.card),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    item.retryable ? 'Retry' : 'Too large',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
          Positioned(
            top: -6,
            right: -6,
            child: PressableScale(
              onTap: onRemove,
              child: Container(
                width: 22,
                height: 22,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: Colors.black87,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.close_rounded,
                  size: 14,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
