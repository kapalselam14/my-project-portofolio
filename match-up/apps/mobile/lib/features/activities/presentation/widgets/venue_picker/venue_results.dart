part of '../venue_picker_sheet.dart';

class _BottomSheet extends StatelessWidget {
  const _BottomSheet({required this.title, required this.child, this.trailing});

  final String title;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AnimatedSize(
      duration: const Duration(milliseconds: 220),
      curve: Curves.easeOutCubic,
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.55,
        ),
        child: Material(
          color: context.colors.surface,
          elevation: 0,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Drag handle.
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Center(
                  child: Container(
                    width: 32,
                    height: 3,
                    decoration: BoxDecoration(
                      color: theme.colorScheme.outlineVariant,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.x4,
                  AppSpacing.x3,
                  AppSpacing.x2,
                  AppSpacing.x2,
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        title,
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: theme.colorScheme.onSurfaceVariant,
                          letterSpacing: 0.1,
                        ),
                      ),
                    ),
                    ?trailing,
                  ],
                ),
              ),
              Flexible(child: child),
              const SizedBox(height: AppSpacing.x2),
            ],
          ),
        ),
      ),
    );
  }
}

// result row list.

class _ResultsColumn extends StatelessWidget {
  const _ResultsColumn({
    required this.items,
    required this.selected,
    required this.onHover,
    required this.onPick,
  });

  /// Already-ranked suggestions.
  final List<RankedPlace> items;
  final PlaceSuggestion? selected;
  final void Function(PlaceSuggestion) onHover;
  final void Function(PlaceSuggestion) onPick;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      shrinkWrap: true,
      padding: EdgeInsets.zero,
      physics: const ClampingScrollPhysics(),
      itemCount: items.length,
      separatorBuilder: (_, i) => const _HairlineDivider(),
      itemBuilder: (_, i) {
        final r = items[i];
        final s = r.suggestion;
        final isSelected = selected?.placeId == s.placeId;
        return _ResultRow(
          ranked: r,
          selected: isSelected,
          onHover: () => onHover(s),
          onPick: () => onPick(s),
        );
      },
    );
  }
}

class _ResultRow extends StatelessWidget {
  const _ResultRow({
    required this.ranked,
    required this.selected,
    required this.onHover,
    required this.onPick,
  });

  final RankedPlace ranked;
  final bool selected;
  final VoidCallback onHover;
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: selected
          ? theme.colorScheme.primaryContainer.withValues(alpha: 0.5)
          : Colors.transparent,
      child: InkWell(
        onTap: () {
          HapticFeedback.selectionClick();
          onHover();
          onPick();
        },
        onHover: (_) => onHover(),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.x4,
            vertical: AppSpacing.x3,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              _CategoryAvatar(
                label: ranked.suggestion.label,
                selected: selected,
              ),
              const SizedBox(width: AppSpacing.x3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text.rich(
                            _highlightLabel(
                              label: ranked.suggestion.label,
                              ranges: ranked.matchedRanges,
                              selected: selected,
                              color: theme.colorScheme.onSurface,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (selected) ...[
                          const SizedBox(width: 6),
                          Icon(
                            Icons.check_circle_rounded,
                            size: 16,
                            color: theme.colorScheme.primary,
                          ),
                        ],
                      ],
                    ),
                    if (ranked.suggestion.secondary.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        ranked.suggestion.secondary,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          fontSize: 13,
                          color: theme.colorScheme.onSurfaceVariant,
                          height: 1.2,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.x2),
              _DistanceBadge(km: ranked.distanceKm, selected: selected),
            ],
          ),
        ),
      ),
    );
  }
}

/// Rounded-square avatar that picks a category-specific icon based on keywords in the venue label (parks, beaches.

/// Rounded-square avatar that picks a category-specific icon based on keywords in the venue label (parks, beaches.
class _CategoryAvatar extends StatelessWidget {
  const _CategoryAvatar({required this.label, required this.selected});

