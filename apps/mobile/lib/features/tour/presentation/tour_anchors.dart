import 'package:flutter/widgets.dart';

import '../domain/tour_step.dart';

/// Static registry of [GlobalKey]s that coach-mark steps spotlight.
/// There is exactly one key per anchor for the whole app.
class TourAnchors {
  TourAnchors._();

  static final swipeDeck = GlobalKey(debugLabel: 'tour.swipeDeck');
  static final actionRow = GlobalKey(debugLabel: 'tour.actionRow');
  static final filterButton = GlobalKey(debugLabel: 'tour.filterButton');
  static final tabMyGames = GlobalKey(debugLabel: 'tour.tabMyGames');
  static final tabCreate = GlobalKey(debugLabel: 'tour.tabCreate');
  static final tabChat = GlobalKey(debugLabel: 'tour.tabChat');
  static final tabProfile = GlobalKey(debugLabel: 'tour.tabProfile');

  /// Resolves a [TourAnchorId] to its registered [GlobalKey].
  static GlobalKey? keyFor(TourAnchorId id) {
    switch (id) {
      case TourAnchorId.none:
        return null;
      case TourAnchorId.swipeDeck:
        return swipeDeck;
      case TourAnchorId.actionRow:
        return actionRow;
      case TourAnchorId.filterButton:
        return filterButton;
      case TourAnchorId.tabMyGames:
        return tabMyGames;
      case TourAnchorId.tabCreate:
        return tabCreate;
      case TourAnchorId.tabChat:
        return tabChat;
      case TourAnchorId.tabProfile:
        return tabProfile;
    }
  }
}
