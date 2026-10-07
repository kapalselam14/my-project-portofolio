part of '../venue_picker_sheet.dart';

class _Map extends StatefulWidget {
  const _Map({required this.selected, required this.onPickedLocation});

  final LatLng? selected;
  final ValueChanged<LatLng> onPickedLocation;

  @override
  State<_Map> createState() => _MapState();
}

class _MapState extends State<_Map> {
  late final MapController _ctrl = MapController();
  double _zoom = 13;
  LatLng? _userLocation;
  bool _locating = false;
  // Fallback if we never get a GPS fix (matches the seed-data centre.
  static const LatLng _defaultCenter = LatLng(-36.8485, 174.7633);

  static const _maxZoom = 19.0;
  static const _minZoom = 4.0;

  @override
  void initState() {
    super.initState();
    _zoom = widget.selected != null ? 15.0 : 13.0;
    // Don't auto-resolve GPS here.
  }

  Future<void> _resolveUserLocation() async {
    if (_locating) return;
    setState(() => _locating = true);
    try {
      final pos = await LocationService.instance.getCurrentLocation();
      if (!mounted) return;
      if (pos != null) {
        setState(() {
          _userLocation = LatLng(pos.latitude, pos.longitude);
        });
      }
    } on LocationTimeoutException {
      // Slow fix — keep the bundled fallback origin.
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  void _zoomBy(double delta) {
    final next = (_zoom + delta).clamp(_minZoom, _maxZoom);
    if (next == _zoom) return;
    setState(() => _zoom = next);
    _ctrl.move(_ctrl.camera.center, next);
    HapticFeedback.selectionClick();
  }

  /// Recenters the map.
  Future<void> _recenter() async {
    HapticFeedback.selectionClick();
    final selected = widget.selected;
    if (selected != null) {
      setState(() => _zoom = 15);
      _ctrl.move(selected, 15);
      return;
    }
    final cached = _userLocation;
    if (cached != null) {
      setState(() => _zoom = 14);
      _ctrl.move(cached, 14);
      return;
    }
    await _resolveUserLocation();
    if (!mounted) return;
    final here = _userLocation;
    if (here != null) {
      setState(() => _zoom = 14);
      _ctrl.move(here, 14);
    } else {
      setState(() => _zoom = 13);
      _ctrl.move(_defaultCenter, 13);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Default view is always the bundled Auckland centre.
    final initialCenter = widget.selected ?? _defaultCenter;
    return FlutterMap(
      mapController: _ctrl,
      options: MapOptions(
        initialCenter: initialCenter,
        initialZoom: _zoom,
        minZoom: _minZoom,
        maxZoom: _maxZoom,
        onTap: (tapPosition, point) {
          HapticFeedback.selectionClick();
          widget.onPickedLocation(point);
        },
        onPositionChanged: (camera, hasGesture) {
          if (!hasGesture) return;
          if (camera.zoom != _zoom) {
            setState(() => _zoom = camera.zoom);
          }
        },
        interactionOptions: const InteractionOptions(
          flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
        ),
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'matchup-demo/1.0',
        ),
        if (_userLocation != null)
          MarkerLayer(
            markers: [
              Marker(
                point: _userLocation!,
                width: 22,
                height: 22,
                child: const _UserLocationDot(),
              ),
            ],
          ),
        if (widget.selected != null)
          MarkerLayer(
            markers: [
              Marker(
                point: widget.selected!,
                width: 44,
                height: 44,
                child: const _Pin(),
              ),
            ],
          ),
        Positioned(left: 0, right: 0, bottom: 0, child: _OsmAttribution()),
        Positioned(
          right: 12,
          top: 12,
          child: _MapControls(
            zoom: _zoom,
            locating: _locating,
            minZoom: _minZoom,
            maxZoom: _maxZoom,
            onZoomIn: () => _zoomBy(1),
            onZoomOut: () => _zoomBy(-1),
            onRecenter: _recenter,
          ),
        ),
      ],
    );
  }
}

class _MapControls extends StatelessWidget {
  const _MapControls({
    required this.zoom,
    required this.locating,
    required this.minZoom,
    required this.maxZoom,
    required this.onZoomIn,
    required this.onZoomOut,
    required this.onRecenter,
  });

  final double zoom;
  final bool locating;
  final double minZoom;
  final double maxZoom;
  final VoidCallback onZoomIn;
  final VoidCallback onZoomOut;
  final Future<void> Function() onRecenter;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: theme.colorScheme.surface,
      elevation: 3,
      shadowColor: Colors.black.withValues(alpha: 0.18),
      borderRadius: BorderRadius.circular(12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _MapCtrlBtn(
            icon: Icons.add_rounded,
            enabled: zoom < maxZoom,
            onTap: onZoomIn,
            semanticLabel: 'Zoom in',
            radius: const BorderRadius.vertical(top: Radius.circular(12)),
          ),
          Container(
            height: 0.5,
            width: 28,
            color: theme.colorScheme.outlineVariant.withValues(alpha: 0.6),
          ),
          _MapCtrlBtn(
            icon: Icons.remove_rounded,
            enabled: zoom > minZoom,
            onTap: onZoomOut,
            semanticLabel: 'Zoom out',
          ),
          Container(
            height: 0.5,
            width: 28,
            color: theme.colorScheme.outlineVariant.withValues(alpha: 0.6),
          ),
          // Recenter (GPS) — has a spinner overlay while we wait for the platform location stream.
          _RecenterButton(locating: locating, onTap: () => onRecenter()),
        ],
      ),
    );
  }
}

