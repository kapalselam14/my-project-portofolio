/// Platform of a registered push-notification device.
enum DevicePlatform {
  ios,
  android,
  web;

  /// Wire-format value the backend expects (`'ios' | 'android' | 'web'`).
  String get wireValue => name;

  /// Inverse of [wireValue].
  static DevicePlatform? fromWire(String? value) {
    switch (value) {
      case 'ios':
        return DevicePlatform.ios;
      case 'android':
        return DevicePlatform.android;
      case 'web':
        return DevicePlatform.web;
      default:
        return null;
    }
  }
}

/// A device registered for push notifications for the current user.
class DeviceRecord {
  const DeviceRecord({
    required this.deviceId,
    required this.fcmToken,
    required this.platform,
  });

  final String deviceId;
  final String fcmToken;
  final DevicePlatform platform;
}
