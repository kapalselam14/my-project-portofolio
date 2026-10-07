import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers/repository_providers.dart';
import '../data/auth_repository.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/utils/secure_screen.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/system_back.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/pressable_scale.dart';

/// Confirmation shown after [ForgotPasswordScreen] successfully sends a Firebase password-reset email.
/// Firebase email/password recovery is link-based.
class ResetLinkSentScreen extends ConsumerStatefulWidget {
  const ResetLinkSentScreen({super.key, this.email = ''});
  final String email;

  @override
  ConsumerState<ResetLinkSentScreen> createState() =>
      _ResetLinkSentScreenState();
}

class _ResetLinkSentScreenState extends ConsumerState<ResetLinkSentScreen>
    with SecureScreenMixin {
  Timer? _timer;
  int _secondsRemaining = 0;
  bool _isResending = false;

  @override
  void initState() {
    super.initState();
    // Start the 60s cooldown on open (not only after resend) so the just-sent link can't be spammed immediately.
    _secondsRemaining = 60;
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        if (_secondsRemaining > 0) _secondsRemaining--;
      });
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _startCooldown() {
    _timer?.cancel();
    setState(() => _secondsRemaining = 60);
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {
        if (_secondsRemaining > 0) _secondsRemaining--;
      });
    });
  }

  String get _timerText {
    final m = (_secondsRemaining ~/ 60).toString().padLeft(2, '0');
    final s = (_secondsRemaining % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  Future<void> _resend() async {
    if (_secondsRemaining > 0 || _isResending || widget.email.isEmpty) return;
    setState(() => _isResending = true);
    try {
      await ref
          .read(authRepositoryProvider)
          .forgotPassword(email: widget.email);
      if (!mounted) return;
      _startCooldown();
      AppSnackbar.show(
        context,
        message: 'Reset link sent again.',
        variant: AppSnackbarVariant.info,
      );
    } catch (e) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: e is AuthException
            ? e.userMessage
            : 'Could not resend. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    } finally {
      if (mounted) setState(() => _isResending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final hasEmail = widget.email.isNotEmpty;
    final email = hasEmail ? widget.email : 'your email';
    final screenHeight = MediaQuery.of(context).size.height;
    final safeTop = MediaQuery.of(context).padding.top;
    final safeBottom = MediaQuery.of(context).padding.bottom;
    final availableHeight = screenHeight - safeTop - safeBottom;

    return SystemBackFallback(
      onEmptyStack: (context) => context.go('/login'),
      child: AppScaffold(
        safeAreaTop: true,
        showHomeIndicator: true,
        backgroundColor: context.colors.background,
        body: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.x5,
              AppSpacing.x3,
              AppSpacing.x5,
              AppSpacing.x6,
            ),
            child: ConstrainedBox(
              constraints: BoxConstraints(
                minHeight: availableHeight - AppSpacing.x3 - AppSpacing.x6,
              ),
              child: IntrinsicHeight(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Back button
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Semantics(
                        button: true,
                        label: 'Back',
                        child: PressableScale(
                          onTap: () async {
                            // maybePop no-ops when this screen is the stack root (e.g. deep link).
                            final popped = await Navigator.of(
                              context,
                            ).maybePop();
                            if (!context.mounted) return;
                            if (!popped) context.go('/login');
                          },
                          child: Container(
                            width: 40,
                            height: 40,
                            alignment: Alignment.center,
                            child: Icon(
                              Icons.arrow_back_ios_new_rounded,
                              size: 20,
                              color: context.colors.textPrimary,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.x4),

                    // Icon
                    Container(
                      width: 64,
                      height: 64,
                      decoration: BoxDecoration(
                        color: context.colors.primarySoft,
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: Icon(
                        Icons.mark_email_unread_rounded,
                        size: 30,
                        color: context.colors.primaryOnSurface,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.x4),

                    // Title + subtitle
                    Text(
                      'Check Your Email',
                      style: AppTypography.headingDisplay(context),
                    ),
                    const SizedBox(height: AppSpacing.x2),
                    Text.rich(
                      TextSpan(
                        style: AppTypography.bodyFormSecondary(context),
                        children: [
                          const TextSpan(
                            text: 'We sent a password reset link to ',
                          ),
                          TextSpan(
                            text: email,
                            style: AppTypography.bodyFormSecondary(context)
                                .copyWith(
                                  fontWeight: FontWeight.w700,
                                  color: context.colors.textPrimary,
                                ),
                          ),
                          const TextSpan(
                            text:
                                '. Tap the link in that email to choose a new '
                                'password, then sign in again.',
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.x5),

                    // Back to sign in button
                    PressableScale(
                      onTap: () => context.go('/login'),
                      child: Container(
                        width: double.infinity,
                        height: 54,
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(AppRadius.lg),
                          boxShadow: AppShadows.glowPrimary,
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          'Back to Sign In',
                          style: AppTypography.buttonPrimary,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.x4),

                    // Resend link — disabled when email is empty.
                    if (!hasEmail)
                      Center(
                        child: Text(
                          'Open this link from your email app.',
                          style: AppTypography.bodyFormSecondary(context),
                          textAlign: TextAlign.center,
                        ),
                      )
                    else
                      Center(
                        child: Wrap(
                          crossAxisAlignment: WrapCrossAlignment.center,
                          spacing: 4,
                          children: [
                            Text(
                              _secondsRemaining > 0
                                  ? 'Resend link in $_timerText'
                                  : "Didn't receive the email?",
                              style: AppTypography.bodyFormSecondary(context),
                            ),
                            if (_secondsRemaining == 0)
                              Semantics(
                                button: true,
                                label: 'Resend reset link',
                                child: PressableScale(
                                  onTap: _isResending ? null : _resend,
                                  child: _isResending
                                      ? const SizedBox(
                                          width: 14,
                                          height: 14,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                          ),
                                        )
                                      : Text(
                                          'Resend',
                                          style:
                                              AppTypography.bodyFormSecondary(
                                                context,
                                              ).copyWith(
                                                color: AppColors.primary,
                                                fontWeight: FontWeight.w700,
                                                decoration:
                                                    TextDecoration.underline,
                                                decorationColor:
                                                    AppColors.primary,
                                              ),
                                        ),
                                ),
                              ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
