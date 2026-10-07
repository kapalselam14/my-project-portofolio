import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/features/activities/presentation/create/providers/form_data_provider.dart';
import 'package:matchup_mobile/features/activities/presentation/create/services/form_validator.dart';

/// Helper — builds a fully valid ActivityFormData.
ActivityFormData _valid({
  String title = 'Weekend Basketball',
  String location = 'Central Park',
  DateTime? selectedDate,
  int maxParticipants = 10,
  int feeType = 0,
  String? price,
}) => ActivityFormData(
  title: title,
  location: location,
  selectedDate: selectedDate ?? DateTime.now().add(const Duration(days: 1)),
  maxParticipants: maxParticipants,
  feeType: feeType,
  price: price,
);

void main() {
  group('formValidator', () {
    test('should return empty map for a fully valid form', () {
      final errors = formValidator(_valid());
      expect(errors, isEmpty);
    });

    test('should report error when title is blank', () {
      final errors = formValidator(_valid(title: '   '));
      expect(errors, contains('title'));
    });

    test('should report error when location is blank', () {
      final errors = formValidator(_valid(location: ''));
      expect(errors, contains('location'));
    });

    test('should report error when date is in the past', () {
      final errors = formValidator(
        _valid(selectedDate: DateTime.now().subtract(const Duration(hours: 1))),
      );
      expect(errors, contains('selectedDate'));
    });

    test('should not report date error when selectedDate is null', () {
      // null means "not set yet" — validator ignores it
      final errors = formValidator(
        ActivityFormData(title: 'Title', location: 'Loc', selectedDate: null),
      );
      expect(errors.containsKey('selectedDate'), isFalse);
    });

    test('should report error when maxParticipants is below 2', () {
      final errors = formValidator(_valid(maxParticipants: 1));
      expect(errors, contains('maxParticipants'));
    });

    test('should report error when maxParticipants exceeds 50', () {
      final errors = formValidator(_valid(maxParticipants: 51));
      expect(errors, contains('maxParticipants'));
    });

    test('should report error when feeType is Paid but price is empty', () {
      final errors = formValidator(_valid(feeType: 1, price: null));
      expect(errors, contains('price'));
    });

    test('should not report price error when feeType is Free', () {
      final errors = formValidator(_valid(feeType: 0, price: null));
      expect(errors.containsKey('price'), isFalse);
    });

    test(
      'should not report price error when feeType is Paid and price is set',
      () {
        final errors = formValidator(_valid(feeType: 1, price: '5.00'));
        expect(errors.containsKey('price'), isFalse);
      },
    );
  });

  group('validateStep', () {
    test('should only include step-1 fields on step 1', () {
      // Invalid step-1 form (no title) + invalid step-2 (no location)
      final data = ActivityFormData(title: '', location: '');
      final errors = validateStep(1, data);
      expect(errors, contains('title'));
      expect(errors.containsKey('location'), isFalse);
    });

    test('should only include step-2 fields on step 2', () {
      final data = ActivityFormData(title: '', location: '');
      final errors = validateStep(2, data);
      expect(errors, contains('location'));
      expect(errors.containsKey('title'), isFalse);
    });
  });
}
