import 'package:flutter/material.dart';

import '../models/quiz_summary.dart';
import '../services/api_client.dart';
import '../utils/plural.dart';
import '../widgets/async_body.dart';
import '../widgets/centered_content.dart';
import '../widgets/theme_mode_button.dart';
import '../widgets/topic_tag.dart';
import 'quiz_screen.dart';
import 'recommendations_screen.dart';

/// First screen of a student: pick the subject to practice.
class QuizPickerScreen extends StatefulWidget {
  const QuizPickerScreen({
    super.key,
    required this.api,
    this.studentName,
    this.onLogout,
  });

  final ApiClient api;
  final String? studentName;
  final Future<void> Function()? onLogout;

  @override
  State<QuizPickerScreen> createState() => _QuizPickerScreenState();
}

IconData _iconFor(QuizSummary quiz) {
  final text = '${quiz.title} ${quiz.topics.join(' ')}'.toLowerCase();
  if (text.contains('matem') || text.contains('equa')) return Icons.calculate;
  if (text.contains('geograf')) return Icons.public;
  if (text.contains('hist')) return Icons.account_balance;
  if (text.contains('ingl')) return Icons.translate;
  if (text.contains('ci\u00eanc')) return Icons.science;
  return Icons.menu_book;
}

class _QuizPickerScreenState extends State<QuizPickerScreen> {
  List<QuizSummary>? _quizzes;
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
      final quizzes = await widget.api.fetchQuizzes();
      if (!mounted) return;
      setState(() {
        _quizzes = quizzes;
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

  void _open(QuizSummary quiz) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => QuizScreen(api: widget.api, slug: quiz.slug),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.studentName;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Escolha um assunto'),
        actions: [
          const ThemeModeButton(),
          IconButton(
            key: const Key('recommendations-action'),
            tooltip: 'Recomendações de estudo',
            icon: const Icon(Icons.lightbulb_outline),
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(
                builder: (_) => RecommendationsScreen(api: widget.api),
              ),
            ),
          ),
          if (widget.onLogout != null)
            IconButton(
              key: const Key('logout-button'),
              tooltip: name == null
                  ? 'Sair da conta'
                  : 'Sair da conta de $name',
              icon: const Icon(Icons.logout),
              onPressed: widget.onLogout,
            ),
        ],
      ),
      body: CenteredContent(
        child: _loading
            ? const LoadingView()
            : _error != null
            ? ErrorView(message: _error!, onRetry: _load)
            : _buildList(_quizzes!),
      ),
    );
  }

  Widget _buildList(List<QuizSummary> quizzes) {
    if (quizzes.isEmpty) {
      return const Center(child: Text('Nenhum simulado disponível.'));
    }
    final name = widget.studentName;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          name == null
              ? 'Qual assunto você quer praticar?'
              : 'Olá, $name! Qual assunto você quer praticar?',
          style: Theme.of(context).textTheme.titleMedium,
        ),
        const SizedBox(height: 12),
        for (final quiz in quizzes)
          Card(
            key: Key('quiz-card-${quiz.slug}'),
            child: ListTile(
              minVerticalPadding: 14,
              leading: Icon(_iconFor(quiz), size: 32),
              title: Text(quiz.title),
              subtitle: Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    for (final topic in quiz.topics) TopicTag(name: topic),
                    Text(plural(quiz.questionCount, 'questão', 'questões')),
                  ],
                ),
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => _open(quiz),
            ),
          ),
      ],
    );
  }
}
