/// Result of a successful sign-in or register operation.
class AuthResult {
  const AuthResult({
    required this.accessToken,
    required this.refreshToken,
    required this.userId,
  });

  final String accessToken;
  final String refreshToken;

  /// Server-side user ID — stored in [SecureTokenStore] and used as the `me` context for profile / activity queries.
  final String userId;
}

/// Abstract contract for every authentication operation the app performs.
/// Implementations: [LocalAuthRepository] (local, always succeeds), [RemoteAuthRepository] (live API).
abstract class AuthRepository {
  /// Signs in with email + password.
  Future<AuthResult> signIn({required String email, required String password});

  /// Creates a new account. Returns [AuthResult] on success (auto-login).
  Future<AuthResult> register({
    required String name,
    required String email,
    required String password,
  });

  /// Sends a password-reset email to [email] via Firebase (`sendOobCode` with `PASSWORD_RESET`).
  Future<void> forgotPassword({required String email});

  /// Invalidates the current session on the server.
  Future<void> signOut();
}

/// Strongly-typed error for authentication failures.
class AuthException implements Exception {
  const AuthException(this.userMessage, {this.code});

  final String userMessage;

  /// Optional server-side error code (e.g. `"INVALID_CREDENTIALS"`).
  final String? code;

  @override
  String toString() => 'AuthException($code): $userMessage';
}