/// Filled icon button used for the GPS recenter action.

/// Filled icon button used for the GPS recenter action.
class _RecenterButton extends StatelessWidget {
  const _RecenterButton({required this.locating, required this.onTap});

  final bool locating;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Semantics(
      button: true,
      label: 'Recenter map on my location',
      child: InkWell(
        onTap: locating ? null : onTap,
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(12)),
        child: SizedBox(
          width: 40,
          height: 40,
          child: Stack(
            alignment: Alignment.center,
            children: [
              if (locating)
                SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      theme.colorScheme.primary,
                    ),
                  ),
                )
              else
                Icon(
                  Icons.my_location_rounded,
                  size: 20,
                  color: theme.colorScheme.primary,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Pulsing dot drawn at the device's resolved GPS location.

/// Pulsing dot drawn at the device's resolved GPS location.
class _UserLocationDot extends StatelessWidget {
  const _UserLocationDot();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Stack(
      alignment: Alignment.center,
      children: [
        Container(
          width: 22,
          height: 22,
          decoration: BoxDecoration(
            color: theme.colorScheme.primary.withValues(alpha: 0.18),
            shape: BoxShape.circle,
          ),
        ),
        Container(
          width: 12,
          height: 12,
          decoration: BoxDecoration(
            color: theme.colorScheme.primary,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.25),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MapCtrlBtn extends StatelessWidget {
  const _MapCtrlBtn({
    required this.icon,
    required this.enabled,
    required this.onTap,
    required this.semanticLabel,
    this.radius,
  });

  final IconData icon;
  final bool enabled;
  final VoidCallback onTap;
  final String semanticLabel;
  final BorderRadius? radius;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final shape = radius ?? BorderRadius.zero;
    return Semantics(
      button: true,
      label: semanticLabel,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: shape,
        child: Container(
          width: 40,
          height: 40,
          alignment: Alignment.center,
          child: Icon(
            icon,
            size: 20,
            color: enabled
                ? theme.colorScheme.onSurface
                : theme.colorScheme.onSurfaceVariant.withValues(alpha: 0.4),
          ),
        ),
      ),
    );
  }
}

class _OsmAttribution extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: theme.colorScheme.surface.withValues(alpha: 0.85),
        borderRadius: const BorderRadius.only(topLeft: Radius.circular(6)),
      ),
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: '\u00a9 ',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
                fontSize: 10,
              ),
            ),
            TextSpan(
              text: 'OpenStreetMap',
              style: theme.textTheme.bodySmall?.copyWith(
                color: theme.colorScheme.primary,
                fontSize: 10,
                fontWeight: FontWeight.w500,
                decoration: TextDecoration.underline,
              ),
              recognizer: null,
            ),
          ],
        ),
      ),
    );
  }
}

class _Pin extends StatelessWidget {
  const _Pin();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Stack(
      alignment: Alignment.center,
      children: [
        Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: theme.colorScheme.primary.withValues(alpha: 0.18),
            shape: BoxShape.circle,
          ),
        ),
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: theme.colorScheme.primary,
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: 2.5),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.25),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: const Center(
            child: Icon(Icons.place_rounded, color: Colors.white, size: 16),
          ),
        ),
      ],
    );
  }
}

// bottom sheet (over the map).
