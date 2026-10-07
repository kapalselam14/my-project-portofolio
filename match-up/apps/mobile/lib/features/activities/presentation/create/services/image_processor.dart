import 'dart:convert';
import 'dart:typed_data';

import 'package:image/image.dart' as img;

/// Lightweight image validation & processing service.
/// Cover uploads are downscaled with `package:image`.
class ImageProcessor {
  /// Maximum file size accepted (5 MB).
  static const int maxFileSize = 5 * 1024 * 1024;

  /// Maximum edge dimension in pixels.
  static const int maxDimension = 4096;

  /// Long edge target for cover uploads.
  static const int uploadMaxEdge = 1920;

  // Validation.

  bool isValidFormat(String mimeType) {
    return const {'image/jpeg', 'image/png', 'image/webp'}.contains(mimeType);
  }

  bool isValidSize(int fileSize) => fileSize <= maxFileSize;

  bool isValidDimensions(int width, int height) =>
      width <= maxDimension && height <= maxDimension;

  /// Validate a raw byte buffer and return an error string, or null if valid.
  String? validateBytes(Uint8List bytes) {
    if (bytes.lengthInBytes > maxFileSize) {
      return 'Image must be under 5 MB. Please choose a smaller file.';
    }
    return null;
  }

  // Encode decode.

  /// Encode raw bytes to a base-64 string.
  String encodeToBase64(Uint8List bytes) => base64.encode(bytes);

  /// Decode a base-64 string back to raw bytes.
  Uint8List decodeFromBase64(String base64Image) => base64.decode(base64Image);

  // Compression (downscale long edge JPEG quality).
  /// Downscales the image so its long edge fits.
  /// Returns the input unchanged when it is already under target, or when the bytes can't be decoded (not an image).
  Future<Uint8List> process(Uint8List bytes, {int targetKb = 800}) async {
    // If under target size, return as-is.
    if (bytes.lengthInBytes <= targetKb * 1024) return bytes;

    final decoded = img.decodeImage(bytes);
    // Not decodable (not an image, corrupt) — leave untouched.
    if (decoded == null) return bytes;

    img.Image resized = decoded;
    final longEdge = decoded.width > decoded.height
        ? decoded.width
        : decoded.height;
    if (longEdge > uploadMaxEdge) {
      final scale = uploadMaxEdge / longEdge;
      resized = img.copyResize(
        decoded,
        width: (decoded.width * scale).round(),
        height: (decoded.height * scale).round(),
        interpolation: img.Interpolation.linear,
      );
    }

    var quality = 85;
    var encoded = Uint8List.fromList(img.encodeJpg(resized, quality: quality));
    while (encoded.lengthInBytes > targetKb * 1024 && quality > 60) {
      quality -= 10;
      encoded = Uint8List.fromList(img.encodeJpg(resized, quality: quality));
    }
    return encoded;
  }

  // Base64 round trip helpers.

  /// Process a base-64 image string and return processed base-64.
  Future<String> processBase64(String base64Image) async {
    final bytes = decodeFromBase64(base64Image);
    final processed = await process(bytes);
    return encodeToBase64(processed);
  }
}
