import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/attempt_result.dart';
import '../models/explanation.dart';
import '../models/quiz.dart';
import '../models/recommendations.dart';

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode, this.code});

  final String message;
  final int? statusCode;
  final String? code;

  @override
  String toString() => message;
}

/// Thin HTTP client for the StudyPath API. The base URL is injected, never hard-coded.
class ApiClient {
  ApiClient({
    required this.baseUrl,
    required this.studentId,
    http.Client? client,
    this.timeout = const Duration(seconds: 10),
  }) : _client = client ?? http.Client();

  final String baseUrl;
  final String studentId;
  final Duration timeout;
  final http.Client _client;

  Uri _uri(String path) => Uri.parse('$baseUrl/api/v1$path');

  Future<Quiz> fetchQuiz(String slug) async {
    final json = await _send(() => _client.get(_uri('/quizzes/$slug')));
    return _parse(json, Quiz.fromJson);
  }

  /// Retrying with the same [requestId] is safe: the API is idempotent (RN-05).
  Future<AttemptResult> submitAttempt({
    required String requestId,
    required String quizId,
    required Map<String, String> answers,
  }) async {
    final body = jsonEncode({
      'requestId': requestId,
      'studentId': studentId,
      'quizId': quizId,
      'answers': [
        for (final e in answers.entries)
          {'questionId': e.key, 'selectedOption': e.value},
      ],
    });
    final json = await _send(
      () => _client.post(
        _uri('/attempts'),
        headers: {'content-type': 'application/json'},
        body: body,
      ),
    );
    return _parse(json, AttemptResult.fromJson);
  }

  /// Creates (or reuses) a review quiz for a topic that is currently in the recommendations.
  Future<Quiz> createReviewQuiz(String topicId) async {
    final json = await _send(
      () => _client.post(
        _uri('/students/$studentId/review-quizzes'),
        headers: {'content-type': 'application/json'},
        body: jsonEncode({'topicId': topicId}),
      ),
    );
    return _parse(json, Quiz.fromJson);
  }

  /// Only valid for questions answered incorrectly in [attemptId].
  Future<Explanation> fetchExplanation({
    required String attemptId,
    required String questionId,
  }) async {
    final json = await _send(
      () => _client.post(
        _uri('/attempts/$attemptId/explanations'),
        headers: {'content-type': 'application/json'},
        body: jsonEncode({'questionId': questionId}),
      ),
    );
    return _parse(json, Explanation.fromJson);
  }

  Future<Recommendations> fetchRecommendations() async {
    final json = await _send(
      () => _client.get(_uri('/students/$studentId/recommendations')),
    );
    return _parse(json, Recommendations.fromJson);
  }

  /// A malformed 2xx body must surface as an [ApiException] so screens leave the
  /// loading state and offer a retry instead of failing silently.
  T _parse<T>(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>) from,
  ) {
    try {
      return from(json);
    } catch (_) {
      throw const ApiException(
        'Resposta inesperada da API.',
        code: 'BAD_RESPONSE',
      );
    }
  }

  Future<Map<String, dynamic>> _send(
    Future<http.Response> Function() request,
  ) async {
    final http.Response response;
    try {
      response = await request().timeout(timeout);
    } on TimeoutException {
      throw const ApiException(
        'A API demorou demais para responder.',
        code: 'TIMEOUT',
      );
    } catch (_) {
      throw const ApiException(
        'Não foi possível conectar à API.',
        code: 'NETWORK',
      );
    }

    Map<String, dynamic>? decoded;
    try {
      decoded =
          jsonDecode(utf8.decode(response.bodyBytes)) as Map<String, dynamic>;
    } catch (_) {
      decoded = null;
    }

    if (response.statusCode >= 200 &&
        response.statusCode < 300 &&
        decoded != null) {
      return decoded;
    }
    final error = decoded?['error'] as Map<String, dynamic>?;
    throw ApiException(
      (error?['message'] as String?) ??
          'Erro inesperado (${response.statusCode}).',
      statusCode: response.statusCode,
      code: error?['code'] as String?,
    );
  }
}
