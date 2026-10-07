import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/network/api_client.dart';

import '../../../core/providers/repository_providers.dart';
import 'my_activities_screen.dart';
import '../../../core/services/storage_service.dart';
import '../../../core/services/weather_service.dart';
import '../../../core/storage/local_storage.dart';
import '../../../core/utils/geohash.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_segmented_control.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/app_tappable.dart';
import '../../../core/widgets/date_picker_sheet.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../discovery/presentation/widgets/discovery_card.dart';
import '../../sports/domain/sport_config.dart';
import '../domain/activity_model.dart';
import 'create/components/image_picker_modal.dart';
import 'create/providers/form_data_provider.dart';
import 'create/services/form_validator.dart' show validateField;
import '../domain/place_suggestion.dart';
import 'widgets/venue_field.dart';
import 'widgets/weather_chip.dart';
import 'create/providers/image_upload_provider.dart';

part 'widgets/create_progress.dart';
part 'widgets/create_form_fields.dart';
part 'widgets/create_cover_photo.dart';
part 'widgets/create_price.dart';

/// Two-step create-activity wizard with a live preview.
/// Step 1 (Setup) — the basic game details (title, sport, date, duration, location, capacity), shown as tappable.
/// Every field is driven straight through [formDataProvider] (single source of truth).
class CreateActivityScreen extends ConsumerStatefulWidget {
  const CreateActivityScreen({super.key});

  @override
  ConsumerState<CreateActivityScreen> createState() =>
      _CreateActivityScreenState();
}

class _CreateActivityScreenState extends ConsumerState<CreateActivityScreen> {
  static const _stepSetup = 0;
  static const _stepRules = 1;
  static const _stepPreview = 2;

  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _priceController = TextEditingController();
  PlaceSuggestion? _venue;
  static final _picker = ImagePicker();

  int _step = _stepSetup;
  bool _submitting = false;

  /// Set when the activity was created but its cover upload failed.
  String? _coverFailedActivityId;

  /// True after a blocked Continue attempt — reveals inline field errors on the setup step.
  bool _setupAttempted = false;

  // Custom duration: stepped in 15-minute increments, 30m … 8h.
  static const _durationStep = 15;
  static const _durationMin = 30;
  static const _durationMax = 480;
  static const _skillOptions = [
    'All Level',
    'Beginner',
    'Intermediate',
    'Advanced',
  ];
  static const _sportOptions = [
    'Basketball',
    'Tennis',
    'Running',
    'Volleyball',
    'Football',
    'Soccer',
    'Cycling',
    'Hiking',
    'Golf',
    'Swimming',
  ];

  /// Modern, consistent metadata for every "tipe" picker so Sport, Skill, Entry, and Join Policy all speak the same.
  static const _sportIcons = <String, IconData>{
    'Basketball': Icons.sports_basketball_outlined,
    'Tennis': Icons.sports_tennis_outlined,
    'Running': Icons.directions_run_outlined,
    'Volleyball': Icons.sports_volleyball_outlined,
    'Football': Icons.sports_football_outlined,
    'Soccer': Icons.sports_soccer_outlined,
    'Cycling': Icons.directions_bike_outlined,
    'Hiking': Icons.hiking_outlined,
    'Golf': Icons.sports_golf_outlined,
    'Swimming': Icons.pool_outlined,
  };

  static final _skillMeta = <String, ({IconData icon, String subtitle})>{
    'All Level': (icon: Icons.groups_outlined, subtitle: 'Everyone welcome'),
    'Beginner': (icon: Icons.eco_outlined, subtitle: 'Just starting out'),
    'Intermediate': (
      icon: Icons.trending_up_outlined,
      subtitle: 'Knows the basics',
    ),
    'Advanced': (icon: Icons.bolt_outlined, subtitle: 'Competitive play'),
  };

