import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

/// Open-Meteo (Free).
/// Used when creating an activity: venue, date and time are known, so show temperature and rain chance.
/// Upstream: https://api.open-meteo.com/v1/forecast (16-day limit).
class WeatherInfo {
  const WeatherInfo({
    required this.temperatureC,
    required this.weatherCode,
    required this.precipitationProbability,
    required this.dateTime,
  });

  final double temperatureC;
  final int weatherCode;
  final int precipitationProbability;
  final DateTime dateTime;

  String get description => weatherDescriptionFor(weatherCode);
  IconData get icon => weatherIconFor(weatherCode);
}

/// Daily summary for the per-date icons in [DatePickerSheet].
class DailyWeather {
  const DailyWeather({
    required this.date,
    required this.tempMax,
    required this.tempMin,
    required this.weatherCode,
    required this.precipitationProbabilityMax,
  });

  final DateTime date;
  final double tempMax;
  final double tempMin;
  final int weatherCode;
  final int precipitationProbabilityMax;

  String get description => weatherDescriptionFor(weatherCode);
  IconData get icon => weatherIconFor(weatherCode);
}

/// WMO weathercode -> English description.
String weatherDescriptionFor(int code) {
  return switch (code) {
    0 => 'Clear sky',
    1 => 'Mostly clear',
    2 => 'Partly cloudy',
    3 => 'Overcast',
    45 || 48 => 'Foggy',
    51 || 53 || 55 => 'Drizzle',
    56 || 57 => 'Freezing drizzle',
    61 => 'Light rain',
    63 => 'Rain',
    65 => 'Heavy rain',
    66 || 67 => 'Freezing rain',
    71 || 73 || 75 || 77 => 'Snow',
    80 || 81 || 82 => 'Heavy showers',
    85 || 86 => 'Heavy snow',
    95 => 'Thunderstorm',
    96 || 99 => 'Thunderstorm with hail',
    _ => 'Cloudy',
  };
}

/// WMO weather code to Material icon (common icons only, test-safe).
IconData weatherIconFor(int code) {
  return switch (code) {
    0 => Icons.wb_sunny_outlined,
    1 => Icons.wb_sunny_outlined,
    2 => Icons.cloud_outlined,
    3 => Icons.cloud_outlined,
    45 || 48 => Icons.air_outlined,
    51 || 53 || 55 || 56 || 57 => Icons.water_drop_outlined,
    61 || 63 || 65 || 66 || 67 || 80 || 81 || 82 => Icons.water_drop_outlined,
    71 || 73 || 75 || 77 || 85 || 86 => Icons.grain_outlined,
    95 || 96 || 99 => Icons.thunderstorm_outlined,
    _ => Icons.cloud_outlined,
  };
}

class WeatherService {
  WeatherService._();

  static final WeatherService instance = WeatherService._();

  /// Test-only override.
  @visibleForTesting
  static Future<Map<String, dynamic>?> Function(double lat, double lng)?
  debugFetchJson;

  final Dio _dio = Dio(
    BaseOptions(
      baseUrl: 'https://api.open-meteo.com',
      connectTimeout: const Duration(seconds: 8),
      receiveTimeout: const Duration(seconds: 8),
    ),
  );

  static const _cacheTtl = Duration(minutes: 10);
  final Map<String, ({DateTime fetchedAt, Map<String, dynamic> json})> _cache =
      {};

  String _key(double lat, double lng) =>
      '${lat.toStringAsFixed(3)},${lng.toStringAsFixed(3)}';

  Future<Map<String, dynamic>?> _getJson(double lat, double lng) async {
    final debug = debugFetchJson;
    if (debug != null) return debug(lat, lng);
    final key = _key(lat, lng);
    final cached = _cache[key];
    if (cached != null &&
        DateTime.now().difference(cached.fetchedAt) < _cacheTtl) {
      return cached.json;
    }
    try {
      final res = await _dio.get(
        '/v1/forecast',
        queryParameters: {
          'latitude': lat,
          'longitude': lng,
          'hourly': 'temperature_2m,weathercode,precipitation_probability',
          'daily':
              'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
          'timezone': 'auto',
          'forecast_days': 16,
        },
      );
      final body = res.data;
      if (body is Map<String, dynamic>) {
        _cache[key] = (fetchedAt: DateTime.now(), json: body);
        return body;
      }
      if (body is Map) {
        final json = Map<String, dynamic>.from(body);
        _cache[key] = (fetchedAt: DateTime.now(), json: json);
        return json;
      }
      return null;
    } catch (e) {
      debugPrint('[Weather] fetch failed: $e');
      return null;
    }
  }