  final String label;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final (icon, tint) = _categoryStyle(label, theme);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOut,
      width: 44,
      height: 44,
      decoration: BoxDecoration(
        color: selected
            ? theme.colorScheme.primary
            : tint.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(12),
      ),
      alignment: Alignment.center,
      child: Icon(
        icon,
        size: 22,
        color: selected ? theme.colorScheme.onPrimary : tint,
      ),
    );
  }
}

/// Keyword → (icon, accent colour) table.
final List<(RegExp, IconData, Color Function(ThemeData))> _kCategoryTable = [
  // Parks / gardens / domains.
  (
    RegExp(
      r'\b(park|garden|domain|reserve|playground)\b',
      caseSensitive: false,
    ),
    Icons.park_rounded,
    (t) => t.colorScheme.tertiary,
  ),
  // Beaches / bays / waterfront.
  (
    RegExp(
      r'\b(beach|bay|cove|harbour|harbor|waterfront|marina)\b',
      caseSensitive: false,
    ),
    Icons.beach_access_rounded,
    (t) => t.colorScheme.primary,
  ),
  // Creeks / rivers / lakes / falls.
  (
    RegExp(
      r'\b(creek|river|lake|falls?|springs?|stream)\b',
      caseSensitive: false,
    ),
    Icons.water_rounded,
    (t) => t.colorScheme.secondary,
  ),
  // Museums / galleries / libraries.
  (
    RegExp(r'\b(museum|gallery|library|archive)\b', caseSensitive: false),
    Icons.museum_rounded,
    (t) => t.colorScheme.tertiary,
  ),
  // Sports / stadium / arena / court.
  (
    RegExp(
      r'\b(stadium|arena|court|field|gym|pool|sports?)\b',
      caseSensitive: false,
    ),
    Icons.sports_soccer_rounded,
    (t) => t.colorScheme.secondary,
  ),
  // Mountains / hills / lookouts / tracks.
  (
    RegExp(
      r'\b(mount|mt\.?|hill|peak|lookout|track|ridge|summit)\b',
      caseSensitive: false,
    ),
    Icons.landscape_rounded,
    (t) => t.colorScheme.primary,
  ),
  // Cafe / restaurant / food.
  (
    RegExp(
      r'\b(cafe|café|coffee|restaurant|food|kitchen|bar)\b',
      caseSensitive: false,
    ),
    Icons.restaurant_rounded,
    (t) => t.colorScheme.tertiary,
  ),
];

(IconData, Color) _categoryStyle(String label, ThemeData theme) {
  for (final (pattern, icon, colorOf) in _kCategoryTable) {
    if (pattern.hasMatch(label)) return (icon, colorOf(theme));
  }
  return (Icons.place_rounded, theme.colorScheme.primary);
}

/// Renders the distance label + selected-arrow as a single right- aligned column.

/// Renders the distance label + selected-arrow as a single right- aligned column.
class _DistanceBadge extends StatelessWidget {
  const _DistanceBadge({required this.km, required this.selected});
  final double km;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final label = _formatDistance(km);
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.end,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          label,
          style: theme.textTheme.bodySmall?.copyWith(
            color: selected
                ? theme.colorScheme.primary
                : theme.colorScheme.onSurfaceVariant,
            fontFeatures: const [FontFeature.tabularFigures()],
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
          ),
        ),
        if (selected) ...[
          const SizedBox(height: 2),
          Icon(
            Icons.arrow_forward_rounded,
            size: 14,
            color: theme.colorScheme.primary,
          ),
        ],
      ],
    );
  }

  static String _formatDistance(double km) {
    if (km < 1) {
      final m = (km * 1000).round();
      return '${m}m';
    }
    if (km < 10) return '${km.toStringAsFixed(1)}km';
    return '${km.round()}km';
  }
}

