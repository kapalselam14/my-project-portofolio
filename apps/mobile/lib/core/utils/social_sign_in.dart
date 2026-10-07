import 'package:flutter/material.dart';

import '../widgets/app_snackbar.dart';

/// Honest state for Apple/Google sign-in: there is no OAuth client behind those buttons yet.
const String socialSignInUnavailableMessage =
    'Social sign-in isn\'t available yet — please use email';

/// Shows the "social sign-in unavailable" notice.
void showSocialSignInUnavailable(BuildContext context) {
  AppSnackbar.show(
    context,
    message: socialSignInUnavailableMessage,
    variant: AppSnackbarVariant.info,
  );
}
