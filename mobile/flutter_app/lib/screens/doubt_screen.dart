import 'package:flutter/material.dart';

import '../models/doubt.dart';
import '../models/quiz.dart';
import '../services/api_client.dart';
import '../utils/plural.dart';
import '../widgets/async_body.dart';
import '../widgets/centered_content.dart';
import '../widgets/theme_mode_button.dart';
import '../widgets/topic_tag.dart';

/// "Tirar dúvida": graded AI hints for a question the student got wrong.
/// The server decides the order (hint 1, hint 2, then the full solution), never the app.
class DoubtScreen extends StatefulWidget {
  const DoubtScreen({
    super.key,
    required this.api,
    required this.attemptId,
    required this.question,
    required this.selectedOption,
  });

  final ApiClient api;
  final String attemptId;
  final Question question;
  final String selectedOption;

  @override
  State<DoubtScreen> createState() => _DoubtScreenState();
}

class _DoubtScreenState extends State<DoubtScreen> {
  final _message = TextEditingController();
  Doubt? _doubt;
  final List<DoubtHint> _hints = [];
  bool _loading = true;
  bool _asking = false;
  String? _error;
  String? _notice;

  @override
  void initState() {
    super.initState();
    _open();
  }

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _open() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final doubt = await widget.api.openDoubt(
        attemptId: widget.attemptId,
        questionId: widget.question.id,
      );
      if (!mounted) return;
      setState(() {
        _doubt = doubt;
        _hints
          ..clear()
          ..addAll(doubt.hints);
        _message.text = doubt.message ?? '';
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

  Future<void> _askHint() async {
    final doubt = _doubt;
    if (doubt == null || _asking) return;
    setState(() {
      _asking = true;
      _error = null;
    });
    try {
      // The optional note is sent with the first request only, when the doubt is (re)opened.
      var current = doubt;
      if (_hints.isEmpty && _message.text.trim().isNotEmpty) {
        // Re-open is idempotent on the server; the note only applies when the doubt is created.
        current = await widget.api.openDoubt(
          attemptId: widget.attemptId,
          questionId: widget.question.id,
          message: _message.text,
        );
      }
      final result = await widget.api.nextHint(current.id);
      if (!mounted) return;
      setState(() {
        _doubt = Doubt(
          id: current.id,
          status: current.status,
          message: current.message,
          hintsUsed: result.hintsUsed,
          maxHints: current.maxHints,
          hints: const [],
        );
        _hints.add(result.hint);
        _notice = result.notice;
        _asking = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _asking = false;
        _error = e.message;
      });
    }
  }

  String _buttonLabel(Doubt doubt) {
    final next = doubt.hintsUsed + 1;
    if (next >= doubt.maxHints) return 'Ver a solução completa';
    return next == 1 ? 'Preciso de uma dica' : 'Preciso de mais uma dica';
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Tirar dúvida'),
      actions: const [ThemeModeButton()],
    ),
    body: CenteredContent(
      child: _loading
          ? const LoadingView()
          : _doubt == null
          ? ErrorView(message: _error ?? 'Erro inesperado.', onRetry: _open)
          : _buildContent(_doubt!),
    ),
  );

  Widget _buildContent(Doubt doubt) {
    final theme = Theme.of(context);
    final q = widget.question;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (q.topicName != null)
          Align(
            alignment: Alignment.centerLeft,
            child: TopicTag(name: q.topicName!),
          ),
        const SizedBox(height: 8),
        Text(q.statement, style: theme.textTheme.titleMedium),
        const SizedBox(height: 4),
        Text('Você marcou a alternativa ${widget.selectedOption}.'),
        const SizedBox(height: 16),
        if (_hints.isEmpty)
          TextField(
            key: const Key('doubt-message'),
            controller: _message,
            enabled: !_asking,
            maxLength: 300,
            minLines: 1,
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'O que você não entendeu? (opcional)',
              border: OutlineInputBorder(),
            ),
          ),
        for (final hint in _hints)
          _HintCard(
            key: Key('hint-${hint.level}'),
            hint: hint,
            total: doubt.maxHints,
          ),
        if (_notice != null)
          Padding(
            padding: const EdgeInsets.only(top: 4, bottom: 8),
            child: Text(
              _notice!,
              key: const Key('hint-notice'),
              style: theme.textTheme.bodySmall,
            ),
          ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              _error!,
              key: const Key('doubt-error'),
              style: TextStyle(color: theme.colorScheme.error),
            ),
          ),
        const SizedBox(height: 8),
        if (doubt.hasMoreHints)
          FilledButton.icon(
            key: const Key('ask-hint'),
            onPressed: _asking ? null : _askHint,
            icon: _asking
                ? const SizedBox(
                    height: 18,
                    width: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.lightbulb_outline),
            label: Text(
              _error != null ? 'Tentar de novo' : _buttonLabel(doubt),
            ),
          )
        else
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              'Você viu todas as ${plural(doubt.maxHints, 'dica', 'dicas')} desta dúvida.',
              key: const Key('all-hints-used'),
            ),
          ),
      ],
    );
  }
}

class _HintCard extends StatelessWidget {
  const _HintCard({super.key, required this.hint, required this.total});

  final DoubtHint hint;
  final int total;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isSolution = hint.level == total;
    return Semantics(
      container: true,
      label: isSolution ? 'Solução completa' : 'Dica ${hint.level} de $total',
      child: Card(
        margin: const EdgeInsets.only(bottom: 8),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    isSolution ? 'Solução' : 'Dica ${hint.level} de $total',
                    style: theme.textTheme.titleSmall,
                  ),
                  Chip(
                    label: Text(hint.isAi ? 'IA' : 'Dica padrão'),
                    visualDensity: VisualDensity.compact,
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(hint.text),
            ],
          ),
        ),
      ),
    );
  }
}
