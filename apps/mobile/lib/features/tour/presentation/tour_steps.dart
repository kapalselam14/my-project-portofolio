import '../domain/tour_step.dart';

/// Identifies the first-run tour for [TourStore] persistence — bump this.
const kFirstRunTourId = 'first_run';

/// The first-run coach-mark tour shown once, right after a new user finishes onboarding and lands on Discovery.
const kFirstRunTour = <TourStep>[
  TourStep(
    anchor: TourAnchorId.none,
    title: 'Welcome to MatchUp',
    body: 'A quick 30-second tour of the essentials.',
  ),
  TourStep(
    anchor: TourAnchorId.swipeDeck,
    title: 'Swipe to find games',
    body: "Swipe right if you're keen, left to pass. Tap a card for details.",
  ),
  TourStep(
    anchor: TourAnchorId.actionRow,
    title: 'Or use these buttons',
    body: 'Pass, view details, or join the game straight away.',
  ),
  TourStep(
    anchor: TourAnchorId.filterButton,
    title: 'Tune your feed',
    body: 'Set sport, distance, and skill level so suggestions fit you.',
    shape: TourSpotlightShape.circle,
  ),
  TourStep(
    anchor: TourAnchorId.tabCreate,
    title: 'Host your own game',
    body: 'Pick a time and place, then let players join you.',
  ),
  TourStep(
    anchor: TourAnchorId.tabMyGames,
    title: 'Track all your games',
    body: 'Upcoming, the ones you host, and your history live here.',
  ),
];
