part of '../venue_picker_sheet.dart';

/// Card shown after a tap-on-map pick.
class _PickedLocationCard extends StatefulWidget {
  const _PickedLocationCard({required this.latLng, required this.onConfirm});

  final LatLng latLng;
  final ValueChanged<String> onConfirm;

  @override
  State<_PickedLocationCard> createState() => _PickedLocationCardState();
}

class _PickedLocationCardState extends State<_PickedLocationCard> {
  // No reverse-geocode endpoint exists ([PlacesRepository] only exposes autocomplete).
  late final TextEditingController _nameCtrl = TextEditingController();

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  void _confirm() {
    HapticFeedback.lightImpact();
    widget.onConfirm(_nameCtrl.text);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: context.colors.surface,
      elevation: 6,
      shadowColor: Colors.black.withValues(alpha: 0.18),
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.x3),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primaryContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    Icons.place_rounded,
                    size: 20,
                    color: theme.colorScheme.onPrimaryContainer,
                  ),
                ),
                const SizedBox(width: AppSpacing.x3),
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Dropped pin',
                        style: theme.textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${widget.latLng.latitude.toStringAsFixed(5)}, '
                        '${widget.latLng.longitude.toStringAsFixed(5)}',
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.x2),
            TextField(
              controller: _nameCtrl,
              textInputAction: TextInputAction.done,
              textCapitalization: TextCapitalization.words,
              maxLength: 80,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurface,
              ),
              decoration: InputDecoration(
                hintText: 'Name this place',
                hintStyle: theme.textTheme.bodyMedium?.copyWith(
                  color: theme.colorScheme.onSurfaceVariant.withValues(
                    alpha: 0.7,
                  ),
                ),
                isDense: true,
                counterText: '',
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(
                    color: theme.colorScheme.outlineVariant,
                  ),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: theme.colorScheme.primary),
                ),
              ),
              onSubmitted: (_) => _confirm(),
            ),
            const SizedBox(height: AppSpacing.x2),
            FilledButton(onPressed: _confirm, child: const Text('Use')),
          ],
        ),
      ),
    );
  }
}
