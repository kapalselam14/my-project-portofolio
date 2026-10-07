import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/providers/repository_providers.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/pressable_scale.dart';

// Provider.

/// Persists each toggle as `notif_<key>` in SharedPreferences.
final _notifSettingsProvider =
    StateNotifierProvider<_NotifSettingsNotifier, Map<String, bool>>((ref) {
      return _NotifSettingsNotifier();
    });

class _NotifSettingsNotifier extends StateNotifier<Map<String, bool>> {
  _NotifSettingsNotifier() : super(_defaults) {
    _load();
  }

  static const _defaults = <String, bool>{
    'game_cancellations': true,
    'new_messages': true,
  };

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final loaded = Map<String, bool>.from(_defaults);
    for (final key in _defaults.keys) {
      final stored = prefs.getBool('notif_$key');
      if (stored != null) loaded[key] = stored;
    }
    state = loaded;
  }

  Future<void> toggle(String key) async {
    final next = !(state[key] ?? false);
    state = {...state, key: next};
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('notif_$key', next);
    // TODO(push): subscribe/unsubscribe the matching FCM topic when a category is toggled.
  }
}

// Screen.

class NotificationSettingsScreen extends ConsumerWidget {
  const NotificationSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(_notifSettingsProvider);
    final notifier = ref.read(_notifSettingsProvider.notifier);

    return AppScaffold.detail(
      title: 'Notifications',
      showHomeIndicator: false,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.x5,
          AppSpacing.x4,
          AppSpacing.x5,
          AppSpacing.x8,
        ),
        children: [
          Text(
            'Choose what alerts you want to receive',
            style: AppTypography.bodyMedium(
              context,
            ).copyWith(color: context.colors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.x2),
          Text(
            "These preferences are saved on this device only and don't change push delivery yet.",
            style: AppTypography.metaSub(context),
          ),
          const SizedBox(height: AppSpacing.x3),

          // Best-effort badge count from the server's canonical feed (`GET /notifications/me` via the repository.
          Semantics(
            button: true,
            label: 'Refresh from server',
            child: PressableScale(
              onTap: () => _refreshFromServer(context, ref),
              child: Container(
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: context.colors.surface,
                  borderRadius: BorderRadius.circular(AppRadius.card),
                  border: Border.all(color: context.colors.border),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.refresh_rounded,
                      size: 18,
                      color: context.colors.primaryOnSurface,
                    ),
                    const SizedBox(width: AppSpacing.x2),
                    Text(
                      'Refresh from server',
                      style: AppTypography.labelField(context).copyWith(
                        color: context.colors.primaryOnSurface,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.x6),

          // Only categories the backend actually sends today: activity_cancelled + dm_message.
          _Section(
            label: 'GAME UPDATES',
            children: [
              _ToggleRow(
                title: 'Game Cancellations',
                subtitle: 'Notify instantly if a game gets cancelled',
                value: settings['game_cancellations'] ?? true,
                onChanged: () => notifier.toggle('game_cancellations'),
                last: true,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.x5),

          _Section(
            label: 'SOCIAL ACTIVITY',
            children: [
              _ToggleRow(
                title: 'New Messages',
                subtitle: 'Direct messages from other players',
                value: settings['new_messages'] ?? true,
                onChanged: () => notifier.toggle('new_messages'),
                last: true,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// Server refresh.

/// Best-effort unread badge count from the live feed.
Future<void> _refreshFromServer(BuildContext context, WidgetRef ref) async {
  try {
    final unread = await ref.read(notificationRepositoryProvider).unread();
    if (!context.mounted) return;
    AppSnackbar.show(
      context,
      message: unread.isEmpty
          ? 'You are all caught up — no unread notifications.'
          : 'You have ${unread.length} unread notification${unread.length == 1 ? '' : 's'}.',
    );
  } catch (_) {
    if (!context.mounted) return;
    AppSnackbar.show(
      context,
      message: 'Could not reach the server — showing device settings.',
      variant: AppSnackbarVariant.error,
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({required this.label, required this.children});
  final String label;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AppTypography.metaSub(context).copyWith(
            fontWeight: FontWeight.w700,
            letterSpacing: 0.6,
            fontSize: 11,
            color: context.colors.textTertiary,
          ),
        ),
        const SizedBox(height: AppSpacing.x2),
        Container(
          decoration: BoxDecoration(
            color: context.colors.surface,
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(color: context.colors.border),
            boxShadow: AppShadows.card,
          ),
          child: Column(children: children),
        ),
      ],
    );
  }
}

// Toggle row.

class _ToggleRow extends StatelessWidget {
  const _ToggleRow({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
    this.last = false,
  });
  final String title;
  final String subtitle;
  final bool value;
  final VoidCallback onChanged;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Semantics(
          label: '$title: ${value ? 'enabled' : 'disabled'}',
          toggled: value,
          child: InkWell(
            onTap: onChanged,
            borderRadius: last
                ? const BorderRadius.only(
                    bottomLeft: Radius.circular(AppRadius.card),
                    bottomRight: Radius.circular(AppRadius.card),
                  )
                : null,
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.x4,
                vertical: AppSpacing.x3,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: AppTypography.labelField(context)),
                        const SizedBox(height: 2),
                        Text(subtitle, style: AppTypography.metaSub(context)),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.x3),
                  Switch.adaptive(
                    value: value,
                    onChanged: (_) => onChanged(),
                    activeThumbColor: Colors.white,
                    activeTrackColor: context.colors.primaryOnSurface,
                    inactiveThumbColor: Colors.white,
                    inactiveTrackColor: context.colors.border,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ],
              ),
            ),
          ),
        ),
        if (!last)
          Divider(
            height: 1,
            color: context.colors.border,
            indent: AppSpacing.x4,
            endIndent: AppSpacing.x4,
          ),
      ],
    );
  }
}
