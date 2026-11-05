import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:studypath_app/services/api_client.dart';

ApiClient clientFor(MockClient mock) =>
    ApiClient(baseUrl: 'http://api.test', studentId: 'student-1', client: mock);

void main() {
  test('submitAttempt sends requestId, studentId and answers', () async {
    late http.Request captured;
    final api = clientFor(
      MockClient((req) async {
        captured = req;
        return http.Response(
          jsonEncode({
            'attemptId': 'a',
            'quizId': 'q',
            'correctCount': 1,
            'totalCount': 1,
            'scorePct': 100,
            'topicResults': <dynamic>[],
            'answers': <dynamic>[],
          }),
          201,
        );
      }),
    );

    final r = await api.submitAttempt(
      requestId: 'rid',
      quizId: 'q',
      answers: {'q1': 'B'},
    );

    expect(r.scorePct, 100);
    expect(captured.url.toString(), 'http://api.test/api/v1/attempts');
    expect(jsonDecode(captured.body), {
      'requestId': 'rid',
      'studentId': 'student-1',
      'quizId': 'q',
      'answers': [
        {'questionId': 'q1', 'selectedOption': 'B'},
      ],
    });
  });

  test('maps the API error envelope to ApiException', () async {
    final api = clientFor(
      MockClient(
        (_) async => http.Response(
          jsonEncode({
            'error': {
              'code': 'REQUEST_ID_CONFLICT',
              'message': 'conflito',
              'details': [],
            },
          }),
          409,
        ),
      ),
    );
    await expectLater(
      api.fetchRecommendations(),
      throwsA(
        isA<ApiException>()
            .having((e) => e.statusCode, 'status', 409)
            .having((e) => e.code, 'code', 'REQUEST_ID_CONFLICT')
            .having((e) => e.message, 'message', 'conflito'),
      ),
    );
  });

  test('network failures become a friendly ApiException', () async {
    final api = clientFor(
      MockClient((_) async => throw http.ClientException('boom')),
    );
    await expectLater(
      api.fetchQuiz('demo'),
      throwsA(isA<ApiException>().having((e) => e.code, 'code', 'NETWORK')),
    );
  });

  test('non-JSON error bodies still produce an ApiException', () async {
    final api = clientFor(
      MockClient((_) async => http.Response('<html>', 502)),
    );
    await expectLater(
      api.fetchQuiz('demo'),
      throwsA(isA<ApiException>().having((e) => e.statusCode, 'status', 502)),
    );
  });
}
