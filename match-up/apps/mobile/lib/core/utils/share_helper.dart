import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';

import '../../features/activities/domain/activity_model.dart';
import '../../features/profile/domain/user_model.dart';

/// System share sheet wrappers.
class ShareHelper {
  const ShareHelper._();

  static Future<bool> shareActivity(ActivityModel activity) {
    final when = DateFormat('EEE, MMM d · h:mm a').format(activity.dateTime);
    return shareText(
      'Join me on MatchUp!\n'
      '${activity.title} ($when)\n'
      '${activity.location}'
      '${activity.description.isNotEmpty ? '\n${activity.description}' : ''}',
      subject: activity.title,
    );
  }

  static Future<bool> shareProfile(UserModel user) {
    final rating = (user.rating ?? 0) > 0
        ? 'Rated ${user.rating!.toStringAsFixed(1)} on MatchUp'
        : 'Find them on MatchUp';
    return shareText(
      '${user.displayName} — $rating.',
      subject: user.displayName,
    );
  }

  @visibleForTesting
  static Future<bool> shareText(String text, {String? subject}) async {
    try {
      await SharePlus.instance.share(ShareParams(text: text, subject: subject));
      return true;
    } catch (e) {
      debugPrint('[ShareHelper] share failed: $e');
      return false;
    }
  }
}
