// Compact one-line `if (...) return json(...)` routing in the mock HTTP handlers is clearer here.
// ignore_for_file: curly_braces_in_flow_control_structures

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:studypath_app/main.dart';
import 'package:studypath_app/models/auth_session.dart';
import 'package:studypath_app/models/doubt.dart';
import 'package:studypath_app/models/quiz.dart';
import 'package:studypath_app/screens/doubt_screen.dart';
import 'package:studypath_app/screens/teacher_queue_screen.dart';
import 'package:studypath_app/services/api_client.dart';
import 'package:studypath_app/services/session_controller.dart';

import 'test_support.dart';

http.Response json(Object body, [int status = 200]) => http.Response(
  jsonEncode(body),
  status,
  headers: {'content-type': 'application/json; charset=utf-8'},
);

Map<String, Object?> err(String code, String message) => {
  'error': {'code': code, 'message': message, 'details': <Object>[]},
};

Map<String, Object?> doubtJson({
  String status = 'AI_HINTS',
  int used = 0,
  String? teacherAnswer,
  bool? aiHelpful,
  bool? teacherHelpful,
}) => {
  'id': 'd1',
  'attemptId': 'att',
  'questionId': 'q1',
  'status': status,
  'message': null,
  'hintsUsed': used,
  'maxHints': 3,
  'hints': [
    for (var i = 1; i <= used; i++)
      {'level': i, 'text': 'Texto da dica $i', 'source': 'llm'},
  ],
  'teacherRequestedAt': status == 'AI_HINTS'
      ? null
      : '2026-01-01T10:00:00.000Z',
  'etaMinutes': 14,
  'teacherAnswer': teacherAnswer,
  'answeredAt': teacherAnswer == null ? null : '2026-01-01T10:09:00.000Z',
  'aiHelpful': aiHelpful,
  'teacherHelpful': teacherHelpful,
};

Map<String, Object?> teacherItem({
  String id = 't1',
  String name = 'Maria',
  int waiting = 5,
  int hints = 2,
  String? message = 'não entendi o parêntese',
  String? misconception,
  String status = 'WAITING_TEACHER',
  String? answer,
  bool? slaBreached,
}) => {
  'id': id,
  'status': status,
  'studentFirstName': name,
  'topic': 'Equações',
  'statement': 'Resolva 2(x + 3) = 5x - 3.',
  'options': [
    {'key': 'A', 'text': '1'},
    {'key': 'C', 'text': '3'},
  ],
  'selectedOption': 'A',
  'correctOption': 'C',
  'referenceExplanation': 'Distribua: 2x + 6 = 5x - 3.',
  'message': message,
  'misconception': misconception,
  'hintsUsed': hints,
  'aiHints': [
    for (var i = 1; i <= hints; i++)
      {'level': i, 'text': 'A IA disse $i', 'source': 'llm'},
  ],
  'requestedAt': '2026-01-01T10:00:00.000Z',
  'waitingMinutes': waiting,
  'slaBreached': ?slaBreached,
  'answer': answer,
  'answeredAt': answer == null ? null : '2026-01-01T10:09:00.000Z',
};

const question = Question(
  id: 'q1',
  statement: 'Resolva 2(x + 3) = 5x - 3.',
  options: [
    AnswerOption(key: 'A', text: '1'),
    AnswerOption(key: 'C', text: '3'),
  ],
  difficulty: 'hard',
  topicName: 'Equações',
);

ApiClient apiWith(MockClient mock) {
  final api = ApiClient(baseUrl: 'http://api.test', client: mock);
  api.useSession(fakeSession());
  return api;
}

