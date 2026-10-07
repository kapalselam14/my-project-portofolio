import '../domain/calendar_event.dart';

abstract class CalendarRepository {
  Future<List<CalendarEvent>> upcoming({int days = 30});

  /// Writes [event] to the device calendar.
  Future<bool> addToDeviceCalendar(CalendarEvent event);
}
