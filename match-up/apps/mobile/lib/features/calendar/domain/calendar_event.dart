/// Domain model for a calendar entry — wraps an [ActivityModel] occurrence.
class CalendarEvent {
  final String id;
  final String activityId;
  final String title;
  final DateTime start;
  final DateTime end;
  final String location;
  final bool addedToDeviceCalendar;

  /// True when the viewer hosts this activity (populated from the hosted source).
  final bool isHost;

  /// True for past/completed activities, routed to the review screen.
  final bool isPast;

  const CalendarEvent({
    required this.id,
    required this.activityId,
    required this.title,
    required this.start,
    required this.end,
    required this.location,
    this.addedToDeviceCalendar = false,
    this.isHost = false,
    this.isPast = false,
  });
}
