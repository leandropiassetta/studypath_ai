import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:studypath_app/main.dart';
import 'package:studypath_app/services/api_client.dart';
import 'package:studypath_app/services/session_controller.dart';

http.Response json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

Future<List<Uri>> openApp(
  WidgetTester tester,
  Future<http.Response> Function(http.Request) handler, {
  bool wakeServer = true,
}) async {
  tester.view.physicalSize = const Size(800, 2000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final urls = <Uri>[];
  final api = ApiClient(
    baseUrl: 'http://api.test/',
    client: MockClient((req) {
      urls.add(req.url);
      return handler(req);
    }),
  );
  await tester.pumpWidget(
    StudyPathApp(
      api: api,
      session: SessionController(api),
      wakeServer: wakeServer,
    ),
  );
  return urls;
}

FilledButton submit(WidgetTester tester) =>
    tester.widget<FilledButton>(find.byKey(const Key('auth-submit')));

void main() {
  test('wakeUp is true for any answer (even an error page) and false when nothing answers', () async {
    final awake = ApiClient(
      baseUrl: 'http://api.test',
      client: MockClient((_) async => http.Response('boom', 503)),
    );
    expect(await awake.wakeUp(), isTrue);

    final down = ApiClient(
      baseUrl: 'http://api.test',
      client: MockClient((_) async => throw http.ClientException('refused')),
    );
    expect(await down.wakeUp(), isFalse);

    final never = ApiClient(
      baseUrl: 'http://api.test',
      client: MockClient((_) => Completer<http.Response>().future),
    );
    expect(
      await never.wakeUp(timeout: const Duration(milliseconds: 50)),
      isFalse,
    );
  });

  testWidgets(
    'by default the app does not touch the server before the user acts',
    (tester) async {
      final urls = await openApp(
        tester,
        (_) async => json({}),
        wakeServer: false,
      );
      await tester.pumpAndSettle();
      expect(urls, isEmpty);
      expect(submit(tester).onPressed, isNotNull);
    },
  );

  testWidgets(
    'a healthy server answers at once: no banner, the button is usable',
    (tester) async {
      final urls = await openApp(tester, (_) async => json({'status': 'ok'}));
      await tester.pumpAndSettle();
      expect(
        urls.single.toString(),
        'http://api.test/health',
      ); // trailing slash tolerated
      expect(find.byKey(const Key('server-waking')), findsNothing);
      expect(find.byKey(const Key('server-unreachable')), findsNothing);
      expect(submit(tester).onPressed, isNotNull);
    },
  );

  testWidgets(
    'a sleeping server: the user is told, the button waits, then it is released',
    (tester) async {
      final answer = Completer<http.Response>();
      await openApp(tester, (_) => answer.future);
      await tester.pump(const Duration(milliseconds: 300));
      expect(
        find.byKey(const Key('server-waking')),
        findsNothing,
      ); // not yet: it may answer quickly
      expect(
        submit(tester).onPressed,
        isNull,
      ); // but nobody can submit into a sleeping server

      await tester.pump(const Duration(seconds: 2)); // past the delay
      expect(find.byKey(const Key('server-waking')), findsOneWidget);
      expect(find.textContaining('Acordando o servidor'), findsOneWidget);
      // The form is already usable for typing.
      await tester.enterText(
        find.byKey(const Key('field-email')),
        'maria@teste.dev',
      );

      answer.complete(json({'status': 'ok'}));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('server-waking')), findsNothing);
      expect(submit(tester).onPressed, isNotNull);
      expect(
        find.text('maria@teste.dev'),
        findsOneWidget,
      ); // what was typed is kept
    },
  );

  testWidgets('a server that never answers: an error with a retry that works', (
    tester,
  ) async {
    var calls = 0;
    await openApp(tester, (_) async {
      calls++;
      if (calls == 1) throw http.ClientException('refused');
      return json({'status': 'ok'});
    });
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('server-unreachable')), findsOneWidget);
    expect(find.text('Tentar de novo'), findsOneWidget);
    expect(submit(tester).onPressed, isNotNull); // the user is never locked out

    await tester.tap(find.text('Tentar de novo'));
    await tester.pumpAndSettle();
    expect(calls, 2);
    expect(find.byKey(const Key('server-unreachable')), findsNothing);
  });
}
