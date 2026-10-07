import 'report_repository.dart';

/// Offline-only [ReportRepository]. The app **always** talks to the live backend for reports.
class LocalReportRepository implements ReportRepository {
  @override
  Future<void> submit({
    required String targetId,
    required ReportTargetType targetType,
    required String reason,
    String? details,
    List<String>? evidenceUrls,
  }) async {
    throw StateError(
      'ReportRepository.submit() requires a live backend — no offline '
      'fallback is provided.',
    );
  }
}
