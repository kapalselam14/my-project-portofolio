import 'dart:async';

import 'package:device_calendar/device_calendar.dart';
import 'package:flutter/foundation.dart';

/// Optional class-two feature: add an activity to the device's native calendar.
/// The wrapper degrades gracefully when permissions are denied or the platform has no writable calendar.
class CalendarService {
  CalendarService._();

  static final CalendarService instance = CalendarService._();

  final DeviceCalendarPlugin _plugin = DeviceCalendarPlugin();

  Future<bool> _requestPermissions() async {
    try {
      final result = await _plugin.requestPermissions();
      return result.data == true;
    } catch (e) {
      if (kDebugMode) debugPrint('CalendarService._requestPermissions: $e');
      return false;
    }
  }

  /// Returns a writable calendar ID, or `null` if none is available.
  Future<String?> _writableCalendarId() async {
    try {
      final result = await _plugin.retrieveCalendars();
      if (!result.isSuccess || result.data == null) return null;
      final calendars = result.data!;
      final writable = calendars.where((c) => c.isReadOnly == false);
      if (writable.isEmpty) return null;
      // Prefer the first writable calendar; on most devices this is the primary local account.
      return writable.first.id;
    } catch (e) {
      if (kDebugMode) debugPrint('CalendarService._writableCalendarId: $e');
      return null;
    }
  }

  /// Creates a calendar event for the given activity and returns `true` on success.
  /// [title], [start], and [end] are required.
  Future<bool> addEvent({
    required String title,
    required DateTime start,
    required DateTime end,
    String? description,
    String? location,
    List<String>? attendees,
  }) async {
    if (!await _requestPermissions()) return false;
    final calendarId = await _writableCalendarId();
    if (calendarId == null) return false;

    final event = Event(
      calendarId,
      title: title,
      start: TZDateTime.from(start, local),
      end: TZDateTime.from(end, local),
      description: description,
      location: location,
      attendees: attendees?.map((a) => Attendee(name: a)).toList(),
    );

    try {
      final result = await _plugin.createOrUpdateEvent(event);
      return result?.isSuccess == true;
    } catch (e) {
      if (kDebugMode) debugPrint('CalendarService.addEvent: $e');
      return false;
    }
  }
}
