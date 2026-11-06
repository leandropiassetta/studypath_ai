import 'package:studypath_app/main.dart';
import 'package:studypath_app/models/auth_session.dart';
import 'package:studypath_app/services/api_client.dart';
import 'package:studypath_app/services/session_controller.dart';

AuthSession fakeSession({String id = 's', String name = 'Aluna Teste'}) =>
    AuthSession(
      token: 't' * 43,
      expiresAt: DateTime.utc(2099),
      student: Student(id: id, name: name, email: 'aluna@teste.dev'),
    );

/// The whole app, already logged in (the quiz is the first screen).
StudyPathApp loggedInApp(ApiClient api) => StudyPathApp(
  api: api,
  session: SessionController(api, initial: fakeSession()),
);
