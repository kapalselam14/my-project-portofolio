import 'package:flutter/material.dart';

import '../theme/app_colors.dart';
import '../theme/app_spacing.dart';
import '../theme/app_typography.dart';
import '../theme/dark_colors.dart';

enum _FieldVariant { pill, form }

/// Single entry point for every text input in the app.
/// Two variants, because the app legitimately needs both shapes:
/// [AppTextField.pill] — radius `pill`, fill `surfaceSubtle`, no label.
/// Both variants set `border` / `enabledBorder` / `focusedBorder` / `errorBorder` / `focusedErrorBorder` explicitly.
/// dart AppTextField.pill( controller: _searchController, hint: 'Search chats, sports or matches...', leading:.
/// AppTextField.form( label: 'FULL NAME', controller: _nameController, ) ```.
class AppTextField extends StatelessWidget {
  const AppTextField.pill({
    super.key,
    this.controller,
    this.hint,
    this.leading,
    this.trailing,
    this.maxLines = 1,
    this.keyboardType,
    this.textInputAction,
    this.textCapitalization = TextCapitalization.none,
    this.onChanged,
    this.onSubmitted,
    this.autofocus = false,
    this.enabled = true,
    this.errorText,
  }) : _variant = _FieldVariant.pill,
       label = null,
       maxLength = null,
       validator = null;

  const AppTextField.form({
    super.key,
    required this.label,
    this.controller,
    this.hint,
    this.leading,
    this.trailing,
    this.maxLines = 1,
    this.maxLength,
    this.keyboardType,
    this.textInputAction,
    this.textCapitalization = TextCapitalization.none,
    this.onChanged,
    this.onSubmitted,
    this.autofocus = false,
    this.enabled = true,
    this.errorText,
    this.validator,
  }) : _variant = _FieldVariant.form;

  final _FieldVariant _variant;

  /// `.form()` only — uppercase label rendered above the field.
  final String? label;

  final TextEditingController? controller;
  final String? hint;
  final Widget? leading;
  final Widget? trailing;
  final int maxLines;
  final int? maxLength;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final TextCapitalization textCapitalization;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final bool autofocus;
  final bool enabled;
  final String? errorText;

  /// `.form()` only — `TextFormField` validator, if this field is wrapped in a `Form`.
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    final field = _variant == _FieldVariant.pill
        ? _buildPill(context)
        : _buildForm(context);

    if (label == null) return field;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label!,
          style: AppTypography.metaSub(context).copyWith(
            fontWeight: FontWeight.w700,
            color: context.colors.textSecondary,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: AppSpacing.x2),
        field,
      ],
    );
  }

  Widget _buildPill(BuildContext context) {
    return Container(
      height: maxLines == 1 ? 44 : null,
      constraints: maxLines == 1 ? null : const BoxConstraints(minHeight: 44),
      decoration: BoxDecoration(
        color: enabled
            ? context.colors.surfaceSubtle
            : context.colors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: context.colors.border),
      ),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.x4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          if (leading != null) ...[leading!, const SizedBox(width: 8)],
          Expanded(child: _textField(context, dense: true)),
          if (trailing != null) ...[const SizedBox(width: 4), trailing!],
        ],
      ),
    );
  }

  Widget _buildForm(BuildContext context) {
    return TextFormField(
      controller: controller,
      maxLines: maxLines,
      maxLength: maxLength,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      textCapitalization: textCapitalization,
      onChanged: onChanged,
      onFieldSubmitted: onSubmitted,
      autofocus: autofocus,
      enabled: enabled,
      validator: validator,
      cursorColor: context.colors.textPrimary,
      cursorWidth: 1.5,
      style: AppTypography.bodyReading(
        context,
      ).copyWith(color: context.colors.textPrimary),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: AppTypography.bodyReading(
          context,
        ).copyWith(color: context.colors.textTertiary),
        errorText: errorText,
        prefixIcon: leading == null
            ? null
            : Padding(
                padding: const EdgeInsets.only(left: 14, right: 8),
                child: leading,
              ),
        prefixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
        suffixIcon: trailing == null
            ? null
            : Padding(
                padding: const EdgeInsets.only(right: 14, left: 8),
                child: trailing,
              ),
        suffixIconConstraints: const BoxConstraints(minWidth: 0, minHeight: 0),
        isDense: true,
        filled: true,
        fillColor: enabled
            ? context.colors.surface
            : context.colors.surfaceMuted,
        contentPadding: EdgeInsets.symmetric(
          horizontal: leading != null ? 4 : 14,
          vertical: 14,
        ),
        border: _formBorder(context.colors.border),
        enabledBorder: _formBorder(context.colors.border),
        focusedBorder: _formBorder(AppColors.primary, width: 1.5),
        errorBorder: _formBorder(AppColors.error),
        focusedErrorBorder: _formBorder(AppColors.error, width: 1.5),
        disabledBorder: _formBorder(context.colors.border),
      ),
    );
  }

  Widget _textField(BuildContext context, {required bool dense}) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      keyboardType: keyboardType,
      textInputAction: textInputAction,
      textCapitalization: textCapitalization,
      onChanged: onChanged,
      onSubmitted: onSubmitted,
      autofocus: autofocus,
      enabled: enabled,
      cursorColor: context.colors.textPrimary,
      cursorWidth: 1.5,
      style: AppTypography.bodyReading(
        context,
      ).copyWith(color: context.colors.textPrimary),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: AppTypography.bodyReading(
          context,
        ).copyWith(color: context.colors.textTertiary),
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
        disabledBorder: InputBorder.none,
        isDense: dense,
        contentPadding: EdgeInsets.zero,
      ),
    );
  }

  OutlineInputBorder _formBorder(Color color, {double width = 1}) {
    return OutlineInputBorder(
      borderRadius: BorderRadius.circular(AppRadius.input),
      borderSide: BorderSide(color: color, width: width),
    );
  }
}
