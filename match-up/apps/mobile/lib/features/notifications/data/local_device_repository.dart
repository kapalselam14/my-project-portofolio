import '../domain/device_record.dart';
import 'device_repository.dart';

/// Offline-only device store.
class LocalDeviceRepository implements DeviceRepository {
  @override
  Future<void> register(DeviceRecord device) async {}

  @override
  Future<List<DeviceRecord>> list() async {
    return const <DeviceRecord>[];
  }

  @override
  Future<void> delete(String deviceId) async {}
}
