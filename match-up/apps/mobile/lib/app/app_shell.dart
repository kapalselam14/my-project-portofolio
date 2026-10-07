import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/providers/auth_state_provider.dart';
import '../core/theme/app_typography.dart';
import '../core/theme/dark_colors.dart';
import '../core/widgets/home_indicator.dart';
import '../core/widgets/pressable_scale.dart';
import '../features/tour/presentation/tour_anchors.dart';
import '../features/tour/presentation/tour_host.dart';

class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key, required this.child});

  final Widget child;

  // Every glyph is hand-drawn (a single Lucide-style line-icon family) so the whole bar matches the reference.
  static final _tabs = <_NavTab>[
    _NavTab(
      label: 'Discover',
      route: '/discovery',
      iconBuilder: (color, onColor, size, selected) => _NavIcon(
        size: size,
        painter: _CompassPainter(color, onColor, filled: selected),
      ),
    ),
    _NavTab(
      label: 'My Games',
      route: '/activities',
      tourKey: TourAnchors.tabMyGames,
      iconBuilder: (color, onColor, size, selected) =>
          _NavIcon(size: size, painter: _FieldPainter(color)),
    ),
    _NavTab(
      label: 'Create',
      route: '/create',
      tourKey: TourAnchors.tabCreate,
      iconBuilder: (color, onColor, size, selected) =>
          _NavIcon(size: size, painter: _PlusCirclePainter(color)),
    ),
    _NavTab(
      label: 'Chat',
      route: '/messages',
      tourKey: TourAnchors.tabChat,
      iconBuilder: (color, onColor, size, selected) =>
          _NavIcon(size: size, painter: _MessagePainter(color)),
    ),
    _NavTab(
      label: 'Profile',
      route: '/profile',
      tourKey: TourAnchors.tabProfile,
      iconBuilder: (color, onColor, size, selected) =>
          _NavIcon(size: size, painter: _UserPainter(color)),
    ),
  ];

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  /// Tab-visit history for the system back button.
  final List<int> _tabHistory = [];

  /// Last handled back-press: same anti-double-tap debounce as [SystemBackFallback].
  DateTime? _lastBackHandled;
  static const _backDebounceWindow = Duration(milliseconds: 500);

  void _goTab(int index, int currentIndex) {
    if (index == currentIndex) return;
    // Only real tabs participate (-1 = pushed screens like notifications/chat threads, which pop normally instead).
    if (currentIndex >= 0) {
      _tabHistory.add(currentIndex);
      if (_tabHistory.length > 20) _tabHistory.removeAt(0);
    }
    context.go(AppShell._tabs[index].route);
  }

  int _indexFor(String location) {
    if (location == '/discovery' || location.startsWith('/discovery/')) {
      return 0;
    }
    if (location == '/activities' || location.startsWith('/activities/')) {
      return 1;
    }
    if (location == '/create' || location.startsWith('/create/')) return 2;
    if (location == '/messages' ||
        location.startsWith('/messages/') ||
        location == '/chat' ||
        location.startsWith('/chat/')) {
      return 3;
    }
    if (location == '/profile' || location.startsWith('/profile/')) return 4;
    // Non-tab locations (preferences, filter, calendar, edit-profile, player-profile, dm, notifications, activity.
    return -1;
  }

  /// Exact `/activity/<id>` locations render full-screen (no tab bar).
  static bool _isFullScreenDetail(String location) =>
      RegExp(r'^/activity/[^/]+$').hasMatch(location);

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final index = _indexFor(location);

    // A new account must not inherit the previous one's tab history.
    ref.listen<AuthStatus>(authStatusProvider, (_, _) {
      _tabHistory.clear();
    });

    // System back on a tab root walks the tab-visit history instead of closing the app; empty history exits normally.
    return PopScope(
      canPop: _tabHistory.isEmpty,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        final now = DateTime.now();
        final age = now.difference(
          _lastBackHandled ?? DateTime.fromMillisecondsSinceEpoch(0),
        );
        if (!age.isNegative && age < _backDebounceWindow) return;
        _lastBackHandled = now;
        if (_tabHistory.isNotEmpty) {
          var prev = _tabHistory.removeLast();
          // Drop duplicates of where we already are.
          final here = _indexFor(GoRouterState.of(context).matchedLocation);
          while (_tabHistory.isNotEmpty &&
              (_tabHistory.last == prev || _tabHistory.last == here)) {
            prev = _tabHistory.removeLast();
          }
          if (prev == here || prev < 0 || prev >= AppShell._tabs.length) return;
          context.go(AppShell._tabs[prev].route);
        }
      },
      child: Scaffold(
        // TourHost inserts its spotlight into the Navigator-level Overlay.
        body: TourHost(location: location, child: widget.child),
        // The activity detail screen moved inside the shell.
        bottomNavigationBar: _isFullScreenDetail(location)
            ? null
            : SafeArea(
                top: false,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _TabBar(
                      currentIndex: index,
                      onTap: (i) => _goTab(i, index),
                    ),
                    const HomeIndicator(),
                  ],
                ),
              ),
      ),
    );
  }
}

