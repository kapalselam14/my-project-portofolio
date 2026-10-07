import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

/// Thrown by [LocationService.getCurrentLocation] when the GPS fix itself times out (as opposed to a permission denial.
class LocationTimeoutException implements Exception {
  const LocationTimeoutException([this.message = 'location fix timed out']);
  final String message;
  @override
  String toString() => 'LocationTimeoutException($message)';
}

/// Thin wrapper around [geolocator] for the chat "share location" attachment.
class LocationService {
  LocationService._();

  static final LocationService instance = LocationService._();

  /// Test-only override.
  @visibleForTesting
  static Future<Position?> Function()? debugGetCurrentLocation;

  /// Requests permission (if needed) and returns the device's current position.
  Future<Position?> getCurrentLocation() async {
    final debugOverride = debugGetCurrentLocation;
    if (debugOverride != null) return debugOverride();
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) return null;

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return null;
      }

      // Bound the GPS wait: on an emulator without a mock location.
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      ).timeout(
        const Duration(seconds: 4),
        onTimeout: () {
          if (kDebugMode) {
            debugPrint('LocationService.getCurrentLocation: timed out');
          }
          throw const LocationTimeoutException();
        },
      );
    } on LocationTimeoutException {
      // A slow fix is transient, not a denial — propagate so the caller can offer a retry instead of a permissions.
      rethrow;
    } catch (e) {
      if (kDebugMode) debugPrint('LocationService.getCurrentLocation: $e');
      return null;
    }
  }

  /// True when the user permanently denied location permission ("don't ask again").
  Future<bool> isPermissionPermanentlyDenied() async {
    if (debugGetCurrentLocation != null) return false;
    try {
      return await Geolocator.checkPermission() ==
          LocationPermission.deniedForever;
    } catch (_) {
      return false;
    }
  }
}
