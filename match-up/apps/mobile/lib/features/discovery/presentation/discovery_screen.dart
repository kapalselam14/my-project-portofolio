// Discovery swipe deck: cached feed, filter sync, swipe-persist, and match routing.
import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/network/api_client.dart';
import '../../../core/providers/auth_state_provider.dart';
import '../../../core/providers/preferences_provider.dart';
import '../../../core/providers/repository_providers.dart';
import '../../../core/storage/local_storage.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/utils/nav_guard.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/error_retry.dart';
import '../../../core/widgets/home_header.dart';
import '../../../core/widgets/pressable_scale.dart';
import '../../../core/widgets/skeleton.dart';
import '../../tour/presentation/tour_anchors.dart';
import '../../tour/presentation/tour_controller.dart';
import '../../activities/presentation/my_activities_screen.dart';
import '../domain/activity_model.dart';
import '../data/remote_activity_repository.dart';
import '../domain/discovery_filter.dart';
import '../domain/swipe_decision.dart';
import 'widgets/discovery_actions.dart';
import 'widgets/swipe_deck.dart';

// Providers.

final _unreadNotifCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final all = await ref.watch(notificationRepositoryProvider).all();
  return all.where((n) => n.unread).length;
});

/// Whether the deck includes passed (left-swiped) cards.
/// Deliberately NOT autoDispose and NOT widget-local state: the Discover tab's State is destroyed every time the user.
/// Rebuilt on account switch (watches the auth uid) so Lisa never inherits Benjamin's "Start over" session flag.
final _includeSwipedProvider = StateProvider<bool>((ref) {
  ref.watch(authStateProvider.select((s) => s.userId));
  return false;
});

/// User-configurable discovery filter, written by the Filter screen and read by Discovery.
/// Rebuilt to empty on account switch (watches the auth uid) AND persisted per-user (see [_filterKeyFor]).
final discoveryFilterProvider = StateProvider<DiscoveryFilter>((ref) {
  ref.watch(authStateProvider.select((s) => s.userId));
  return const DiscoveryFilter();
});

/// Per-user SharedPreferences key for the persisted discovery filter.
String _filterKeyFor(String? uid) => 'discovery_filter_v1_${uid ?? 'anon'}';

/// Best-effort write-through of the user filter. Never blocks UI and never throws.
Future<void> _persistFilter(DiscoveryFilter filter, String? uid) async {
  try {
    final store = await LocalStorage.create().timeout(
      const Duration(seconds: 2),
    );
    await store
        .setString(_filterKeyFor(uid), jsonEncode(filter.toJson()))
        .timeout(const Duration(seconds: 2));
  } catch (_) {
    // Best-effort only.
  }
}

/// Opens the filter store, or null when unavailable (fresh install without the plugin.
Future<LocalStorage?> _openFilterStore() async {
  try {
    return await LocalStorage.create().timeout(const Duration(seconds: 2));
  } catch (_) {
    return null;
  }
}

// Screen.

class DiscoveryScreen extends ConsumerStatefulWidget {
  const DiscoveryScreen({super.key});

  @override
  ConsumerState<DiscoveryScreen> createState() => _DiscoveryScreenState();
}

class _DiscoveryScreenState extends ConsumerState<DiscoveryScreen> {
  int _topIndex = 0;
  List<ActivityModel> _activities = const [];
  bool _isLoading = true;

  /// True when the last [_load] failed.
  bool _loadError = false;

  /// End of the most recent drag gesture on the deck.
  DateTime? _lastDragEnd;

  /// In-flight guard for the swipe-to-join/request flow.
  bool _swiping = false;

  /// ProviderSubscription handle — fired by the listener set up in [initState].
  late final ProviderSubscription<DiscoveryFilter> _filterSub;

  /// True while [_seedDefaultFilter] writes the restored filter.
  bool _restoringFilter = false;

  /// True after the user has tapped Apply at least once.
  bool _hasActiveFilter = false;

  /// True when the active filter caps distance but the device couldn't provide a position (GPS off / denied).
  bool _locationUnknown = false;

