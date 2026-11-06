import 'dart:async';

import 'package:flutter/material.dart';

import '../models/doubt.dart';
import '../services/api_client.dart';
import '../utils/plural.dart';
import '../widgets/async_body.dart';
import '../widgets/centered_content.dart';
import '../widgets/theme_mode_button.dart';
import '../widgets/topic_tag.dart';
import 'teacher_doubt_screen.dart';

/// Home of a teacher account: the doubts waiting for an answer, oldest first.
class TeacherQueueScreen extends StatefulWidget {
  const TeacherQueueScreen({
    super.key,
    required this.api,
    this.teacherName,
    this.onLogout,
    this.refreshInterval = const Duration(seconds: 10),
  });

  final ApiClient api;
  final String? teacherName;
  final Future<void> Function()? onLogout;

  /// How often the waiting list refreshes by itself.
  final Duration refreshInterval;

  @override
  State<TeacherQueueScreen> createState() => _TeacherQueueScreenState();
}

class _TeacherQueueScreenState extends State<TeacherQueueScreen> {
  List<TeacherDoubt> _items = const [];
  bool _answered = false;
  bool _loading = true;
  String? _error;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(widget.refreshInterval, (_) {
      if (!_answered) _load(silent: true);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final items = await widget.api.fetchTeacherQueue(answered: _answered);
      if (!mounted) return;
      setState(() {
        _items = items;
        _loading = false;
        _error = null;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      // A failed silent refresh keeps the list that is already on screen.
      if (!silent) {
        setState(() {
          _error = e.message;
          _loading = false;
        });
      }
    }
  }

  Future<void> _open(TeacherDoubt doubt) async {
    final answered = await Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => TeacherDoubtScreen(api: widget.api, doubt: doubt),
      ),
    );
    if (answered == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Resposta enviada ao aluno.')),
      );
    }
    if (mounted) await _load(silent: true);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('Fila de dúvidas'),
      actions: [
        const ThemeModeButton(),
        IconButton(
          key: const Key('refresh-queue'),
          tooltip: 'Atualizar a fila',
          icon: const Icon(Icons.refresh),
          onPressed: () => _load(),
        ),
        if (widget.onLogout != null)
          IconButton(
            key: const Key('logout-button'),
            tooltip: widget.teacherName == null
                ? 'Sair da conta'
                : 'Sair da conta de ${widget.teacherName}',
            icon: const Icon(Icons.logout),
            onPressed: () => widget.onLogout?.call(),
          ),
      ],
    ),
    body: CenteredContent(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: SegmentedButton<bool>(
              key: const Key('queue-mode'),
              segments: const [
                ButtonSegment(value: false, label: Text('Aguardando')),
                ButtonSegment(value: true, label: Text('Respondidas por mim')),
              ],
              selected: {_answered},
              onSelectionChanged: (s) {
                setState(() => _answered = s.first);
                _load();
              },
            ),
          ),
          Expanded(
            child: _loading
                ? const LoadingView()
                : _error != null
                ? ErrorView(message: _error!, onRetry: _load)
                : _buildList(),
          ),
        ],
      ),
    ),
  );

  Widget _buildList() {
    if (_items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Text(
            _answered
                ? 'Você ainda não respondeu nenhuma dúvida.'
                : 'Nenhuma dúvida aguardando. Quando um aluno chamar um '
                      'professor, ela aparece aqui.',
            key: const Key('queue-empty'),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: () => _load(silent: true),
      child: ListView.builder(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: _items.length,
        itemBuilder: (context, i) {
          final d = _items[i];
          return Card(
            child: ListTile(
              key: Key('doubt-${d.id}'),
              onTap: () => _open(d),
              title: Text(
                d.statement,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              subtitle: Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    TopicTag(name: d.topic),
                    Text(d.studentFirstName),
                    Text(
                      d.isAnswered
                          ? 'respondida'
                          : 'aguardando há ${plural(d.waitingMinutes, 'minuto', 'minutos')}',
                    ),
                    if (d.slaBreached && !d.isAnswered)
                      Text(
                        'Prazo vencido',
                        key: const Key('sla-breached'),
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    if (d.hintsUsed > 0)
                      Text('IA deu ${plural(d.hintsUsed, 'dica', 'dicas')}'),
                  ],
                ),
              ),
              trailing: const Icon(Icons.chevron_right),
            ),
          );
        },
      ),
    );
  }
}