  /// Daily forecast (16 days) for the calendar icons.
  Future<Map<DateTime, DailyWeather>> fetchDaily(double lat, double lng) async {
    final json = await _getJson(lat, lng);
    if (json == null) return const {};
    try {
      final daily = json['daily'];
      if (daily is! Map) return const {};
      final times = (daily['time'] as List?) ?? const [];
      final codes = (daily['weathercode'] as List?) ?? const [];
      final maxs = (daily['temperature_2m_max'] as List?) ?? const [];
      final mins = (daily['temperature_2m_min'] as List?) ?? const [];
      final pops =
          (daily['precipitation_probability_max'] as List?) ?? const [];
      final out = <DateTime, DailyWeather>{};
      for (var i = 0; i < times.length; i++) {
        final day = DateTime.tryParse('${times[i]}');
        if (day == null) continue;
        out[DateTime(day.year, day.month, day.day)] = DailyWeather(
          date: DateTime(day.year, day.month, day.day),
          tempMax:
              (maxs.length > i ? (maxs[i] as num?)?.toDouble() : null) ??
              double.nan,
          tempMin:
              (mins.length > i ? (mins[i] as num?)?.toDouble() : null) ??
              double.nan,
          weatherCode:
              (codes.length > i ? (codes[i] as num?)?.toInt() : null) ?? 2,
          precipitationProbabilityMax:
              (pops.length > i ? (pops[i] as num?)?.toInt() : null) ?? 0,
        );
      }
      return out;
    } catch (e) {
      debugPrint('[Weather] parse daily failed: $e');
      return const {};
    }
  }

  /// Hourly forecast map (hour -> info) for live lookups.
  Future<Map<DateTime, WeatherInfo>> fetchHourly(double lat, double lng) async {
    final json = await _getJson(lat, lng);
    if (json == null) return const {};
    try {
      final hourly = json['hourly'];
      if (hourly is! Map) return const {};
      final times = (hourly['time'] as List?) ?? const [];
      final temps = (hourly['temperature_2m'] as List?) ?? const [];
      final codes = (hourly['weathercode'] as List?) ?? const [];
      final pops = (hourly['precipitation_probability'] as List?) ?? const [];
      final out = <DateTime, WeatherInfo>{};
      for (var i = 0; i < times.length; i++) {
        final t = DateTime.tryParse('${times[i]}');
        if (t == null) continue;
        out[DateTime(t.year, t.month, t.day, t.hour)] = WeatherInfo(
          temperatureC:
              (temps.length > i ? (temps[i] as num?)?.toDouble() : null) ??
              double.nan,
          weatherCode:
              (codes.length > i ? (codes[i] as num?)?.toInt() : null) ?? 2,
          precipitationProbability:
              (pops.length > i ? (pops[i] as num?)?.toInt() : null) ?? 0,
          dateTime: t,
        );
      }
      return out;
    } catch (e) {
      debugPrint('[Weather] parse hourly failed: $e');
      return const {};
    }
  }

  /// Forecast for the picked date-time (matched to the nearest hour).
  Future<WeatherInfo?> fetchForDateTime(
    double lat,
    double lng,
    DateTime dateTime,
  ) async {
    // Open-Meteo spans ~16 days: skip network calls beyond that.
    final now = DateTime.now();
    if (dateTime.difference(now).inDays > 16) return null;
    final json = await _getJson(lat, lng);
    if (json == null) return null;
    try {
      final hourly = json['hourly'];
      if (hourly is! Map) return null;
      final times = (hourly['time'] as List?) ?? const [];
      final temps = (hourly['temperature_2m'] as List?) ?? const [];
      final codes = (hourly['weathercode'] as List?) ?? const [];
      final pops = (hourly['precipitation_probability'] as List?) ?? const [];
      if (times.isEmpty) return null;

      // Find the hour index closest to the chosen date.
      var best = 0;
      var bestDiff = 1 << 62;
      for (var i = 0; i < times.length; i++) {
        final t = DateTime.tryParse('${times[i]}');
        if (t == null) continue;
        final diff = (t.difference(dateTime).inMinutes).abs();
        if (diff < bestDiff) {
          bestDiff = diff;
          best = i;
        }
      }
      // Reject when the closest hour is still off by >12h (out of range).
      if (bestDiff > 12 * 60) return null;
      final bestTime = DateTime.tryParse('${times[best]}') ?? dateTime;
      return WeatherInfo(
        temperatureC:
            (temps.length > best ? (temps[best] as num?)?.toDouble() : null) ??
            double.nan,
        weatherCode:
            (codes.length > best ? (codes[best] as num?)?.toInt() : null) ?? 2,
        precipitationProbability:
            (pops.length > best ? (pops[best] as num?)?.toInt() : null) ?? 0,
        dateTime: bestTime,
      );
    } catch (e) {
      debugPrint('[Weather] parse hourly failed: $e');
      return null;
    }
  }

  @visibleForTesting
  void clearCache() => _cache.clear();
}
