import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

import '../network/api_client.dart';

/// Signs the Firebase SDK into the same Firebase user the backend already authenticated via the ID token.
/// The app authenticates against Firebase through plain REST ([RemoteAuthRepository]).
/// Every method is a safe no-op when Firebase isn't configured.
class RtdbAuthService {
  RtdbAuthService._();

  static final RtdbAuthService instance = RtdbAuthService._();

  /// Ensures the Firebase SDK has a signed-in user.
  Future<void> ensureSignedIn() async {
    if (!_isFirebaseReady()) return;
    try {
      final auth = FirebaseAuth.instance;
      if (auth.currentUser != null) return;
      final res = await ApiClient.instance.dio.post('/users/custom-token');
      final token = apiDataMap(res.data)?['customToken'] as String?;
      if (token == null || token.isEmpty) {
        debugPrint('[RtdbAuthService] empty custom token');
        return;
      }
      await auth.signInWithCustomToken(token);
    } catch (e, st) {
      debugPrint('[RtdbAuthService.ensureSignedIn] $e\n$st');
    }
  }

  /// Signs the SDK out.
  Future<void> signOut() async {
    if (!_isFirebaseReady()) return;
    try {
      await FirebaseAuth.instance.signOut();
    } catch (e, st) {
      debugPrint('[RtdbAuthService.signOut] $e\n$st');
    }
  }

  bool _isFirebaseReady() {
    try {
      return Firebase.apps.isNotEmpty;
    } catch (_) {
      return false;
    }
  }
}
