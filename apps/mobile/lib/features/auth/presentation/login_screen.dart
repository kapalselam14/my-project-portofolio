import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers/auth_state_provider.dart';
import '../../../core/providers/repository_providers.dart';
import '../data/auth_repository.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/utils/secure_screen.dart';
import '../../../core/utils/social_sign_in.dart';
import '../../../core/widgets/app_dialog.dart';
import '../../notifications/services/push_notification_service.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/system_back.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/pressable_scale.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SecureScreenMixin {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  bool _isLoading = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _onClose() async {
    final dirty =
        _emailController.text.isNotEmpty || _passwordController.text.isNotEmpty;
    if (!dirty) {
      context.go('/welcome');
      return;
    }
    final discard = await AppDialog.confirm(
      context,
      title: 'Discard sign in?',
      body: 'You have unsaved changes. Discard them and go back?',
      confirmLabel: 'Discard',
    );
    if (discard == true && mounted) context.go('/welcome');
  }

  Future<void> _onLogin() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      final result = await ref
          .read(authRepositoryProvider)
          .signIn(
            email: _emailController.text.trim(),
            password: _passwordController.text,
          );
      if (!mounted) return;
      await ref
          .read(authStateProvider.notifier)
          .signIn(
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            userId: result.userId,
          );
      if (!mounted) return;
      // The startup registration ran logged-out (401, swallowed).
      unawaited(
        PushNotificationService.instance.refreshRegistration(
          deviceRepository: ref.read(deviceRepositoryProvider),
        ),
      );
      // Navigate explicitly — don't rely solely on the async router redirect.
      context.go('/discovery');
    } catch (e) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: e is AuthException
            ? e.userMessage
            : 'Login failed. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String? _validateEmail(String? value) {
    final v = value?.trim() ?? '';
    if (v.isEmpty) return 'Email is required';
    if (!RegExp(r'^[^@]+@[^@]+\.[^@]+$').hasMatch(v)) {
      return 'Invalid email format';
    }
    return null;
  }

  String? _validatePassword(String? value) {
    if (value == null || value.isEmpty) return 'Password is required';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;
    final safeAreaTop = MediaQuery.of(context).padding.top;
    final safeAreaBottom = MediaQuery.of(context).padding.bottom;
    final availableHeight = screenHeight - safeAreaTop - safeAreaBottom;

    return SystemBackFallback(
      onEmptyStack: (context) => context.go('/welcome'),
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
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // Close button
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Semantics(
                          button: true,
                          label: 'Close',
                          child: PressableScale(
                            onTap: _onClose,
                            child: Container(
                              width: 40,
                              height: 40,
                              alignment: Alignment.center,
                              child: Icon(
                                Icons.close_rounded,
                                size: 24,
                                color: context.colors.textPrimary,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.x3),

                      // Title
                      Text(
                        'Sign In',
                        style: AppTypography.headingDisplay(context),
                      ),
                      const SizedBox(height: AppSpacing.x1),
                      Text(
                        "Let's sign in to your MatchUp account",
                        style: AppTypography.bodyFormSecondary(context),
                      ),
                      const SizedBox(height: AppSpacing.x4),

                      // Social buttons — no OAuth yet; taps explain that.
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: _SocialButton(
                              label: 'Google',
                              icon: Icons.circle_outlined,
                              onTap: () => showSocialSignInUnavailable(context),
                              isOutline: true,
                              comingSoon: true,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.x3),
                          Expanded(
                            child: _SocialButton(
                              label: 'Apple',
                              icon: Icons.apple_rounded,
                              onTap: () => showSocialSignInUnavailable(context),
                              isOutline: false,
                              comingSoon: true,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.x4),

                      // Divider
                      Row(
                        children: [
                          Expanded(
                            child: Divider(color: context.colors.border),
                          ),
                          Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.x3,
                            ),
                            child: Text(
                              'OR SIGN IN WITH EMAIL',
                              style: AppTypography.metaSub(
                                context,
                              ).copyWith(fontSize: 12, letterSpacing: 0.5),
                            ),
                          ),
                          Expanded(
                            child: Divider(color: context.colors.border),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.x4),

                      // Email
                      Text('Email', style: AppTypography.labelField(context)),
                      const SizedBox(height: AppSpacing.x2),
                      _TextField(
                        controller: _emailController,
                        hint: 'Enter your email',
                        icon: Icons.email_outlined,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.next,
                        validator: _validateEmail,
                      ),
                      const SizedBox(height: AppSpacing.x3),

                      // Password
                      Text(
                        'Password',
                        style: AppTypography.labelField(context),
                      ),
                      const SizedBox(height: AppSpacing.x2),
                      _TextField(
                        controller: _passwordController,
                        hint: 'Enter your password',
                        icon: Icons.lock_outline_rounded,
                        obscureText: _obscurePassword,
                        textInputAction: TextInputAction.done,
                        onSubmitted: (_) => _onLogin(),
                        validator: _validatePassword,
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscurePassword
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                            size: 20,
                            color: context.colors.textTertiary,
                          ),
                          onPressed: () => setState(
                            () => _obscurePassword = !_obscurePassword,
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.x2),

                      // Forgot Password
                      Align(
                        alignment: Alignment.centerRight,
                        child: Semantics(
                          button: true,
                          label: 'Forgot password?',
                          child: PressableScale(
                            onTap: () => context.go('/forgot-password'),
                            child: Text(
                              'Forgot Password?',
                              style: AppTypography.labelField(context).copyWith(
                                color: context.colors.primaryOnSurface,
                                fontWeight: FontWeight.w600,
                                fontSize: 13.5,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.x4),

                      // Sign In button
                      PressableScale(
                        onTap: _isLoading ? null : _onLogin,
                        child: Container(
                          width: double.infinity,
                          height: 54,
                          decoration: BoxDecoration(
                            color: _isLoading
                                ? AppColors.primary.withValues(alpha: 0.6)
                                : AppColors.primary,
                            borderRadius: BorderRadius.circular(AppRadius.lg),
                            boxShadow: _isLoading
                                ? null
                                : AppShadows.glowPrimary,
                          ),
                          alignment: Alignment.center,
                          child: _isLoading
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.5,
                                    valueColor: AlwaysStoppedAnimation(
                                      AppColors.textOnPrimary,
                                    ),
                                  ),
                                )
                              : Text(
                                  'Sign In',
                                  style: AppTypography.buttonPrimary,
                                ),
                        ),
                      ),

                      const SizedBox(height: AppSpacing.x4),

                      // Don't have an account? Sign Up
                      Center(
                        child: Wrap(
                          crossAxisAlignment: WrapCrossAlignment.center,
                          spacing: 4,
                          children: [
                            Text(
                              "Don't have an account?",
                              style: AppTypography.bodyFormSecondary(context),
                            ),
                            Semantics(
                              button: true,
                              label: 'Sign up',
                              child: PressableScale(
                                onTap: () => context.go('/register'),
                                child: Text(
                                  'Sign Up',
                                  style:
                                      AppTypography.bodyFormSecondary(
                                        context,
                                      ).copyWith(
                                        color: context.colors.primaryOnSurface,
                                        fontWeight: FontWeight.w700,
                                        decoration: TextDecoration.underline,
                                        decorationColor:
                                            context.colors.primaryOnSurface,
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
      ),
    );
  }
}

// Social button.

class _SocialButton extends StatelessWidget {
  const _SocialButton({
    required this.label,
    required this.icon,
    required this.onTap,
    required this.isOutline,
    this.comingSoon = false,
  });
  final String label;
  final IconData icon;
  final VoidCallback? onTap;
  final bool isOutline;

  /// True while social sign-in is unavailable.
  final bool comingSoon;

  @override
  Widget build(BuildContext context) {
    final button = PressableScale(
      onTap: onTap,
      child: Container(
        height: 52,
        decoration: BoxDecoration(
          color: isOutline ? context.colors.surface : const Color(0xFF000000),
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: isOutline
              ? Border.all(color: context.colors.border, width: 1)
              : null,
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 18,
              color: isOutline
                  ? context.colors.textSecondary
                  : AppColors.textOnPrimary,
            ),
            const SizedBox(width: AppSpacing.x2),
            Text(
              label,
              style: AppTypography.labelField(context).copyWith(
                color: isOutline
                    ? context.colors.textPrimary
                    : AppColors.textOnPrimary,
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
    if (!comingSoon) {
      return Semantics(button: true, label: label, child: button);
    }
    return Semantics(
      button: true,
      label: comingSoon ? '$label (coming soon)' : label,
      enabled: true,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          button,
          if (comingSoon) ...[
            const SizedBox(height: AppSpacing.x1),
            Text(
              'Coming soon',
              style: AppTypography.caption(
                context,
              ).copyWith(color: context.colors.textSecondary, fontSize: 12),
            ),
          ],
        ],
      ),
    );
  }
}

// Text field.

class _TextField extends StatelessWidget {
  const _TextField({
    required this.controller,
    required this.hint,
    required this.icon,
    this.obscureText = false,
    this.keyboardType,
    this.textInputAction,
    this.validator,
    this.onSubmitted,
    this.suffixIcon,
  });

  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final bool obscureText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final String? Function(String?)? validator;
  final ValueChanged<String>? onSubmitted;
  final Widget? suffixIcon;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadius.card),
      ),
      child: TextFormField(
        controller: controller,
        obscureText: obscureText,
        keyboardType: keyboardType,
        textInputAction: textInputAction,
        validator: validator,
        onFieldSubmitted: onSubmitted,
        cursorColor: AppColors.primary,
        cursorWidth: 1.5,
        style: AppTypography.bodyReading(
          context,
        ).copyWith(fontSize: 15, fontWeight: FontWeight.w400),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: AppTypography.bodyReading(
            context,
          ).copyWith(color: context.colors.textTertiary, fontSize: 15),
          prefixIcon: Padding(
            padding: const EdgeInsets.only(left: AppSpacing.x3),
            child: Icon(icon, size: 18, color: context.colors.textTertiary),
          ),
          prefixIconConstraints: const BoxConstraints(minWidth: 48),
          suffixIcon: suffixIcon,
          filled: true,
          fillColor: context.colors.surfaceMuted,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.x4,
            vertical: AppSpacing.x3 + 2,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadius.card),
            borderSide: BorderSide(color: context.colors.border, width: 1),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadius.card),
            borderSide: BorderSide(color: context.colors.border, width: 1),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadius.card),
            borderSide: BorderSide(color: AppColors.primary, width: 2),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadius.card),
            borderSide: BorderSide(color: context.colors.errorText, width: 1),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadius.card),
            borderSide: BorderSide(color: context.colors.errorText, width: 2),
          ),
        ),
      ),
    );
  }
}
