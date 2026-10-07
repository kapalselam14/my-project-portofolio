import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers/repository_providers.dart';
import '../data/auth_repository.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/theme/dark_colors.dart';
import '../../../core/utils/nav_guard.dart';
import '../../../core/utils/secure_screen.dart';
import '../../../core/widgets/app_scaffold.dart';
import '../../../core/widgets/system_back.dart';
import '../../../core/widgets/app_snackbar.dart';
import '../../../core/widgets/pressable_scale.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() =>
      _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen>
    with SecureScreenMixin {
  final _emailController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  String? _validateEmail(String? value) {
    final v = value?.trim() ?? '';
    if (v.isEmpty) return 'Email is required';
    if (!RegExp(r'^[^@]+@[^@]+\.[^@]+$').hasMatch(v)) {
      return 'Enter a valid email address';
    }
    return null;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSubmitting = true);
    try {
      final email = _emailController.text.trim();
      await ref.read(authRepositoryProvider).forgotPassword(email: email);
      if (!mounted) return;
      // Pass email via query parameters so it survives process death.
      final encoded = Uri.encodeComponent(email);
      NavGuard.push(context, '/reset-link-sent?email=$encoded');
    } catch (e) {
      if (!mounted) return;
      AppSnackbar.show(
        context,
        message: e is AuthException
            ? e.userMessage
            : 'Could not send reset email. Please try again.',
        variant: AppSnackbarVariant.error,
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
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
                child: Form(
                  key: _formKey,
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
                          Icons.lock_reset_rounded,
                          size: 30,
                          color: context.colors.primaryOnSurface,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.x4),

                      // Title + subtitle
                      Text(
                        'Forgot Password?',
                        style: AppTypography.headingDisplay(context),
                      ),
                      const SizedBox(height: AppSpacing.x2),
                      Text(
                        "Enter your email address and we'll send you a link to reset your password.",
                        style: AppTypography.bodyFormSecondary(context),
                      ),
                      const SizedBox(height: AppSpacing.x5),

                      // Email field
                      Text(
                        'Email Address',
                        style: AppTypography.labelField(context),
                      ),
                      const SizedBox(height: AppSpacing.x2),
                      _AuthTextField(
                        controller: _emailController,
                        hint: 'Enter your email',
                        icon: Icons.email_outlined,
                        keyboardType: TextInputType.emailAddress,
                        textInputAction: TextInputAction.done,
                        onSubmitted: (_) => _submit(),
                        validator: _validateEmail,
                      ),
                      const SizedBox(height: AppSpacing.x5),

                      // Send Code button
                      PressableScale(
                        onTap: _isSubmitting ? null : _submit,
                        child: Container(
                          width: double.infinity,
                          height: 54,
                          decoration: BoxDecoration(
                            color: _isSubmitting
                                ? AppColors.primary.withValues(alpha: 0.6)
                                : AppColors.primary,
                            borderRadius: BorderRadius.circular(AppRadius.lg),
                            boxShadow: _isSubmitting
                                ? null
                                : AppShadows.glowPrimary,
                          ),
                          alignment: Alignment.center,
                          child: _isSubmitting
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
                                  'Send Reset Link',
                                  style: AppTypography.buttonPrimary,
                                ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.x4),

                      // Back to sign in
                      Center(
                        child: Wrap(
                          crossAxisAlignment: WrapCrossAlignment.center,
                          spacing: 4,
                          children: [
                            Text(
                              'Remember your password?',
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

// Shared text field.

class _AuthTextField extends StatelessWidget {
  const _AuthTextField({
    required this.controller,
    required this.hint,
    required this.icon,
    this.keyboardType,
    this.textInputAction,
    this.validator,
    this.onSubmitted,
  });

  final TextEditingController controller;
  final String hint;
  final IconData icon;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final String? Function(String?)? validator;
  final ValueChanged<String>? onSubmitted;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      validator: validator,
      onFieldSubmitted: onSubmitted,
      cursorColor: AppColors.primary,
      cursorWidth: 1.5,
      style: AppTypography.bodyReading(context).copyWith(fontSize: 15),
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
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
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
    );
  }
}
