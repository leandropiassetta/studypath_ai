import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:studypath_app/main.dart';
import 'package:studypath_app/screens/auth_screen.dart';
import 'package:studypath_app/services/api_client.dart';
import 'package:studypath_app/services/session_controller.dart';

import 'test_support.dart';

http.Response json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

Map<String, Object?> sessionBody({
  String id = 'stu-1',
  String name = 'Maria',
}) => {
  'token': 'x' * 43,
  'expiresAt': '2099-01-01T00:00:00.000Z',
  'student': {'id': id, 'name': name, 'email': 'maria@teste.dev'},
};

Map<String, Object?> error(String code, String message) => {
  'error': {'code': code, 'message': message, 'details': <Object>[]},
};

const quizJson = {
  'id': 'quiz',
  'slug': 'demo-matematica',
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

ApiClient clientFor(MockClient mock) =>
    ApiClient(baseUrl: 'http://api.test', client: mock);

void main() {
  group('validators', () {
    test('e-mail', () {
      expect(validateEmail('maria@teste.dev'), isNull);
      expect(validateEmail('  maria@teste.dev  '), isNull); // the app trims it
      expect(validateEmail(''), 'Informe seu e-mail');
      expect(validateEmail(null), 'Informe seu e-mail');
      for (final bad in [
        'maria',
        'maria@',
        '@teste.dev',
        'maria@teste',
        'a b@c.dev',
      ]) {
        expect(validateEmail(bad), contains('e-mail válido'), reason: bad);
      }
    });

    test('name', () {
      expect(validateName('Ana'), isNull);
      expect(validateName('   '), 'Informe seu nome');
      expect(validateName('n' * 81), contains('80'));
    });

    test('new password enforces the 10 character minimum', () {
      expect(validateNewPassword('dez-chars!'), isNull);
      expect(validateNewPassword('nove-char'), contains('pelo menos 10'));
      expect(validateNewPassword(''), 'Crie uma senha');
      expect(validateNewPassword('x' * 129), contains('128'));
    });

    test('an existing password only needs to be present (no policy hints on login)', () {
      expect(validateExistingPassword('qualquer'), isNull);
      expect(validateExistingPassword(''), 'Informe sua senha');
    });
  });

  group('ApiClient authentication', () {
    test(
      'login/register send credentials and never an Authorization header',
      () async {
        final seen = <http.Request>[];
        final api = clientFor(
          MockClient((req) async {
            seen.add(req);
            return json(
              sessionBody(),
              req.url.path.endsWith('register') ? 201 : 200,
            );
          }),
        );
        await api.login(email: 'maria@teste.dev', password: 'uma-senha-longa');
        await api.register(
          name: 'Maria',
          email: 'maria@teste.dev',
          password: 'uma-senha-longa',
        );

        expect(seen.map((r) => r.url.path), [
          '/api/v1/auth/login',
          '/api/v1/auth/register',
        ]);
        expect(jsonDecode(seen[0].body), {
          'email': 'maria@teste.dev',
          'password': 'uma-senha-longa',
        });
        expect(jsonDecode(seen[1].body)['name'], 'Maria');
        expect(
          seen.every((r) => !r.headers.containsKey('authorization')),
          isTrue,
        );
      },
    );

    test('after useSession every request carries the bearer token and the student id', () async {
      final seen = <http.Request>[];
      final api = clientFor(
        MockClient((req) async {
          seen.add(req);
          return json({'unexpected': true}); // content is irrelevant here
        }),
      );
      expect(api.hasSession, isFalse);
      api.useSession(fakeSession(id: 'stu-9'));
      expect(api.hasSession, isTrue);

      await expectLater(
        api.fetchRecommendations(),
        throwsA(isA<ApiException>()),
      );
      await expectLater(api.fetchQuiz('demo'), throwsA(isA<ApiException>()));
      expect(seen[0].url.path, '/api/v1/students/stu-9/recommendations');
      for (final r in seen) {
        expect(r.headers['authorization'], 'Bearer ${'t' * 43}');
      }
    });

    test(
      'a 401 on an authenticated call reports the expired session once',
      () async {
        var expired = 0;
        final api = clientFor(
          MockClient((_) async => json(error('UNAUTHENTICATED', 'x'), 401)),
        )..onUnauthorized = () => expired++;
        api.useSession(fakeSession());
        await expectLater(
          api.fetchQuiz('demo'),
          throwsA(
            isA<ApiException>().having(
              (e) => e.message,
              'message',
              'Sua sessão expirou. Entre de novo.',
            ),
          ),
        );
        expect(expired, 1);
      },
    );

    test(
      'a 401 on login is a wrong password, not an expired session',
      () async {
        var expired = 0;
        final api = clientFor(
          MockClient(
            (_) async => json(
              error('INVALID_CREDENTIALS', 'E-mail ou senha incorretos'),
              401,
            ),
          ),
        )..onUnauthorized = () => expired++;
        await expectLater(
          api.login(email: 'a@b.dev', password: 'errada-errada'),
          throwsA(
            isA<ApiException>().having(
              (e) => e.message,
              'message',
              'E-mail ou senha incorretos',
            ),
          ),
        );
        expect(expired, 0);
      },
    );

    test(
      'logout calls the server, handles the 204 and clears the session',
      () async {
        late http.Request seen;
        final api = clientFor(
          MockClient((req) async {
            seen = req;
            return http.Response('', 204);
          }),
        );
        api.useSession(fakeSession());
        await api.logout();
        expect(seen.url.path, '/api/v1/auth/logout');
        expect(seen.headers['authorization'], isNotNull);
        expect(api.hasSession, isFalse);
        expect(api.studentId, '');
      },
    );

    test(
      'logout clears the local session even when the server cannot be reached',
      () async {
        final api = clientFor(
          MockClient((_) async => throw http.ClientException('offline')),
        );
        api.useSession(fakeSession());
        await api.logout(); // must not throw
        expect(api.hasSession, isFalse);
      },
    );
  });

  group('SessionController', () {
    test(
      'login opens the session, logout closes it, listeners are told',
      () async {
        final api = clientFor(
          MockClient((_) async => json(sessionBody(name: 'Maria'))),
        );
        final controller = SessionController(api);
        var notified = 0;
        controller.addListener(() => notified++);
        expect(controller.isLoggedIn, isFalse);

        await controller.login(
          email: 'maria@teste.dev',
          password: 'uma-senha-longa',
        );
        expect(controller.isLoggedIn, isTrue);
        expect(controller.session!.student.name, 'Maria');
        expect(api.studentId, 'stu-1');

        await controller.logout();
        expect(controller.isLoggedIn, isFalse);
        expect(api.hasSession, isFalse);
        expect(notified, 2);
      },
    );

    test(
      'an expired session logs out with a notice that the next login clears',
      () async {
        var loginOk = false;
        final api = clientFor(
          MockClient((req) async {
            if (req.url.path.endsWith('/login')) {
              loginOk = true;
              return json(sessionBody());
            }
            return json(error('UNAUTHENTICATED', 'x'), 401);
          }),
        );
        final controller = SessionController(api, initial: fakeSession());
        expect(controller.isLoggedIn, isTrue);

        await expectLater(api.fetchQuiz('demo'), throwsA(isA<ApiException>()));
        expect(controller.isLoggedIn, isFalse);
        expect(controller.notice, 'Sua sessão expirou. Entre de novo.');

        await controller.login(
          email: 'maria@teste.dev',
          password: 'uma-senha-longa',
        );
        expect(loginOk, isTrue);
        expect(controller.notice, isNull);
      },
    );

    test(
      'nothing is persisted: a new controller always starts logged out',
      () async {
        final api = clientFor(MockClient((_) async => json(sessionBody())));
        await SessionController(api)
            .login(email: 'maria@teste.dev', password: 'uma-senha-longa');
        expect(
          SessionController(clientFor(MockClient((_) async => json({}))))
              .isLoggedIn,
          isFalse,
        );
      },
    );
  });

  group('AuthScreen', () {
    Future<(SessionController, List<http.Request>)> pumpAuth(
      WidgetTester tester, {
      FutureOr<http.Response> Function(http.Request)? handler,
    }) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final requests = <http.Request>[];
      final api = clientFor(
        MockClient((req) async {
          requests.add(req);
          return handler != null ? await handler(req) : json(sessionBody());
        }),
      );
      final controller = SessionController(api);
      await tester.pumpWidget(StudyPathApp(api: api, session: controller));
      return (controller, requests);
    }

    Future<void> fill(
      WidgetTester tester, {
      String? name,
      String email = 'maria@teste.dev',
      String password = 'uma-senha-longa',
    }) async {
      if (name != null) {
        await tester.enterText(find.byKey(const Key('field-name')), name);
      }
      await tester.enterText(find.byKey(const Key('field-email')), email);
      await tester.enterText(find.byKey(const Key('field-password')), password);
    }

    testWidgets('starts on the login form, with no name field', (tester) async {
      await pumpAuth(tester);
      expect(find.text('Entrar'), findsWidgets);
      expect(find.byKey(const Key('field-name')), findsNothing);
      expect(find.text('Mínimo de 10 caracteres'), findsNothing);
    });

    testWidgets(
      'shows clear validation messages and sends nothing when the form is invalid',
      (tester) async {
        final (_, requests) = await pumpAuth(tester);
        await tester.tap(find.byKey(const Key('auth-submit')));
        await tester.pump();
        expect(find.text('Informe seu e-mail'), findsOneWidget);
        expect(find.text('Informe sua senha'), findsOneWidget);

        await fill(tester, email: 'sem-arroba', password: 'x');
        await tester.tap(find.byKey(const Key('auth-submit')));
        await tester.pump();
        expect(find.textContaining('e-mail válido'), findsOneWidget);
        expect(requests, isEmpty);
      },
    );

    testWidgets(
      'register mode asks for the name and enforces the password length',
      (tester) async {
        final (_, requests) = await pumpAuth(tester);
        await tester.tap(find.text('Criar conta').first);
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('field-name')), findsOneWidget);
        expect(find.text('Mínimo de 10 caracteres'), findsOneWidget);

        await fill(tester, name: 'Maria', password: 'curta');
        await tester.tap(find.byKey(const Key('auth-submit')));
        await tester.pump();
        expect(find.textContaining('pelo menos 10'), findsOneWidget);
        expect(requests, isEmpty);
      },
    );

    testWidgets('the password can be shown and hidden', (tester) async {
      await pumpAuth(tester);
      bool obscured() => tester
          .widget<EditableText>(
            find.descendant(
              of: find.byKey(const Key('field-password')),
              matching: find.byType(EditableText),
            ),
          )
          .obscureText;
      expect(obscured(), isTrue);
      await tester.tap(find.byKey(const Key('toggle-password')));
      await tester.pump();
      expect(obscured(), isFalse);
      expect(find.byTooltip('Ocultar senha'), findsOneWidget);
    });

    testWidgets('a successful login trims the e-mail and opens the quiz', (
      tester,
    ) async {
      final (controller, requests) = await pumpAuth(
        tester,
        handler: (req) => req.url.path.endsWith('/login')
            ? json(sessionBody(name: 'Maria'))
            : json(quizJson),
      );
      await fill(tester, email: '  Maria@Teste.dev  ');
      await tester.tap(find.byKey(const Key('auth-submit')));
      await tester.pumpAndSettle();

      expect(
        jsonDecode(requests.first.body)['email'],
        'Maria@Teste.dev',
      ); // trimmed, server lowercases
      expect(controller.isLoggedIn, isTrue);
      expect(find.text('Simulado de Matemática'), findsOneWidget);
      expect(find.byKey(const Key('logout-button')), findsOneWidget);
    });

    testWidgets(
      'wrong credentials show the server message and allow another try',
      (tester) async {
        await pumpAuth(
          tester,
          handler: (_) => json(
            error('INVALID_CREDENTIALS', 'E-mail ou senha incorretos'),
            401,
          ),
        );
        await fill(tester);
        await tester.tap(find.byKey(const Key('auth-submit')));
        await tester.pumpAndSettle();
        expect(find.byKey(const Key('auth-error')), findsOneWidget);
        expect(find.text('E-mail ou senha incorretos'), findsOneWidget);
        expect(
          tester
              .widget<FilledButton>(find.byKey(const Key('auth-submit')))
              .onPressed,
          isNotNull,
        );
      },
    );

    testWidgets(
      'while the request is pending the form is locked and shows progress',
      (tester) async {
        final pending = Completer<http.Response>();
        final (_, requests) = await pumpAuth(
          tester,
          handler: (_) => pending.future,
        );
        await fill(tester);
        await tester.tap(find.byKey(const Key('auth-submit')));
        await tester.pump();

        expect(find.byType(CircularProgressIndicator), findsOneWidget);
        expect(
          tester
              .widget<FilledButton>(find.byKey(const Key('auth-submit')))
              .onPressed,
          isNull,
        );
        await tester.tap(
          find.byKey(const Key('auth-submit')),
          warnIfMissed: false,
        );
        await tester.pump();
        expect(requests, hasLength(1)); // no double submit
        pending.complete(
          json(error('INVALID_CREDENTIALS', 'E-mail ou senha incorretos'), 401),
        );
        await tester.pumpAndSettle();
      },
    );

    testWidgets('duplicate e-mail on sign-up shows the conflict message', (
      tester,
    ) async {
      await pumpAuth(
        tester,
        handler: (_) => json(
          error('EMAIL_TAKEN', 'Já existe uma conta com este e-mail'),
          409,
        ),
      );
      await tester.tap(find.text('Criar conta').first);
      await tester.pumpAndSettle();
      await fill(tester, name: 'Maria');
      await tester.tap(find.byKey(const Key('auth-submit')));
      await tester.pumpAndSettle();
      expect(find.text('Já existe uma conta com este e-mail'), findsOneWidget);
    });

    testWidgets(
      'an expired session sends the student back to the login with an explanation',
      (tester) async {
        var loggedIn = false;
        await pumpAuth(
          tester,
          handler: (req) {
            if (req.url.path.endsWith('/login')) {
              loggedIn = true;
              return json(sessionBody());
            }
            // Right after logging in, the server no longer accepts the session (e.g. revoked).
            return loggedIn
                ? json(error('UNAUTHENTICATED', 'x'), 401)
                : json(quizJson);
          },
        );
        await fill(tester);
        await tester.tap(find.byKey(const Key('auth-submit')));
        await tester.pumpAndSettle();

        expect(
          find.byKey(const Key('auth-submit')),
          findsOneWidget,
        ); // back on the login form
        expect(find.byKey(const Key('auth-notice')), findsOneWidget);
        expect(find.text('Sua sessão expirou. Entre de novo.'), findsOneWidget);
      },
    );
  });

  testWidgets(
    'logout returns to the login and the next student never sees the previous one',
    (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      var who = 'Maria';
      final api = clientFor(
        MockClient((req) async {
          if (req.url.path.endsWith('/login')) {
            return json(sessionBody(id: who, name: who));
          }
          if (req.url.path.endsWith('/logout')) {
            return http.Response('', 204);
          }
          return json(quizJson);
        }),
      );
      final controller = SessionController(api);
      await tester.pumpWidget(StudyPathApp(api: api, session: controller));

      Future<void> logIn() async {
        await tester.enterText(
          find.byKey(const Key('field-email')),
          '$who@teste.dev'.toLowerCase(),
        );
        await tester.enterText(
          find.byKey(const Key('field-password')),
          'uma-senha-longa',
        );
        await tester.tap(find.byKey(const Key('auth-submit')));
        await tester.pumpAndSettle();
      }

      await logIn();
      await tester.tap(find.byKey(const Key('option-q1-B')));
      await tester.pump();
      expect(find.text('Enviar respostas (1/1)'), findsOneWidget);

      await tester.tap(find.byKey(const Key('logout-button')));
      await tester.pumpAndSettle();
      // There were marked answers, so leaving asks first.
      expect(find.text('Sair do simulado?'), findsOneWidget);
      await tester.tap(find.byKey(const Key('leave-quiz')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('auth-submit')), findsOneWidget);
      expect(api.hasSession, isFalse);

      who = 'Joao';
      await logIn();
      // A brand-new quiz screen: the previous student's answer is gone.
      expect(find.text('Enviar respostas (0/1)'), findsOneWidget);
    },
  );
}
