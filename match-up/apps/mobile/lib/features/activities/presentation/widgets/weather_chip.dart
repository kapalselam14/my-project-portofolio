import 'package:flutter/material.dart';

import '../../../../core/services/weather_service.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/dark_colors.dart';

/// Weather forecast chip for the create-activity Setup step.
/// No venue (lat/lng null): "pick a venue first" hint.
class WeatherChip extends StatelessWidget {
  const WeatherChip({
    super.key,
    required this.latitude,
    required this.longitude,
    required this.dateTime,
  });

  final double? latitude;
  final double? longitude;
  final DateTime? dateTime;

  @override
  Widget build(BuildContext context) {
    final lat = latitude;
    final lng = longitude;
    final dt = dateTime;
    if (lat == null || lng == null) {
      return _shell(
        context,
        icon: Icons.cloud_outlined,
        text: 'Pick a venue to see the weather forecast',
        subtle: true,
      );
    }
    if (dt == null) {
      return _shell(
        context,
        icon: Icons.cloud_outlined,
        text: 'Pick a date to see the weather forecast',
        subtle: true,
      );
    }
    if (dt.difference(DateTime.now()).inDays > 16) {
      return _shell(
        context,
        icon: Icons.cloud_outlined,
        text: 'Forecast only available up to 16 days ahead',
        subtle: true,
      );
    }
    return FutureBuilder<WeatherInfo?>(
      future: WeatherService.instance.fetchForDateTime(lat, lng, dt),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return _shell(
            context,
            icon: Icons.cloud_outlined,
            text: 'Loading forecast…',
            subtle: true,
            loading: true,
          );
        }
        final w = snap.data;
        if (w == null) {
          return _shell(
            context,
            icon: Icons.cloud_outlined,
            text: 'Weather unavailable — try again later',
            subtle: true,
          );
        }
        final temp = w.temperatureC.isNaN ? '—' : '${w.temperatureC.round()}°C';
        final rain = w.precipitationProbability;
        final warn = rain >= 60;
        return Container(
          margin: const EdgeInsets.only(bottom: AppSpacing.x3),
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.x4,
            vertical: AppSpacing.x3,
          ),
          decoration: BoxDecoration(
            color: warn ? context.colors.warningBg : context.colors.primarySoft,
            borderRadius: BorderRadius.circular(AppRadius.card),
            border: Border.all(color: context.colors.border),
          ),
          child: Row(
            children: [
              Icon(w.icon, size: 22, color: context.colors.primaryOnSurface),
              const SizedBox(width: AppSpacing.x3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$temp · ${w.description}',
                      style: AppTypography.bodyMedium(
                        context,
                      ).copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 1),
                    Text(
                      rain > 0
                          ? 'Rain chance $rain%${warn ? ' — consider indoor' : ''}'
                          : 'Low rain chance — good for outdoors',
                      style: AppTypography.metaSub(context),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.wb_cloudy_outlined,
                size: 16,
                color: context.colors.textTertiary,
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _shell(
    BuildContext context, {
    required IconData icon,
    required String text,
    bool subtle = false,
    bool loading = false,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.x3),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.x4,
        vertical: AppSpacing.x3,
      ),
      decoration: BoxDecoration(
        color: context.colors.surfaceSubtle,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: context.colors.border),
      ),
      child: Row(
        children: [
          if (loading)
            const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          else
            Icon(icon, size: 18, color: context.colors.textTertiary),
          const SizedBox(width: AppSpacing.x2),
          Expanded(child: Text(text, style: AppTypography.metaSub(context))),
        ],
      ),
    );
  }
}
