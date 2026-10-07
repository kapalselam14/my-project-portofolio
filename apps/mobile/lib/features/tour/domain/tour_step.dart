/// Identifies which anchor a [TourStep] should spotlight.
enum TourAnchorId {
  none,
  swipeDeck,
  actionRow,
  filterButton,
  tabMyGames,
  tabCreate,
  tabChat,
  tabProfile,
}

/// Shape of the spotlight cut-out drawn around the anchor's bounds.
enum TourSpotlightShape { roundedRect, circle }

/// A single step in a coach-mark tour: which element to highlight, and the copy to show alongside it.
class TourStep {
  const TourStep({
    required this.anchor,
    required this.title,
    required this.body,
    this.shape = TourSpotlightShape.roundedRect,
    this.padding = 8,
  });

  /// Which registered [TourAnchorId] to spotlight.
  final TourAnchorId anchor;

  final String title;
  final String body;

  /// Shape of the cut-out around the anchor's bounds.
  final TourSpotlightShape shape;

  /// Extra space (in logical pixels) between the anchor's bounds and the edge of the spotlight cut-out.
  final double padding;
}
