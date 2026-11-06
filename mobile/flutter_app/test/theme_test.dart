import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:studypath_app/main.dart';
import 'package:studypath_app/screens/recommendations_screen.dart';
import 'package:studypath_app/services/api_client.dart';
import 'package:studypath_app/services/session_controller.dart';
import 'package:studypath_app/services/theme_controller.dart';
import 'package:studypath_app/widgets/theme_mode_button.dart';

import 'test_support.dart';

http.Response json(Object body) => http.Response(
  jsonEncode(body),
  200,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

const quizJson = {
  'id': 'quiz',
  'slug': 'demo',
  'title': 'Simulado de Matemática',
  'kind': 'standard',
  'questions': [
    {
      'id': 'q1',
      'topic': {'id': 't', 'name': 'Equações'},
      'statement': 'x + 2 = 5?',
      'options': [
        {'key': 'A', 'text': '2'},
        {'key': 'B', 'text': '3'},
      ],
      'difficulty': 'easy',
    },
  ],
};

ApiClient api() => ApiClient(
  baseUrl: 'http://api.test',
  studentId: 's',
  client: MockClient((req) async {
    if (req.url.path.endsWith('/recommendations')) {
      return json({
        'studentId': 's',
        'status': 'ON_TRACK',
        'evaluatedAttempts': 1,
        'topics': <Object>[],
        'progress': <Object>[],
      });
    }
    return json(quizJson);
  }),
);

Brightness brightnessOf(WidgetTester tester) =>
    Theme.of(tester.element(find.byType(Scaffold).first)).brightness;

void setSystem(WidgetTester tester, Brightness brightness) {
  tester.view.physicalSize = const Size(600, 1200);
  tester.view.devicePixelRatio = 1;
  tester.platformDispatcher.platformBrightnessTestValue = brightness;
  addTearDown(tester.view.reset);
  addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
}

/// One tap on the theme button.
Future<void> tapTheme(WidgetTester tester) async {
  await tester.tap(find.byKey(const Key('theme-button')));
  await tester.pumpAndSettle();
}

void main() {
  test('ThemeController toggles in one step and only knows light and dark', () {
    final controller = ThemeController(ThemeMode.light);
    var notified = 0;
    controller.addListener(() => notified++);
    expect(controller.isDark, isFalse);
    controller.toggle();
    expect(controller.mode, ThemeMode.dark);
    controller.toggle();
    expect(controller.mode, ThemeMode.light);
    expect(notified, 2);
    controller.select(ThemeMode.light); // same value: no notification
    expect(notified, 2);
    expect(() => controller.select(ThemeMode.system), throwsAssertionError);
    expect(() => ThemeController(ThemeMode.system), throwsAssertionError);
  });

  testWidgets('the button hides itself when there is no theme scope', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: Scaffold(body: ThemeModeButton())),
    );
    expect(find.byKey(const Key('theme-button')), findsNothing);
  });

  testWidgets(
    'light app: shows the moon, and one tap goes straight to dark (no menu)',
    (tester) async {
      setSystem(tester, Brightness.light);
      await tester.pumpWidget(loggedInApp(api()));
      await tester.pumpAndSettle();
      expect(brightnessOf(tester), Brightness.light);
      expect(find.byIcon(Icons.dark_mode), findsOneWidget);
      expect(find.byIcon(Icons.light_mode), findsNothing);
      expect(find.byTooltip('Mudar para o tema escuro'), findsOneWidget);

      await tapTheme(tester);
      expect(brightnessOf(tester), Brightness.dark);
      // No menu appeared: the tap itself changed the theme.
      expect(find.byType(PopupMenuButton<ThemeMode>), findsNothing);
      expect(find.byType(CheckedPopupMenuItem<ThemeMode>), findsNothing);
      expect(find.text('Claro'), findsNothing);
      expect(find.text('Escuro'), findsNothing);
    },
  );

  testWidgets(
    'dark app: shows the sun, and one tap goes straight back to light',
    (tester) async {
      setSystem(tester, Brightness.dark);
      await tester.pumpWidget(loggedInApp(api()));
      await tester.pumpAndSettle();
      expect(brightnessOf(tester), Brightness.dark);
      expect(find.byIcon(Icons.light_mode), findsOneWidget);
      expect(find.byIcon(Icons.dark_mode), findsNothing);
      expect(find.byTooltip('Mudar para o tema claro'), findsOneWidget);

      await tapTheme(tester);
      expect(brightnessOf(tester), Brightness.light);
      expect(
        find.byIcon(Icons.dark_mode),
        findsOneWidget,
      ); // the icon flipped too
      expect(find.byTooltip('Mudar para o tema escuro'), findsOneWidget);
    },
  );

  testWidgets('it keeps toggling back and forth', (tester) async {
    setSystem(tester, Brightness.light);
    await tester.pumpWidget(loggedInApp(api()));
    await tester.pumpAndSettle();
    final seen = <Brightness>[];
    for (var i = 0; i < 4; i++) {
      await tapTheme(tester);
      seen.add(brightnessOf(tester));
    }
    expect(seen, [
      Brightness.dark,
      Brightness.light,
      Brightness.dark,
      Brightness.light,
    ]);
  });

  testWidgets('the choice wins over later changes of the system theme', (
    tester,
  ) async {
    setSystem(tester, Brightness.light);
    await tester.pumpWidget(loggedInApp(api()));
    await tester.pumpAndSettle();
    await tapTheme(tester); // dark
    tester.platformDispatcher.platformBrightnessTestValue = Brightness.light;
    await tester.pumpAndSettle();
    expect(brightnessOf(tester), Brightness.dark);
  });

  testWidgets(
    'the button is on the login screen, so the choice can be made before signing in',
    (tester) async {
      setSystem(tester, Brightness.light);
      final a = api();
      await tester.pumpWidget(
        StudyPathApp(api: a, session: SessionController(a)),
      );
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('auth-submit')), findsOneWidget);
      expect(find.byKey(const Key('theme-button')), findsOneWidget);

      await tapTheme(tester);
      expect(
        Theme.of(tester.element(find.byKey(const Key('auth-submit'))))
            .brightness,
        Brightness.dark,
      );
    },
  );

  testWidgets(
    'the choice survives logging out and in again (same app session)',
    (tester) async {
      setSystem(tester, Brightness.light);
      final a = ApiClient(
        baseUrl: 'http://api.test',
        client: MockClient((req) async {
          if (req.url.path.endsWith('/login')) {
            return json({
              'token': 'x' * 43,
              'expiresAt': '2099-01-01T00:00:00.000Z',
              'student': {'id': 's', 'name': 'Maria', 'email': 'm@t.dev'},
            });
          }
          if (req.url.path.endsWith('/logout')) {
            return http.Response('', 204);
          }
          return json(quizJson);
        }),
      );
      final session = SessionController(a);
      await tester.pumpWidget(StudyPathApp(api: a, session: session));
      await tester.pumpAndSettle();

      await tapTheme(tester); // dark
      await tester.enterText(find.byKey(const Key('field-email')), 'm@t.dev');
      await tester.enterText(
        find.byKey(const Key('field-password')),
        'senha123',
      );
      await tester.tap(find.byKey(const Key('auth-submit')));
      await tester.pumpAndSettle();
      expect(
        brightnessOf(tester),
        Brightness.dark,
      ); // still dark inside the quiz

      await tester.tap(find.byKey(const Key('logout-button')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('auth-submit')), findsOneWidget);
      expect(
        Theme.of(tester.element(find.byKey(const Key('auth-submit'))))
            .brightness,
        Brightness.dark,
      );
    },
  );

  testWidgets('the recommendations screen has the same one-tap button', (
    tester,
  ) async {
    setSystem(tester, Brightness.light);
    final a = api();
    await tester.pumpWidget(
      StudyPathApp(
        api: a,
        session: SessionController(a, initial: fakeSession()),
      ),
    );
    await tester.pumpAndSettle();
    final navigator = tester.state<NavigatorState>(
      find.byType(Navigator).first,
    );
    navigator.push(
      MaterialPageRoute<void>(builder: (_) => RecommendationsScreen(api: a)),
    );
    await tester.pumpAndSettle();
    expect(find.text('Recomendação de estudo geral'), findsOneWidget);
    expect(find.byKey(const Key('theme-button')), findsOneWidget);
    await tapTheme(tester);
    expect(brightnessOf(tester), Brightness.dark);
  });
}
