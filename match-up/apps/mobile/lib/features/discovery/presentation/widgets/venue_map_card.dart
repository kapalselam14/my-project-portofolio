import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/dark_colors.dart';
import '../../../../core/widgets/app_snackbar.dart';
import '../../../activities/domain/activity_model.dart';

/// Google Maps directions URL targeting the venue coordinates.
/// Uses the universal https scheme so it opens the Google Maps app when installed and falls back to the browser.
Uri venueDirectionsUri(double latitude, double longitude) => Uri.parse(
  'https://www.google.com/maps/dir/?api=1&destination=$latitude,$longitude',
);

/// Opens Google Maps with route directions to ([latitude], [longitude]).
/// Shows a SnackBar instead of failing silently when no app can handle it.
Future<void> openVenueDirections(
  BuildContext context,
  double latitude,
  double longitude,
) async {
  final opened = await launchUrl(
    venueDirectionsUri(latitude, longitude),
    mode: LaunchMode.externalApplication,
  );
  if (!opened && context.mounted) {
    AppSnackbar.show(
      context,
      message: "Couldn't open Google Maps",
      variant: AppSnackbarVariant.error,
    );
  }
}

/// Venue location map for activity detail screens.
/// Shows a static OSM preview (180px) with a venue pin.
class VenueMapCard extends StatelessWidget {
  const VenueMapCard({super.key, required this.activity});

  final ActivityModel activity;

  @override
  Widget build(BuildContext context) {
    final lat = activity.latitude;
    final lng = activity.longitude;
    if (lat == null || lng == null) return const SizedBox.shrink();
    final point = LatLng(lat, lng);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Venue Location',
          style: Theme.of(
            context,
          ).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: AppSpacing.x3),
        Material(
          color: context.colors.surface,
          borderRadius: BorderRadius.circular(AppRadius.card),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () {
              HapticFeedback.selectionClick();
              _FullVenueMap.show(context, activity: activity);
            },
            child: SizedBox(
              height: 180,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  // Fallback behind the tiles: while tiles load.
                  Container(
                    color: context.colors.surfaceSubtle,
                    alignment: Alignment.center,
                    child: Icon(
                      Icons.map_outlined,
                      size: 48,
                      color: context.colors.textTertiary,
                    ),
                  ),
                  FlutterMap(
                    options: MapOptions(
                      initialCenter: point,
                      initialZoom: 15,
                      // Transparent so the fallback icon behind shows through while tiles load or when they fail.
                      backgroundColor: Colors.transparent,
                      interactionOptions: const InteractionOptions(
                        flags: InteractiveFlag.none,
                      ),
                    ),
                    children: [
                      TileLayer(
                        urlTemplate:
                            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                        userAgentPackageName: 'matchup-demo/1.0',
                        // Tiles stay transparent on failure so the fallback icon above shows through.
                        errorTileCallback: (tile, error, stackTrace) {},
                      ),
                      MarkerLayer(
                        markers: [
                          Marker(
                            point: point,
                            width: 36,
                            height: 36,
                            child: const _VenuePin(),
                          ),
                        ],
                      ),
                    ],
                  ),
                  // OSM attribution for the preview (the fullscreen map uses RichAttributionWidget.
                  Positioned(
                    top: 6,
                    right: 6,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.45),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        '© OpenStreetMap',
                        style: TextStyle(color: Colors.white, fontSize: 9),
                      ),
                    ),
                  ),
                  // Bottom label strip — venue name + expand hint.
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.x4,
                        vertical: AppSpacing.x2,
                      ),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            Colors.transparent,
                            Colors.black.withValues(alpha: 0.55),
                          ],
                        ),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              activity.location,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          const Icon(
                            Icons.open_in_full_rounded,
                            size: 16,
                            color: Colors.white,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.x3),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: () => openVenueDirections(context, lat, lng),
            icon: const Icon(Icons.directions_rounded, size: 18),
            label: const Text('Get Directions'),
          ),
        ),
      ],
    );
  }
}

