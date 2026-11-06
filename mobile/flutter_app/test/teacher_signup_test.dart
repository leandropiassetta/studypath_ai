import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:studypath_app/main.dart';
import 'package:studypath_app/screens/auth_screen.dart';
import 'package:studypath_app/services/api_client.dart';
import 'package:studypath_app/services/session_controller.dart';

http.Response json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

Map<String, Object?> session(String role, String name) => {
  'token': 't' * 43,
  'expiresAt': '2099-01-01T00:00:00.000Z',
  'student': {'id': 'u1', 'name': name, 'email': 'x@teste.dev', 'role': role},
};

Map<String, Object?> error(String code, String message) => {
  'error': {'code': code, 'message': message, 'details': <Object>[]},
};

/// Opens the app on the sign-up form and records every request.
Future<List<http.Request>> openSignUp(
  WidgetTester tester, {
  required http.Response Function(http.Request) onRegister,
}) async {
  tester.view.physicalSize = const Size(800, 2000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final requests = <http.Request>[];
  final api = ApiClient(
    baseUrl: 'http://api.test',
    client: MockClient((req) async {
      requests.add(req);
      if (req.url.path.endsWith('/auth/register')) return onRegister(req);
      if (req.url.path.endsWith('/teacher/doubts')) return json(<Object>[]);
      if (req.url.path.endsWith('/quizzes')) return json(<Object>[]);
      return json(error('NOT_FOUND', 'x'), 404);
    }),
  );
  await tester.pumpWidget(
    StudyPathApp(api: api, session: SessionController(api)),
  );
  await tester.tap(find.text('Criar conta').first);
  await tester.pumpAndSettle();
  return requests;
}

Future<void> fillBasics(WidgetTester tester) async {
  await tester.enterText(find.byKey(const Key('field-name')), 'Helena Prado');
  await tester.enterText(
    find.byKey(const Key('field-email')),
    'helena@escola.dev',
  );
  await tester.enterText(
    find.byKey(const Key('field-password')),
    'uma-senha-longa',
  );
}

Future<void> chooseTeacher(WidgetTester tester) async {
  await tester.tap(find.text('Sou professor'));
  await tester.pumpAndSettle();
}

Map<String, dynamic> registerBody(List<http.Request> requests) => jsonDecode(
  requests.firstWhere((r) => r.url.path.endsWith('/register')).body,
) as Map<String, dynamic>;

void main() {
  test('validateInviteCode', () {
    expect(validateInviteCode(null), 'Informe o código de convite');
    expect(validateInviteCode('   '), 'Informe o código de convite');
    expect(validateInviteCode('x' * 129), 'Código muito longo');
    expect(validateInviteCode('um-codigo'), isNull);
  });

  testWidgets(
    'the account type only exists when creating an account, and defaults to student',
    (tester) async {
      await openSignUp(
        tester,
        onRegister: (_) => json(session('student', 'A')),
      );
      expect(find.byKey(const Key('account-type')), findsOneWidget);
      expect(find.text('Sou aluno'), findsOneWidget);
      expect(find.text('Sou professor'), findsOneWidget);
      expect(find.byKey(const Key('field-invite')), findsNothing);

      await tester.tap(find.text('Entrar').first); // back to the login form
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('account-type')), findsNothing);
    },
  );

  testWidgets('a student sends no role and no code', (tester) async {
    final requests = await openSignUp(
      tester,
      onRegister: (_) => json(session('student', 'Helena Prado')),
    );
    await fillBasics(tester);
    await tester.tap(find.byKey(const Key('auth-submit')));
    await tester.pumpAndSettle();
    final body = registerBody(requests);
    expect(body.containsKey('role'), isFalse);
    expect(body.containsKey('inviteCode'), isFalse);
    expect(
      find.text('Escolha um assunto'),
      findsOneWidget,
    ); // students land on the picker
  });

  testWidgets('choosing teacher asks for the code, and the button says so', (
    tester,
  ) async {
    await openSignUp(
      tester,
      onRegister: (_) => json(session('teacher', 'Helena Prado')),
    );
    await chooseTeacher(tester);
    expect(find.byKey(const Key('field-invite')), findsOneWidget);
    expect(find.text('Peça o código à sua escola'), findsOneWidget);
    expect(find.text('Criar conta de professor'), findsOneWidget);
  });

  testWidgets(
    'the code is required for a teacher, and nothing is sent without it',
    (tester) async {
      final requests = await openSignUp(
        tester,
        onRegister: (_) => json(session('teacher', 'H')),
      );
      await chooseTeacher(tester);
      await fillBasics(tester);
      await tester.tap(find.byKey(const Key('auth-submit')));
      await tester.pumpAndSettle();
      expect(find.text('Informe o código de convite'), findsOneWidget);
      expect(requests.where((r) => r.url.path.endsWith('/register')), isEmpty);
    },
  );

  testWidgets('a teacher sends role and code, and lands on the doubt queue', (
    tester,
  ) async {
    final requests = await openSignUp(
      tester,
      onRegister: (_) => json(session('teacher', 'Helena Prado')),
    );
    await chooseTeacher(tester);
    await fillBasics(tester);
    await tester.enterText(
      find.byKey(const Key('field-invite')),
      '  codigo-secreto ',
    );
    await tester.tap(find.byKey(const Key('auth-submit')));
    await tester.pumpAndSettle();
    final body = registerBody(requests);
    expect(body['role'], 'teacher');
    expect(body['inviteCode'], 'codigo-secreto'); // trimmed
    expect(find.text('Fila de dúvidas'), findsOneWidget);
    expect(find.text('Escolha um assunto'), findsNothing);
  });

  testWidgets('a wrong code shows the server message and keeps the form', (
    tester,
  ) async {
    await openSignUp(
      tester,
      onRegister: (_) =>
          json(error('INVALID_INVITE_CODE', 'Código de convite inválido'), 403),
    );
    await chooseTeacher(tester);
    await fillBasics(tester);
    await tester.enterText(
      find.byKey(const Key('field-invite')),
      'errado-errado',
    );
    await tester.tap(find.byKey(const Key('auth-submit')));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('auth-error')), findsOneWidget);
    expect(find.text('Código de convite inválido'), findsOneWidget);
    expect(find.byKey(const Key('field-invite')), findsOneWidget);
    expect(
      find.text('helena@escola.dev'),
      findsOneWidget,
    ); // typed values are kept
  });

  testWidgets('the code is hidden by default and can be shown', (tester) async {
    await openSignUp(tester, onRegister: (_) => json(session('teacher', 'H')));
    await chooseTeacher(tester);
    EditableText field() => tester.widget<EditableText>(
      find.descendant(
        of: find.byKey(const Key('field-invite')),
        matching: find.byType(EditableText),
      ),
    );
    expect(field().obscureText, isTrue);
    await tester.tap(find.byKey(const Key('toggle-invite')));
    await tester.pump();
    expect(field().obscureText, isFalse);
  });

  testWidgets(
    'switching to login and back never keeps the teacher choice or the code',
    (tester) async {
      await openSignUp(
        tester,
        onRegister: (_) => json(session('student', 'A')),
      );
      await chooseTeacher(tester);
      await tester.enterText(
        find.byKey(const Key('field-invite')),
        'codigo-secreto',
      );
      await tester.tap(find.text('Entrar').first);
      await tester.pumpAndSettle();
      await tester.tap(find.text('Criar conta').first);
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('field-invite')), findsNothing);
      expect(find.text('Criar conta de professor'), findsNothing);
    },
  );
}
