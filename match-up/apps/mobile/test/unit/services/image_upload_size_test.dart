import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/core/services/storage_service.dart';

/// Guards the shared upload-size contract: oversized picks throw
/// [ImageTooLargeException] (user-facing copy included) instead of
/// burning upload bandwidth just to be denied by `storage.rules` —
/// and callers must never silently proceed without the photo.
void main() {
  late Directory dir;

  setUp(() async {
    dir = await Directory.systemTemp.createTemp('upload_size_');
  });

  tearDown(() async {
    try {
      await dir.delete(recursive: true);
    } catch (_) {}
  });

  Future<String> fileOf(int bytes) async {
    final file = File('${dir.path}/pic_$bytes.jpg');
    await file.writeAsBytes(List.filled(bytes, 7), flush: true);
    return file.path;
  }

  group('StorageService.checkImageSize', () {
    test('passes files within the cap', () async {
      final path = await fileOf(1024);
      await StorageService.checkImageSize(path, kMaxChatImageBytes);
    });

    test('throws ImageTooLargeException over the cap', () async {
      final path = await fileOf(kMaxChatImageBytes + 1);
      expect(
        () => StorageService.checkImageSize(path, kMaxChatImageBytes),
        throwsA(isA<ImageTooLargeException>()),
      );
    });

    test('exception message names actual and maximum megabytes', () async {
      final path = await fileOf(kMaxChatImageBytes + 512 * 1024);
      try {
        await StorageService.checkImageSize(path, kMaxChatImageBytes);
        fail('expected ImageTooLargeException');
      } on ImageTooLargeException catch (e) {
        expect(e.message, contains('8.0 MB'));
        expect(e.message, contains('Maximum is'));
      }
    });

    test('missing files fall through to the upload attempt', () async {
      // No throw: stat errors are the uploader's problem, reported
      // generically there.
      await StorageService.checkImageSize(
        '${dir.path}/does-not-exist.jpg',
        kMaxChatImageBytes,
      );
    });
  });

  group('upload caps mirror storage.rules', () {
    test('chat and cover caps are 8 MB', () {
      expect(kMaxChatImageBytes, 8 * 1024 * 1024);
      expect(kMaxCoverImageBytes, 8 * 1024 * 1024);
    });
  });
}
