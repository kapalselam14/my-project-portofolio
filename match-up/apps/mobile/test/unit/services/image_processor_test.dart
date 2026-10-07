import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/features/activities/presentation/create/services/image_processor.dart';

void main() {
  late ImageProcessor processor;

  setUp(() => processor = ImageProcessor());

  group('ImageProcessor — format validation', () {
    test('should accept JPEG mime type', () {
      expect(processor.isValidFormat('image/jpeg'), isTrue);
    });

    test('should accept PNG mime type', () {
      expect(processor.isValidFormat('image/png'), isTrue);
    });

    test('should accept WebP mime type', () {
      expect(processor.isValidFormat('image/webp'), isTrue);
    });

    test('should reject unsupported mime types', () {
      expect(processor.isValidFormat('image/gif'), isFalse);
      expect(processor.isValidFormat('application/pdf'), isFalse);
      expect(processor.isValidFormat(''), isFalse);
    });
  });

  group('ImageProcessor — size validation', () {
    const fiveMb = 5 * 1024 * 1024;

    test('should accept files under 5 MB', () {
      expect(processor.isValidSize(fiveMb - 1), isTrue);
    });

    test('should accept files exactly 5 MB', () {
      expect(processor.isValidSize(fiveMb), isTrue);
    });

    test('should reject files over 5 MB', () {
      expect(processor.isValidSize(fiveMb + 1), isFalse);
    });
  });

  group('ImageProcessor — dimension validation', () {
    test('should accept dimensions within 4096×4096', () {
      expect(processor.isValidDimensions(1920, 1080), isTrue);
      expect(processor.isValidDimensions(4096, 4096), isTrue);
    });

    test('should reject dimensions exceeding 4096', () {
      expect(processor.isValidDimensions(4097, 100), isFalse);
      expect(processor.isValidDimensions(100, 4097), isFalse);
    });
  });

  group('ImageProcessor — validateBytes', () {
    test('should return null for bytes within size limit', () {
      final smallBytes = Uint8List(1024); // 1 KB
      expect(processor.validateBytes(smallBytes), isNull);
    });

    test('should return error string for bytes exceeding 5 MB', () {
      final largeBytes = Uint8List(6 * 1024 * 1024); // 6 MB
      expect(processor.validateBytes(largeBytes), isNotNull);
      expect(processor.validateBytes(largeBytes), contains('5 MB'));
    });
  });

  group('ImageProcessor — base64 round-trip', () {
    test('should encode and decode bytes without data loss', () {
      final original = Uint8List.fromList(List.generate(256, (i) => i));
      final encoded = processor.encodeToBase64(original);
      final decoded = processor.decodeFromBase64(encoded);
      expect(decoded, equals(original));
    });

    test('should produce a valid base64 string', () {
      final bytes = Uint8List.fromList([0, 1, 2, 3]);
      final encoded = processor.encodeToBase64(bytes);
      // Should not throw — valid base64 is decodable
      expect(() => base64.decode(encoded), returnsNormally);
    });
  });

  group('ImageProcessor — processBase64', () {
    test('should return a non-empty base64 string for valid input', () async {
      final bytes = Uint8List(512); // 512 bytes — under threshold
      final input = processor.encodeToBase64(bytes);
      final output = await processor.processBase64(input);
      expect(output, isNotEmpty);
    });
  });
}
