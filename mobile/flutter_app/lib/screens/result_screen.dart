import 'package:flutter/material.dart';

import '../models/attempt_result.dart';
import '../models/quiz.dart';
import '../services/api_client.dart';
import '../widgets/centered_content.dart';
import '../widgets/explanation_tile.dart';
import '../widgets/theme_mode_button.dart';
import '../widgets/topic_tag.dart';
import 'doubt_screen.dart';
import 'recommendations_screen.dart';

/// pt-BR percentage without noise: 50 -> "50%", 87.5 -> "87,5%", 33.33 -> "33,33%".
String formatPct(double v) {
  var text = v.toStringAsFixed(2);
  if (text.contains('.')) {
    text = text.replaceFirst(RegExp(r'\.?0+$'), '');
  }
  return '${text.replaceAll('.', ',')}%';
}

class ResultScreen extends StatelessWidget {
  const ResultScreen({
    super.key,
    required this.api,
    required this.quiz,
    required this.result,
  });

  final ApiClient api;
  final Quiz quiz;
  final AttemptResult result;

  @override
  Widget build(BuildContext context) {
    final byId = {for (final q in quiz.questions) q.id: q};
    final index = {
      for (var i = 0; i < quiz.questions.length; i++)
        quiz.questions[i].id: i + 1,
    };
    return Scaffold(
      appBar: AppBar(
        title: const Text('Resultado'),
        actions: const [ThemeModeButton()],
      ),
      body: CenteredContent(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(
              formatPct(result.scorePct),
              key: const Key('score'),
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.displayMedium,
            ),
            Text(
              '${result.correctCount} de ${result.totalCount} '
              '${result.totalCount == 1 ? 'questão correta' : 'questões corretas'}',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            Semantics(
              header: true,
              child: Text(
                'Por assunto',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            for (final t in result.topicResults)
              ListTile(
                dense: true,
                title: Text(t.topicName),
                trailing: Text(
                  '${t.correctCount}/${t.totalCount} (${formatPct(t.accuracyPct)})',
                ),
              ),
            const SizedBox(height: 8),
            Semantics(
              header: true,
              child: Text(
                'Correção',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            for (final a in result.answers)
              Card(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (byId[a.questionId]?.topicName != null)
                      Padding(
                        padding: const EdgeInsets.only(left: 16, top: 10),
                        child: KeyedSubtree(
                          key: Key('result-topic-${a.questionId}'),
                          child: TopicTag(name: byId[a.questionId]!.topicName!),
                        ),
                      ),
                    ListTile(
                      leading: Icon(
                        a.isCorrect ? Icons.check_circle : Icons.cancel,
                        semanticLabel: a.isCorrect
                            ? 'Resposta correta'
                            : 'Resposta incorreta',
                        color: a.isCorrect ? Colors.green : Colors.red,
                      ),
                      title: Text(
                        '${index[a.questionId]}. ${byId[a.questionId]?.statement ?? ''}',
                      ),
                      subtitle: Text(
                        'Sua resposta: ${a.selectedOption}'
                        '${a.isCorrect ? '' : ' • Correta: ${a.correctOption}'}\n'
                        '${a.referenceExplanation}',
                      ),
                      isThreeLine: true,
                    ),
                    if (!a.isCorrect)
                      Padding(
                        padding: const EdgeInsets.only(left: 56, bottom: 4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            ExplanationTile(
                              api: api,
                              attemptId: result.attemptId,
                              questionId: a.questionId,
                            ),
                            if (byId[a.questionId] != null)
                              TextButton.icon(
                                key: Key('doubt-${a.questionId}'),
                                onPressed: () => Navigator.of(context).push(
                                  MaterialPageRoute<void>(
                                    builder: (_) => DoubtScreen(
                                      api: api,
                                      attemptId: result.attemptId,
                                      question: byId[a.questionId]!,
                                      selectedOption: a.selectedOption,
                                    ),
                                  ),
                                ),
                                icon: const Icon(Icons.help_outline),
                                label: const Text('Tirar dúvida'),
                              ),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            const SizedBox(height: 16),
            if (!quiz.isReview) ...[
              FilledButton(
                key: const Key('recommendations-button'),
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => RecommendationsScreen(api: api),
                  ),
                ),
                child: const Text('Ver recomendações de estudo'),
              ),
              const SizedBox(height: 8),
            ],
            OutlinedButton(
              key: const Key('retake-button'),
              onPressed: () => Navigator.of(context).pop(),
              child: Text(
                quiz.isReview
                    ? 'Voltar às recomendações'
                    : 'Fazer novo simulado',
              ),
            ),
          ],
        ),
      ),
    );
  }
}
