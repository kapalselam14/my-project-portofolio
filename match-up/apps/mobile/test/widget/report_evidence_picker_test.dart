import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image/image.dart' as img;

import 'package:matchup_mobile/core/services/storage_service.dart';
import 'package:matchup_mobile/features/report/presentation/report_evidence_picker.dart';

/// Permission denial and upload-error coverage for [ReportEvidencePicker].
///
/// The widget reads the reporter's uid from `authStateProvider` (in-memory
/// Riverpod state, not a platform channel), so a bare [ProviderScope] with
/// no overrides is enough to pump it — `userId` is simply null, which the
/// picker treats the same as any other upload failure. Firebase is never
/// initialised in the test environment either, so
/// `StorageService.uploadReportEvidence` deterministically returns `null`
/// (its own `_isFirebaseReady()` guard catches the missing plugin) — the
/// same reason the cover-upload flow's failure path needs no mocking
/// elsewhere in this suite. That makes the upload-failure/retry path free
/// to test here, but the upload-success path isn't reachable without a
/// dependency-injection seam this codebase doesn't have (see
/// `image_upload_size_test.dart` for the same constraint on the
/// size-check contract this widget reuses).
void main() {
  const pickerChannel = MethodChannel('plugins.flutter.io/image_picker');
  late Directory dir;

  setUp(() async {
    dir = await Directory.systemTemp.createTemp('evidence_picker_');
  });

  tearDown(() async {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(pickerChannel, null);
    try {
      await dir.delete(recursive: true);
    } catch (_) {}
  });

  /// A genuine, tiny decodable JPEG — `Image.file` in the evidence tile
  /// actually decodes the picked file, so garbage bytes would surface as
  /// a real decode error rather than exercising the upload path under
  /// test. Written via [WidgetTester.runAsync]: `testWidgets` runs the
  /// test body in a fake-async zone that never resolves real `dart:io`
  /// futures on its own — real file I/O has to escape that zone.
  Future<String> validJpegFile(WidgetTester tester) async {
    return (await tester.runAsync(() async {
      final bytes = img.encodeJpg(img.Image(width: 4, height: 4), quality: 40);
      final file = File(
        '${dir.path}/evidence_${DateTime.now().microsecondsSinceEpoch}.jpg',
      );
      await file.writeAsBytes(bytes, flush: true);
      return file.path;
    }))!;
  }

  /// Same valid JPEG, padded with trailing zero bytes past the encoder's
  /// EOI marker so `File.length()` exceeds [minBytes] — decoders stop at
  /// EOI and ignore the padding, so the file still renders, while the
  /// size gate still sees it as oversized.
  Future<String> oversizedJpegFile(WidgetTester tester, int minBytes) async {
    return (await tester.runAsync(() async {
      final jpg = img.encodeJpg(img.Image(width: 4, height: 4), quality: 40);
      final padded = Uint8List(minBytes + 1)..setRange(0, jpg.length, jpg);
      final file = File('${dir.path}/evidence_oversized.jpg');
      await file.writeAsBytes(padded, flush: true);
      return file.path;
    }))!;
  }

  void mockPickerReturns(String? path) {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(pickerChannel, (call) async => path);
  }

  void mockPickerThrows(String code) {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(pickerChannel, (call) async {
          throw PlatformException(code: code);
        });
  }

  Future<void> pumpPicker(
    WidgetTester tester, {
    required ValueChanged<List<String>> onChanged,
    required ValueChanged<bool> onBusyChanged,
  }) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: ReportEvidencePicker(
              onChanged: onChanged,
              onBusyChanged: onBusyChanged,
            ),
          ),
        ),
      ),
    );
  }

  /// Wrapped in [WidgetTester.runAsync] because picking "succeeds" leads
  /// into the widget's own real `dart:io`/`StorageService` calls
  /// (`checkImageSize`'s `File.length()`, the JPEG decode for the
  /// thumbnail, the upload attempt) — none of which resolve inside
  /// `testWidgets`' fake-async zone on their own. The picker tap uses
  /// bounded manual pumps rather than [WidgetTester.pumpAndSettle]: while
  /// the item sits in its brief "uploading" state, its tile shows an
  /// indeterminate [CircularProgressIndicator], whose repeating animation
  /// never lets `pumpAndSettle` observe "no more scheduled frames" even
  /// after the real upload work has actually finished — a well-known
  /// interaction between indeterminate progress indicators and
  /// `pumpAndSettle`. A handful of short real pumps is enough since the
  /// underlying work here (a local temp-file check, no live Firebase) is
  /// already fast.
  Future<void> tapAdd(WidgetTester tester, String source) async {
    await tester.runAsync(() async {
      await tester.tap(find.byIcon(Icons.add_photo_alternate_outlined));
      await tester.pumpAndSettle();
      await tester.tap(find.text(source));
      // Real (not fake-clock) waits between pumps: still inside
      // runAsync's real zone, so this actually gives the OS-level I/O
      // behind checkImageSize/uploadReportEvidence time to complete
      // before the next pump reflects it into the widget tree.
      for (var i = 0; i < 20; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 20));
        await tester.pump();
      }
    });
  }

  testWidgets('renders the add-evidence tile with no attachments', (
    tester,
  ) async {
    await pumpPicker(tester, onChanged: (_) {}, onBusyChanged: (_) {});

    expect(find.byIcon(Icons.add_photo_alternate_outlined), findsOneWidget);
  });

  testWidgets(
    'camera permission denial shows a specific error and adds nothing',
    (tester) async {
      mockPickerThrows('camera_access_denied');
      final changed = <List<String>>[];
      await pumpPicker(tester, onChanged: changed.add, onBusyChanged: (_) {});

      await tapAdd(tester, 'Camera');

      expect(
        find.text(
          'Could not access the camera. Check camera permissions and try again.',
        ),
        findsOneWidget,
      );
      expect(changed, isEmpty);
    },
  );

  testWidgets('gallery permission denial shows a specific error', (
    tester,
  ) async {
    mockPickerThrows('photo_access_denied');
    await pumpPicker(tester, onChanged: (_) {}, onBusyChanged: (_) {});

    await tapAdd(tester, 'Gallery');

    expect(
      find.text(
        'Could not access your photos. Check photo permissions and try again.',
      ),
      findsOneWidget,
    );
  });

  testWidgets(
    'an oversized pick fails validation before upload and shows the size error',
    (tester) async {
      final path = await oversizedJpegFile(tester, kMaxEvidenceBytes);
      mockPickerReturns(path);
      await pumpPicker(tester, onChanged: (_) {}, onBusyChanged: (_) {});

      await tapAdd(tester, 'Gallery');

      expect(find.textContaining('Maximum is'), findsOneWidget);
      // Too-large is rejected before ever reaching the upload step, so no
      // retry affordance is offered — remove and pick a smaller file instead.
      expect(find.text('Retry'), findsNothing);
    },
  );

  testWidgets('upload failure shows Retry and reports busy while uploading', (
    tester,
  ) async {
    final path = await validJpegFile(tester);
    mockPickerReturns(path);
    final busyStates = <bool>[];
    await pumpPicker(tester, onChanged: (_) {}, onBusyChanged: busyStates.add);

    await tapAdd(tester, 'Gallery');

    expect(find.text('Retry'), findsOneWidget);
    expect(busyStates, contains(true));
    expect(busyStates.last, isFalse);
  });

  testWidgets('tapping Retry re-attempts the upload for the same file', (
    tester,
  ) async {
    final path = await validJpegFile(tester);
    mockPickerReturns(path);
    await pumpPicker(tester, onChanged: (_) {}, onBusyChanged: (_) {});
    await tapAdd(tester, 'Gallery');
    expect(find.text('Retry'), findsOneWidget);

    await tester.runAsync(() async {
      await tester.tap(find.text('Retry'));
      for (var i = 0; i < 20; i++) {
        await Future<void>.delayed(const Duration(milliseconds: 20));
        await tester.pump();
      }
    });

    // Still exactly one tile, and it settled back into a failed/retryable
    // state — no crash, no duplicate tile from the retry.
    expect(find.text('Retry'), findsOneWidget);
  });

  testWidgets('removing an attachment clears its tile', (tester) async {
    final path = await validJpegFile(tester);
    mockPickerReturns(path);
    await pumpPicker(tester, onChanged: (_) {}, onBusyChanged: (_) {});
    await tapAdd(tester, 'Gallery');
    expect(find.text('Retry'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.close_rounded));
    await tester.pumpAndSettle();

    expect(find.text('Retry'), findsNothing);
  });

  testWidgets('caps at 3 attachments — the add tile disappears', (
    tester,
  ) async {
    final path = await validJpegFile(tester);
    mockPickerReturns(path);
    await pumpPicker(tester, onChanged: (_) {}, onBusyChanged: (_) {});

    for (var i = 0; i < 3; i++) {
      await tapAdd(tester, 'Gallery');
    }

    expect(find.byIcon(Icons.add_photo_alternate_outlined), findsNothing);
  });
}
