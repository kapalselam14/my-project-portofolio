import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';

import '../../../core/providers/profile_providers.dart';
import '../../../core/providers/repository_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/widgets/app_dialog.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/app_tappable.dart';
import '../../../core/widgets/app_text_field.dart';
import '../../../core/widgets/asset_image.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../../core/widgets/skeleton.dart';
import '../domain/user_model.dart';
import '../data/user_repository.dart';
import '../../activities/presentation/create/components/image_picker_modal.dart';

part 'widgets/edit_profile_sections.dart';
part 'widgets/edit_profile_sports.dart';
part 'widgets/edit_profile_save.dart';

// Screen.

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _nameController = TextEditingController();
  final _bioController = TextEditingController();
  final _emailController = TextEditingController();
  final _locationController = TextEditingController();
  final _heightController = TextEditingController();
  final _weightController = TextEditingController();
  final _goalController = TextEditingController();
  final _dobController = TextEditingController();

  DateTime? _dob;
  bool _loading = false;
  bool _uploadingPhoto = false;
  bool _initialised = false;
  bool _dirty = false;

  /// Id of the user the fields were last initialised from.
  String? _loadedUserId;

  final List<_SportEntry> _sports = [];

  @override
  void initState() {
    super.initState();
    for (final c in [
      _nameController,
      _bioController,
      _emailController,
      _locationController,
      _heightController,
      _weightController,
      _goalController,
    ]) {
      c.addListener(_markDirty);
    }
  }

  void _markDirty() {
    if (!_dirty) setState(() => _dirty = true);
  }

  void _syncDobText() {
    _dobController.text = _dob != null
        ? DateFormat('d MMMM y').format(_dob!)
        : '';
  }

  @override
  void dispose() {
    _nameController.dispose();
    _bioController.dispose();
    _emailController.dispose();
    _locationController.dispose();
    _heightController.dispose();
    _weightController.dispose();
    _goalController.dispose();
    _dobController.dispose();
    super.dispose();
  }

  void _initFields(UserModel user) {
    if (_initialised && _loadedUserId == user.id) return;
    _loadedUserId = user.id;
    _nameController.text = user.displayName;
    _bioController.text = user.bio ?? '';
    _emailController.text = user.email ?? '';
    _locationController.text = user.location ?? '';
    _dob = user.dateOfBirth;
    _syncDobText();
    _heightController.text = user.heightCm?.toString() ?? '';
    _weightController.text = user.weightKg?.toString() ?? '';
    _goalController.text = user.goal ?? '';
    _sports.clear();
    _sports.addAll(
      user.sports.map(
        (s) => _SportEntry(name: s.sport, level: _levelIndex(s.level)),
      ),
    );
    _initialised = true;
    _dirty = false;
  }

  static int _levelIndex(String level) => switch (level) {
    'Beginner' => 0,
    'Advanced' => 2,
    _ => 1,
  };

  Future<void> _pickDob() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _dob ?? DateTime(1996, 1, 1),
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
      builder: (context, child) => Theme(
        data: Theme.of(context).copyWith(
          colorScheme: const ColorScheme.light(
            primary: AppColors.primary,
            onPrimary: AppColors.textOnPrimary,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) {
      setState(() {
        _dob = picked;
        _syncDobText();
        _dirty = true;
      });
    }
  }

  Future<void> _save() async {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      AppSnackbar.show(
        context,
        message: 'Name cannot be empty.',
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    // Height now persists (PATCH /me accepts 50–300); reject garbage locally so the backend 400 never fires for a typo.
    final heightRaw = _heightController.text.trim();
    final height = heightRaw.isEmpty ? null : int.tryParse(heightRaw);
    if (heightRaw.isNotEmpty &&
        (height == null || height < 50 || height > 300)) {
      AppSnackbar.show(
        context,
        message: 'Height must be between 50 and 300 cm.',
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    // Same for weight (PATCH /me accepts 30–300).
    final weightRaw = _weightController.text.trim();
    final weight = weightRaw.isEmpty ? null : int.tryParse(weightRaw);
    if (weightRaw.isNotEmpty &&
        (weight == null || weight < 30 || weight > 300)) {
      AppSnackbar.show(
        context,
        message: 'Weight must be between 30 and 300 kg.',
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    setState(() => _loading = true);
    try {
      await ref
          .read(userRepositoryProvider)
          .updateProfile(
            displayName: name,
            bio: _bioController.text.trim(),
            location: _locationController.text.trim(),
            email: _emailController.text.trim(),
            dateOfBirth: _dob,
            heightCm: height,
            weightKg: weight,
            goal: _goalController.text.trim(),
            sports: _sports
                .map(
                  (s) => (
                    sport: s.name,
                    level: const [
                      'Beginner',
                      'Intermediate',
                      'Advanced',
                    ][s.level],
                  ),
                )
                .toList(),
          );
      ref.invalidate(myProfileProvider);
      if (!mounted) return;
      _dirty = false;
      AppSnackbar.show(
        context,
        message: 'Profile saved',
        variant: AppSnackbarVariant.success,
      );
      context.pop();
    } catch (e) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: e is ProfileUpdateException
            ? e.message
            : "Couldn't save your changes. Please try again.",
        variant: AppSnackbarVariant.error,
      );
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  /// Picks a gallery photo, uploads it, and persists the URL as the profile photo.
  Future<void> _changePhoto() async {
    if (_uploadingPhoto) return;
    // Gallery or camera — same source chooser as the create flow.
    final choice = await showModalBottomSheet<ImageSourceChoice>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const ImagePickerModal(),
    );
    if (choice == null || !mounted) return;
    final picked = await ImagePicker().pickImage(
      source: choice == ImageSourceChoice.camera
          ? ImageSource.camera
          : ImageSource.gallery,
      maxWidth: 1024,
      imageQuality: 85,
    );
    if (picked == null || !mounted) return;
    setState(() => _uploadingPhoto = true);
    try {
      await ref
          .read(userRepositoryProvider)
          .uploadAvatar(localPath: picked.path);
      ref.invalidate(myProfileProvider);
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: 'Profile photo updated.',
        variant: AppSnackbarVariant.success,
      );
    } on AvatarTooLargeException catch (e) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: e.message,
        variant: AppSnackbarVariant.error,
      );
    } catch (_) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: 'Could not update photo. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    } finally {
      if (mounted) setState(() => _uploadingPhoto = false);
    }
  }

  Future<bool> _confirmDiscard() async {
    if (!_dirty) return true;
    final discard = await AppDialog.confirm(
      context,
      title: 'Discard changes?',
      body: 'Your edits have not been saved.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      destructive: true,
    );
    return discard ?? false;
  }

  Future<void> _onBack() async {
    final discard = await _confirmDiscard();
    if (!discard || !mounted) return;
    if (!context.mounted) return;
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(myProfileProvider);

    return PopScope(
      canPop: !_dirty,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final discard = await _confirmDiscard();
        if (!discard || !mounted || !context.mounted) return;
        context.pop();
      },
      child: AppScaffold(
        safeAreaTop: true,
        showHomeIndicator: false,
        backgroundColor: context.colors.background,
        body: Column(
          children: [
            // Header.
            Container(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.x4,
                AppSpacing.x3,
                AppSpacing.x5,
                AppSpacing.x3,
              ),
              decoration: BoxDecoration(
                color: context.colors.surface,
                border: Border(
                  bottom: BorderSide(color: context.colors.border),
                ),
              ),
              child: Row(
                children: [
                  Semantics(
                    button: true,
                    label: 'Back',
                    child: PressableScale(
                      onTap: _onBack,
                      child: Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          color: context.colors.surfaceMuted,
                          borderRadius: BorderRadius.circular(AppRadius.md),
                        ),
                        alignment: Alignment.center,
                        child: Icon(
                          Icons.arrow_back_ios_new_rounded,
                          size: 16,
                          color: context.colors.textPrimary,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.x3),
                  Expanded(
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Edit Profile',
                          style: AppTypography.titleSheet(context),
                        ),
                        // Live unsaved-changes dot.
                        AnimatedOpacity(
                          opacity: _dirty ? 1 : 0,
                          duration: const Duration(milliseconds: 200),
                          child: Container(
                            margin: const EdgeInsets.only(left: 8),
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: AppColors.primary,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Mirror spacer
                  const SizedBox(width: 38),
                ],
              ),
            ),

            // Body.
            Expanded(
              child: profileAsync.when(
                loading: () => const SkeletonList(count: 6),
                error: (_, _) =>
                    const Center(child: Text('Could not load profile.')),
                data: (user) {
                  _initFields(user);
                  return SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.x5,
                      AppSpacing.x5,
                      AppSpacing.x5,
                      AppSpacing.x8,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Avatar
                        Center(
                          child: _AvatarBlock(
                            user: user,
                            isUploading: _uploadingPhoto,
                            onTap: _changePhoto,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.x5),

                        // Personal info card
                        _SectionCard(
                          title: 'Personal Info',
                          icon: Icons.person_outline_rounded,
                          child: Column(
                            children: [
                              AppTextField.form(
                                label: 'FULL NAME',
                                controller: _nameController,
                              ),
                              const SizedBox(height: AppSpacing.x4),
                              AppTextField.form(
                                label: 'BIO',
                                controller: _bioController,
                                maxLines: 3,
                              ),
                              const SizedBox(height: AppSpacing.x4),
                              AppTextField.form(
                                label: 'LOCATION',
                                controller: _locationController,
                              ),
                              const SizedBox(height: AppSpacing.x4),
                              PressableScale(
                                onTap: _pickDob,
                                child: AbsorbPointer(
                                  child: AppTextField.form(
                                    label: 'DATE OF BIRTH',
                                    controller: _dobController,
                                    hint: 'Select date',
                                    trailing: Icon(
                                      Icons.calendar_month_outlined,
                                      size: 18,
                                      color: context.colors.textTertiary,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: AppSpacing.x4),

                        // Contact card — PATCH /me persists none of these yet (see RemoteUserRepository.updateProfile).
                        _SectionCard(
                          title: 'Contact',
                          icon: Icons.mail_outline_rounded,
                          child: Column(
                            children: [
                              AppTextField.form(
                                label: 'EMAIL',
                                controller: _emailController,
                                keyboardType: TextInputType.emailAddress,
                                enabled: false,
                              ),
                              const SizedBox(height: AppSpacing.x3),
                              const _NotSyncedCaption(),
                            ],
                          ),
                        ),
                        const SizedBox(height: AppSpacing.x4),

                        // Physical card — height, weight and goal all persist via PATCH /me.
                        _SectionCard(
                          title: 'Physical',
                          icon: Icons.fitness_center_outlined,
                          child: Column(
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: AppTextField.form(
                                      label: 'HEIGHT (CM)',
                                      controller: _heightController,
                                      keyboardType: TextInputType.number,
                                    ),
                                  ),
                                  const SizedBox(width: AppSpacing.x3),
                                  Expanded(
                                    child: AppTextField.form(
                                      label: 'WEIGHT (KG)',
                                      controller: _weightController,
                                      keyboardType: TextInputType.number,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: AppSpacing.x4),
                              AppTextField.form(
                                label: 'PRIMARY GOAL',
                                controller: _goalController,
                                hint: 'e.g. Run a half-marathon',
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: AppSpacing.x4),

                        // My sports card
                        _SectionCard(
                          title: 'My Sports',
                          icon: Icons.sports_basketball_outlined,
                          trailing: AppTappable(
                            semanticLabel: 'Add sport',
                            feedback: AppTapFeedback.scale,
                            onTap: () => _showAddSportSheet(context),
                            minSize: 0,
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.x3,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                color: context.colors.primarySoft,
                                borderRadius: BorderRadius.circular(
                                  AppRadius.pill,
                                ),
                                border: Border.all(
                                  color: context.colors.primaryOnSurface
                                      .withValues(alpha: 0.4),
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.add_rounded,
                                    size: 14,
                                    color: context.colors.primaryOnSurface,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    'Add sport',
                                    style: AppTypography.chipLabel(context)
                                        .copyWith(
                                          color:
                                              context.colors.primaryOnSurface,
                                          fontSize: 12,
                                        ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          child: _sports.isEmpty
                              ? Text(
                                  'No sports added yet. Tap Add sport to get started.',
                                  style: AppTypography.metaSub(context),
                                )
                              : Column(
                                  children: List.generate(
                                    _sports.length,
                                    (i) => Padding(
                                      padding: EdgeInsets.only(
                                        bottom: i < _sports.length - 1
                                            ? AppSpacing.x3
                                            : 0,
                                      ),
                                      child: _SportCard(
                                        entry: _sports[i],
                                        onLevelChanged: (level) => setState(() {
                                          _sports[i] = _SportEntry(
                                            name: _sports[i].name,
                                            level: level,
                                          );
                                          _dirty = true;
                                        }),
                                        onRemove: () => setState(() {
                                          _sports.removeAt(i);
                                          _dirty = true;
                                        }),
                                      ),
                                    ),
                                  ),
                                ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),

            // Pinned save bar.
            _SaveBar(loading: _loading, onSave: _save),
          ],
        ),
      ),
    );
  }

  static const _addableSports = [
    'Basketball',
    'Tennis',
    'Soccer',
    'Running',
    'Volleyball',
    'Cycling',
    'Swimming',
    'Golf',
  ];

  Future<void> _showAddSportSheet(BuildContext context) async {
    final existing = _sports.map((s) => s.name).toSet();
    final options = _addableSports.where((s) => !existing.contains(s)).toList();
    if (options.isEmpty) return;

    final picked = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => SafeArea(
        top: false,
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
            AppSpacing.x5,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Drag handle
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
              Text('Add a sport', style: AppTypography.titleSheet(context)),
              const SizedBox(height: AppSpacing.x4),
              ...options.map(
                (s) => PressableScale(
                  onTap: () => Navigator.of(context).pop(s),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      vertical: AppSpacing.x3,
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            s,
                            style: AppTypography.bodyReading(context),
                          ),
                        ),
                        Icon(
                          Icons.add_rounded,
                          size: 18,
                          color: context.colors.textTertiary,
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );

    if (picked != null) {
      setState(() {
        _sports.add(_SportEntry(name: picked, level: 1));
        _dirty = true;
      });
    }
  }
}

// Section card.