  static final _joinPolicyMeta =
      <String, ({IconData icon, String title, String subtitle})>{
        'open': (
          icon: Icons.lock_open_outlined,
          title: 'Open',
          subtitle: 'Anyone can join instantly',
        ),
        'approval': (
          icon: Icons.verified_outlined,
          title: 'Approval',
          subtitle: 'You approve each request',
        ),
      };

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _restoreOrReset());
  }

  /// Draft persistence (spec Phase 5, MVP scope): the form is JSON- serialisable via [ActivityFormData.toJson].
  static const _draftKey = 'create_activity_draft_v1';

  Future<void> _restoreOrReset() async {
    try {
      final store = await LocalStorage.create();
      final raw = store.getString(_draftKey);
      if (raw != null && raw.isNotEmpty && mounted) {
        final data = ActivityFormData.fromJson(
          Map<String, dynamic>.from(jsonDecode(raw) as Map),
        );
        if (data.title.trim().isNotEmpty ||
            data.location.trim().isNotEmpty ||
            data.description.trim().isNotEmpty) {
          ref.read(imageUploadProvider.notifier).reset();
          final form = ref.read(formDataProvider.notifier)
            ..reset()
            ..setTitle(data.title)
            ..setSportType(data.sportType)
            ..setLocation(data.location)
            ..setDescription(data.description)
            ..setMaxParticipants(data.maxParticipants)
            ..setSkillLevel(data.skillLevel)
            ..setFeeType(data.feeType)
            ..setPrice(data.price)
            ..setPriceMode(data.priceMode)
            ..setMinPlayers(data.minPlayers)
            ..setDurationMinutes(data.durationMinutes)
            ..setJoinPolicy(data.joinPolicy);
          if (data.selectedDate != null &&
              data.selectedDate!.isAfter(DateTime.now())) {
            form.setSelectedDate(data.selectedDate);
          } else {
            form.setSelectedDate(DateTime.now().add(const Duration(hours: 2)));
          }
          _titleController.text = data.title;
          _descriptionController.text = data.description;
          _priceController.text = data.price ?? '';
          // Rebuild the picked venue so the address + accurate pin survive the restore.
          setState(() {
            final lat = data.venueLatitude;
            final lng = data.venueLongitude;
            _venue =
                (lat != null && lng != null && data.location.trim().isNotEmpty)
                ? PlaceSuggestion(
                    placeId: '',
                    label: data.location,
                    secondary: data.venueAddress,
                    latitude: lat,
                    longitude: lng,
                  )
                : null;
          });
          return;
        }
      }
    } catch (_) {
      // No usable draft (fresh install, test harness without prefs plugin, or corrupt JSON).
    }
    if (!mounted) return;
    ref.read(imageUploadProvider.notifier).reset();
    ref.read(formDataProvider.notifier)
      ..reset()
      ..setSelectedDate(DateTime.now().add(const Duration(hours: 2)));
    setState(() => _venue = null);
    _titleController.clear();
    _descriptionController.clear();
    _priceController.clear();
  }

  Future<void> _saveDraft() async {
    try {
      final store = await LocalStorage.create();
      final data = ref.read(formDataProvider);
      await store.setString(_draftKey, jsonEncode(data.toJson()));
    } catch (_) {
      // Draft is best-effort; a failed save must never block the wizard.
    }
  }

  Future<void> _clearDraft() async {
    try {
      final store = await LocalStorage.create();
      await store.remove(_draftKey);
    } catch (_) {
      // Best-effort only.
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  FormDataNotifier get _form => ref.read(formDataProvider.notifier);

  // Formatting.

  String _formatDate(DateTime dt) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    final hour12 = dt.hour == 0 ? 12 : (dt.hour > 12 ? dt.hour - 12 : dt.hour);
    final ampm = dt.hour < 12 ? 'AM' : 'PM';
    final min = dt.minute.toString().padLeft(2, '0');
    return '${days[dt.weekday - 1]}, ${months[dt.month - 1]} ${dt.day}, $hour12:$min $ampm';
  }

  String _durationText(int minutes) {
    final h = minutes ~/ 60;
    final m = minutes % 60;
    if (h == 0) return '$m min';
    if (m == 0) return h == 1 ? '1 hour' : '$h hours';
    return '${h}h ${m}m';
  }

  // Pickers.

  Future<void> _pickImage() async {
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

    ref.read(imageUploadProvider.notifier).setUploading(0.1);
    try {
      final file = await _picker.pickImage(
        source: source,
        maxWidth: 1920,
        maxHeight: 1080,
        imageQuality: 85,
      );
      if (file == null) {
        ref.read(imageUploadProvider.notifier).reset();
        return;
      }
      final bytes = await file.readAsBytes();
      if (bytes.lengthInBytes > 5 * 1024 * 1024) {
        ref
            .read(imageUploadProvider.notifier)
            .setFailed('Image must be under 5 MB.');
        return;
      }
      final b64 = base64.encode(bytes);
      ref.read(imageUploadProvider.notifier).setCompleted(b64);
      _form.setCoverImage(b64);
      // Cover-only retry state: a fresh pick should immediately retry the upload for the already-created game.
      if (_coverFailedActivityId != null) {
        await _retryCover();
      }
    } catch (_) {
      ref
          .read(imageUploadProvider.notifier)
          .setFailed('Could not load image. Please try again.');
    }
  }

  Future<void> _pickDate() async {
    final form = ref.read(formDataProvider);
    final current = form.selectedDate;
    final picked = await showModalBottomSheet<DateTime>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => DatePickerSheet(
        initialDate: current ?? DateTime.now().add(const Duration(hours: 2)),
        minDate: DateTime.now(),
        latitude: form.venueLatitude ?? _venue?.latitude,
        longitude: form.venueLongitude ?? _venue?.longitude,
      ),
    );
    if (picked != null) _form.setSelectedDate(picked);
  }

  void _showOptionPicker({
    required String title,
    String? subtitle,
    required List<String> options,
    required String current,
    required ValueChanged<String> onSelect,
    IconData Function(String option)? iconFor,
    String Function(String option)? subtitleFor,
  }) {
    HapticFeedback.selectionClick();
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(context).size.height * 0.7,
          ),
          child: Container(
            decoration: BoxDecoration(
              color: context.colors.surface,
              borderRadius: BorderRadius.vertical(
                top: Radius.circular(AppRadius.xl),
              ),
              boxShadow: AppShadows.sheet,
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
                      borderRadius: AppRadius.pillR,
                    ),
                  ),
                ),
                Text(
                  title,
                  style: AppTypography.titleLarge(
                    context,
                  ).copyWith(fontWeight: FontWeight.w800),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: AppTypography.bodyMedium(
                      context,
                    ).copyWith(color: context.colors.textSecondary),
                  ),
                ],
                const SizedBox(height: AppSpacing.x4),
                Flexible(
                  child: ListView.separated(
                    shrinkWrap: true,
                    itemCount: options.length,
                    separatorBuilder: (_, _) =>
                        const SizedBox(height: AppSpacing.x2),
                    itemBuilder: (context, index) {
                      final opt = options[index];
                      final selected = opt == current;
                      final icon = iconFor?.call(opt);
                      final sub = subtitleFor?.call(opt);
                      final c = context.colors;
                      return PressableScale(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          onSelect(opt);
                          Navigator.of(context).pop();
                        },
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
                              if (icon != null) ...[
                                Container(
                                  width: 38,
                                  height: 38,
                                  decoration: BoxDecoration(
                                    color: selected
                                        ? c.surface
                                        : c.surfaceSubtle,
                                    borderRadius: BorderRadius.circular(
                                      AppRadius.input,
                                    ),
                                  ),
                                  alignment: Alignment.center,
                                  child: Icon(
                                    icon,
                                    size: 19,
                                    color: selected
                                        ? c.primaryOnSurface
                                        : c.textSecondary,
                                  ),
                                ),
                                const SizedBox(width: AppSpacing.x3),
                              ],
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _joinPolicyMeta[opt]?.title ?? opt,
                                      style: AppTypography.bodyMedium(context)
                                          .copyWith(
                                            fontSize: 15,
                                            color: selected
                                                ? c.primaryOnSurface
                                                : c.textPrimary,
                                            fontWeight: selected
                                                ? FontWeight.w700
                                                : FontWeight.w600,
                                          ),
                                    ),
                                    if (sub != null) ...[
                                      const SizedBox(height: 1),
                                      Text(
                                        sub,
                                        style: AppTypography.metaSub(context),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              const SizedBox(width: AppSpacing.x2),
                              AnimatedContainer(
                                duration: AppDurations.fast,
                                width: 24,
                                height: 24,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: selected
                                      ? c.primaryOnSurface
                                      : Colors.transparent,
                                  border: Border.all(
                                    color: selected
                                        ? c.primaryOnSurface
                                        : c.borderInput,
                                    width: 1.5,
                                  ),
                                ),
                                alignment: Alignment.center,
                                child: selected
                                    ? const Icon(
                                        Icons.check_rounded,
                                        size: 15,
                                        color: Colors.white,
                                      )
                                    : null,
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // Navigation.

  void _onBack() {
    if (_step > _stepSetup) {
      setState(() => _step--);
    } else {
      context.pop();
    }
  }

  void _continueToRules() {
    final data = ref.read(formDataProvider);
    final err = _setupError(data);
    if (err != null) {
      // Reveal inline field errors in addition to the snackbar, so a missing venue can't be mistaken for "lanjut".
      setState(() => _setupAttempted = true);
      AppSnackbar.show(
        context,
        message: err,
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    FocusScope.of(context).unfocus();
    setState(() {
      _setupAttempted = false;
      _step = _stepRules;
    });
    unawaited(_saveDraft());
  }

  void _goToPreview() {
    final data = ref.read(formDataProvider);
    if (data.feeType == 1) {
      // Same shared gate as [_submit]: the strict format rule first, then the positivity check.
      final priceErr = validateField(
        'price',
        _priceController.text.trim(),
        data,
      );
      if (priceErr != null) {
        AppSnackbar.show(
          context,
          message: priceErr,
          variant: AppSnackbarVariant.error,
        );
        return;
      }
      final amount = double.tryParse(_priceController.text.trim());
      if (amount == null || amount <= 0) {
        AppSnackbar.show(
          context,
          message: data.priceMode == 1
              ? 'Please enter a valid total cost.'
              : 'Please enter a valid price.',
          variant: AppSnackbarVariant.error,
        );
        return;
      }
    }
    FocusScope.of(context).unfocus();
    setState(() => _step = _stepPreview);
    unawaited(_saveDraft());
  }

  /// First blocking issue on the setup step, or null when it's good to go.
  String? _setupError(ActivityFormData data) {
    if (data.title.trim().isEmpty) return 'Please enter an activity title.';
    // A venue pick carries coordinates — a bare location string without them.
    if (data.location.trim().isEmpty ||
        (data.venueLatitude == null && _venue == null)) {
      return 'Please pick a venue on the map.';
    }
    final date = data.selectedDate;
    if (date == null || date.isBefore(DateTime.now())) {
      return 'Please pick a future date and time.';
    }
    if (data.maxParticipants < 2) return 'Minimum 2 participants required.';
    return null;
  }

  /// Uploads the selected cover image and points the activity at it via `PATCH cover`.
  /// The draft stores the picked bytes as base64 via `setCoverImage` (see [_pickImage]).
  Future<String?> _attachCover(String activityId, Uint8List bytes) async {
    try {
      final dir = await Directory.systemTemp.createTemp('cover_');
      final file = File(
        '${dir.path}/cover_${DateTime.now().millisecondsSinceEpoch}.jpg',
      );
      await file.writeAsBytes(bytes, flush: true);
      final storagePath = 'activities/$activityId/cover/cover.jpg';
      final uploaded = await StorageService.instance.uploadToPath(
        localPath: file.path,
        storagePath: storagePath,
      );
      if (uploaded == null) {
        return 'Cover photo upload failed. Check your connection.';
      }
      await ref
          .read(activityRepositoryProvider)
          .updateCover(
            activityId: activityId,
            coverImagePath: uploaded.path,
            coverImageUrl: uploaded.downloadUrl,
          );
      return null;
    } catch (e) {
      debugPrint('[CreateActivity] cover attach failed: $e');
      // Prefer a specific, actionable reason so the user can pick another photo instead of seeing a generic failure.
      if (e is DioException && e.error is ApiException) {
        return (e.error as ApiException).userMessage;
      }
      if (e.toString().contains('permission-denied') ||
          e.toString().contains('unauthorized')) {
        return 'Upload was denied. Please sign in again and pick another photo.';
      }
      if (e is ImageTooLargeException) return e.message;
      return 'Cover photo could not be uploaded.';
    }
  }

  /// Retries only the cover upload for an already-created activity (see.
  Future<void> _retryCover() async {
    final activityId = _coverFailedActivityId;
    if (activityId == null || _submitting) return;
    final coverBytes = _decodeCoverBytes(
      ref.read(formDataProvider).coverImagePath,
    );
    if (coverBytes == null) {
      // User removed the photo: keep the created game, without a cover.
      final id = _coverFailedActivityId;
      setState(() => _coverFailedActivityId = null);
      await _finishCreateSuccess(activityId: id!, withCover: false);
      return;
    }
    if (coverBytes.lengthInBytes > kMaxCoverImageBytes) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: ImageTooLargeException(
          kMaxCoverImageBytes,
          coverBytes.lengthInBytes,
        ).message,
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    setState(() => _submitting = true);
    try {
      final reason = await _attachCover(activityId, coverBytes);
      if (!mounted) return;
      if (reason == null) {
        setState(() => _coverFailedActivityId = null);
        await _finishCreateSuccess(activityId: activityId, withCover: true);
      } else {
        _showCoverFailure(reason);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  /// Shows why the cover failed and keeps the user on the form so they can pick another photo.
  void _showCoverFailure(String reason, {bool alreadyCreated = false}) {
    if (!mounted) return;
    final head = alreadyCreated && reason.isNotEmpty
        ? 'Activity created, but ${reason[0].toLowerCase()}${reason.substring(1)}'
        : reason;
    AppSnackbar.show(
      context,
      message:
          '$head Choose another photo, or remove it and retry to continue without a cover.',
      variant: AppSnackbarVariant.error,
      duration: const Duration(seconds: 6),
      actionLabel: 'Pick another',
      onAction: _pickImage,
    );
  }

  /// Shared success tail: reset the wizard, refresh Hosting, and leave for the activities list.
  Future<void> _finishCreateSuccess({
    required String activityId,
    required bool withCover,
  }) async {
    _form.reset();
    ref.read(imageUploadProvider.notifier).reset();
    await _clearDraft();
    if (!mounted) return;
    // The new game lives under Hosting — refresh that tab now so it appears without a manual pull-to-refresh.
    ref.invalidate(hostedGamesProvider);
    HapticFeedback.heavyImpact();
    AppSnackbar.show(
      context,
      message: withCover
          ? 'Activity created! 🎉'
          : 'Activity created without a cover photo.',
      variant: AppSnackbarVariant.success,
    );
    context.go('/activities');
  }

  Future<void> _submit() async {
    if (_submitting) return;
    // The game already exists — a second full submit would duplicate it. Retry only the cover instead.
    if (_coverFailedActivityId != null) {
      await _retryCover();
      return;
    }
    final data = ref.read(formDataProvider);
    // Never silently substitute a fallback date.
    final setupErr = _setupError(data);
    if (setupErr != null) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: setupErr,
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    // Shared rules (same messages as the wizard validators): capacity cap and price format.
    final capErr = validateField(
      'maxParticipants',
      '${data.maxParticipants}',
      data,
    );
    if (capErr != null) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: capErr,
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    final paid = data.feeType == 1;
    if (paid) {
      final priceErr = validateField(
        'price',
        _priceController.text.trim(),
        data,
      );
      if (priceErr != null) {
        if (!mounted) return;
        AppSnackbar.show(
          context,
          message: priceErr,
          variant: AppSnackbarVariant.error,
        );
        return;
      }
    }
    final split = paid && data.priceMode == 1;
    final amount = double.tryParse(_priceController.text.trim());
    if (paid && (amount == null || amount <= 0)) {
      AppSnackbar.show(
        context,
        message: split
            ? 'Please enter a valid total cost.'
            : 'Please enter a valid price.',
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    // Split: clamp min into 2..capacity (null = full house).
    final minPlayers = split
        ? (data.minPlayers ?? data.maxParticipants).clamp(
            2,
            data.maxParticipants,
          )
        : null;
    final perPerson = split && minPlayers != null
        ? (amount! / minPlayers * 100).round() / 100
        : amount;

    setState(() => _submitting = true);
    final pickedVenue = _venue;
    // Venue coords: the form's persisted pick wins (survives draft restore).
    final double pickedLat =
        data.venueLatitude ?? pickedVenue?.latitude ?? -36.8485;
    final double pickedLng =
        data.venueLongitude ?? pickedVenue?.longitude ?? 174.7633;
    final String pickedGeohash = geohashEncode(pickedLat, pickedLng);
    final String? pickedAddress = data.venueAddress.trim().isNotEmpty
        ? data.venueAddress.trim()
        : pickedVenue?.secondary.trim().isNotEmpty == true
        ? pickedVenue!.secondary.trim()
        : null;
    // Cover photo is optional and uploaded AFTER the create, because Storage rules only allow.
    final coverBytes = _decodeCoverBytes(data.coverImagePath);
    // Fail fast on oversized covers (8 MB server cap): stay on the form with the reason.
    if (coverBytes != null && coverBytes.lengthInBytes > kMaxCoverImageBytes) {
      if (!mounted) return;
      setState(() => _submitting = false);
      AppSnackbar.show(
        context,
        message: ImageTooLargeException(
          kMaxCoverImageBytes,
          coverBytes.lengthInBytes,
        ).message,
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    // Weather snapshot (best-effort): captured now so the detail screen can show it without another lookup.
    WeatherInfo? snapshot;
    try {
      snapshot = await WeatherService.instance.fetchForDateTime(
        pickedLat,
        pickedLng,
        data.selectedDate!,
      );
    } catch (_) {
      snapshot = null;
    }
    try {
      final created = await ref
          .read(activityRepositoryProvider)
          .create(
            title: data.title.trim(),
            description: data.description.trim(),
            sportType: data.sportType,
            location: data.location.trim(),
            address: pickedAddress,
            // Validated at the top of [_submit] — never a silent now()+2h substitution.
            dateTime: data.selectedDate!,
            maxParticipants: data.maxParticipants,
            skillLevel: data.skillLevel,
            latitude: pickedLat,
            longitude: pickedLng,
            geohash: pickedGeohash,
            durationMinutes: data.durationMinutes,
            joinPolicy: data.joinPolicy,
            isPaid: paid,
            fee: paid ? perPerson : null,
            feeMode: split ? 'split' : 'fixed',
            totalCost: split ? amount : null,
            minPlayers:
                split && minPlayers != null && minPlayers < data.maxParticipants
                ? minPlayers
                : null,
            weatherTemp: snapshot?.temperatureC.isNaN == false
                ? snapshot?.temperatureC
                : null,
            weatherCode: snapshot?.weatherCode,
            weatherDesc: snapshot?.description,
            weatherRain: snapshot?.precipitationProbability,
          );
      // Phase two: store the bytes, upload to the host-only cover path, and point the activity at the URL.
      if (coverBytes == null) {
        await _finishCreateSuccess(activityId: created.id, withCover: true);
      } else {
        final reason = await _attachCover(created.id, coverBytes);
        if (!mounted) return;
        if (reason == null) {
          await _finishCreateSuccess(activityId: created.id, withCover: true);
        } else {
          setState(() {
            _submitting = false;
            _coverFailedActivityId = created.id;
          });
          // Refresh Hosting anyway so the created game is visible underneath while the user fixes the photo.
          ref.invalidate(hostedGamesProvider);
          HapticFeedback.heavyImpact();
          _showCoverFailure(reason, alreadyCreated: true);
        }
      }
    } catch (e) {
      if (!mounted) return;
      debugPrint('[CreateActivity] submit failed: $e');
      // Prefer the backend's own message (validation, conflicts, …) over the generic fallback so failures explain.
      final message = e is DioException && e.error is ApiException
          ? (e.error as ApiException).userMessage
          : 'Could not create activity. Please try again.';
      // Retry path (spec Phase 4): the form is NOT reset on failure.
      AppSnackbar.show(
        context,
        message: message,
        variant: AppSnackbarVariant.error,
        duration: const Duration(seconds: 5),
        actionLabel: 'Retry',
        onAction: _submit,
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  // Build.

  @override
  Widget build(BuildContext context) {
    final data = ref.watch(formDataProvider);
    final uploadInfo = ref.watch(imageUploadProvider);

    return AppScaffold.sheet(
      title: _step == _stepPreview ? 'Preview Activity' : 'Create Activity',
      onBack: _onBack,
      showHomeIndicator: false,
      body: Column(
        children: [
          _StepProgressBar(step: _step),
          Expanded(
            child: switch (_step) {
              _stepRules => _buildRulesStep(data, uploadInfo),
              _stepPreview => _buildPreviewStep(data),
              _ => _buildSetupStep(data),
            },
          ),
        ],
      ),
      bottomBar: _buildBottomBar(),
    );
  }

  Widget _buildBottomBar() {
    final Widget content = switch (_step) {
      _stepRules => _PrimaryCta(
        label: 'Preview activity',
        subtitle: 'See how it will look to others',
        onPressed: _goToPreview,
      ),
      _stepPreview => Row(
        children: [
          Expanded(
            child: AppButton.secondary(
              label: 'Edit Details',
              size: AppButtonSize.sm,
              onPressed: () => setState(() => _step = _stepRules),
            ),
          ),
          const SizedBox(width: AppSpacing.x3),
          Expanded(
            flex: 2,
            child: AppButton(
              // After a cover-only failure the game exists.
              label: _coverFailedActivityId != null
                  ? 'Retry Cover Upload'
                  : 'Create Activity',
              size: AppButtonSize.sm,
              onPressed: _submitting ? null : _submit,
              loading: _submitting,
            ),
          ),
        ],
      ),
      _ => _PrimaryCta(
        label: 'Continue',
        subtitle: 'Step 2: Who can join?',
        onPressed: _continueToRules,
      ),
    };
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.x5,
        AppSpacing.x3,
        AppSpacing.x5,
        AppSpacing.x4,
      ),
      child: content,
    );
  }

  // Step 1 · Setup.

  Widget _buildSetupStep(ActivityFormData data) {
    // Inline errors appear only after a blocked Continue attempt — pristine fields stay clean.
    final titleErr = _setupAttempted && data.title.trim().isEmpty
        ? 'Please enter an activity title.'
        : null;
    final venueErr =
        _setupAttempted &&
            (data.location.trim().isEmpty ||
                (data.venueLatitude == null && _venue == null))
        ? 'Please pick a venue on the map.'
        : null;
    final dateErr =
        _setupAttempted &&
            (data.selectedDate == null ||
                data.selectedDate!.isBefore(DateTime.now()))
        ? 'Please pick a future date and time.'
        : null;
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.x5,
        AppSpacing.x2,
        AppSpacing.x5,
        AppSpacing.x8,
      ),
      children: [
        const _StepHeading(
          title: "Let's set up your game",
          subtitle: 'Add the basic details of your activity',
        ),
        const SizedBox(height: AppSpacing.x4),

        // Title.
        _SettingCard(
          icon: Icons.edit_outlined,
          label: 'Activity Title',
          error: titleErr,
          trailing: Text(
            '${data.title.length}/40',
            style: AppTypography.metaSub(context),
          ),
          value: TextField(
            controller: _titleController,
            style: _inputStyle(context),
            cursorColor: AppColors.primary,
            inputFormatters: [LengthLimitingTextInputFormatter(40)],
            decoration: _dec(context, 'Weekend Basketball Runs'),
            onChanged: _form.setTitle,
          ),
        ),

        // Sport.
        _SettingCard(
          icon: Icons.sports_basketball_outlined,
          label: 'Sport',
          onTap: () => _showOptionPicker(
            title: 'Select Sport',
            subtitle: 'What will you be playing?',
            // Admin-curated list (canHost); bundled fallback offline.
            options: pickSportNames(
              ref.watch(sportsConfigProvider).valueOrNull ?? const [],
              (s) => s.canHost,
              _sportOptions,
            ),
            current: data.sportType,
            onSelect: _form.setSportType,
            iconFor: (o) => _sportIcons[o] ?? Icons.sports_basketball_outlined,
          ),
          value: Text(data.sportType, style: _valueStyle(context)),
          trailing: _chevron(context),
        ),

        // Location first — venue coords drive the weather forecast below, so pick this before the date.
        VenueField(
          value: _venue,
          errorText: venueErr,
          onSuggestionSelected: (s) {
            setState(() => _venue = s);
            _form.setVenue(
              label: s.label,
              address: s.secondary,
              latitude: s.latitude,
              longitude: s.longitude,
            );
          },
        ),

        // Date & time.
        _SettingCard(
          icon: Icons.calendar_month_outlined,
          label: 'Date & Time',
          error: dateErr,
          onTap: _pickDate,
          value: Text(
            data.selectedDate == null
                ? 'Pick a date'
                : _formatDate(data.selectedDate!),
            style: _valueStyle(context),
          ),
          trailing: _chevron(context),
        ),

        // Weather forecast for the picked venue + date. Best-effort via Open-Meteo — never blocks submit.
        WeatherChip(
          latitude: data.venueLatitude ?? _venue?.latitude,
          longitude: data.venueLongitude ?? _venue?.longitude,
          dateTime: data.selectedDate,
        ),

        // Duration — custom, stepped in 15-minute increments.
        _SettingCard(
          icon: Icons.schedule_outlined,
          label: 'Duration',
          value: Text(
            _durationText(data.durationMinutes),
            style: _valueStyle(context),
          ),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _CounterBtn(
                icon: Icons.remove,
                enabled: data.durationMinutes > _durationMin,
                emphasised: false,
                semanticLabel: 'Shorten duration',
                onTap: () => _form.setDurationMinutes(
                  data.durationMinutes - _durationStep,
                ),
              ),
              _CounterBtn(
                icon: Icons.add,
                enabled: data.durationMinutes < _durationMax,
                emphasised: true,
                semanticLabel: 'Extend duration',
                onTap: () => _form.setDurationMinutes(
                  data.durationMinutes + _durationStep,
                ),
              ),
            ],
          ),
        ),

        // Max participants.
        _SettingCard(
          icon: Icons.group_outlined,
          label: 'Max Participants',
          value: Text(
            '${data.maxParticipants} players',
            style: _valueStyle(context),
          ),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _CounterBtn(
                icon: Icons.remove,
                enabled: data.maxParticipants > 2,
                emphasised: false,
                semanticLabel: 'Remove one participant',
                onTap: () => _form.setMaxParticipants(data.maxParticipants - 1),
              ),
              _CounterBtn(
                icon: Icons.add,
                enabled: data.maxParticipants < 50,
                emphasised: true,
                semanticLabel: 'Add one participant',
                onTap: () => _form.setMaxParticipants(data.maxParticipants + 1),
              ),
            ],
          ),
        ),

        const SizedBox(height: AppSpacing.x2),
        const _TipNote('You can always edit these details later.'),
      ],
    );
  }

  // Step 2 · Rules.

  Widget _buildRulesStep(ActivityFormData data, ImageUploadInfo uploadInfo) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.x5,
        AppSpacing.x2,
        AppSpacing.x5,
        AppSpacing.x8,
      ),
      children: [
        const _StepHeading(
          title: 'Tell us more about your game',
          subtitle: 'Set the rules and preferences',
        ),
        const SizedBox(height: AppSpacing.x4),

        // Skill level — consistent 2-col choice grid, same language as Entry / Join Policy below.
        _FieldLabel('Skill Level'),
        const SizedBox(height: 2),
        Text('Who is this game for?', style: AppTypography.metaSub(context)),
        const SizedBox(height: _kLabelGap + 2),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: AppSpacing.x3,
            crossAxisSpacing: AppSpacing.x3,
            mainAxisExtent: 76,
          ),
          itemCount: _skillOptions.length,
          itemBuilder: (context, i) {
            final opt = _skillOptions[i];
            final meta = _skillMeta[opt];
            return _ChoiceCard(
              icon: meta?.icon ?? Icons.signal_cellular_alt_outlined,
              title: opt,
              subtitle: meta?.subtitle ?? '',
              selected: data.skillLevel == opt,
              onTap: () => _form.setSkillLevel(opt),
            );
          },
        ),
        const SizedBox(height: AppSpacing.x5),

        // Entry — two selectable choice cards.
        _FieldLabel('Entry Fee'),
        const SizedBox(height: 2),
        Text('Is there a cost to join?', style: AppTypography.metaSub(context)),
        const SizedBox(height: _kLabelGap + 2),
        Row(
          children: [
            Expanded(
              child: _ChoiceCard(
                icon: Icons.volunteer_activism_outlined,
                title: 'Free',
                subtitle: 'Anyone can join',
                selected: data.feeType == 0,
                onTap: () => _form.setFeeType(0),
              ),
            ),
            const SizedBox(width: AppSpacing.x3),
            Expanded(
              child: _ChoiceCard(
                icon: Icons.payments_outlined,
                title: 'Paid',
                subtitle: 'Set a price',
                selected: data.feeType == 1,
                onTap: () => _form.setFeeType(1),
              ),
            ),
          ],
        ),
        // Paid block: segmented mode + price card.
        ClipRect(
          child: AnimatedSize(
            duration: AppDurations.base,
            curve: Curves.easeOutCubic,
            alignment: Alignment.topCenter,
            child: data.feeType == 1
                ? Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const SizedBox(height: AppSpacing.x3),
                      // Pricing mode: Fixed = flat per person, Split = shared total.
                      AppSegmentedControl(
                        labels: const ['Fixed · per person', 'Split · total'],
                        selectedIndex: data.priceMode,
                        onChanged: (i) => _form.setPriceMode(i),
                      ),
                      const SizedBox(height: AppSpacing.x3),
                      // Amount, min stepper and live estimate in one card.
                      _PriceCard(
                        priceController: _priceController,
                        onPriceChanged: _form.setPrice,
                        isSplit: data.priceMode == 1,
                        min: data.minPlayers ?? data.maxParticipants,
                        max: data.maxParticipants,
                        onMinChanged: (v) => _form.setMinPlayers(
                          v >= data.maxParticipants ? null : v,
                        ),
                        total: double.tryParse(_priceController.text.trim()),
                      ),
                    ],
                  )
                : const SizedBox(width: double.infinity),
          ),
        ),
        const SizedBox(height: AppSpacing.x4),

        // Join Policy — same choice-card language as Entry above.
        _FieldLabel('Who Can Join'),
        const SizedBox(height: 2),
        Text(
          'Control how people join your game',
          style: AppTypography.metaSub(context),
        ),
        const SizedBox(height: _kLabelGap + 2),
        Row(
          children: [
            Expanded(
              child: _ChoiceCard(
                icon: _joinPolicyMeta['open']!.icon,
                title: _joinPolicyMeta['open']!.title,
                subtitle: _joinPolicyMeta['open']!.subtitle,
                selected: data.joinPolicy == 'open',
                onTap: () => _form.setJoinPolicy('open'),
              ),
            ),
            const SizedBox(width: AppSpacing.x3),
            Expanded(
              child: _ChoiceCard(
                icon: _joinPolicyMeta['approval']!.icon,
                title: _joinPolicyMeta['approval']!.title,
                subtitle: _joinPolicyMeta['approval']!.subtitle,
                selected: data.joinPolicy == 'approval',
                onTap: () => _form.setJoinPolicy('approval'),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.x5),

        // Description.
        Row(
          children: [
            _FieldLabel('Description'),
            const SizedBox(width: 6),
            Text('(Optional)', style: AppTypography.metaSub(context)),
            const Spacer(),
            Text(
              '${data.description.length}/300',
              style: AppTypography.metaSub(context),
            ),
          ],
        ),
        const SizedBox(height: _kLabelGap),
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
            controller: _descriptionController,
            style: _inputStyle(context),
            cursorColor: AppColors.primary,
            minLines: 3,
            maxLines: 5,
            inputFormatters: [LengthLimitingTextInputFormatter(300)],
            decoration: _dec(
              context,
              "Friendly 5v5 runs for intermediate players. Let's have fun "
              'and improve together!',
            ),
            onChanged: _form.setDescription,
          ),
        ),
        const SizedBox(height: AppSpacing.x4),

        // Photos.
        Row(
          children: [
            _FieldLabel('Add Photos'),
            const SizedBox(width: 6),
            Text('(Optional)', style: AppTypography.metaSub(context)),
          ],
        ),
        const SizedBox(height: _kLabelGap),
        _CoverPhoto(
          uploadInfo: uploadInfo,
          // Draft-restored cover survives process death while the in-memory upload provider does not.
          fallbackBytes: _decodeCoverBytes(data.coverImagePath),
          onTap: _pickImage,
          onRemove: () {
            ref.read(imageUploadProvider.notifier).reset();
            _form.setCoverImage(null);
          },
          onReplace: _pickImage,
        ),
      ],
    );
  }

  // Preview.

  /// Decodes the draft's stored cover (base64 from [_pickImage]) for immediate display.
  Uint8List? _decodeCoverBytes(String? stored) {
    if (stored == null || stored.isEmpty) return null;
    try {
      return base64.decode(stored);
    } catch (_) {
      return null;
    }
  }

  Widget _buildPreviewStep(ActivityFormData data) {
    final paid = data.feeType == 1;
    final split = paid && data.priceMode == 1;
    final amount = double.tryParse(_priceController.text.trim());
    final min = split
        ? (data.minPlayers ?? data.maxParticipants).clamp(
            2,
            data.maxParticipants,
          )
        : null;
    final preview = ActivityModel(
      id: 'preview',
      title: data.title.trim().isEmpty ? 'Your activity' : data.title.trim(),
      sportType: data.sportType,
      description: data.description.trim(),
      location: data.location.trim().isEmpty
          ? 'Location TBD'
          : data.location.trim(),
      distanceKm: 0,
      dateTime:
          data.selectedDate ?? DateTime.now().add(const Duration(hours: 2)),
      skillLevel: data.skillLevel,
      capacity: data.maxParticipants,
      participantCount: 1,
      hostName: 'You',
      durationMinutes: data.durationMinutes,
      isPaid: paid,
      fee: paid
          ? (split && min != null && amount != null && amount > 0
                ? (amount / min * 100).round() / 100
                : amount)
          : null,
      feeMode: split ? 'split' : 'fixed',
      totalCost: split ? amount : null,
      minPlayers: split && min != null && min < data.maxParticipants
          ? min
          : null,
    );

    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.x5,
        AppSpacing.x2,
        AppSpacing.x5,
        AppSpacing.x8,
      ),
      children: [
        const _StepHeading(
          title: 'Almost there!',
          subtitle: 'This is how others will see your activity',
        ),
        const SizedBox(height: AppSpacing.x4),
        // Card height follows the screen (62%) within sane bounds so the preview fills small phones without.
        SizedBox(
          height: (MediaQuery.of(context).size.height * 0.62)
              .clamp(420.0, 640.0)
              .toDouble(),
          // The picked photo has no URL yet (upload happens on submit), so hand the raw bytes to the hero directly.
          child: DiscoveryCard(
            activity: preview,
            coverImageBytes: _decodeCoverBytes(data.coverImagePath),
          ),
        ),
        const SizedBox(height: AppSpacing.x5),
        const _CheckRow('Your activity looks great.'),
        const SizedBox(height: AppSpacing.x2),
        const _CheckRow('You can edit details before creating.'),
      ],
    );
  }

  // Small inline helpers.

  Widget _chevron(BuildContext context) => Icon(
    Icons.chevron_right_rounded,
    size: 20,
    color: context.colors.textTertiary,
  );

  TextStyle _valueStyle(BuildContext context) =>
      AppTypography.bodyMedium(context).copyWith(
        fontSize: 15,
        fontWeight: FontWeight.w500,
        color: context.colors.textPrimary,
      );
}

// ───────────────────────────────────────────────────────────────────────────── Step chrome.

/// Thin progress bar under the header showing wizard advancement.