class _VenuePin extends StatelessWidget {
  const _VenuePin();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      decoration: BoxDecoration(
        color: theme.colorScheme.primary,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: const Center(
        child: Icon(Icons.place_rounded, color: Colors.white, size: 18),
      ),
    );
  }
}

/// Full-screen interactive venue map, opened from [VenueMapCard].
class _FullVenueMap extends StatefulWidget {
  const _FullVenueMap({required this.activity});

  final ActivityModel activity;

  static Future<void> show(
    BuildContext context, {
    required ActivityModel activity,
  }) {
    return showDialog(
      context: context,
      useSafeArea: false,
      builder: (_) => _FullVenueMap(activity: activity),
    );
  }

  @override
  State<_FullVenueMap> createState() => _FullVenueMapState();
}

class _FullVenueMapState extends State<_FullVenueMap> {
  late final MapController _ctrl = MapController();

  @override
  Widget build(BuildContext context) {
    final lat = widget.activity.latitude!;
    final lng = widget.activity.longitude!;
    final point = LatLng(lat, lng);
    final theme = Theme.of(context);

    return Material(
      child: Stack(
        children: [
          FlutterMap(
            mapController: _ctrl,
            options: MapOptions(
              initialCenter: point,
              initialZoom: 15,
              minZoom: 4,
              maxZoom: 19,
              interactionOptions: const InteractionOptions(
                flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
              ),
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'matchup-demo/1.0',
              ),
              MarkerLayer(
                markers: [
                  Marker(
                    point: point,
                    width: 44,
                    height: 44,
                    child: const _VenuePin(),
                  ),
                ],
              ),
              const RichAttributionWidget(
                attributions: [
                  TextSourceAttribution('© OpenStreetMap contributors'),
                ],
              ),
            ],
          ),
          // Top bar — close + venue name.
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.x4),
                child: Row(
                  children: [
                    Material(
                      color: theme.colorScheme.surface,
                      shape: const CircleBorder(),
                      elevation: 2,
                      child: InkWell(
                        customBorder: const CircleBorder(),
                        onTap: () => Navigator.of(context).pop(),
                        child: const Padding(
                          padding: EdgeInsets.all(10),
                          child: Icon(Icons.close_rounded, size: 20),
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.x3),
                    Expanded(
                      child: Material(
                        color: theme.colorScheme.surface,
                        elevation: 2,
                        borderRadius: BorderRadius.circular(12),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.x4,
                            vertical: AppSpacing.x3,
                          ),
                          child: Text(
                            widget.activity.location,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          // Open in Google Maps — route directions to the venue.
          Positioned(
            left: 16,
            right: 16,
            bottom: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: FilledButton.icon(
                  onPressed: () => openVenueDirections(context, lat, lng),
                  icon: const Icon(Icons.navigation_rounded, size: 18),
                  label: const Text('Open in Google Maps'),
                ),
              ),
            ),
          ),
          // Zoom cluster, bottom-right (above the directions button).
          Positioned(
            right: 12,
            bottom: 96,
            child: Material(
              color: theme.colorScheme.surface,
              elevation: 3,
              borderRadius: BorderRadius.circular(12),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  InkWell(
                    onTap: () {
                      final z = (_ctrl.camera.zoom + 1).clamp(4.0, 19.0);
                      _ctrl.move(_ctrl.camera.center, z);
                    },
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(12),
                    ),
                    child: const SizedBox(
                      width: 40,
                      height: 40,
                      child: Icon(Icons.add_rounded, size: 20),
                    ),
                  ),
                  Container(
                    height: 0.5,
                    width: 28,
                    color: theme.colorScheme.outlineVariant.withValues(
                      alpha: 0.6,
                    ),
                  ),
                  InkWell(
                    onTap: () {
                      final z = (_ctrl.camera.zoom - 1).clamp(4.0, 19.0);
                      _ctrl.move(_ctrl.camera.center, z);
                    },
                    borderRadius: const BorderRadius.vertical(
                      bottom: Radius.circular(12),
                    ),
                    child: const SizedBox(
                      width: 40,
                      height: 40,
                      child: Icon(Icons.remove_rounded, size: 20),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
