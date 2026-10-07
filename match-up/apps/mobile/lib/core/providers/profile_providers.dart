import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/repository_providers.dart';
import '../../features/profile/domain/user_model.dart';

/// Async provider for the current user's profile. Screens watch this for loading/error/data — never hardcode user data.
final myProfileProvider = FutureProvider.autoDispose<UserModel>((ref) {
  return ref.watch(userRepositoryProvider).me();
});

/// Provider for another user's profile by ID.
final playerProfileProvider = FutureProvider.autoDispose
    .family<UserModel?, String>((ref, id) {
      return ref.watch(userRepositoryProvider).byId(id);
    });