/// Builds a TextSpan tree for the venue label with the matched query ranges drawn in bold primary color.
TextSpan _highlightLabel({
  required String label,
  required List<(int, int)> ranges,
  required bool selected,
  required Color color,
}) {
  if (ranges.isEmpty) {
    return TextSpan(
      text: label,
      style: TextStyle(
        fontSize: 15,
        fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
        color: color,
      ),
    );
  }
  final children = <TextSpan>[];
  var cursor = 0;
  final bold = FontWeight.w700;
  final regular = selected ? FontWeight.w600 : FontWeight.w500;
  for (final r in ranges) {
    if (cursor < r.$1) {
      children.add(
        TextSpan(
          text: label.substring(cursor, r.$1),
          style: TextStyle(fontSize: 15, fontWeight: regular, color: color),
        ),
      );
    }
    children.add(
      TextSpan(
        text: label.substring(r.$1, r.$2),
        style: TextStyle(
          fontSize: 15,
          fontWeight: bold,
          color: color, // keep color consistent — bolder weight alone
          // does the highlighting, avoids a noisy look.
        ),
      ),
    );
    cursor = r.$2;
  }
  if (cursor < label.length) {
    children.add(
      TextSpan(
        text: label.substring(cursor),
        style: TextStyle(fontSize: 15, fontWeight: regular, color: color),
      ),
    );
  }
  return TextSpan(children: children);
}

class _HairlineDivider extends StatelessWidget {
  const _HairlineDivider();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 64),
      child: Container(
        height: 0.5,
        color: Theme.of(context).dividerColor.withValues(alpha: 0.6),
      ),
    );
  }
}

// states.

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.headline, required this.subline});

  final String headline;
  final String subline;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.x4,
        AppSpacing.x2,
        AppSpacing.x4,
        AppSpacing.x4,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: theme.colorScheme.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(16),
            ),
            alignment: Alignment.center,
            child: Icon(
              Icons.search_off_rounded,
              size: 26,
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: AppSpacing.x3),
          Text(
            headline,
            style: theme.textTheme.titleMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            subline,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.x4,
        AppSpacing.x2,
        AppSpacing.x4,
        AppSpacing.x4,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: theme.colorScheme.errorContainer.withValues(alpha: 0.7),
              borderRadius: BorderRadius.circular(16),
            ),
            alignment: Alignment.center,
            child: Icon(
              Icons.cloud_off_rounded,
              size: 26,
              color: theme.colorScheme.onErrorContainer,
            ),
          ),
          const SizedBox(height: AppSpacing.x3),
          Text(
            message,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: theme.colorScheme.onSurface,
            ),
          ),
          const SizedBox(height: AppSpacing.x3),
          FilledButton.tonalIcon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh_rounded, size: 18),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

class _ShimmerResults extends StatefulWidget {
  const _ShimmerResults({this.count = 4});
  final int count;

  @override
  State<_ShimmerResults> createState() => _ShimmerResultsState();
}

class _ShimmerResultsState extends State<_ShimmerResults>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final base = theme.colorScheme.surfaceContainerHighest;
    final highlight = theme.colorScheme.surfaceContainerHigh;
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      padding: EdgeInsets.zero,
      itemCount: widget.count,
      separatorBuilder: (_, i) => const _HairlineDivider(),
      itemBuilder: (_, i) => Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.x4,
          vertical: AppSpacing.x3,
        ),
        child: AnimatedBuilder(
          animation: _ctrl,
          builder: (_, c) {
            final t = _ctrl.value;
            return Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: Color.lerp(base, highlight, t),
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                const SizedBox(width: AppSpacing.x3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        height: 12,
                        width: double.infinity,
                        decoration: BoxDecoration(
                          color: Color.lerp(base, highlight, t),
                          borderRadius: BorderRadius.circular(6),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Container(
                        height: 10,
                        width: 180,
                        decoration: BoxDecoration(
                          color: Color.lerp(base, highlight, t),
                          borderRadius: BorderRadius.circular(6),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

// floating "Use this location".

/// Card shown after a tap-on-map pick.
