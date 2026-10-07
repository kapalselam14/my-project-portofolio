import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../../core/providers/repository_providers.dart';
import '../../../../core/services/location_service.dart';
import '../../data/places_ranker.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/dark_colors.dart';
import '../../domain/place_suggestion.dart';

part 'venue_picker/venue_chrome.dart';
part 'venue_picker/venue_search.dart';
part 'venue_picker/venue_map.dart';
part 'venue_picker/venue_results.dart';
part 'venue_picker/venue_picked.dart';

class VenuePickerSheet extends ConsumerStatefulWidget {
  const VenuePickerSheet({super.key, required this.countryCodes});

  final String? countryCodes;

  static Future<PlaceSuggestion?> show(
    BuildContext context, {
    String? countryCodes,
  }) {
    return showModalBottomSheet<PlaceSuggestion>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SheetWrapper(countryCodes: countryCodes),
    );
  }

  @override
  ConsumerState<VenuePickerSheet> createState() => _VenuePickerSheetState();
}

class _VenuePickerSheetState extends ConsumerState<VenuePickerSheet>
    with SingleTickerProviderStateMixin {
  final _searchCtrl = TextEditingController();
  final _searchFocus = FocusNode();
  Timer? _debounce;

  List<PlaceSuggestion> _results = const [];
  // ignore: prefer_final_fields
  List<RankedPlace> _ranked = const [];
  bool _searching = false;
  String? _error;
  PlaceSuggestion? _selected;

  // Cached recent searches (persisted to SharedPreferences).
  List<PlaceSuggestion> _recent = const [];

  // Currently picked map location (from a tap on the map, not from the suggestions list).
  LatLng? _pickedLatLng;

  // Resolved device GPS, used as the origin for distance ranking and as the initial map center.
  LatLng? _userLocation;

  static const _kRecentKey = 'venue_picker.recent_searches';
  static const _kRecentMax = 5;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      // No autofocus: the sheet opens on the map + recent searches with the keyboard hidden.
      await _loadRecent();
      // Resolve GPS in the background so the first search uses the user's actual location as the distance origin.
      try {
        final pos = await LocationService.instance.getCurrentLocation();
        if (!mounted || pos == null) return;
        setState(() {
          _userLocation = LatLng(pos.latitude, pos.longitude);
        });
      } catch (_) {
        /* ignored */
      }
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchCtrl.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  Future<void> _loadRecent() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getStringList(_kRecentKey) ?? const [];
      if (!mounted) return;
      setState(() {
        _recent = raw
            .map((s) {
              try {
                return PlaceSuggestion.fromJson(
                  jsonDecode(s) as Map<String, dynamic>,
                );
              } catch (_) {
                return null;
              }
            })
            .whereType<PlaceSuggestion>()
            .toList();
      });
    } catch (_) {
      // Best-effort only — silently ignore read failures.
    }
  }

  Future<void> _saveRecent(PlaceSuggestion s) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      // Move-to-front dedupe.
      final deduped = [s, ..._recent.where((r) => r.placeId != s.placeId)];
      _recent = deduped.take(_kRecentMax).toList();
      await prefs.setStringList(
        _kRecentKey,
        _recent
            .map(
              (r) => jsonEncode({
                'placeId': r.placeId,
                'label': r.label,
                'secondary': r.secondary,
                'latitude': r.latitude,
                'longitude': r.longitude,
              }),
            )
            .toList(),
      );
    } catch (_) {
      // Best-effort.
    }
  }

  Future<void> _clearRecent() async {
    setState(() => _recent = const []);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_kRecentKey);
    } catch (_) {}
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    final trimmed = value.trim();
    setState(() => _pickedLatLng = null);
    if (trimmed.length < 3) {
      setState(() {
        _results = const [];
        _searching = false;
        _error = null;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), _search);
  }

  Future<void> _search() async {
    final query = _searchCtrl.text.trim();
    if (query.length < 3) return;
    if (!mounted) return;
    setState(() {
      _searching = true;
      _error = null;
    });
    try {
      final origin =
          _pickedLatLng ??
          _selectedLatLng ??
          _userLocation ??
          const LatLng(-36.8485, 174.7633);
      final results = await ref
          .read(placesRepositoryProvider)
          .autocomplete(
            query,
            countryCodes: widget.countryCodes,
            // Bias the geocoder to the user's area (~±35km) so nearby Auckland venues rank above same-named world.
            viewbox: _viewboxAround(origin),
          );
      if (!mounted) return;
      // Discard stale responses (user kept typing past us).
      if (_searchCtrl.text.trim() != query) return;
      // Rank results by combined relevance + distance score.
      final rankedAll = const PlacesRanker().rank(
        results,
        query,
        origin: origin,
      );
      setState(() {
        _ranked = rankedAll;
        _results = rankedAll.map((r) => r.suggestion).toList(growable: false);
        _searching = false;
        _selected = _results.isNotEmpty ? _results.first : null;
      });
    } catch (e) {
      if (!mounted) return;
      if (_searchCtrl.text.trim() != query) return;
      setState(() {
        _searching = false;
        _error = 'Search failed. Check your connection and try again.';
      });
    }
  }

  /// Nominatim viewbox (`"left,top,right,bottom"`) around [origin], roughly ±35 km, clamped to valid world degrees.
  String _viewboxAround(LatLng origin) {
    final left = (origin.longitude - 0.35).clamp(-180.0, 180.0);
    final right = (origin.longitude + 0.35).clamp(-180.0, 180.0);
    final top = (origin.latitude + 0.25).clamp(-90.0, 90.0);
    final bottom = (origin.latitude - 0.25).clamp(-90.0, 90.0);
    return '$left,$top,$right,$bottom';
  }

  Future<void> _pick(PlaceSuggestion suggestion) async {
    await _saveRecent(suggestion);
    if (!mounted) return;
    Navigator.of(context).pop(suggestion);
  }

  LatLng? get _selectedLatLng {
    final s = _selected;
    if (s != null) return LatLng(s.latitude, s.longitude);
    return _pickedLatLng;
  }

  @override
  Widget build(BuildContext context) {
    final query = _searchCtrl.text.trim();
    final showInitialState =
        query.isEmpty && _results.isEmpty && _pickedLatLng == null;
    // Reference point for the distance sort + per-row distance label.
    final origin =
        _pickedLatLng ??
        _selectedLatLng ??
        _userLocation ??
        const LatLng(-36.8485, 174.7633);

    return Material(
      color: context.colors.surface,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _GrabHandle(),
          _Header(
            title: 'Pick a venue',
            onClose: () => Navigator.of(context).pop(),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.x4,
              0,
              AppSpacing.x4,
              AppSpacing.x3,
            ),
            child: _SearchBar(
              controller: _searchCtrl,
              focusNode: _searchFocus,
              onChanged: _onQueryChanged,
              onSubmitted: (_) {
                _debounce?.cancel();
                _search();
              },
              searching: _searching,
              hasText: _searchCtrl.text.isNotEmpty,
              onClear: () {
                _searchCtrl.clear();
                _onQueryChanged('');
              },
            ),
          ),
          Expanded(
            child: Stack(
              children: [
                Positioned.fill(
                  child: _Map(
                    selected: _selectedLatLng,
                    onPickedLocation: (latLng) {
                      setState(() {
                        _pickedLatLng = latLng;
                        _searchCtrl.clear();
                        _results = const [];
                        _searching = false;
                        _error = null;
                      });
                      _searchFocus.unfocus();
                    },
                  ),
                ),
                // Floating "Use this location" card for tap-on-map.
                if (_pickedLatLng != null)
                  Positioned(
                    left: AppSpacing.x4,
                    right: AppSpacing.x4,
                    bottom: AppSpacing.x5,
                    child: _PickedLocationCard(
                      latLng: _pickedLatLng!,
                      onConfirm: (name) {
                        final ll = _pickedLatLng!;
                        final trimmed = name.trim();
                        Navigator.of(context).pop(
                          PlaceSuggestion(
                            placeId:
                                'pin:${ll.latitude.toStringAsFixed(5)},${ll.longitude.toStringAsFixed(5)}',
                            label: trimmed.isNotEmpty
                                ? trimmed
                                : '${ll.latitude.toStringAsFixed(5)}, ${ll.longitude.toStringAsFixed(5)}',
                            secondary: 'Dropped pin',
                            latitude: ll.latitude,
                            longitude: ll.longitude,
                          ),
                        );
                      },
                    ),
                  )
                // Results / recent / empty / error states.
                else if (query.isEmpty && _recent.isNotEmpty)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: _BottomSheet(
                      title: 'Recent',
                      trailing: TextButton(
                        onPressed: _clearRecent,
                        child: const Text('Clear'),
                      ),
                      child: _ResultsColumn(
                        items: const PlacesRanker().rank(
                          _recent,
                          '',
                          origin: origin,
                        ),
                        selected: _selected,
                        onHover: (s) => setState(() => _selected = s),
                        onPick: _pick,
                      ),
                    ),
                  )
                else if (_searching)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: _BottomSheet(
                      title: 'Searching…',
                      child: const _ShimmerResults(count: 4),
                    ),
                  )
                else if (_error != null)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: _BottomSheet(
                      title: 'Search error',
                      child: _ErrorState(message: _error!, onRetry: _search),
                    ),
                  )
                else if (_results.isNotEmpty)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: _BottomSheet(
                      title:
                          '${_results.length} '
                          'result${_results.length == 1 ? '' : 's'}',
                      child: _ResultsColumn(
                        items: _ranked,
                        selected: _selected,
                        onHover: (s) => setState(() => _selected = s),
                        onPick: _pick,
                      ),
                    ),
                  )
                else if (query.length >= 3 && !_searching)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: _BottomSheet(
                      title: 'No matches',
                      child: _EmptyState(
                        headline: 'No matches for "$query"',
                        subline:
                            'Try a different venue, neighbourhood, '
                            'or tap the map to drop a pin.',
                      ),
                    ),
                  )
                else if (showInitialState)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: _BottomSheet(
                      title: 'Tip',
                      child: _EmptyState(
                        headline: 'Search a venue or drop a pin',
                        subline:
                            'Start typing — e.g. "Auckland Domain" — or tap '
                            'anywhere on the map.',
                      ),
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

// chrome.
