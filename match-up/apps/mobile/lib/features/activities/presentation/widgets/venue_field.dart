import 'package:flutter/material.dart';

import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/dark_colors.dart';
import '../../domain/place_suggestion.dart';
import 'venue_picker_sheet.dart';

/// A single tappable control that opens [VenuePickerSheet].
class VenueField extends StatelessWidget {
  const VenueField({
    super.key,
    required this.value,
    required this.onSuggestionSelected,
    this.countryCodes,
    this.errorText,
  });

  final PlaceSuggestion? value;
  final ValueChanged<PlaceSuggestion> onSuggestionSelected;
  final String? countryCodes;

  /// Inline validation message (red border + text).
  final String? errorText;

  static const _icon = Icons.place_outlined;

  @override
  Widget build(BuildContext context) {
    final picked = value;
    final hasVenue = picked != null;
    final hasAddress = hasVenue && picked.secondary.trim().isNotEmpty;

    final valueText = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          hasVenue ? picked.label : 'Pick a venue on the map',
          style: AppTypography.bodyMedium(context).copyWith(
            color: hasVenue
                ? context.colors.textPrimary
                : context.colors.textSecondary,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        if (hasAddress)
          Text(
            picked.secondary.trim(),
            style: AppTypography.bodySmall(context),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
      ],
    );

    return _VenueCard(
      icon: _icon,
      label: 'Location',
      value: valueText,
      errorText: errorText,
      onTap: () => _open(context),
    );
  }

  Future<void> _open(BuildContext context) async {
    final picked = await VenuePickerSheet.show(
      context,
      countryCodes: countryCodes,
    );
    if (picked != null) {
      onSuggestionSelected(picked);
    }
  }
}

/// Replica of the private `_SettingCard` in create_activity_screen.dart but exposed publicly so the venue picker can.
class _VenueCard extends StatelessWidget {
  const _VenueCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.onTap,
    this.errorText,
  });

  final IconData icon;
  final String label;
  final Widget value;
  final VoidCallback onTap;
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.x3),
      child: Material(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.card),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadius.card),
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.x4,
              vertical: AppSpacing.x3,
            ),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadius.card),
              border: Border.all(
                color: errorText != null
                    ? context.colors.errorText
                    : context.colors.border,
                width: errorText != null ? 1.5 : 1,
              ),
            ),
            child: Row(
              children: [
                _VenueIconBox(icon),
                const SizedBox(width: AppSpacing.x3),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label, style: AppTypography.metaSub(context)),
                      const SizedBox(height: 2),
                      value,
                      if (errorText != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          errorText!,
                          style: AppTypography.metaSub(context).copyWith(
                            color: context.colors.errorText,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                Icon(
                  Icons.chevron_right_rounded,
                  size: 18,
                  color: context.colors.textTertiary,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _VenueIconBox extends StatelessWidget {
  const _VenueIconBox(this.icon);
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: context.colors.primarySoft,
        borderRadius: BorderRadius.circular(AppRadius.input),
      ),
      alignment: Alignment.center,
      child: Icon(icon, size: 19, color: context.colors.primaryOnSurface),
    );
  }
}
