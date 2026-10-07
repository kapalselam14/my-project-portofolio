import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/providers/auth_state_provider.dart';
import '../../../core/providers/repository_providers.dart';
import '../../../core/storage/secure_token_store.dart';
import '../data/auth_repository.dart';
import '../../notifications/services/push_notification_service.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/utils/secure_screen.dart';
import '../../../core/utils/social_sign_in.dart';
import '../../../core/widgets/app_dialog.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/system_back.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/pressable_scale.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen>
    with SecureScreenMixin {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmController = TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirm = true;
  bool _isLoading = false;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  Future<void> _onRegister() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isLoading = true);
    try {
      final result = await ref
          .read(authRepositoryProvider)
          .register(
            name: _nameController.text.trim(),
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
      // New account: onboarding not yet done.
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setBool(gtkDoneKeyFor(result.userId), false);
      } catch (_) {
        // Fail-open: onboarding resume is best-effort.
      }
      if (!mounted) return;
      // Same push-registration refresh as login: startup ran logged-out.
      unawaited(
        PushNotificationService.instance.refreshRegistration(
          deviceRepository: ref.read(deviceRepositoryProvider),
        ),
      );
      context.go('/get-to-know-1');
    } catch (e) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: e is AuthException
            ? e.userMessage
            : 'Registration failed. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _onClose() async {
    final dirty =
        _nameController.text.isNotEmpty ||
        _emailController.text.isNotEmpty ||
        _passwordController.text.isNotEmpty ||
        _confirmController.text.isNotEmpty;
    if (!dirty) {
      context.go('/welcome');
      return;
    }
    final discard = await AppDialog.confirm(
      context,
      title: 'Discard sign up?',
      body: 'You have unsaved changes. Discard them and go back?',
      confirmLabel: 'Discard',
    );
    if (discard == true && mounted) context.go('/welcome');
  }

  String? _validateName(String? value) {
    final v = value?.trim() ?? '';
    if (v.isEmpty) return 'Name is required';
    if (v.length < 2) return 'Name must be at least 2 characters';
    if (v.length > 50) return 'Name must be at most 50 characters';
    return null;
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
    if (value.length < 8) return 'Password must be at least 8 characters';
    if (!RegExp(r'[A-Za-z]').hasMatch(value) ||
        !RegExp(r'[0-9]').hasMatch(value)) {
      return 'Password must include a letter and a number';
    }
    return null;
  }

  String? _validateConfirm(String? value) {
    if (value == null || value.isEmpty) return 'Please confirm your password';
    if (value != _passwordController.text) return 'Passwords do not match';
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;
    final safeAreaTop = MediaQuery.of(context).padding.top;
    final safeAreaBottom = MediaQuery.of(context).padding.bottom;
    final availableHeight = screenHeight - safeAreaTop - safeAreaBottom;

    return SystemBackFallback(
      // Same dirty-check as the UI close button: typed input must confirm before it is discarded.
      onEmptyStack: (_) => _onClose(),
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
                        'Sign Up',
                        style: AppTypography.headingDisplay(context),
                      ),
                      const SizedBox(height: AppSpacing.x1),
                      Text(
                        'Create your MatchUp account',
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
                              'OR SIGN UP WITH EMAIL',
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

                      // Full Name
                      Text(
                        'Full Name',
                        style: AppTypography.labelField(context),
                      ),
                      const SizedBox(height: AppSpacing.x2),
                      _TextField(
                        controller: _nameController,
                        hint: 'Enter your full name',
                        icon: Icons.person_outline_rounded,
                        keyboardType: TextInputType.name,
                        textInputAction: TextInputAction.next,
                        validator: _validateName,
                      ),
                      const SizedBox(height: AppSpacing.x3),

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
                        hint: 'Create a strong password',
                        icon: Icons.lock_outline_rounded,
                        obscureText: _obscurePassword,
                        textInputAction: TextInputAction.next,
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
                      const SizedBox(height: AppSpacing.x3),

                      // Confirm Password
                      Text(
                        'Confirm Password',
                        style: AppTypography.labelField(context),
                      ),
                      const SizedBox(height: AppSpacing.x2),
                      _TextField(
                        controller: _confirmController,
                        hint: 'Confirm your password',
                        icon: Icons.lock_outline_rounded,
                        obscureText: _obscureConfirm,
                        textInputAction: TextInputAction.done,
                        onSubmitted: (_) => _onRegister(),
                        validator: _validateConfirm,
                        suffixIcon: IconButton(
                          icon: Icon(
                            _obscureConfirm
                                ? Icons.visibility_off_outlined
                                : Icons.visibility_outlined,
                            size: 20,
                            color: context.colors.textTertiary,
                          ),
                          onPressed: () => setState(
                            () => _obscureConfirm = !_obscureConfirm,
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.x5),

                      // Create Account button
                      PressableScale(
                        onTap: _isLoading ? null : _onRegister,
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
                                  'Create Account',
                                  style: AppTypography.buttonPrimary,
                                ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.x4),

                      // Already have an account? Sign In
                      Center(
                        child: Wrap(
                          crossAxisAlignment: WrapCrossAlignment.center,
                          spacing: 4,
                          children: [
                            Text(
                              'Already have an account?',
                              style: AppTypography.bodyFormSecondary(context),
                            ),
                            Semantics(
                              button: true,
                              label: 'Sign in',
                              child: PressableScale(
                                onTap: () => context.go('/login'),
                                child: Text(
                                  'Sign In',
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

  // Field styling is theme-aware — light uses subtle surfaceMuted fill, dark uses surfaceMuted too.
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