  @override
  void initState() {
    super.initState();
    // Tour gate: hide the coach-mark overlay until the feed finishes.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(discoveryContentReadyProvider.notifier).state = false;
    });
    // Reload the deck whenever the Filter screen writes a new filter.
    _filterSub = ref.listenManual<DiscoveryFilter>(discoveryFilterProvider, (
      prev,
      next,
    ) {
      // Value equality lives on the model, so redundant writes are ignored here.
      if (prev == next) return;
      debugPrint('[Discovery] filter changed: empty=${next.isEmpty}');
      // Write-through so the choice survives app restart. Per-user key: Benjamin's saved filter must not follow Lisa.
      unawaited(_persistFilter(next, ref.read(authStateProvider).userId));
      // Skip during seed-restore: the seed calls _load() explicitly right after, so loading here would fetch twice.
      if (_restoringFilter) return;
      _load();
    }, fireImmediately: false);
    // Restore the persisted filter (or seed from onboarding prefs on first ever launch) before the first load, then.
    _seedDefaultFilter().then((_) {
      if (mounted) _load();
    });
  }

  /// Restores the filter in priority order: Persisted user filter (survives restart).
  Future<void> _seedDefaultFilter() async {
    if (!ref.read(discoveryFilterProvider).isEmpty) return;
    try {
      final store = await _openFilterStore();
      // Per-user key: a persisted filter belongs to whoever saved it.
      final raw = store?.getString(
        _filterKeyFor(ref.read(authStateProvider).userId),
      );
      if (raw != null && raw.isNotEmpty && mounted) {
        final restored = DiscoveryFilter.fromJson(
          Map<String, dynamic>.from(jsonDecode(raw) as Map),
        );
        final fresh = _dropStaleDates(restored);
        if (!fresh.isEmpty) {
          // Guarded: the listener skips its _load(), the explicit one after the seed covers this restore.
          _restoringFilter = true;
          ref.read(discoveryFilterProvider.notifier).state = fresh;
          _restoringFilter = false;
          return;
        }
      }
    } catch (_) {
      // Corrupt JSON — fall through to prefs.
    }
    if (!mounted) return;
    var prefs = ref.read(sportPreferencesProvider);
    if (prefs.isEmpty) {
      // Cross-device: local prefs are per-install.
      try {
        final me = await ref.read(userRepositoryProvider).me();
        if (!mounted) return;
        if (me.sports.isNotEmpty) {
          final hydrated = {
            for (final s in me.sports)
              s.sport: s.level.isNotEmpty ? s.level : 'Intermediate',
          };
          ref.read(sportPreferencesProvider.notifier).setAll(hydrated);
          prefs = hydrated;
        }
      } catch (_) {
        // Offline — fall through with whatever local prefs exist.
      }
    }
    if (prefs.isEmpty) return;
    ref.read(discoveryFilterProvider.notifier).state = DiscoveryFilter(
      sportSkills: [
        for (final e in prefs.entries)
          DiscoverySportSkill(sport: e.key, skill: _discoverySkill(e.value)),
      ],
      maxDistanceKm: ref.read(distanceFilterProvider),
    );
  }

  /// Drops a custom "Pick dates" range whose end already passed.
  DiscoveryFilter _dropStaleDates(DiscoveryFilter filter) {
    final end = filter.startBefore;
    if (end != null && end.isBefore(DateTime.now())) {
      return DiscoveryFilter(
        sportSkills: filter.sportSkills,
        datePreset: DiscoveryDatePreset.anyTime,
        maxDistanceKm: filter.maxDistanceKm,
      );
    }
    return filter;
  }

  /// Maps a saved skill label ('Beginner', …) to the filter enum.
  DiscoverySkillLevel _discoverySkill(String label) {
    return switch (label.trim().toLowerCase()) {
      'beginner' => DiscoverySkillLevel.beginner,
      'intermediate' => DiscoverySkillLevel.intermediate,
      'advanced' => DiscoverySkillLevel.advanced,
      _ => DiscoverySkillLevel.any,
    };
  }

  @override
  void dispose() {
    _filterSub.close();
    super.dispose();
  }

  /// Manual refresh (header button) bypasses the cache and always shows the skeleton.
  Future<void> _load({bool forceRefresh = false}) async {
    // Merge the session "show swiped" choice into the user filter so a single object travels to the repo.
    final filter = ref
        .read(discoveryFilterProvider)
        .copyWith(includeSwiped: ref.read(_includeSwipedProvider));
    // Show the skeleton on EVERY load (first paint, filter apply, Start over) — not just the first.
    if (mounted && !_isLoading) setState(() => _isLoading = true);
    if (mounted && _loadError) setState(() => _loadError = false);
    ref.read(discoveryContentReadyProvider.notifier).state = false;
    // Anchor for manual refresh: the id on top right now.
    final anchorId = forceRefresh && _topIndex < _activities.length
        ? _activities[_topIndex].id
        : null;
    try {
      final repo = ref.read(activityRepositoryProvider);
      // Committed games (joined + hosted) anchor the time-clash filter.
      List<ActivityModel> committed = const [];
      try {
        final results = await Future.wait([
          repo.joinedByUser('', limit: 50),
          repo.hostedByUser('', limit: 50),
        ]);
        committed = [...results[0], ...results[1]];
      } catch (_) {
        // Offline — feed-derived fallback inside [_applyDeck].
      }
      // Cache-hit serves instantly (tab switches dispose this State.
      final remote = repo is RemoteActivityRepository ? repo : null;
      final wasFresh =
          !forceRefresh && (remote?.isFeedFresh(filter: filter) ?? false);
      final list = await repo.feed(filter: filter, forceRefresh: forceRefresh);
      if (!mounted) return;
      // Never re-deal a card the user already swiped.
      _applyDeck(list, filter, committed: committed, anchorId: anchorId);
      // When the active filter caps distance, probe location availability so the deck can warn instead of silently.
      unawaited(_probeLocationNotice(remote, filter));
      // Silent background refresh when the render above came from a fresh cache entry: the deck converges to live.
      if (wasFresh && remote != null) {
        unawaited(_refreshSilently(remote, filter));
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _loadError = true;
        });
      }
      // Skeleton gone (error path shows the empty deck).
      ref.read(discoveryContentReadyProvider.notifier).state = true;
    }
  }

  /// Builds [_activities] from a raw feed inside setState.
  void _applyDeck(
    List<ActivityModel> list,
    DiscoveryFilter filter, {
    List<ActivityModel>? committed,
    String? anchorId,
  }) {
    // Never re-deal a card the user already swiped.
    final includeSwiped = ref.read(_includeSwipedProvider);
    setState(() {
      // Committed games (joined or hosted) anchor the time-clash check below and never enter the deck themselves.
      final known = (committed == null || committed.isEmpty)
          ? list.where((a) => a.isParticipant || a.isHost).toList()
          : committed;
      _activities = list.where((a) {
        // Stale `open` rows (backend expiry is eventual): never deal a game that already started.
        if (!a.dateTime.isAfter(DateTime.now())) return false;
        // Joined/hosted games live in My Games — never re-deal them in Discover, not on reload, not even on "Start.
        if (a.isParticipant || a.isHost) return false;
        // A right-swipe (join) is permanent: a joined game never re-enters the deck. It lives on in My Games instead.
        if (a.mySwipeDecision == 'join') return false;
        // "Start over" re-deals passes; otherwise only unseen cards.
        return includeSwiped || a.mySwipeDecision == null;
      }).toList();
      // Drop anything time-clashing with a committed game — no point dealing a card they can't attend.
      if (known.isNotEmpty) {
        _activities = _activities.where((a) {
          return !known.any(
            (b) =>
                b.id != a.id &&
                a.dateTime.isBefore(b.endTime) &&
                b.dateTime.isBefore(a.endTime),
          );
        }).toList();
      }
      // Manual-refresh anchor: restore the pre-reload top card when it's still in the deck.
      if (anchorId != null && _activities.isNotEmpty) {
        final at = _activities.indexWhere((a) => a.id == anchorId);
        _topIndex = at < 0 ? 0 : at.clamp(0, _activities.length - 1);
      } else {
        _topIndex = 0;
      }
      _isLoading = false;
      _hasActiveFilter = !filter.isEmpty;
    });
    // Feed painted (deck or empty state) — skeleton gone, anchors measurable.
    ref.read(discoveryContentReadyProvider.notifier).state = true;
  }

  /// Checks whether the device can provide a position when the active filter caps distance.
  Future<void> _probeLocationNotice(
    RemoteActivityRepository? remote,
    DiscoveryFilter filter,
  ) async {
    if (filter.maxDistanceKm == null || remote == null) {
      if (mounted && _locationUnknown) {
        setState(() => _locationUnknown = false);
      }
      return;
    }
    try {
      final has = await remote.hasLocationForGeo().timeout(
        const Duration(seconds: 5),
      );
      if (!mounted) return;
      if (_locationUnknown == !has) return;
      setState(() => _locationUnknown = !has);
    } catch (_) {
      // Silent path — the deck simply stays without the notice.
    }
  }

  /// Re-fetches bypassing the cache and swaps the deck silently.
  Future<void> _refreshSilently(
    RemoteActivityRepository repo,
    DiscoveryFilter filter,
  ) async {
    try {
      final fresh = await repo.feed(filter: filter, forceRefresh: true);
      if (!mounted || _topIndex > 0) return;
      final sameIds =
          fresh.map((a) => a.id).join(',') ==
          _activities.map((a) => a.id).join(',');
      if (sameIds) return;
      // Same committed lists as [_load] so the time-clash filter stays at full strength.
      List<ActivityModel> committed = const [];
      try {
        final results = await Future.wait([
          repo.joinedByUser('', limit: 50),
          repo.hostedByUser('', limit: 50),
        ]);
        committed = [...results[0], ...results[1]];
      } catch (_) {
        // Offline — feed-derived fallback inside [_applyDeck].
      }
      _applyDeck(fresh, filter, committed: committed);
    } catch (_) {
      // Silent path — stale deck simply stays.
    }
  }

  void _swipeOut(bool liked) {
    if (_topIndex >= _activities.length) return;
    // Ignore join taps while a join/request is still pending.
    if (liked && _swiping) return;
    HapticFeedback.lightImpact();
    final activity = _activities[_topIndex];
    final needsApproval = activity.joinPolicy == 'approval';

    // Approval-gated games file a join request (awaited.
    if (liked && needsApproval) {
      _swiping = true;
      unawaited(_requestAndShowPending(activity));
      return;
    }

    // Open games join for real on a right-swipe (awaited — the match screen + My Games would lie if the join failed).
    if (liked && !needsApproval) {
      _swiping = true;
      unawaited(_joinAndShowMatch(activity));
      return;
    }

    final next = _topIndex + 1;
    setState(() => _topIndex = next);

    // Persist the decision to the backend (or local fallback) so the user doesn't see the same card twice on next.
    _persistSwipe(activityId: activity.id, decision: SwipeDecision.pass);

    // Drop cached feeds so a just-swiped card can't be re-dealt from a stale entry within the TTL window.
    final repo = ref.read(activityRepositoryProvider);
    if (repo is RemoteActivityRepository) repo.invalidateFeed();
  }

  /// Fire-and-forget swipe persistence with a visible failure path.
  Future<void> _persistSwipe({
    required String activityId,
    required SwipeDecision decision,
  }) async {
    try {
      await ref
          .read(swipesRepositoryProvider)
          .save(activityId: activityId, decision: decision);
    } catch (_) {
      if (mounted) _onPersistError();
    }
  }

  /// Shared handler for swipe-persist failures (also wired to the deck's `onPersistError`): the swipe already advanced.
  Future<void> _onPersistError() async {
    if (!mounted) return;
    AppSnackbar.show(
      context,
      message: 'Could not save your swipe. Please try again.',
      variant: AppSnackbarVariant.error,
    );
  }

  /// Joins the activity, records the swipe decision, advances past the card, and opens the match screen.
  Future<void> _joinAndShowMatch(ActivityModel activity) async {
    try {
      await ref.read(activityRepositoryProvider).join(activity.id);
    } catch (e) {
      if (!mounted) return;
      if (_isAlreadyJoined(e)) {
        _openMatch(activity);
        return;
      }
      AppSnackbar.show(
        context,
        message: _joinErrorMessage(e, isRequest: false),
        variant: AppSnackbarVariant.error,
      );
      return;
    } finally {
      _swiping = false;
    }
    if (!mounted) return;
    _openMatch(activity);
  }

  /// Records the swipe, advances past the card, and opens the match screen.
  void _openMatch(ActivityModel activity) {
    _persistSwipe(activityId: activity.id, decision: SwipeDecision.join);
    final repo = ref.read(activityRepositoryProvider);
    if (repo is RemoteActivityRepository) repo.invalidateFeed();
    // The Upcoming tab caches keepAlive-side: without this it keeps serving the pre-join list until a manual.
    ref.invalidate(joinedGamesProvider);
    setState(() => _topIndex += 1);
    HapticFeedback.heavyImpact();
    // The joined activity rides along as route extra so the match screen can render from cache when the byId refetch.
    if (mounted) context.go('/match/${activity.id}', extra: activity);
  }

  /// Files the join request, records the swipe decision, advances past the card, and opens the pending screen.
  Future<void> _requestAndShowPending(ActivityModel activity) async {
    try {
      await ref.read(activityRepositoryProvider).requestJoin(activity.id);
    } catch (e) {
      if (!mounted) return;
      if (_isAlreadyPending(e)) {
        _openPending(activity);
        return;
      }
      AppSnackbar.show(
        context,
        message: _joinErrorMessage(e),
        variant: AppSnackbarVariant.error,
      );
      return;
    } finally {
      _swiping = false;
    }
    if (!mounted) return;
    _openPending(activity);
  }

  /// Records the swipe, advances past the card, and opens the pending screen.
  void _openPending(ActivityModel activity) {
    _persistSwipe(activityId: activity.id, decision: SwipeDecision.join);
    final repo = ref.read(activityRepositoryProvider);
    if (repo is RemoteActivityRepository) repo.invalidateFeed();
    // Same staleness contract as _openMatch, for the Pending tab.
    ref.invalidate(pendingGamesProvider);
    setState(() => _topIndex += 1);
    HapticFeedback.heavyImpact();
    context.go('/request-sent/${activity.id}', extra: activity);
  }

  /// True when the backend rejected the request as a duplicate of an existing pending one (409 + the backend's exact.
  bool _isAlreadyPending(Object e) {
    return e is DioException &&
        e.error is ApiException &&
        (e.error as ApiException).statusCode == 409 &&
        (e.error as ApiException).userMessage == 'Join request already pending';
  }

  /// True when the instant-join failed because the viewer is already a participant.
  bool _isAlreadyJoined(Object e) {
    return e is DioException &&
        e.error is ApiException &&
        (e.error as ApiException).statusCode == 409 &&
        (e.error as ApiException).userMessage ==
            'User already joined this activity';
  }

  /// Prefers the backend's own message (full, not open, …) over the generic fallback so failures explain themselves.
  String _joinErrorMessage(Object e, {bool isRequest = true}) {
    if (e is DioException && e.error is ApiException) {
      return (e.error as ApiException).userMessage;
    }
    return isRequest
        ? 'Could not send the request. Please try again.'
        : 'Could not join. Please try again.';
  }

  void _dislike() => _swipeOut(false);
  void _like() => _swipeOut(true);

  void _reset() {
    // Previously this only rewound the index — a visible no-op whenever the swipe filter had emptied the list.
    HapticFeedback.lightImpact();
    ref.read(_includeSwipedProvider.notifier).state = true;
    _load();
  }

  /// Start-over latch release: back to unseen cards only.
  void _showUnseenOnly() {
    HapticFeedback.lightImpact();
    ref.read(_includeSwipedProvider.notifier).state = false;
    _load();
  }

  void _clearFilters() {
    // One-tap escape hatch from a filter-emptied deck.
    HapticFeedback.lightImpact();
    ref.read(discoveryFilterProvider.notifier).state = const DiscoveryFilter();
  }

  void _onDragState(bool dragging) {
    // The deck reports false both at drag end and when the settle/exit animation finishes.
    if (!dragging) _lastDragEnd = DateTime.now();
  }

  void _openDetails() {
    if (_topIndex >= _activities.length) return;
    // Suppress tap-to-details when a drag just ended over the card: a swipe release also lands a tap, which would.
    final lastEnd = _lastDragEnd;
    if (lastEnd != null &&
        DateTime.now().difference(lastEnd) <
            const Duration(milliseconds: 300)) {
      return;
    }
    final activity = _activities[_topIndex];
    // push (not go): go() replaces the whole navigation stack, which leaves the detail screen's back/dislike buttons.
    NavGuard.push(context, '/activity/${activity.id}');
  }

  @override
  Widget build(BuildContext context) {
    final deckExhausted = !_isLoading && _topIndex >= _activities.length;
    final unreadCount = ref.watch(_unreadNotifCountProvider).valueOrNull ?? 0;
    final filterSummary = ref.watch(discoveryFilterProvider).describe();
    final includeSwiped = ref.watch(_includeSwipedProvider);

    return AppScaffold(
      showHomeIndicator: false, // inside ShellRoute — AppShell draws its own.
      body: Column(
        children: [
          HomeHeader(
            title: 'Discover',
            subtitle: _hasActiveFilter ? 'Filtered' : 'Find your next game',
            actions: [
              HomeHeaderAction(
                icon: Icons.tune_rounded,
                semanticLabel: 'Filters',
                onTap: () => NavGuard.push(context, '/filter'),
                anchorKey: TourAnchors.filterButton,
                // Subtle dot in the corner when a non-empty filter is active.
                showDot: _hasActiveFilter,
              ),
              HomeHeaderAction(
                icon: Icons.refresh_rounded,
                semanticLabel: 'Refresh',
                onTap: () => _load(forceRefresh: true),
              ),
              HomeHeaderAction(
                icon: Icons.notifications_none_rounded,
                semanticLabel: 'Notifications',
                onTap: () => NavGuard.push(context, '/notifications'),
                showDot: unreadCount > 0,
              ),
            ],
          ),
          // Location-off notice: the distance filter can't apply without a GPS fix, so the deck is unfiltered.
          if (_locationUnknown && _hasActiveFilter)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.x5,
                0,
                AppSpacing.x5,
                AppSpacing.x2,
              ),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.x3,
                  vertical: AppSpacing.x2,
                ),
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                  borderRadius: BorderRadius.circular(AppSpacing.x2),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.location_off_outlined,
                      size: 16,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                    const SizedBox(width: AppSpacing.x2),
                    const Flexible(
                      child: Text(
                        'Location off — distances unknown, showing all',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.x5,
                AppSpacing.x2,
                AppSpacing.x5,
                AppSpacing.x2,
              ), // Tapping the card opens details — a natural gesture that
              // mirrors how the like/dismiss buttons mirror the swipe.
              child: _isLoading
                  ? KeyedSubtree(
                      key: TourAnchors.swipeDeck,
                      child: const ActivityCardSkeleton(),
                    )
                  : (_loadError && _activities.isEmpty)
                  ? ErrorRetry(
                      message:
                          "Couldn't load activities. Check your connection and try again.",
                      onRetry: () => _load(),
                    )
                  : deckExhausted
                  ? DiscoveryEmptyDeck(
                      onRestart: _reset,
                      filterSummary: filterSummary,
                      onClearFilters: _hasActiveFilter ? _clearFilters : null,
                      // Start-over latch release: flip back to unseen cards without re-picking filters.
                      onShowUnseen: includeSwiped ? _showUnseenOnly : null,
                    )
                  // KeyedSubtree carries the tour anchor so SwipeDeck keeps its own `ValueKey(_topIndex)`.
                  : KeyedSubtree(
                      key: TourAnchors.swipeDeck,
                      child: PressableScale(
                        onTap: _openDetails,
                        child: SwipeDeck(
                          // Force a fresh State each time topIndex advances.
                          key: ValueKey(_topIndex),
                          activities: _activities,
                          topIndex: _topIndex,
                          onSwiped: _swipeOut,
                          onDragging: _onDragState,
                          onPersistError: _onPersistError,
                        ),
                      ),
                    ),
            ),
          ),
          if (!_isLoading && !deckExhausted)
            Padding(
              key: TourAnchors.actionRow,
              padding: const EdgeInsets.only(
                top: AppSpacing.x2,
                bottom: AppSpacing.x4,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                // Center (not start): buttons have different diameters (54/62/68) and start-alignment left the info.
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  DiscoveryAction.reject(onTap: _dislike),
                  const SizedBox(width: AppSpacing.x6),
                  DiscoveryAction.info(onTap: _openDetails),
                  const SizedBox(width: AppSpacing.x6),
                  // Approval-gated games get the Request variant so the cost of the swipe is visible upfront.
                  if (_activities[_topIndex].joinPolicy == 'approval')
                    DiscoveryAction.request(onTap: _like)
                  else
                    DiscoveryAction.join(onTap: _like),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
