import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/providers/repository_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/geohash.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/error_retry.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../../core/widgets/skeleton.dart';
import '../../discovery/domain/activity_model.dart';
import '../../sports/domain/sport_config.dart';
import '../domain/place_suggestion.dart';
import 'my_activities_screen.dart';
import 'widgets/venue_field.dart';

part 'widgets/edit_chrome.dart';
part 'widgets/edit_form_fields.dart';

/// Host-only edit screen for an existing activity.
/// Prefills every field from the loaded activity and PATCHes only what the host changed.
/// Layout follows the same visual language as [CreateActivityScreen].
class EditActivityScreen extends ConsumerStatefulWidget {
  const EditActivityScreen({super.key, required this.activityId});
  final String activityId;

  @override
  ConsumerState<EditActivityScreen> createState() => _EditActivityScreenState();
}

final _editActivityProvider = FutureProvider.autoDispose
    .family<ActivityModel?, String>((ref, id) {
      return ref.watch(activityRepositoryProvider).byId(id);
    });

class _EditActivityScreenState extends ConsumerState<EditActivityScreen> {
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
  static const _skillOptions = [
    'All Level',
    'Beginner',
    'Intermediate',
    'Advanced',
  ];

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

  static const _skillMeta = <String, ({IconData icon, String subtitle})>{
    'All Level': (icon: Icons.groups_outlined, subtitle: 'Everyone welcome'),
    'Beginner': (icon: Icons.eco_outlined, subtitle: 'Just starting out'),
    'Intermediate': (
      icon: Icons.trending_up_outlined,
      subtitle: 'Knows the basics',
    ),
    'Advanced': (icon: Icons.bolt_outlined, subtitle: 'Competitive play'),
  };

  static const _joinPolicyMeta = <String, ({IconData icon, String subtitle})>{
    'open': (
      icon: Icons.lock_open_outlined,
      subtitle: 'Anyone can join instantly',
    ),
    'approval': (
      icon: Icons.verified_outlined,
      subtitle: 'You approve each request',
    ),
  };

  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _priceController = TextEditingController();

  bool _initialised = false;
  bool _saving = false;
  int _titleLen = 0;
  int _descLen = 0;

  String _sport = 'Basketball';
  DateTime? _date;
  int _durationMinutes = 120;
  PlaceSuggestion? _venue;
  int _capacity = 10;
  int _minCapacity = 2;
  String _skill = 'All Level';
  String _joinPolicy = 'open';

  /// Entry fee: 0 = Free, 1 = Paid (same convention as Create).
  int _feeType = 0;

  // Original snapshot — powers the discard-changes check behind the ✕.
  String _origTitle = '';
  String _origDesc = '';
  String _origSport = '';
  DateTime? _origDate;
  int _origDuration = 0;
  String? _origVenueLabel;
  double? _origLat;
  double? _origLng;
  int _origCapacity = 0;
  String _origSkill = '';
  String _origJoinPolicy = '';
  int _origFeeType = 0;
  String _origPrice = '';

  @override
  void initState() {
    super.initState();
    _titleController.addListener(
      () => setState(() => _titleLen = _titleController.text.length),
    );
    _descriptionController.addListener(
      () => setState(() => _descLen = _descriptionController.text.length),
    );
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _priceController.dispose();
    super.dispose();
  }

  void _initFrom(ActivityModel a) {
    _titleController.text = a.title;
    _descriptionController.text = a.description;
    _titleLen = a.title.length;
    _descLen = a.description.length;
    _sport = _sportOptions.contains(a.sportType) ? a.sportType : 'Basketball';
    _date = a.dateTime;
    _durationMinutes = a.durationMinutes;
    _capacity = a.capacity;
    _minCapacity = a.participantCount.clamp(2, a.capacity);
    if (_capacity < _minCapacity) _capacity = _minCapacity;
    _skill = _skillOptions.contains(a.skillLevel) ? a.skillLevel : 'All Level';
    _joinPolicy = a.joinPolicy;
    _feeType = a.isPaid ? 1 : 0;
    _priceController.text = _formatPrice(a.fee);
    if (a.latitude != null && a.longitude != null) {
      _venue = PlaceSuggestion(
        placeId: 'existing',
        label: a.location,
        secondary: '',
        latitude: a.latitude!,
        longitude: a.longitude!,
      );
    }
    // Snapshot for the discard-changes check.
    _origTitle = a.title;
    _origDesc = a.description;
    _origSport = _sport;
    _origDate = _date;
    _origDuration = _durationMinutes;
    _origVenueLabel = _venue?.label;
    _origLat = _venue?.latitude;
    _origLng = _venue?.longitude;
    _origCapacity = _capacity;
    _origSkill = _skill;
    _origJoinPolicy = _joinPolicy;
    _origFeeType = _feeType;
    _origPrice = _priceController.text;
    _initialised = true;
  }

