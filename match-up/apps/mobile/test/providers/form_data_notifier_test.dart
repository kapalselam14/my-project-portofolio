import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:matchup_mobile/features/activities/presentation/create/providers/form_data_provider.dart';

void main() {
  late ProviderContainer container;

  setUp(() => container = ProviderContainer());
  tearDown(() => container.dispose());

  // Convenience helpers — called as functions (not getters) inside tests
  ActivityFormData state() => container.read(formDataProvider);
  FormDataNotifier notifier() => container.read(formDataProvider.notifier);

  group('FormDataNotifier', () {
    test('should initialise with default values', () {
      expect(state().title, '');
      expect(state().location, '');
      expect(state().sportType, 'Basketball');
      expect(state().maxParticipants, 10);
      expect(state().feeType, 0);
      expect(state().skillLevel, 'Intermediate');
    });

    test('should update title via setTitle', () {
      notifier().setTitle('Evening Tennis');
      expect(state().title, 'Evening Tennis');
    });

    test('should update location via setLocation', () {
      notifier().setLocation('Central Park');
      expect(state().location, 'Central Park');
    });

    test('should update sportType via setSportType', () {
      notifier().setSportType('Tennis');
      expect(state().sportType, 'Tennis');
    });

    test('should update maxParticipants via setMaxParticipants', () {
      notifier().setMaxParticipants(20);
      expect(state().maxParticipants, 20);
    });

    test('should update skillLevel via setSkillLevel', () {
      notifier().setSkillLevel('Advanced');
      expect(state().skillLevel, 'Advanced');
    });

    test('should update feeType via setFeeType', () {
      notifier().setFeeType(1);
      expect(state().feeType, 1);
    });

    test('should update price via setPrice', () {
      notifier().setPrice('12.50');
      expect(state().price, '12.50');
    });

    test('should update selectedDate via setSelectedDate', () {
      final date = DateTime(2027, 3, 15, 14, 0);
      notifier().setSelectedDate(date);
      expect(state().selectedDate, date);
    });

    test('should update coverImage via setCoverImage', () {
      notifier().setCoverImage('/tmp/photo.jpg');
      expect(state().coverImagePath, '/tmp/photo.jpg');
    });

    test('should default durationMinutes to 120', () {
      expect(state().durationMinutes, 120);
    });

    test('should update durationMinutes via setDurationMinutes', () {
      notifier().setDurationMinutes(90);
      expect(state().durationMinutes, 90);
    });

    test('should reset all fields to defaults via reset', () {
      notifier().setTitle('Something');
      notifier().setLocation('Somewhere');
      notifier().reset();
      expect(state().title, '');
      expect(state().location, '');
    });

    test('should expose current state via getter without accessing .state', () {
      notifier().setTitle('My Activity');
      expect(notifier().current.title, 'My Activity');
    });

    test('should restore from JSON via loadFromJson', () {
      final json = {
        'title': 'Restored',
        'sportType': 'Soccer',
        'location': 'Test Loc',
        'description': '',
        'maxParticipants': 8,
        'skillLevel': 'Beginner',
        'feeType': 0,
      };
      notifier().loadFromJson(json);
      expect(state().title, 'Restored');
      expect(state().sportType, 'Soccer');
    });
  });

  group('formErrorsProvider', () {
    test(
      'should return title error when title is empty AND field is dirty',
      () {
        // Mark title as dirty first — errors only surface for touched fields
        container.read(formDirtyFieldsProvider.notifier).markDirty('title');
        final errors = container.read(formErrorsProvider);
        expect(errors, contains('title'));
      },
    );

    test(
      'should NOT return title error when title is empty but field is not dirty',
      () {
        // Default: no dirty fields — errors should not surface yet
        final errors = container.read(formErrorsProvider);
        expect(errors.containsKey('title'), isFalse);
      },
    );

    test('should clear title error once valid fields are set (dirty)', () {
      container.read(formDirtyFieldsProvider.notifier).markDirty('title');
      notifier().setTitle('Basketball Run');
      notifier().setLocation('Park');
      notifier().setSelectedDate(DateTime.now().add(const Duration(days: 1)));
      final errors = container.read(formErrorsProvider);
      expect(errors.containsKey('title'), isFalse);
    });
  });

  group('allFormErrorsProvider', () {
    test(
      'should return title error when title is empty regardless of dirty state',
      () {
        // allFormErrorsProvider is unfiltered — always reflects true validation state
        final errors = container.read(allFormErrorsProvider);
        expect(errors, contains('title'));
      },
    );
  });

  group('venue', () {
    test('setVenue stores label, address and coordinates', () {
      notifier().setVenue(
        label: 'Eden Park',
        address: 'Reimers Ave, Kingsland, Auckland',
        latitude: -36.875,
        longitude: 174.745,
      );
      final st = state();
      expect(st.location, 'Eden Park');
      expect(st.venueAddress, 'Reimers Ave, Kingsland, Auckland');
      expect(st.venueLatitude, -36.875);
      expect(st.venueLongitude, 174.745);
    });

    test('venue survives a toJson/fromJson round trip', () {
      notifier().setVenue(
        label: 'Eden Park',
        address: 'Reimers Ave, Kingsland, Auckland',
        latitude: -36.875,
        longitude: 174.745,
      );
      final restored = ActivityFormData.fromJson(state().toJson());
      expect(restored.location, 'Eden Park');
      expect(restored.venueAddress, 'Reimers Ave, Kingsland, Auckland');
      expect(restored.venueLatitude, -36.875);
      expect(restored.venueLongitude, 174.745);
    });

    test('old drafts without venue keys parse to empty venue', () {
      final restored = ActivityFormData.fromJson({'location': 'Park'});
      expect(restored.venueAddress, '');
      expect(restored.venueLatitude, isNull);
      expect(restored.venueLongitude, isNull);
    });
  });

  group('split-cost min players (regression: stepper stuck below max)', () {
    test('setMinPlayers(null) clears a previously set minimum', () {
      notifier().setMaxParticipants(10);
      notifier().setMinPlayers(9);
      expect(state().minPlayers, 9);
      // "+" at 9 of 10 writes null (full house) — must clear, not stick.
      notifier().setMinPlayers(null);
      expect(state().minPlayers, isNull);
    });

    test('copyWith without minPlayers keeps the current value', () {
      notifier().setMinPlayers(6);
      notifier().setPrice('100');
      expect(state().minPlayers, 6);
      expect(state().price, '100');
    });

    test('shrinking capacity below the minimum resets to full house', () {
      notifier().setMaxParticipants(10);
      notifier().setMinPlayers(9);
      notifier().setMaxParticipants(8);
      expect(state().maxParticipants, 8);
      expect(state().minPlayers, isNull);
    });

    test('min players survives a toJson/fromJson round trip', () {
      notifier().setMaxParticipants(10);
      notifier().setPriceMode(1);
      notifier().setMinPlayers(8);
      final restored = ActivityFormData.fromJson(state().toJson());
      expect(restored.priceMode, 1);
      expect(restored.minPlayers, 8);
    });
  });
}