class _TabBar extends StatelessWidget {
  const _TabBar({required this.currentIndex, required this.onTap});

  final int currentIndex;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    // Clamp system text scaling inside the bar so huge accessibility fonts can't blow the fixed-height items apart.
    final scaler = MediaQuery.textScalerOf(
      context,
    ).clamp(minScaleFactor: 1.0, maxScaleFactor: 1.3);
    return MediaQuery(
      data: MediaQuery.of(context).copyWith(textScaler: scaler),
      child: Container(
        decoration: BoxDecoration(
          color: context.colors.surface,
          border: Border(
            top: BorderSide(color: context.colors.border, width: 1),
          ),
        ),
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(AppShell._tabs.length, (i) {
            final tab = AppShell._tabs[i];
            final isSelected = i == currentIndex;
            // Expanded (not fixed 64 px) so the five items always share whatever width the device has.
            return Expanded(
              child: _NavItem(
                tab: tab,
                isSelected: isSelected,
                onTap: () => onTap(i),
              ),
            );
          }),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.tab,
    required this.isSelected,
    required this.onTap,
  });

  final _NavTab tab;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    // Plain attached bar (matching the reference): no pill behind the active icon.
    final color = isSelected
        ? context.colors.primaryOnSurface
        : context.colors.textSecondary;
    return Semantics(
      button: true,
      selected: isSelected,
      label: tab.label,
      child: PressableScale(
        onTap: onTap,
        // Width comes from the parent Expanded — only the height is fixed.
        child: SizedBox(
          key: tab.tourKey,
          height: 52,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              tab.iconBuilder(color, context.colors.surface, 25, isSelected),
              const SizedBox(height: 5),
              AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 200),
                style: AppTypography.caption(context).copyWith(
                  fontSize: 11,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                  height: 1.0,
                  color: color,
                ),
                child: Text(
                  tab.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavTab {
  const _NavTab({
    required this.label,
    required this.route,
    required this.iconBuilder,
    this.tourKey,
  });

  final String label;
  final String route;

  /// Hand-drawn glyph builder.
  final Widget Function(Color color, Color onColor, double size, bool selected)
  iconBuilder;

  /// Registered [TourAnchors] key this tab should be spotlighted with, or `null` for tabs no tour step targets.
  final Key? tourKey;
}

// Custom nav glyphs.
// All five nav icons are hand-drawn as a single Lucide-style line family.

/// Square host for a nav [CustomPainter].
class _NavIcon extends StatelessWidget {
  const _NavIcon({required this.size, required this.painter});

  final double size;
  final CustomPainter painter;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: painter),
    );
  }
}

Paint _strokePaint(Color color, double w) => Paint()
  ..color = color
  ..style = PaintingStyle.stroke
  ..strokeWidth = w / 12.0
  ..strokeCap = StrokeCap.round
  ..strokeJoin = StrokeJoin.round;

/// Discover — a compass (Lucide "compass"): a circle with a diamond needle.
class _CompassPainter extends CustomPainter {
  const _CompassPainter(this.color, this.onColor, {required this.filled});

  final Color color;
  final Color onColor;
  final bool filled;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 24.0;
    final center = Offset(12 * s, 12 * s);
    // Lucide compass needle: 16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88.
    final needle = Path()
      ..moveTo(16.24 * s, 7.76 * s)
      ..lineTo(14.12 * s, 14.12 * s)
      ..lineTo(7.76 * s, 16.24 * s)
      ..lineTo(9.88 * s, 9.88 * s)
      ..close();

