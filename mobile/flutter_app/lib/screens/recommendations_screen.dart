import 'package:flutter/material.dart';

import '../models/recommendations.dart';
import '../services/api_client.dart';
import '../utils/plural.dart';
import '../widgets/async_body.dart';
import '../widgets/centered_content.dart';
import '../widgets/progress_section.dart';
import '../widgets/theme_mode_button.dart';
import '../widgets/question_card.dart';
import 'quiz_screen.dart';
import 'result_screen.dart' show formatPct;

class RecommendationsScreen extends StatefulWidget {
  const RecommendationsScreen({super.key, required this.api});

  final ApiClient api;

  @override
  State<RecommendationsScreen> createState() => _RecommendationsScreenState();
}

class _RecommendationsScreenState extends State<RecommendationsScreen> {
  Recommendations? _data;
  String? _error;
  bool _loading = true;

  /// Topic whose review quiz is being created (disables its button and shows progress).
  String? _practicingTopicId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _practice(TopicRecommendation topic) async {
    setState(() => _practicingTopicId = topic.topicId);
    try {
      final quiz = await widget.api.createReviewQuiz(topic.topicId);
      if (!mounted) return;
      setState(() => _practicingTopicId = null);
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) =>
              QuizScreen(api: widget.api, slug: quiz.slug, initialQuiz: quiz),
        ),
      );
      if (!mounted) return;
      await _load(silent: true); // the answers may have changed the priorities
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _practicingTopicId = null);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  /// [silent] keeps the current content on screen while refreshing (after a practice quiz).
  Future<void> _load({bool silent = false}) async {
    setState(() {
      if (!silent) _loading = true;
      _error = null;
    });
    try {
      final data = await widget.api.fetchRecommendations();
      if (!mounted) return;
      setState(() {
        _data = data;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Recomendações'),
      actions: const [ThemeModeButton()],
    ),
    body: CenteredContent(
      child: _loading
          ? const LoadingView()
          : _error != null
          ? ErrorView(message: _error!, onRetry: _load)
          : _buildContent(_data!),
    ),
  );

  Widget _buildContent(Recommendations data) {
    switch (data.status) {
      case 'NO_HISTORY':
        return const Center(
          child: Text('Faça um simulado para receber recomendações.'),
        );
      case 'ON_TRACK':
        return ListView(
          padding: const EdgeInsets.all(12),
          children: [
            const Padding(
              padding: EdgeInsets.all(12),
              child: Text(
                'Excelente! Todas as questões avaliadas estão com a última '
                'resposta certa.',
                textAlign: TextAlign.center,
              ),
            ),
            ProgressSection(progress: data.progress),
          ],
        );
      default:
        return ListView(
          padding: const EdgeInsets.all(12),
          children: [
            Text(
              'Considerando ${plural(data.evaluatedAttempts, 'tentativa', 'tentativas')}. '
              'A prioridade considera a última resposta de cada questão.',
            ),
            ProgressSection(progress: data.progress),
            if (data.topics.every((t) => t.priority == 'LOW'))
              const Padding(
                padding: EdgeInsets.only(top: 8),
                child: Text(
                  'Nenhum assunto crítico, mas você errou algumas questões. '
                  'Que tal revisar?',
                ),
              ),
            for (final t in data.topics) ...[
              const SizedBox(height: 12),
              Text(
                '${t.topicName} • ${t.priority == 'HIGH' ? 'prioridade alta' : 'revisão opcional'}',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              Text(
                'Última resposta certa em ${t.correctCount} de ${plural(t.answeredCount, 'questão', 'questões')} (${formatPct(t.accuracyPct)})',
              ),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 8),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: FilledButton.tonalIcon(
                    key: Key('practice-${t.topicId}'),
                    onPressed: _practicingTopicId == null
                        ? () => _practice(t)
                        : null,
                    icon: _practicingTopicId == t.topicId
                        ? const SizedBox(
                            height: 16,
                            width: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.edit_note),
                    label: const Text('Praticar este assunto'),
                  ),
                ),
              ),
              if (t.status == 'NO_NEW_QUESTIONS')
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    t.message ?? 'Sem exercícios novos para este assunto.',
                  ),
                ),
              for (var i = 0; i < t.suggestedQuestions.length; i++)
                QuestionCard(
                  index: i + 1,
                  question: t.suggestedQuestions[i].withTopicName(t.topicName),
                  readOnly: true,
                ),
            ],
          ],
        );
    }
  }
}
