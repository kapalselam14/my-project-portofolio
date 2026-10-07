import 'package:flutter/foundation.dart';

import '../../../core/network/api_client.dart';
import '../domain/device_record.dart';
import 'device_repository.dart';
import 'local_device_repository.dart';

/// HTTP-backed [DeviceRepository] for the live MatchUp API.
/// Endpoints used: `POST /api/devices` — register or refresh a device `GET /api/devices/me` — list the user's devices.
/// All operations fall back to [LocalDeviceRepository] on failure so the app stays functional offline.
class RemoteDeviceRepository implements DeviceRepository {
  RemoteDeviceRepository({ApiClient? client, DeviceRepository? fallback})
    : _client = client ?? ApiClient.instance,
      _fallback = fallback ?? LocalDeviceRepository();

  final ApiClient _client;
  final DeviceRepository _fallback;

  @override
  Future<void> register(DeviceRecord device) async {
    try {
      await _client.dio.post(
        '/devices',
        data: {
          'deviceId': device.deviceId,
          'fcmToken': device.fcmToken,
          'platform': device.platform.wireValue,
        },
      );
    } catch (e, st) {
      debugPrint('[RemoteDeviceRepository.register] $e\n$st');
      await _fallback.register(device);
    }
  }

  @override
  Future<List<DeviceRecord>> list() async {
    try {
      final res = await _client.dio.get('/devices/me');
      return apiDataList(res.data)
          .whereType<Map<String, dynamic>>()
          .map(_parse)
          .whereType<DeviceRecord>()
          .toList();
    } catch (e, st) {
      debugPrint('[RemoteDeviceRepository.list] $e\n$st');
      return _fallback.list();
    }
  }

  @override
  Future<void> delete(String deviceId) async {
    try {
      await _client.dio.delete('/devices/me/$deviceId');
    } catch (e, st) {
      debugPrint('[RemoteDeviceRepository.delete] $e\n$st');
      await _fallback.delete(deviceId);
    }
  }

  DeviceRecord? _parse(Map<String, dynamic> json) {
    final platform = DevicePlatform.fromWire(json['platform'] as String?);
    if (platform == null) return null;
    return DeviceRecord(
      deviceId: json['deviceId']?.toString() ?? '',
      fcmToken: json['fcmToken'] as String? ?? '',
      platform: platform,
    );
  }
}
