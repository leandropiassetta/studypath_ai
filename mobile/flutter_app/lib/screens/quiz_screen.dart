import 'package:flutter/material.dart';

import '../models/quiz.dart';
import '../services/api_client.dart';
import '../services/request_id.dart';
import '../widgets/async_body.dart';
import '../widgets/centered_content.dart';
import '../widgets/question_card.dart';
import 'result_screen.dart';

class QuizScreen extends StatefulWidget {
  const QuizScreen({
    super.key,
    required this.api,
    required this.slug,
    this.initialQuiz,
    this.studentName,
    this.onLogout,
  });

  final ApiClient api;
  final String slug;

  /// A quiz that was already created (review quizzes): no loading step is needed.
  final Quiz? initialQuiz;

  /// Shown in the app bar menu together with the logout action (home quiz only).
  final String? studentName;
  final Future<void> Function()? onLogout;

  @override
  State<QuizScreen> createState() => _QuizScreenState();
}

class _QuizScreenState extends State<QuizScreen> {
  Quiz? _quiz;
  String? _loadError;
  bool _loading = true;

  final Map<String, String> _answers = {};
  bool _submitting = false;
  String? _submitError;

  /// One id per submit intent; kept on failure so a retry is idempotent (CA-10).
  String? _requestId;

  @override
  void initState() {
    super.initState();
    final initial = widget.initialQuiz;
    if (initial != null) {
      _quiz = initial;
      _loading = false;
    } else {
      _load();
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final quiz = await widget.api.fetchQuiz(widget.slug);
      if (!mounted) return;
      setState(() {
        _quiz = quiz;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = e.message;
        _loading = false;
      });
    }
  }

  Future<void> _submit() async {
    final quiz = _quiz!;
    final requestId = _requestId ??= newRequestId();
    setState(() {
      _submitting = true;
      _submitError = null;
    });
    try {
      final result = await widget.api.submitAttempt(
        requestId: requestId,
        quizId: quiz.id,
        answers: Map.of(_answers),
      );
      if (!mounted) return;
      setState(() => _submitting = false);
      // The attempt succeeded: this intent is done. Returning from the result starts a fresh one.
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) =>
              ResultScreen(api: widget.api, quiz: quiz, result: result),
        ),
      );
      if (!mounted) return;
      if (quiz.isReview) {
        // A review quiz is one-shot: go back to the recommendations, which reload.
        Navigator.of(context).pop();
        return;
      }
      setState(() {
        _answers.clear();
        _requestId = null;
        _submitError = null;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _submitError = e.message;
      });
    }
  }

  String _reviewSummary(Quiz quiz) {
    final fresh = quiz.newCount ?? 0;
    final retry = quiz.retryCount ?? 0;
    final parts = [
      if (fresh > 0) '$fresh inédita(s)',
      if (retry > 0) '$retry para refazer',
    ];
    return 'Revisão de ${quiz.questions.length} questão(ões): ${parts.join(' e ')}.'
        '${retry > 0 ? ' Refazer a mesma questão ajuda a fixar, mas não prova que você entendeu.' : ''}';
  }

  @override
  Widget build(BuildContext context) {
    final quiz = _quiz;
    return Scaffold(
      appBar: AppBar(
        title: Text(quiz?.title ?? 'Simulado'),
        actions: [
          if (widget.onLogout != null)
            IconButton(
              key: const Key('logout-button'),
              tooltip: widget.studentName == null
                  ? 'Sair da conta'
                  : 'Sair da conta de ${widget.studentName}',
              icon: const Icon(Icons.logout),
              onPressed: () => widget.onLogout?.call(),
            ),
        ],
      ),
      body: CenteredContent(
        child: _loading
            ? const LoadingView()
            : _loadError != null
            ? ErrorView(message: _loadError!, onRetry: _load)
            : _buildQuiz(quiz!),
      ),
    );
  }

  Widget _buildQuiz(Quiz quiz) {
    final complete = _answers.length == quiz.questions.length;
    return Column(
      children: [
        if (quiz.isReview)
          Container(
            key: const Key('review-banner'),
            width: double.infinity,
            color: Theme.of(context).colorScheme.secondaryContainer,
            padding: const EdgeInsets.all(12),
            child: Text(_reviewSummary(quiz)),
          ),
        LinearProgressIndicator(
          key: const Key('progress'),
          value: quiz.questions.isEmpty
              ? 0
              : _answers.length / quiz.questions.length,
        ),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(12),
            children: [
              for (var i = 0; i < quiz.questions.length; i++)
                QuestionCard(
                  index: i + 1,
                  question: quiz.questions[i],
                  selected: _answers[quiz.questions[i].id],
                  onSelected: _submitting
                      ? null
                      : (key) => setState(() {
                          _answers[quiz.questions[i].id] = key;
                          // Changing answers is a new intent, so a new requestId.
                          _requestId = null;
                        }),
                ),
            ],
          ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_submitError != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      _submitError!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    key: const Key('submit-button'),
                    onPressed: complete && !_submitting ? _submit : null,
                    child: _submitting
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(
                            _submitError != null
                                ? 'Tentar enviar novamente'
                                : 'Enviar respostas (${_answers.length}/${quiz.questions.length})',
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
