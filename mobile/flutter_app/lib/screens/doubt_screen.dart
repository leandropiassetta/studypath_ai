import 'dart:async';

import 'package:flutter/material.dart';

import '../models/doubt.dart';
import '../models/quiz.dart';
import '../services/api_client.dart';
import '../utils/plural.dart';
import '../widgets/async_body.dart';
import '../widgets/centered_content.dart';
import '../widgets/theme_mode_button.dart';
import '../widgets/topic_tag.dart';

/// "Tirar dúvida": graded AI hints for a question the student got wrong, then (if needed) a
/// human teacher. The server decides the order of the hints and who may answer, never the app.
class DoubtScreen extends StatefulWidget {
  const DoubtScreen({
    super.key,
    required this.api,
    required this.attemptId,
    required this.question,
    required this.selectedOption,
    this.pollInterval = const Duration(seconds: 8),
  });

  final ApiClient api;
  final String attemptId;
  final Question question;
  final String selectedOption;

  /// How often a waiting doubt checks whether the teacher already answered.
  final Duration pollInterval;

  @override
  State<DoubtScreen> createState() => _DoubtScreenState();
}

class _DoubtScreenState extends State<DoubtScreen> {
  final _message = TextEditingController();
  Doubt? _doubt;
  Timer? _poll;
  bool _loading = true;
  bool _asking = false;
  bool _calling = false;
  String? _error;
  String? _notice;

  @override
  void initState() {
    super.initState();
    _open();
  }

  @override
  void dispose() {
    _poll?.cancel();
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
        _message.text = doubt.message ?? '';
        _loading = false;
      });
      _syncPolling();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loading = false;
      });
    }
  }

  /// Polls only while the doubt waits for a teacher, and stops by itself once it is answered.
  void _syncPolling() {
    final waiting = _doubt?.isWaiting ?? false;
    if (waiting && _poll == null) {
      _poll = Timer.periodic(widget.pollInterval, (_) => _refresh());
    } else if (!waiting) {
      _poll?.cancel();
      _poll = null;
    }
  }

  Future<void> _refresh() async {
    final doubt = _doubt;
    if (doubt == null) return;
    try {
      final fresh = await widget.api.getDoubt(doubt.id);
      if (!mounted) return;
      setState(() => _doubt = fresh);
      _syncPolling();
    } on ApiException {
      // A failed refresh keeps what is on screen; the next tick tries again.
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
      var current = doubt;
      if (doubt.hints.isEmpty && _message.text.trim().isNotEmpty) {
        // The note can be added until the first hint; re-opening is idempotent on the server.
        current = await widget.api.openDoubt(
          attemptId: widget.attemptId,
          questionId: widget.question.id,
          message: _message.text,
        );
      }
      final result = await widget.api.nextHint(current.id);
      if (!mounted) return;
      setState(() {
        _doubt = current.copyWith(
          hintsUsed: result.hintsUsed,
          hints: [...current.hints, result.hint],
        );
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

  Future<void> _callTeacher() async {
    final doubt = _doubt;
    if (doubt == null || _calling) return;
    setState(() {
      _calling = true;
      _error = null;
    });
    try {
      final updated = await widget.api.requestTeacher(doubt.id);
      if (!mounted) return;
      setState(() {
        _doubt = updated;
        _calling = false;
      });
      _syncPolling();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _calling = false;
        _error = e.message;
      });
    }
  }

  Future<void> _feedback({bool? ai, bool? teacher}) async {
    final doubt = _doubt;
    if (doubt == null) return;
    try {
      final updated = await widget.api.sendFeedback(
        doubt.id,
        aiHelpful: ai,
        teacherHelpful: teacher,
      );
      if (!mounted) return;
      setState(() => _doubt = updated);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
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
        if (doubt.hints.isEmpty && !doubt.isWaiting && !doubt.isAnswered)
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
        for (final hint in doubt.hints)
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
        if (doubt.hintsUsed > 0)
          _FeedbackRow(
            keyPrefix: 'ai-helpful',
            question: 'As dicas da IA ajudaram?',
            value: doubt.aiHelpful,
            onChanged: (v) => _feedback(ai: v),
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
        if (doubt.hasMoreHints && !doubt.isAnswered)
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
        else if (!doubt.hasMoreHints)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              'Você viu todas as ${plural(doubt.maxHints, 'dica', 'dicas')} desta dúvida.',
              key: const Key('all-hints-used'),
            ),
          ),
        const SizedBox(height: 16),
        _buildTeacherSection(doubt),
      ],
    );
  }

  Widget _buildTeacherSection(Doubt doubt) {
    final theme = Theme.of(context);
    if (doubt.isAnswered) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Card(
            key: const Key('teacher-answer'),
            color: theme.colorScheme.tertiaryContainer,
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Semantics(
                container: true,
                label: 'Resposta do professor',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Resposta do professor',
                      style: theme.textTheme.titleSmall,
                    ),
                    const SizedBox(height: 6),
                    Text(doubt.teacherAnswer ?? ''),
                  ],
                ),
              ),
            ),
          ),
          _FeedbackRow(
            keyPrefix: 'teacher-helpful',
            question: 'A resposta do professor ajudou?',
            value: doubt.teacherHelpful,
            onChanged: (v) => _feedback(teacher: v),
          ),
        ],
      );
    }
    if (doubt.isWaiting) {
      return Card(
        key: const Key('teacher-waiting'),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              const Icon(Icons.hourglass_top),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Sua dúvida está com um professor. Resposta em cerca de '
                  '${doubt.etaMinutes} min. Esta tela se atualiza sozinha.',
                ),
              ),
            ],
          ),
        ),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        OutlinedButton.icon(
          key: const Key('call-teacher'),
          onPressed: _calling ? null : _callTeacher,
          icon: _calling
              ? const SizedBox(
                  height: 18,
                  width: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.support_agent),
          label: const Text('Chamar um professor'),
        ),
        const SizedBox(height: 4),
        Text(
          'Um professor responde em cerca de ${doubt.etaMinutes} min.',
          style: theme.textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _FeedbackRow extends StatelessWidget {
  const _FeedbackRow({
    required this.keyPrefix,
    required this.question,
    required this.value,
    required this.onChanged,
  });

  final String keyPrefix;
  final String question;
  final bool? value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: Wrap(
      spacing: 8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Text(question),
        ChoiceChip(
          key: Key('$keyPrefix-yes'),
          label: const Text('Sim'),
          selected: value == true,
          onSelected: (_) => onChanged(true),
        ),
        ChoiceChip(
          key: Key('$keyPrefix-no'),
          label: const Text('Não'),
          selected: value == false,
          onSelected: (_) => onChanged(false),
        ),
      ],
    ),
  );
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
                    label: Text(
                      hint.isAi
                          ? 'IA'
                          : hint.level >= 3
                          ? 'Solução'
                          : 'Dica padrão',
                    ),
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