    if (filled) {
      canvas.drawCircle(center, 10.5 * s, Paint()..color = color);
      canvas.drawPath(needle, Paint()..color = onColor);
    } else {
      final stroke = _strokePaint(color, size.width);
      canvas.drawCircle(center, 10 * s, stroke);
      canvas.drawPath(needle, stroke);
    }
  }

  @override
  bool shouldRepaint(_CompassPainter old) =>
      old.color != color || old.onColor != onColor || old.filled != filled;
}

/// My Games — top-down soccer pitch: rounded boundary, vertical halfway line, centre circle, and a penalty arc.
class _FieldPainter extends CustomPainter {
  const _FieldPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 24.0;
    final paint = _strokePaint(color, size.width);

    const l = 3.0, r = 21.0, t = 4.0, b = 20.0;
    const midX = 12.0, midY = 12.0;

    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTRB(l * s, t * s, r * s, b * s),
        Radius.circular(3 * s),
      ),
      paint,
    );
    canvas.drawLine(Offset(midX * s, t * s), Offset(midX * s, b * s), paint);
    canvas.drawCircle(Offset(midX * s, midY * s), 3 * s, paint);

    // Penalty arcs — inward-bulging semicircles on each end.
    canvas.drawArc(
      Rect.fromCircle(center: Offset(l * s, midY * s), radius: 2.6 * s),
      -1.5708,
      3.14159,
      false,
      paint,
    );
    canvas.drawArc(
      Rect.fromCircle(center: Offset(r * s, midY * s), radius: 2.6 * s),
      1.5708,
      3.14159,
      false,
      paint,
    );
  }

  @override
  bool shouldRepaint(_FieldPainter old) => old.color != color;
}

/// Create — a plus inside a circle (Lucide "plus-circle": r10, arms 8..16).
class _PlusCirclePainter extends CustomPainter {
  const _PlusCirclePainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 24.0;
    final paint = _strokePaint(color, size.width);
    canvas.drawCircle(Offset(12 * s, 12 * s), 10 * s, paint);
    canvas.drawLine(Offset(8 * s, 12 * s), Offset(16 * s, 12 * s), paint);
    canvas.drawLine(Offset(12 * s, 8 * s), Offset(12 * s, 16 * s), paint);
  }

  @override
  bool shouldRepaint(_PlusCirclePainter old) => old.color != color;
}

/// Chat — Lucide "message-circle": a round bubble with a tail at bottom-left.
class _MessagePainter extends CustomPainter {
  const _MessagePainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 24.0;
    final path = Path()
      ..moveTo(7.9 * s, 20 * s)
      ..arcToPoint(
        Offset(4 * s, 16.1 * s),
        radius: Radius.circular(9 * s),
        largeArc: true,
        clockwise: false,
      )
      ..lineTo(2 * s, 22 * s)
      ..close();
    canvas.drawPath(path, _strokePaint(color, size.width));
  }

  @override
  bool shouldRepaint(_MessagePainter old) => old.color != color;
}

/// Profile — Lucide "user": a head circle (cx12 cy7 r4) above an open shoulders arch (M19 21 v-2 a4 4 0 0 0-4-4 H9.
class _UserPainter extends CustomPainter {
  const _UserPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width / 24.0;
    final paint = _strokePaint(color, size.width);

    // Head.
    canvas.drawCircle(Offset(12 * s, 7 * s), 4 * s, paint);

    // Shoulders.
    final shoulders = Path()
      ..moveTo(19 * s, 21 * s)
      ..lineTo(19 * s, 19 * s)
      ..arcToPoint(
        Offset(15 * s, 15 * s),
        radius: Radius.circular(4 * s),
        clockwise: false,
      )
      ..lineTo(9 * s, 15 * s)
      ..arcToPoint(
        Offset(5 * s, 19 * s),
        radius: Radius.circular(4 * s),
        clockwise: false,
      )
      ..lineTo(5 * s, 21 * s);
    canvas.drawPath(shoulders, paint);
  }

  @override
  bool shouldRepaint(_UserPainter old) => old.color != color;
}
