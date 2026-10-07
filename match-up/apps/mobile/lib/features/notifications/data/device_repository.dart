import '../domain/device_record.dart';

/// Read/write contract for the current user's push-notification devices.
/// Both [LocalDeviceRepository] (in-memory, used while the backend is in development or when Firebase isn't.
abstract class DeviceRepository {
  /// Registers (or refreshes) a device for push notifications.
  Future<void> register(DeviceRecord device);

  /// Lists every device the current user has registered.
  Future<List<DeviceRecord>> list();

  /// Removes a device from the user's push-notification roster.
  Future<void> delete(String deviceId);
}
