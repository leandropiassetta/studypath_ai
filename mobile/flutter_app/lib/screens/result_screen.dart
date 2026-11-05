import 'package:flutter/material.dart';

import '../models/attempt_result.dart';
import '../models/quiz.dart';
import '../services/api_client.dart';
import 'recommendations_screen.dart';

String formatPct(double v) =>
    v == v.roundToDouble() ? '${v.round()}%' : '${v.toStringAsFixed(2)}%';

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
      appBar: AppBar(title: const Text('Resultado')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            formatPct(result.scorePct),
            key: const Key('score'),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.displayMedium,
          ),
          Text(
            '${result.correctCount} de ${result.totalCount} questões corretas',
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 16),
          Text('Por assunto', style: Theme.of(context).textTheme.titleMedium),
          for (final t in result.topicResults)
            ListTile(
              dense: true,
              title: Text(t.topicName),
              trailing: Text(
                '${t.correctCount}/${t.totalCount} (${formatPct(t.accuracyPct)})',
              ),
            ),
          const SizedBox(height: 8),
          Text('Correção', style: Theme.of(context).textTheme.titleMedium),
          for (final a in result.answers)
            Card(
              child: ListTile(
                leading: Icon(
                  a.isCorrect ? Icons.check_circle : Icons.cancel,
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
            ),
          const SizedBox(height: 16),
          FilledButton(
            key: const Key('recommendations-button'),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => RecommendationsScreen(api: api),
              ),
            ),
            child: const Text('Ver recomendações de estudo'),
          ),
        ],
      ),
    );
  }
}