void phone(WidgetTester tester) {
  tester.view.physicalSize = const Size(600, 2000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

Future<void> pumpDoubt(
  WidgetTester tester,
  ApiClient api, {
  Duration poll = const Duration(seconds: 1),
}) async {
  phone(tester);
  await tester.pumpWidget(
    MaterialApp(
      home: DoubtScreen(
        api: api,
        attemptId: 'att',
        question: question,
        selectedOption: 'A',
        pollInterval: poll,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  group('models and client', () {
    test('Student has a role, defaulting to student', () {
      expect(Student.fromJson({'id': 'x', 'name': 'A'}).isTeacher, isFalse);
      expect(
        Student.fromJson({'id': 'x', 'name': 'A', 'role': 'teacher'}).isTeacher,
        isTrue,
      );
    });

    test('Doubt parses the teacher fields and copyWith keeps them', () {
      final d = Doubt.fromJson(
        doubtJson(status: 'ANSWERED', used: 1, teacherAnswer: 'Resp'),
      );
      expect(d.isAnswered, isTrue);
      expect(d.isWaiting, isFalse);
      expect(d.teacherAnswer, 'Resp');
      expect(d.answeredAt, DateTime.utc(2026, 1, 1, 10, 9));
      final c = d.copyWith(hintsUsed: 2);
      expect(c.teacherAnswer, 'Resp');
      expect(c.hintsUsed, 2);
      expect(Doubt.fromJson(doubtJson()).teacherRequestedAt, isNull);
    });

    test(
      'teacher calls: queue URL, answered mode, trimmed answer, feedback keys',
      () async {
        final seen = <http.Request>[];
        final api = apiWith(
          MockClient((req) async {
            seen.add(req);
            if (req.url.path.endsWith('/teacher/doubts'))
              return json([teacherItem()]);
            if (req.url.path.endsWith('/answer')) return http.Response('', 204);
            return json(doubtJson(status: 'WAITING_TEACHER'));
          }),
        );
        final waiting = await api.fetchTeacherQueue();
        await api.fetchTeacherQueue(answered: true);
        await api.answerDoubt('t1', '  Divida por 2  ');
        await api.requestTeacher('d1');
        await api.sendFeedback('d1', aiHelpful: true);
        await api.sendFeedback('d1', teacherHelpful: false);

        expect(waiting.single.studentFirstName, 'Maria');
        expect(waiting.single.options.first.key, 'A');
        expect(
          seen[0].url.toString(),
          'http://api.test/api/v1/teacher/doubts?status=waiting',
        );
        expect(seen[1].url.queryParameters['status'], 'answered');
        expect(jsonDecode(seen[2].body), {'answer': 'Divida por 2'});
        expect(seen[3].url.path, '/api/v1/doubts/d1/teacher');
        expect(seen[4].method, 'PUT');
        expect(jsonDecode(seen[4].body), {'aiHelpful': true});
        expect(jsonDecode(seen[5].body), {'teacherHelpful': false});
        expect(seen.every((r) => r.headers['authorization'] != null), isTrue);
      },
    );

    test(
      'a failing teacher call becomes an ApiException (403 for students)',
      () async {
        final api = apiWith(
          MockClient(
            (_) async =>
                json(err('FORBIDDEN', 'Área exclusiva de professores'), 403),
          ),
        );
        await expectLater(
          api.fetchTeacherQueue(),
          throwsA(
            isA<ApiException>().having((e) => e.statusCode, 'status', 403),
          ),
        );
      },
    );
  });

  group('student: calling a teacher', () {
    testWidgets(
      '"Chamar um professor" puts the doubt in the queue and shows the wait',
      (tester) async {
        final seen = <String>[];
        await pumpDoubt(
          tester,
          apiWith(
            MockClient((req) async {
              seen.add('${req.method} ${req.url.path}');
              if (req.url.path.endsWith('/teacher'))
                return json(doubtJson(status: 'WAITING_TEACHER'));
              return json(doubtJson(), 201);
            }),
          ),
        );
        expect(find.byKey(const Key('call-teacher')), findsOneWidget);
        expect(
          find.text('Um professor responde em cerca de 14 min.'),
          findsOneWidget,
        );

        await tester.tap(find.byKey(const Key('call-teacher')));
        await tester.pumpAndSettle();
        expect(seen, contains('POST /api/v1/doubts/d1/teacher'));
        expect(find.byKey(const Key('teacher-waiting')), findsOneWidget);
        expect(
          find.textContaining('Resposta em cerca de 14 min'),
          findsOneWidget,
        );
        expect(find.byKey(const Key('call-teacher')), findsNothing);
        expect(
          find.byKey(const Key('doubt-message')),
          findsNothing,
        ); // the note is no longer editable
        // Stop the poll timer started by the waiting state before the test ends.
        await tester.pumpWidget(const SizedBox());
      },
    );

    testWidgets(
      'a waiting doubt checks by itself and shows the teacher\'s answer when it arrives',
      (tester) async {
        var polls = 0;
        await pumpDoubt(
          tester,
          apiWith(
            MockClient((req) async {
              if (req.method == 'GET') {
                polls++;
                return json(
                  polls < 2
                      ? doubtJson(status: 'WAITING_TEACHER')
                      : doubtJson(
                          status: 'ANSWERED',
                          teacherAnswer: 'Distribua o 2 pelo 3.',
                        ),
                );
              }
              return json(
                doubtJson(status: 'WAITING_TEACHER'),
                200,
              ); // open on entry: already waiting
            }),
          ),
        );
        expect(find.byKey(const Key('teacher-waiting')), findsOneWidget);

        await tester.pump(
          const Duration(seconds: 1),
        ); // 1st poll: still waiting
        await tester.pump();
        expect(find.byKey(const Key('teacher-waiting')), findsOneWidget);
        await tester.pump(const Duration(seconds: 1)); // 2nd poll: answered
        await tester.pump();
        expect(find.byKey(const Key('teacher-answer')), findsOneWidget);
        expect(find.text('Distribua o 2 pelo 3.'), findsOneWidget);
        expect(find.byKey(const Key('teacher-waiting')), findsNothing);

        // Polling stopped: no more requests after the answer arrived.
        final before = polls;
        await tester.pump(const Duration(seconds: 5));
        expect(polls, before);
      },
    );

    testWidgets('a failed poll keeps the screen and the next one recovers', (
      tester,
    ) async {
      var polls = 0;
      await pumpDoubt(
        tester,
        apiWith(
          MockClient((req) async {
            if (req.method == 'GET') {
              polls++;
              if (polls == 1)
                return json(err('INTERNAL_ERROR', 'Erro interno'), 500);
              return json(
                doubtJson(status: 'ANSWERED', teacherAnswer: 'Resposta final'),
              );
            }
            return json(doubtJson(status: 'WAITING_TEACHER'));
          }),
        ),
      );
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      expect(
        find.byKey(const Key('teacher-waiting')),
        findsOneWidget,
      ); // unchanged, no error screen
      expect(find.text('Erro interno'), findsNothing);
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      expect(find.text('Resposta final'), findsOneWidget);
    });

    testWidgets(
      'an answered doubt reopens with the answer and no way to call again',
      (tester) async {
        await pumpDoubt(
          tester,
          apiWith(
            MockClient(
              (_) async => json(
                doubtJson(
                  status: 'ANSWERED',
                  used: 2,
                  teacherAnswer: 'Já respondida',
                ),
              ),
            ),
          ),
        );
        expect(find.text('Já respondida'), findsOneWidget);
        expect(find.byKey(const Key('call-teacher')), findsNothing);
        expect(
          find.byKey(const Key('ask-hint')),
          findsNothing,
        ); // no more hints after an answer
        expect(find.byKey(const Key('teacher-helpful-yes')), findsOneWidget);
      },
    );

    testWidgets('an error when calling keeps the button available', (
      tester,
    ) async {
      await pumpDoubt(
        tester,
        apiWith(
          MockClient((req) async {
            if (req.url.path.endsWith('/teacher'))
              return json(err('INTERNAL_ERROR', 'Erro interno'), 500);
            return json(doubtJson(), 201);
          }),
        ),
      );
      await tester.tap(find.byKey(const Key('call-teacher')));
      await tester.pumpAndSettle();
      expect(find.text('Erro interno'), findsOneWidget);
      expect(find.byKey(const Key('call-teacher')), findsOneWidget);
    });
  });

  group('student: "isso ajudou?"', () {
    testWidgets(
      'rates the AI hints once there is a hint, and the teacher once answered',
      (tester) async {
        final bodies = <Map<String, dynamic>>[];
        await pumpDoubt(
          tester,
          apiWith(
            MockClient((req) async {
              if (req.method == 'PUT') {
                final body = jsonDecode(req.body) as Map<String, dynamic>;
                bodies.add(body);
                return json(
                  doubtJson(
                    status: 'ANSWERED',
                    used: 1,
                    teacherAnswer: 'R',
                    aiHelpful: body['aiHelpful'] as bool?,
                    teacherHelpful: body['teacherHelpful'] as bool?,
                  ),
                );
              }
              return json(
                doubtJson(status: 'ANSWERED', used: 1, teacherAnswer: 'R'),
              );
            }),
          ),
        );
        expect(find.text('As dicas da IA ajudaram?'), findsOneWidget);
        await tester.tap(find.byKey(const Key('ai-helpful-no')));
        await tester.pumpAndSettle();
        expect(bodies.last, {'aiHelpful': false});
        expect(
          tester
              .widget<ChoiceChip>(find.byKey(const Key('ai-helpful-no')))
              .selected,
          isTrue,
        );

        await tester.tap(find.byKey(const Key('teacher-helpful-yes')));
        await tester.pumpAndSettle();
        expect(bodies.last, {'teacherHelpful': true});
        expect(
          tester
              .widget<ChoiceChip>(find.byKey(const Key('teacher-helpful-yes')))
              .selected,
          isTrue,
        );
      },
    );

    testWidgets('no rating is offered before the first hint', (tester) async {
      await pumpDoubt(
        tester,
        apiWith(MockClient((_) async => json(doubtJson(), 201))),
      );
      expect(find.text('As dicas da IA ajudaram?'), findsNothing);
      expect(find.byKey(const Key('ai-helpful-yes')), findsNothing);
    });
  });

  group('teacher queue', () {
    Future<void> pumpQueue(
      WidgetTester tester,
      ApiClient api, {
      Duration refresh = const Duration(seconds: 10),
    }) async {
      phone(tester);
      await tester.pumpWidget(
        MaterialApp(
          home: TeacherQueueScreen(
            api: api,
            teacherName: 'Helena',
            onLogout: () async {},
            refreshInterval: refresh,
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    testWidgets('flags only the doubts that waited past the promised time', (
      tester,
    ) async {
      await pumpQueue(
        tester,
        apiWith(
          MockClient(
            (_) async => json([
              teacherItem(
                id: 'a',
                name: 'Maria',
                waiting: 20,
                slaBreached: true,
              ),
              teacherItem(
                id: 'b',
                name: 'João',
                waiting: 2,
                slaBreached: false,
              ),
              teacherItem(
                id: 'c',
                name: 'Ana',
                waiting: 3,
              ), // older API: field missing
            ]),
          ),
        ),
      );
      expect(find.byKey(const Key('sla-breached')), findsOneWidget);
      expect(find.text('Prazo vencido'), findsOneWidget);
    });

    testWidgets(
      'lists waiting doubts with first name, topic, wait and what the AI did',
      (tester) async {
        await pumpQueue(
          tester,
          apiWith(
            MockClient(
              (_) async => json([
                teacherItem(id: 'a', name: 'Maria', waiting: 1, hints: 1),
                teacherItem(id: 'b', name: 'João', waiting: 12, hints: 0),
              ]),
            ),
          ),
        );
        expect(find.text('Fila de dúvidas'), findsOneWidget);
        expect(find.text('Maria'), findsOneWidget);
        expect(find.text('aguardando há 1 minuto'), findsOneWidget);
        expect(find.text('aguardando há 12 minutos'), findsOneWidget);
        expect(find.text('IA deu 1 dica'), findsOneWidget);
        expect(
          find.textContaining('IA deu 0'),
          findsNothing,
        ); // nothing to say when the AI gave no hints
        expect(find.text('Equações'), findsWidgets);
      },
    );

    testWidgets(
      'shows a clear empty state, and the answered tab asks the server for answered doubts',
      (tester) async {
        final statuses = <String?>[];
        await pumpQueue(
          tester,
          apiWith(
            MockClient((req) async {
              statuses.add(req.url.queryParameters['status']);
              return json(<Object>[]);
            }),
          ),
        );
        expect(
          find.text(
            'Nenhuma dúvida aguardando. Quando um aluno chamar um professor, ela aparece aqui.',
          ),
          findsOneWidget,
        );
        await tester.tap(find.text('Respondidas por mim'));
        await tester.pumpAndSettle();
        expect(statuses.last, 'answered');
        expect(
          find.text('Você ainda não respondeu nenhuma dúvida.'),
          findsOneWidget,
        );
      },
    );

    testWidgets(
      'an error offers a retry; a failed silent refresh keeps the list',
      (tester) async {
        var calls = 0;
        await pumpQueue(
          tester,
          apiWith(
            MockClient((_) async {
              calls++;
              if (calls == 1)
                return json(err('INTERNAL_ERROR', 'Erro interno'), 500);
              if (calls == 3)
                return json(err('INTERNAL_ERROR', 'Erro interno'), 500);
              return json([teacherItem()]);
            }),
          ),
          refresh: const Duration(seconds: 1),
        );
        expect(find.text('Erro interno'), findsOneWidget);
        await tester.tap(find.text('Tentar novamente'));
        await tester.pumpAndSettle();
        expect(find.text('Maria'), findsOneWidget);

        await tester.pump(
          const Duration(seconds: 1),
        ); // auto refresh fails (call 3)
        await tester.pump();
        expect(
          find.text('Maria'),
          findsOneWidget,
        ); // the list stays, no error screen
        expect(find.text('Erro interno'), findsNothing);
        await tester.pumpWidget(const SizedBox());
      },
    );

    testWidgets('refreshes by itself and picks up a new doubt', (tester) async {
      var calls = 0;
      await pumpQueue(
        tester,
        apiWith(
          MockClient((_) async {
            calls++;
            return json(calls == 1 ? <Object>[] : [teacherItem(name: 'Nova')]);
          }),
        ),
        refresh: const Duration(seconds: 1),
      );
      expect(find.text('Nova'), findsNothing);
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      expect(find.text('Nova'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    });
  });

  group('teacher: answering', () {
    Future<void> openFirst(WidgetTester tester, MockClient mock) async {
      phone(tester);
      await tester.pumpWidget(
        MaterialApp(
          home: TeacherQueueScreen(
            api: apiWith(mock),
            teacherName: 'Helena',
            onLogout: () async {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('doubt-t1')));
      await tester.pumpAndSettle();
    }

    testWidgets(
      'shows the whole context: options with markers, the note, the AI hints and the reference',
      (tester) async {
        await openFirst(
          tester,
          MockClient(
            (_) async =>
                json([teacherItem(misconception: 'Não distribuiu o 2 pelo 3')]),
          ),
        );
        expect(find.text('Responder dúvida'), findsOneWidget);
        expect(
          find.textContaining('A) 1   ← marcada pelo aluno'),
          findsOneWidget,
        );
        expect(find.textContaining('C) 3   ✓ correta'), findsOneWidget);
        expect(find.byKey(const Key('student-note')), findsOneWidget);
        expect(find.text('“não entendi o parêntese”'), findsOneWidget);
        expect(find.byKey(const Key('misconception')), findsOneWidget);
        expect(find.text('Não distribuiu o 2 pelo 3'), findsOneWidget);
        expect(find.text('O que a IA já disse (2 dicas)'), findsOneWidget);
        expect(find.text('1. A IA disse 1'), findsOneWidget);
        expect(find.text('Solução de referência'), findsOneWidget);
      },
    );

    testWidgets('hides the note and the misconception when there is none', (
      tester,
    ) async {
      await openFirst(
        tester,
        MockClient((_) async => json([teacherItem(message: null, hints: 0)])),
      );
      expect(find.byKey(const Key('student-note')), findsNothing);
      expect(find.byKey(const Key('misconception')), findsNothing);
      expect(find.text('A IA ainda não deu dicas'), findsOneWidget);
    });

    testWidgets(
      'sending needs text, posts the trimmed answer and returns to the queue',
      (tester) async {
        final posted = <Map<String, dynamic>>[];
        var answered = false;
        await openFirst(
          tester,
          MockClient((req) async {
            if (req.url.path.endsWith('/answer')) {
              posted.add(jsonDecode(req.body) as Map<String, dynamic>);
              answered = true;
              return http.Response('', 204);
            }
            return json(answered ? <Object>[] : [teacherItem()]);
          }),
        );
        FilledButton send() =>
            tester.widget<FilledButton>(find.byKey(const Key('send-answer')));
        expect(send().onPressed, isNull); // empty
        await tester.enterText(find.byKey(const Key('answer-field')), '   ');
        await tester.pump();
        expect(send().onPressed, isNull); // blank
        await tester.enterText(
          find.byKey(const Key('answer-field')),
          '  Distribua o 2 por cada termo.  ',
        );
        await tester.pump();
        expect(send().onPressed, isNotNull);

        await tester.tap(find.byKey(const Key('send-answer')));
        await tester.pumpAndSettle();
        expect(posted.single, {'answer': 'Distribua o 2 por cada termo.'});
        expect(find.text('Resposta enviada ao aluno.'), findsOneWidget);
        expect(
          find.byKey(const Key('doubt-t1')),
          findsNothing,
        ); // gone from the queue
        expect(find.byKey(const Key('queue-empty')), findsOneWidget);
      },
    );

    testWidgets(
      'if another teacher answered first it says so, keeps the text and re-enables sending',
      (tester) async {
        await openFirst(
          tester,
          MockClient((req) async {
            if (req.url.path.endsWith('/answer'))
              return json(
                err('NOT_WAITING', 'Esta dúvida não está aguardando resposta'),
                409,
              );
            return json([teacherItem()]);
          }),
        );
        await tester.enterText(
          find.byKey(const Key('answer-field')),
          'Minha resposta',
        );
        await tester.pump();
        await tester.tap(find.byKey(const Key('send-answer')));
        await tester.pumpAndSettle();
        expect(
          find.text('Outro professor já respondeu esta dúvida.'),
          findsOneWidget,
        );
        expect(find.text('Minha resposta'), findsOneWidget);
      },
    );

    testWidgets('an answered doubt is read-only', (tester) async {
      phone(tester);
      await tester.pumpWidget(
        MaterialApp(
          home: TeacherQueueScreen(
            api: apiWith(
              MockClient(
                (_) async => json([
                  teacherItem(status: 'ANSWERED', answer: 'Resposta dada'),
                ]),
              ),
            ),
            onLogout: () async {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('doubt-t1')));
      await tester.pumpAndSettle();
      expect(find.text('Resposta dada'), findsOneWidget);
      expect(find.byKey(const Key('answer-field')), findsNothing);
      expect(find.byKey(const Key('send-answer')), findsNothing);
    });
  });

  group('who sees what', () {
    Future<void> pumpApp(WidgetTester tester, String role) async {
      phone(tester);
      final api = apiWith(
        MockClient((req) async {
          if (req.url.path.endsWith('/teacher/doubts')) return json(<Object>[]);
          return json({
            'id': 'quiz',
            'slug': 'demo',
            'title': 'Simulado de Matemática',
            'kind': 'standard',
            'questions': <Object>[],
          });
        }),
      );
      final session = SessionController(
        api,
        initial: AuthSession(
          token: 't' * 43,
          expiresAt: DateTime.utc(2099),
          student: Student(
            id: 'u1',
            name: 'Fulana',
            email: 'f@t.dev',
            role: role,
          ),
        ),
      );
      await tester.pumpWidget(StudyPathApp(api: api, session: session));
      await tester.pumpAndSettle();
    }

    testWidgets('a teacher account lands on the doubt queue', (tester) async {
      await pumpApp(tester, 'teacher');
      expect(find.text('Fila de dúvidas'), findsOneWidget);
      expect(find.text('Simulado de Matemática'), findsNothing);
      expect(find.byKey(const Key('logout-button')), findsOneWidget);
      expect(find.byKey(const Key('theme-button')), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
    });

    testWidgets(
      'a student account lands on the quiz, never on the teacher queue',
      (tester) async {
        await pumpApp(tester, 'student');
        expect(find.text('Simulado de Matemática'), findsOneWidget);
        expect(find.text('Fila de dúvidas'), findsNothing);
      },
    );
  });
}
