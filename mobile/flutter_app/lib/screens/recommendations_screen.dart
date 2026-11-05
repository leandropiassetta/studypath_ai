import 'package:flutter/material.dart';

import '../models/recommendations.dart';
import '../services/api_client.dart';
import '../widgets/async_body.dart';
import '../widgets/question_card.dart';
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

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
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
    appBar: AppBar(title: const Text('Recomendações')),
    body: _loading
        ? const LoadingView()
        : _error != null
        ? ErrorView(message: _error!, onRetry: _load)
        : _buildContent(_data!),
  );

  Widget _buildContent(Recommendations data) {
    switch (data.status) {
      case 'NO_HISTORY':
        return const Center(
          child: Text('Faça um simulado para receber recomendações.'),
        );
      case 'ON_TRACK':
        return const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: Text(
              'Bom desempenho! Nenhum assunto prioritário no momento.',
              textAlign: TextAlign.center,
            ),
          ),
        );
      default:
        return ListView(
          padding: const EdgeInsets.all(12),
          children: [
            Text(
              'Avaliadas ${data.evaluatedAttempts} tentativa(s) recente(s).',
            ),
            for (final t in data.topics) ...[
              const SizedBox(height: 12),
              Text(
                '${t.topicName} • prioridade alta',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              Text(
                'Acertos: ${t.correctCount}/${t.answeredCount} (${formatPct(t.accuracyPct)})',
              ),
              if (t.status == 'NO_NEW_QUESTIONS')
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    t.message ?? 'Sem exercícios novos para este assunto.',
                  ),
                ),
              for (var i = 0; i < t.suggestedQuestions.length; i++)
                QuestionCard(index: i + 1, question: t.suggestedQuestions[i]),
            ],
          ],
        );
    }
  }
}
