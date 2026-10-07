import 'package:flutter/material.dart';

import '../../../../core/services/weather_service.dart';
import '../../../../core/theme/app_spacing.dart';
import '../../../../core/theme/app_typography.dart';
import '../../../../core/theme/dark_colors.dart';
import '../../domain/activity_model.dart';

/// Weather section for activity detail screens.
/// Prefers the snapshot saved at creation ([ActivityModel.hasWeatherSnapshot]).
class ActivityWeatherSection extends StatelessWidget {
  const ActivityWeatherSection({super.key, required this.activity});

  final ActivityModel activity;

  @override
  Widget build(BuildContext context) {
    if (activity.hasWeatherSnapshot) {
      final temp = activity.weatherTemp;
      final code = activity.weatherCode ?? 2;
      final desc = activity.weatherDesc?.trim().isNotEmpty == true
          ? activity.weatherDesc!.trim()
          : weatherDescriptionFor(code);
      final rain = activity.weatherRain;
      return _card(
        context,
        icon: weatherIconFor(code),
        title: temp == null || temp.isNaN ? desc : '${temp.round()}°C · $desc',
        sub: rain == null
            ? 'Forecast at creation'
            : rain > 0
            ? 'Rain $rain% · forecast at creation'
            : 'Low rain · forecast at creation',
      );
    }
    final lat = activity.latitude;
    final lng = activity.longitude;
    if (lat == null || lng == null) return const SizedBox.shrink();
    if (activity.dateTime.difference(DateTime.now()).inDays > 16) {
      return const SizedBox.shrink();
    }
    return FutureBuilder<WeatherInfo?>(
      future: WeatherService.instance.fetchForDateTime(
        lat,
        lng,
        activity.dateTime,
      ),
      builder: (context, snap) {
        final w = snap.data;
        if (w == null) return const SizedBox.shrink();
        final temp = w.temperatureC.isNaN ? '—' : '${w.temperatureC.round()}°C';
        return _card(
          context,
          icon: w.icon,
          title: '$temp · ${w.description}',
          sub: w.precipitationProbability > 0
              ? 'Rain ${w.precipitationProbability}%'
              : 'Low rain',
        );
      },
    );
  }

  Widget _card(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String sub,
  }) {
    return Container(
      margin: const EdgeInsets.only(top: AppSpacing.x3),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.x4,
        vertical: AppSpacing.x3,
      ),
      decoration: BoxDecoration(
        color: context.colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.card),
        border: Border.all(color: context.colors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: context.colors.primarySoft,
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Icon(icon, size: 19, color: context.colors.primaryOnSurface),
          ),
          const SizedBox(width: AppSpacing.x3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Weather', style: AppTypography.metaSub(context)),
                const SizedBox(height: 2),
                Text(
                  title,
                  style: AppTypography.bodyMedium(
                    context,
                  ).copyWith(fontWeight: FontWeight.w700),
                ),
                if (sub.isNotEmpty)
                  Text(sub, style: AppTypography.metaSub(context)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
