part of '../create_activity_screen.dart';

class _PriceCard extends StatefulWidget {
  const _PriceCard({
    required this.priceController,
    required this.onPriceChanged,
    required this.isSplit,
    required this.min,
    required this.max,
    required this.onMinChanged,
    required this.total,
  });

  final TextEditingController priceController;
  final ValueChanged<String> onPriceChanged;
  final bool isSplit;
  final int min;
  final int max;
  final ValueChanged<int> onMinChanged;
  final double? total;

  @override
  State<_PriceCard> createState() => _PriceCardState();
}

class _PriceCardState extends State<_PriceCard> {
  final _focus = FocusNode();
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    _focus.addListener(() {
      if (mounted) setState(() => _focused = _focus.hasFocus);
    });
  }

  @override
  void dispose() {
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    final amountStyle = AppTypography.headlineLarge(context);
    return Container(
      decoration: BoxDecoration(
        color: c.surface,
        borderRadius: BorderRadius.circular(AppRadius.input),
        border: Border.all(
          color: _focused ? AppColors.primary : c.border,
          width: _focused ? 1.5 : 1,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Amount row.
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.x4,
              AppSpacing.x4,
              AppSpacing.x4,
              AppSpacing.x4,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Text(
                  '\$',
                  style: amountStyle.copyWith(color: c.primaryOnSurface),
                ),
                const SizedBox(width: AppSpacing.x1),
                Expanded(
                  child: TextField(
                    controller: widget.priceController,
                    focusNode: _focus,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    textInputAction: TextInputAction.done,
                    cursorColor: AppColors.primary,
                    style: amountStyle,
                    decoration: InputDecoration(
                      hintText: '0.00',
                      hintStyle: amountStyle.copyWith(color: c.textTertiary),
                      filled: false,
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                    onChanged: widget.onPriceChanged,
                  ),
                ),
                const SizedBox(width: AppSpacing.x2),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: c.primarySoft,
                    borderRadius: AppRadius.pillR,
                  ),
                  child: AnimatedSwitcher(
                    duration: AppDurations.fast,
                    child: Text(
                      widget.isSplit ? 'TOTAL' : 'PER PERSON',
                      // Keyed so mode switches cross-fade the pill text instead of swapping it in one frame.
                      key: ValueKey(widget.isSplit),
                      style: AppTypography.badgeSport(context).copyWith(
                        color: c.primaryOnSurface,
                        fontSize: 10,
                        letterSpacing: 0.8,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (widget.isSplit) ...[
            Divider(height: 1, color: c.border),
            // Min stepper row — value inline between the buttons.
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.x4,
                vertical: AppSpacing.x3,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Minimum to run',
                          style: _inputStyle(context).copyWith(fontSize: 14),
                        ),
                        Text(
                          widget.min >= widget.max
                              ? 'Full house · ${widget.max} players'
                              : '${widget.min} of ${widget.max} players',
                          style: AppTypography.metaSub(context),
                        ),
                      ],
                    ),
                  ),
                  _CounterBtn(
                    icon: Icons.remove_rounded,
                    enabled: widget.min > 2,
                    emphasised: false,
                    semanticLabel: 'Decrease minimum players',
                    onTap: () => widget.onMinChanged(widget.min - 1),
                  ),
                  SizedBox(
                    width: 36,
                    child: Text(
                      '${widget.min}',
                      textAlign: TextAlign.center,
                      style: _inputStyle(
                        context,
                      ).copyWith(fontWeight: FontWeight.w700),
                    ),
                  ),
                  _CounterBtn(
                    icon: Icons.add_rounded,
                    enabled: widget.min < widget.max,
                    emphasised: true,
                    semanticLabel: 'Increase minimum players',
                    onTap: () => widget.onMinChanged(widget.min + 1),
                  ),
                ],
              ),
            ),
            // Live worst-case estimate footer.
            _SplitEstimateFooter(
              total: widget.total,
              min: widget.min,
              capacity: widget.max,
            ),
          ],
        ],
      ),
    );
  }
}

/// Tinted live-estimate footer inside [_PriceCard]: total ÷ min. Division is guarded.

class _SplitEstimateFooter extends StatelessWidget {
  const _SplitEstimateFooter({
    required this.total,
    required this.min,
    required this.capacity,
  });

  final double? total;
  final int min;
  final int capacity;

  @override
  Widget build(BuildContext context) {
    final c = context.colors;
    if (total == null || total! <= 0 || min < 1 || capacity < 1) {
      return const SizedBox.shrink();
    }
    final worst = total! / min;
    final full = total! / capacity;
    // Full house splits exact — no "≈".
    final text = min >= capacity
        ? '\$${full.toStringAsFixed(2)} each — split evenly'
        : '≈\$${worst.toStringAsFixed(2)} each worst case · \$${full.toStringAsFixed(2)} when full';
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.x4,
        vertical: AppSpacing.x2 + 2,
      ),
      decoration: BoxDecoration(
        color: c.statusSuccessBg,
        // Inset bottom radius: the footer sits flush against the card's bottom edge.
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(AppRadius.input - 1),
          bottomRight: Radius.circular(AppRadius.input - 1),
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.check_circle_outline_rounded,
            size: 14,
            color: c.successText,
          ),
          const SizedBox(width: AppSpacing.x2),
          Expanded(
            child: Text(
              text,
              style: AppTypography.metaSub(
                context,
              ).copyWith(color: c.successText, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }
}

/// Selectable choice card — icon + title + subtitle, with a highlighted selected state.
