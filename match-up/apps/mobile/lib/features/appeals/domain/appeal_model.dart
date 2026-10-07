/// A moderation appeal filed by the account holder.
enum AppealStatus { pending, approved, rejected }

class AppealModel {
  const AppealModel({
    required this.id,
    required this.type,
    required this.statement,
    required this.status,
    this.adminNote,
    this.createdAt,
    this.decidedAt,
  });

  final String id;
  final String type;
  final String statement;
  final AppealStatus status;
  final String? adminNote;
  final DateTime? createdAt;
  final DateTime? decidedAt;

  static AppealStatus _statusOf(String? raw) => switch (raw) {
    'approved' => AppealStatus.approved,
    'rejected' => AppealStatus.rejected,
    _ => AppealStatus.pending,
  };

  static DateTime? _dateOf(Object? raw) {
    if (raw is String) return DateTime.tryParse(raw);
    return null;
  }

  factory AppealModel.fromJson(Map<String, dynamic> json) => AppealModel(
    id: json['id'] as String? ?? '',
    type: json['type'] as String? ?? 'suspension',
    statement: json['statement'] as String? ?? '',
    status: _statusOf(json['status'] as String?),
    adminNote: json['adminNote'] as String?,
    createdAt: _dateOf(json['createdAt']),
    decidedAt: _dateOf(json['decidedAt']),
  );
}
