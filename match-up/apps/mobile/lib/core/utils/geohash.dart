/// Geohash encoder for latitude/longitude pairs.
/// The backend's [CreateActivityInput] requires a `geohash` string.
/// Precision reference (Niemeyer's geohash): 5 chars ≈ 4.9 km × 4.9 km 6 chars ≈ 1.2 km × 0.6 km 7 chars ≈ 152 m ×.
/// We default to 7 — enough for a neighbourhood-level "is this activity near me?" query without leaking precise home.
library;

/// Standard geohash base-32 alphabet (Niemeyer).
const _base32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/// Encodes a `(lat, lng)` pair to a geohash string.
/// [precision] is the number of characters in the output. Must be between 1 and 12.
String geohashEncode(double latitude, double longitude, {int precision = 7}) {
  if (precision < 1) precision = 1;
  if (precision > 12) precision = 12;

  var lat = (latitude < -90.0 ? -90.0 : (latitude > 90.0 ? 90.0 : latitude));
  var lon = (longitude < -180.0
      ? -180.0
      : (longitude > 180.0 ? 180.0 : longitude));

  var latLow = -90.0;
  var latHigh = 90.0;
  var lonLow = -180.0;
  var lonHigh = 180.0;

  final buffer = StringBuffer();
  var bits = 0;
  var bit = 0;
  var even = true; // even bit = longitude, odd bit = latitude

  while (buffer.length < precision) {
    if (even) {
      final mid = (lonLow + lonHigh) / 2;
      if (lon >= mid) {
        bits = (bits << 1) | 1;
        lonLow = mid;
      } else {
        bits = bits << 1;
        lonHigh = mid;
      }
    } else {
      final mid = (latLow + latHigh) / 2;
      if (lat >= mid) {
        bits = (bits << 1) | 1;
        latLow = mid;
      } else {
        bits = bits << 1;
        latHigh = mid;
      }
    }

    even = !even;
    bit += 1;

    if (bit == 5) {
      buffer.write(_base32[bits & 0x1f]);
      bits = 0;
      bit = 0;
    }
  }

  return buffer.toString();
}
