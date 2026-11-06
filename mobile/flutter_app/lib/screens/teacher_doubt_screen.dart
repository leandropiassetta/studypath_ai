import 'package:flutter/material.dart';

import '../models/doubt.dart';
import '../services/api_client.dart';
import '../utils/plural.dart';
import '../widgets/centered_content.dart';
import '../widgets/theme_mode_button.dart';
import '../widgets/topic_tag.dart';

/// A teacher reads the whole context of a doubt and writes the answer.
class TeacherDoubtScreen extends StatefulWidget {
  const TeacherDoubtScreen({super.key, required this.api, required this.doubt});

  final ApiClient api;
  final TeacherDoubt doubt;

  @override
  State<TeacherDoubtScreen> createState() => _TeacherDoubtScreenState();
}

class _TeacherDoubtScreenState extends State<TeacherDoubtScreen> {
  final _answer = TextEditingController();
  bool _sending = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _answer.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _answer.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    if (_sending || _answer.text.trim().isEmpty) return;
    setState(() {
      _sending = true;
      _error = null;
    });
    try {
      await widget.api.answerDoubt(widget.doubt.id, _answer.text);
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _error = e.statusCode == 409
            ? 'Outro professor já respondeu esta dúvida.'
            : e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = widget.doubt;
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Responder dúvida'),
        actions: const [ThemeModeButton()],
      ),
      body: CenteredContent(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Wrap(
              spacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                TopicTag(name: d.topic),
                Text(d.studentFirstName, style: theme.textTheme.titleSmall),
                Text(
                  d.isAnswered
                      ? 'respondida'
                      : 'aguardando há ${plural(d.waitingMinutes, 'minuto', 'minutos')}',
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(d.statement, style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            for (final o in d.options)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Text(
                  '${o.key}) ${o.text}'
                  '${o.key == d.selectedOption ? '   ← marcada pelo aluno' : ''}'
                  '${o.key == d.correctOption ? '   ✓ correta' : ''}',
                  style: o.key == d.correctOption
                      ? const TextStyle(fontWeight: FontWeight.w600)
                      : null,
                ),
              ),
            const SizedBox(height: 12),
            if (d.message != null)
              _Section(
                key: const Key('student-note'),
                title: 'O que o aluno escreveu',
                child: Text('“${d.message}”'),
              ),
            if (d.misconception != null)
              _Section(
                key: const Key('misconception'),
                title: 'Equívoco provável',
                child: Text(d.misconception!),
              ),
            _Section(
              key: const Key('ai-said'),
              title: d.aiHints.isEmpty
                  ? 'A IA ainda não deu dicas'
                  : 'O que a IA já disse (${plural(d.aiHints.length, 'dica', 'dicas')})',
              child: d.aiHints.isEmpty
                  ? const SizedBox.shrink()
                  : Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (final h in d.aiHints)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Text(
                              '${h.level}. ${h.text}'
                              '${h.isAi ? '' : '  (dica padrão)'}',
                            ),
                          ),
                      ],
                    ),
            ),
            _Section(
              title: 'Solução de referência',
              child: Text(d.referenceExplanation),
            ),
            const SizedBox(height: 8),
            if (d.isAnswered)
              _Section(
                key: const Key('given-answer'),
                title: 'Sua resposta',
                child: Text(d.answer ?? ''),
              )
            else ...[
              TextField(
                key: const Key('answer-field'),
                controller: _answer,
                enabled: !_sending,
                maxLength: 2000,
                minLines: 4,
                maxLines: 10,
                decoration: const InputDecoration(
                  labelText: 'Sua resposta para o aluno',
                  alignLabelWithHint: true,
                  border: OutlineInputBorder(),
                ),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    _error!,
                    key: const Key('answer-error'),
                    style: TextStyle(color: theme.colorScheme.error),
                  ),
                ),
              const SizedBox(height: 8),
              FilledButton.icon(
                key: const Key('send-answer'),
                onPressed: _sending || _answer.text.trim().isEmpty
                    ? null
                    : _send,
                icon: _sending
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.send),
                label: const Text('Enviar resposta'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Section extends StatelessWidget {
  const _Section({super.key, required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(
              header: true,
              child: Text(title, style: Theme.of(context).textTheme.titleSmall),
            ),
            const SizedBox(height: 6),
            child,
          ],
        ),
      ),
    ),
  );
}