  /// Display form of a stored fee: `5.0` → `'5'`, `4.5` → `'4.5'`.
  static String _formatPrice(double? fee) {
    if (fee == null) return '';
    return fee.truncateToDouble() == fee
        ? fee.toInt().toString()
        : fee.toString();
  }

  double? get _parsedPrice {
    final v = double.tryParse(_priceController.text.trim());
    return (v != null && v > 0) ? v : null;
  }

  bool get _isDirty {
    if (!_initialised) return false;
    return _titleController.text != _origTitle ||
        _descriptionController.text != _origDesc ||
        _sport != _origSport ||
        _date != _origDate ||
        _durationMinutes != _origDuration ||
        _venue?.label != _origVenueLabel ||
        _venue?.latitude != _origLat ||
        _venue?.longitude != _origLng ||
        _capacity != _origCapacity ||
        _skill != _origSkill ||
        _joinPolicy != _origJoinPolicy ||
        _feeType != _origFeeType ||
        _priceController.text != _origPrice;
  }

  /// ✕ pressed — pop straight away when nothing changed, otherwise confirm so an accidental tap never throws edits.
  Future<void> _onClose() async {
    if (_saving) return;
    if (!_isDirty) {
      Navigator.of(context).maybePop();
      return;
    }
    final discard = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Discard changes?'),
        content: const Text(
          'You have unsaved changes. They will be lost if you leave.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Keep editing'),
          ),
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: Text(
              'Discard',
              style: TextStyle(color: context.colors.errorText),
            ),
          ),
        ],
      ),
    );
    if (discard == true && mounted) Navigator.of(context).maybePop();
  }

  String? _error() {
    if (_titleController.text.trim().isEmpty) {
      return 'Please enter a title.';
    }
    if (_venue == null) return 'Please pick a venue on the map.';
    if (_date == null) return 'Please pick a date and time.';
    if (_feeType == 1 && _parsedPrice == null) {
      return 'Please enter a valid price.';
    }
    return null;
  }

  Future<void> _save(ActivityModel original) async {
    FocusScope.of(context).unfocus();
    final err = _error();
    if (err != null) {
      AppSnackbar.show(
        context,
        message: err,
        variant: AppSnackbarVariant.error,
      );
      return;
    }
    if (_saving) return;
    // The date picker still opens at today, so hosts fixing a started game get a heads-up.
    if (original.dateTime.isBefore(DateTime.now())) {
      AppSnackbar.show(
        context,
        message: 'This game already started — time edits are limited.',
        variant: AppSnackbarVariant.warning,
      );
    }
    setState(() => _saving = true);
    try {
      final venue = _venue!;
      final start = _date!;
      final paid = _feeType == 1;
      await ref
          .read(activityRepositoryProvider)
          .updateActivity(
            activityId: widget.activityId,
            title: _titleController.text.trim(),
            sportType: _sport,
            description: _descriptionController.text.trim(),
            locationName: venue.label,
            latitude: venue.latitude,
            longitude: venue.longitude,
            geohash: geohashEncode(venue.latitude, venue.longitude),
            startTime: start,
            endTime: start.add(Duration(minutes: _durationMinutes)),
            skillLevel: _skill,
            capacity: _capacity,
            joinPolicy: _joinPolicy,
            isPaid: paid,
            // Free clears any stored fee server-side; paid sends the price.
            fee: paid ? _parsedPrice : null,
          );
      ref.invalidate(hostedGamesProvider);
      ref.invalidate(joinedGamesProvider);
      if (!mounted) return;
      HapticFeedback.mediumImpact();
      // Pop silent — the manage screen shows the confirmation snackbar.
      Navigator.of(context).pop(true);
    } catch (_) {
      if (!mounted) return;
      setState(() => _saving = false);
      AppSnackbar.show(
        context,
        message: 'Could not save changes. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    }
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _date ?? now.add(const Duration(days: 1)),
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_date ?? now),
    );
    if (time == null) return;
    HapticFeedback.selectionClick();
    setState(() {
      _date = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    });
  }

  Future<void> _pickOption({
    required String title,
    String? subtitle,
    required List<String> options,
    required String current,
    required ValueChanged<String> onSelect,
    IconData Function(String option)? iconFor,
    String Function(String option)? subtitleFor,
  }) async {
    HapticFeedback.selectionClick();
    final selected = await showModalBottomSheet<String>(
      context: context,
      useSafeArea: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(sheetContext).size.height * 0.7,
          ),
          child: Container(
            decoration: BoxDecoration(
              color: context.colors.surface,
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(AppRadius.xl),
              ),
              boxShadow: AppShadows.sheet,
            ),
            padding: EdgeInsets.fromLTRB(
              AppSpacing.x5,
              AppSpacing.x3,
              AppSpacing.x5,
              AppSpacing.x6 + MediaQuery.of(sheetContext).viewPadding.bottom,
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
                    itemBuilder: (_, i) {
                      final opt = options[i];
                      final isCurrent = opt == current;
                      final icon = iconFor?.call(opt);
                      final sub = subtitleFor?.call(opt);
                      final c = context.colors;
                      return PressableScale(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          Navigator.of(sheetContext).pop(opt);
                        },
                        child: AnimatedContainer(
                          duration: AppDurations.fast,
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.x4,
                            vertical: AppSpacing.x3,
                          ),
                          decoration: BoxDecoration(
                            color: isCurrent ? c.primarySoft : c.surface,
                            borderRadius: BorderRadius.circular(AppRadius.card),
                            border: Border.all(
                              color: isCurrent ? c.primaryOnSurface : c.border,
                              width: isCurrent ? 1.5 : 1,
                            ),
                          ),
                          child: Row(
                            children: [
                              if (icon != null) ...[
                                Container(
                                  width: 38,
                                  height: 38,
                                  decoration: BoxDecoration(
                                    color: isCurrent
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
                                    color: isCurrent
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
                                      opt,
                                      style: AppTypography.bodyMedium(context)
                                          .copyWith(
                                            fontSize: 15,
                                            fontWeight: isCurrent
                                                ? FontWeight.w700
                                                : FontWeight.w600,
                                            color: isCurrent
                                                ? c.primaryOnSurface
                                                : c.textPrimary,
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
                                  color: isCurrent
                                      ? c.primaryOnSurface
                                      : Colors.transparent,
                                  border: Border.all(
                                    color: isCurrent
                                        ? c.primaryOnSurface
                                        : c.borderInput,
                                    width: 1.5,
                                  ),
                                ),
                                alignment: Alignment.center,
                                child: isCurrent
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
    if (selected != null) onSelect(selected);
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_editActivityProvider(widget.activityId));
    return async.when(
      loading: () => AppScaffold(
        title: 'Edit Activity',
        leading: _CloseButton(
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        // Outside ShellRoute (no tab bar) so this draws its own indicator.
        showHomeIndicator: true,
        body: const SkeletonList(count: 4),
      ),
      error: (_, _) => AppScaffold(
        title: 'Edit Activity',
        leading: _CloseButton(
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        showHomeIndicator: true,
        body: ErrorRetry(
          message: 'Could not load this activity.',
          onRetry: () =>
              ref.invalidate(_editActivityProvider(widget.activityId)),
        ),
      ),
      data: (activity) {
        if (activity == null) {
          return AppScaffold(
            title: 'Edit Activity',
            leading: _CloseButton(
              onPressed: () => Navigator.of(context).maybePop(),
            ),
            showHomeIndicator: true,
            body: const Center(child: Text('Activity not found.')),
          );
        }
        if (!_initialised) {
          // Prefill once — guarded so typing never gets clobbered by a provider rebuild.
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted && !_initialised) {
              setState(() => _initFrom(activity));
            }
          });
          return AppScaffold(
            title: 'Edit Activity',
            leading: _CloseButton(
              onPressed: () => Navigator.of(context).maybePop(),
            ),
            showHomeIndicator: true,
            body: const SkeletonList(count: 4),
          );
        }
        return AppScaffold(
          title: 'Edit Activity',
          leading: _CloseButton(onPressed: _onClose),
          actions: [
            _SaveAction(enabled: !_saving, onTap: () => _save(activity)),
          ],
          // Outside ShellRoute (no tab bar) so this draws its own indicator.
          showHomeIndicator: true,
          body: _buildForm(),
          bottomBar: _buildBottomBar(activity),
        );
      },
    );
  }

  Widget _buildForm() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.x5,
        AppSpacing.x2,
        AppSpacing.x5,
        AppSpacing.x8,
      ),
      children: [
        const _SectionHeading(
          title: 'Basic details',
          subtitle: 'What, when and where',
        ),
        const SizedBox(height: AppSpacing.x3),
        _SettingCard(
          icon: Icons.edit_outlined,
          label: 'Activity Title',
          trailing: Text(
            '$_titleLen/40',
            style: AppTypography.metaSub(context),
          ),
          value: TextField(
            controller: _titleController,
            style: _inputStyle(context),
            cursorColor: AppColors.primary,
            textInputAction: TextInputAction.next,
            inputFormatters: [LengthLimitingTextInputFormatter(40)],
            decoration: _dec(context, 'Weekend Basketball Runs'),
          ),
        ),
        _SettingCard(
          icon: _sportIcons[_sport] ?? Icons.sports_basketball_outlined,
          label: 'Sport',
          onTap: () => _pickOption(
            title: 'Sport',
            subtitle: 'What will you be playing?',
            options: pickSportNames(
              ref.watch(sportsConfigProvider).valueOrNull ?? const [],
              (s) => s.canHost,
              _sportOptions,
            ),
            current: _sport,
            onSelect: (v) => setState(() => _sport = v),
            iconFor: (o) => _sportIcons[o] ?? Icons.sports_basketball_outlined,
          ),
          value: Text(_sport, style: _valueStyle(context)),
          trailing: _chevron(context),
        ),
        _SettingCard(
          icon: Icons.calendar_month_outlined,
          label: 'Date & Time',
          onTap: _pickDate,
          value: Text(
            _date == null
                ? 'Pick a date'
                : DateFormat('EEE, MMM d · h:mm a').format(_date!),
            style: _valueStyle(context).copyWith(
              color: _date == null
                  ? context.colors.textSecondary
                  : context.colors.textPrimary,
            ),
          ),
          trailing: _chevron(context),
        ),
        _SettingCard(
          icon: Icons.schedule_outlined,
          label: 'Duration',
          value: Text(
            _formatDuration(_durationMinutes),
            style: _valueStyle(context),
          ),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _CounterBtn(
                icon: Icons.remove,
                enabled: _durationMinutes > 30,
                semanticLabel: 'Shorten duration',
                onTap: () => setState(() => _durationMinutes -= 15),
              ),
              _CounterBtn(
                icon: Icons.add,
                enabled: _durationMinutes < 480,
                emphasised: true,
                semanticLabel: 'Extend duration',
                onTap: () => setState(() => _durationMinutes += 15),
              ),
            ],
          ),
        ),
        VenueField(
          value: _venue,
          onSuggestionSelected: (s) => setState(() => _venue = s),
        ),
        _SettingCard(
          icon: Icons.group_outlined,
          label: 'Max Participants',
          value: Text('$_capacity players', style: _valueStyle(context)),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _CounterBtn(
                icon: Icons.remove,
                enabled: _capacity > _minCapacity,
                semanticLabel: 'Remove one participant',
                onTap: () => setState(() => _capacity -= 1),
              ),
              _CounterBtn(
                icon: Icons.add,
                enabled: _capacity < 50,
                emphasised: true,
                semanticLabel: 'Add one participant',
                onTap: () => setState(() => _capacity += 1),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.x5),
        const _SectionHeading(
          title: 'Preferences',
          subtitle: 'Who should join your game',
        ),
        const SizedBox(height: AppSpacing.x3),
        _FieldLabel('Skill Level'),
        const SizedBox(height: AppSpacing.x2),
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
              selected: _skill == opt,
              onTap: () {
                HapticFeedback.selectionClick();
                setState(() => _skill = opt);
              },
            );
          },
        ),
        const SizedBox(height: AppSpacing.x4),
        _FieldLabel('Who Can Join'),
        const SizedBox(height: AppSpacing.x2),
        Row(
          children: [
            Expanded(
              child: _ChoiceCard(
                icon: _joinPolicyMeta['open']!.icon,
                title: 'Open',
                subtitle: _joinPolicyMeta['open']!.subtitle,
                selected: _joinPolicy == 'open',
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() => _joinPolicy = 'open');
                },
              ),
            ),
            const SizedBox(width: AppSpacing.x3),
            Expanded(
              child: _ChoiceCard(
                icon: _joinPolicyMeta['approval']!.icon,
                title: 'Approval',
                subtitle: _joinPolicyMeta['approval']!.subtitle,
                selected: _joinPolicy == 'approval',
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() => _joinPolicy = 'approval');
                },
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.x5),
        _FieldLabel('Entry Fee'),
        const SizedBox(height: 2),
        Text('Is there a cost to join?', style: AppTypography.metaSub(context)),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _ChoiceCard(
                icon: Icons.volunteer_activism_outlined,
                title: 'Free',
                subtitle: 'Anyone can join',
                selected: _feeType == 0,
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() => _feeType = 0);
                },
              ),
            ),
            const SizedBox(width: AppSpacing.x3),
            Expanded(
              child: _ChoiceCard(
                icon: Icons.payments_outlined,
                title: 'Paid',
                subtitle: 'Set a price',
                selected: _feeType == 1,
                onTap: () {
                  HapticFeedback.selectionClick();
                  setState(() => _feeType = 1);
                },
              ),
            ),
          ],
        ),
        if (_feeType == 1) ...[
          const SizedBox(height: AppSpacing.x3),
          Container(
            height: 48,
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.x4),
            alignment: Alignment.centerLeft,
            decoration: BoxDecoration(
              color: context.colors.surface,
              borderRadius: BorderRadius.circular(AppRadius.input),
              border: Border.all(color: context.colors.border),
            ),
            child: Row(
              children: [
                Text(
                  '\$',
                  style: _inputStyle(
                    context,
                  ).copyWith(color: context.colors.textSecondary),
                ),
                const SizedBox(width: AppSpacing.x1),
                Expanded(
                  child: TextField(
                    controller: _priceController,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    textInputAction: TextInputAction.done,
                    cursorColor: AppColors.primary,
                    style: _inputStyle(context),
                    decoration: _dec(context, '0.00'),
                  ),
                ),
                Text('per person', style: AppTypography.metaSub(context)),
              ],
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.x5),
        Row(
          children: [
            _FieldLabel('Description'),
            const SizedBox(width: 6),
            Text('(Optional)', style: AppTypography.metaSub(context)),
            const Spacer(),
            Text('$_descLen/300', style: AppTypography.metaSub(context)),
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
            controller: _descriptionController,
            style: _inputStyle(context),
            cursorColor: AppColors.primary,
            minLines: 3,
            maxLines: 5,
            inputFormatters: [LengthLimitingTextInputFormatter(300)],
            decoration: _dec(context, 'What should players know?'),
          ),
        ),
      ],
    );
  }

  Widget _buildBottomBar(ActivityModel activity) {
    return Container(
      decoration: BoxDecoration(
        color: context.colors.surface,
        border: Border(top: BorderSide(color: context.colors.border)),
        boxShadow: AppShadows.bottomBar,
      ),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.x5,
        AppSpacing.x3,
        AppSpacing.x5,
        AppSpacing.x4,
      ),
      child: AppButton(
        label: 'Save Changes',
        onPressed: _saving ? null : () => _save(activity),
        loading: _saving,
      ),
    );
  }

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

  static String _formatDuration(int minutes) {
    if (minutes < 60) return '$minutes min';
    final h = minutes ~/ 60;
    final m = minutes % 60;
    if (m == 0) return h == 1 ? '1 hour' : '$h hours';
    return '$h h $m min';
  }
}

// Building blocks (same language as Create).
