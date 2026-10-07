import 'package:flutter/foundation.dart';

/// Structured, release-safe logger for MatchUp.
/// Rules (OWASP M6 — Inadequate Privacy Controls): Output is suppressed entirely in release builds (`kDebugMode ==.
/// To log in production.

void logInfo(String message) {
  if (kDebugMode) {
    debugPrint('[INFO] $message');
  }
}

void logWarning(String message) {
  if (kDebugMode) {
    debugPrint('[WARN] $message');
  }
}

void logError(String message, [Object? error, StackTrace? stackTrace]) {
  if (kDebugMode) {
    debugPrint('[ERROR] $message${error != null ? ': $error' : ''}');
    if (stackTrace != null) debugPrintStack(stackTrace: stackTrace);
  }
  // Release builds are intentionally silent (no-op): user-visible errors surface via snackbars/dialogs at the call.
}
