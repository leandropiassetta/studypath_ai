import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/attempt_result.dart';
import '../models/auth_session.dart';
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
    this.studentId = '',
    http.Client? client,
    this.timeout = const Duration(seconds: 10),
  }) : _client = client ?? http.Client();

  final String baseUrl;
  final Duration timeout;
  final http.Client _client;

  /// The logged-in student (set by [useSession]); used in request paths and bodies.
  String studentId;
  String? _token;

  /// Called when the API says the session is no longer valid (expired or revoked).
  void Function()? onUnauthorized;

  bool get hasSession => _token != null;

  void useSession(AuthSession session) {
    _token = session.token;
    studentId = session.student.id;
  }

  void clearSession() {
    _token = null;
    studentId = '';
  }

  Map<String, String> _headers({bool json = false}) => {
    if (json) 'content-type': 'application/json',
    if (_token != null) 'authorization': 'Bearer $_token',
  };

  Future<AuthSession> register({
    required String name,
    required String email,
    required String password,
  }) async {
    final json = await _send(
      () => _client.post(
        _uri('/auth/register'),
        headers: _headers(json: true),
        body: jsonEncode({'name': name, 'email': email, 'password': password}),
      ),
      authenticated: false,
    );
    return _parse(json, AuthSession.fromJson);
  }

  Future<AuthSession> login({
    required String email,
    required String password,
  }) async {
    final json = await _send(
      () => _client.post(
        _uri('/auth/login'),
        headers: _headers(json: true),
        body: jsonEncode({'email': email, 'password': password}),
      ),
      authenticated: false,
    );
    return _parse(json, AuthSession.fromJson);
  }

  /// Best effort: the local session is dropped even if the server cannot be reached.
  Future<void> logout() async {
    try {
      await _send(
        () => _client.post(_uri('/auth/logout'), headers: _headers(json: true)),
        authenticated: false,
      );
    } on ApiException {
      // The token will simply expire on the server.
    } finally {
      clearSession();
    }
  }

  /// Tolerates a trailing slash in API_BASE_URL (".../" would otherwise give "//api/v1").
  Uri _uri(String path) =>
      Uri.parse('${baseUrl.replaceAll(RegExp(r'/+$'), '')}/api/v1$path');

  Future<Quiz> fetchQuiz(String slug) async {
    final json = await _send(
      () => _client.get(
        _uri('/quizzes/${Uri.encodeComponent(slug)}'),
        headers: _headers(),
      ),
    );
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
        headers: _headers(json: true),
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
        headers: _headers(json: true),
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
        headers: _headers(json: true),
        body: jsonEncode({'questionId': questionId}),
      ),
    );
    return _parse(json, Explanation.fromJson);
  }

  Future<Recommendations> fetchRecommendations() async {
    final json = await _send(
      () => _client.get(
        _uri('/students/$studentId/recommendations'),
        headers: _headers(),
      ),
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
    Future<http.Response> Function() request, {
    bool authenticated = true,
  }) async {
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

    if (response.statusCode == 401 && authenticated) {
      onUnauthorized?.call();
      throw const ApiException(
        'Sua sessão expirou. Entre de novo.',
        statusCode: 401,
        code: 'UNAUTHENTICATED',
      );
    }
    if (response.statusCode >= 200 &&
        response.statusCode < 300 &&
        response.bodyBytes.isEmpty) {
      return const {}; // e.g. 204 No Content
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
