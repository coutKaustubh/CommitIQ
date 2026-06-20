from django.test import SimpleTestCase

from .analysis_services import (
    _is_sensitive_file,
    _patch_has_n_plus_one,
    _should_analyze_file,
    analyze_file_changes,
    build_ai_summary,
)
from .suggestion_playbook import (
    get_suggestion,
    resolve_n_plus_one_query,
    resolve_sensitive_query,
)


def _fc(file_path, patch, additions=2, deletions=0):
    return type(
        "FC",
        (),
        {
            "file_path": file_path,
            "patch": patch,
            "additions": additions,
            "deletions": deletions,
        },
    )()


class AnalysisSkipListTests(SimpleTestCase):
    def test_skips_markdown_entirely(self):
        patch = "+for x in items:\n+    y = Model.objects.get(id=x)\n"
        fc = _fc("docs/celery.md", patch, additions=707)
        self.assertFalse(_should_analyze_file(fc.file_path))
        self.assertEqual(analyze_file_changes([fc]), [])

    def test_skips_images_and_lockfiles(self):
        self.assertFalse(_should_analyze_file("assets/logo.png"))
        self.assertFalse(_should_analyze_file("package-lock.json"))
        self.assertFalse(_should_analyze_file("frontend/node_modules/foo/index.js"))

    def test_analyzes_python_and_javascript_source(self):
        self.assertTrue(_should_analyze_file("backend/views.py"))
        self.assertTrue(_should_analyze_file("src/routes/user.js"))
        self.assertTrue(_should_analyze_file("api/server.ts"))


class NPlusOneRuleTests(SimpleTestCase):
    def test_detects_django_n_plus_one(self):
        patch = (
            "+for item in cart_items:\n"
            "+    product = Product.objects.get(id=item.id)\n"
        )
        found, needle = _patch_has_n_plus_one(patch, "checkout/views.py")
        self.assertTrue(found)
        self.assertEqual(needle, "objects.get(")

    def test_detects_express_sequelize_n_plus_one(self):
        patch = (
            "+for (const order of orders) {\n"
            "+  const user = await User.findByPk(order.userId);\n"
            "+}\n"
        )
        found, needle = _patch_has_n_plus_one(patch, "routes/orders.js")
        self.assertTrue(found)
        self.assertEqual(needle, ".findByPk(")

    def test_ignores_dict_get_in_python_parser(self):
        patch = "+for key in data:\n+    value = data.get(key)\n"
        found, _ = _patch_has_n_plus_one(patch, "utils/parser.py")
        self.assertFalse(found)

    def test_ignores_string_literals_and_comprehensions(self):
        """Real false positive: whole file has 'for x in' comps + 'objects.get' in a string."""
        patch = (
            "+    if any(lower.endswith(ext) for ext in SKIP_EXTENSIONS):\n"
            "+        pass\n"
            '+    hint = "calls objects.get() in a loop"\n'
            "+def _fc(file_path, patch, additions=2, deletions=0):\n"
            "+    return type(\n"
            '+        "+for item in cart_items:\\n"\n'
            '+        "+    product = Product.objects.get(id=item.id)\\n"\n'
        )
        found, _ = _patch_has_n_plus_one(patch, "backend/repos/analysis_services.py")
        self.assertFalse(found)

    def test_detects_real_n_plus_one_in_loop_body(self):
        patch = (
            "+for item in cart_items:\n"
            "+    product = Product.objects.get(id=item.id)\n"
        )
        issues = analyze_file_changes([_fc("checkout/views.py", patch)])
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0]["title"], "Possible N+1 Query")
        self.assertEqual(issues[0]["query"], "n_plus_one.django_objects_get")
        self.assertIn("filter(id__in=", issues[0]["suggestion"])

    def test_large_change_still_skips_markdown(self):
        fc = _fc("README.md", "+line\n" * 600, additions=600, deletions=0)
        self.assertEqual(analyze_file_changes([fc]), [])


class SensitiveFileRuleTests(SimpleTestCase):
    def test_detects_env_and_secrets_across_stacks(self):
        self.assertTrue(_is_sensitive_file(".env"))
        self.assertTrue(_is_sensitive_file("backend/.env.production"))
        self.assertTrue(_is_sensitive_file("config/secrets.json"))
        self.assertTrue(_is_sensitive_file("deploy/terraform.tfvars"))

    def test_detects_framework_config_not_only_django(self):
        self.assertTrue(_is_sensitive_file("src/main/resources/application-prod.yml"))
        self.assertTrue(_is_sensitive_file("appsettings.production.json"))
        self.assertTrue(_is_sensitive_file("config/database.yml"))
        self.assertTrue(_is_sensitive_file("core/settings.py"))

    def test_detects_keys_and_ssh_paths(self):
        self.assertTrue(_is_sensitive_file("certs/server.pem"))
        self.assertTrue(_is_sensitive_file("home/.ssh/id_rsa"))

    def test_ordinary_source_not_sensitive(self):
        self.assertFalse(_is_sensitive_file("src/utils/helpers.js"))
        self.assertFalse(_is_sensitive_file("internal/handlers/user.go"))
        self.assertFalse(_is_sensitive_file("lib/models/product.rb"))

    def test_sensitive_file_emits_warning_issue(self):
        fc = _fc("config/.env", "+API_KEY=secret\n", additions=1)
        issues = analyze_file_changes([fc])
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0]["title"], "Sensitive file modified")
        self.assertEqual(issues[0]["severity"], "WARNING")
        self.assertEqual(issues[0]["query"], "sensitive_file.env")
        self.assertIn("rotate", issues[0]["suggestion"].lower())


class PlaybookSuggestionTests(SimpleTestCase):
    def test_resolve_django_n_plus_one_query(self):
        self.assertEqual(
            resolve_n_plus_one_query("views.py", "objects.get("),
            "n_plus_one.django_objects_get",
        )

    def test_resolve_sequelize_query(self):
        self.assertEqual(
            resolve_n_plus_one_query("routes.js", ".findByPk("),
            "n_plus_one.sequelize_find_by_pk",
        )

    def test_django_playbook_has_batch_fix(self):
        meta = get_suggestion("n_plus_one.django_objects_get", file_path="checkout/views.py")
        self.assertIn("filter(id__in=", meta["suggestion"])
        self.assertEqual(meta["severity"], "CRITICAL")

    def test_sensitive_env_playbook(self):
        meta = get_suggestion("sensitive_file.env", file_path="config/.env")
        self.assertIn(".env.example", meta["suggestion"])
        self.assertIn("config/.env", meta["problem_hint"])

    def test_large_change_formats_line_counts(self):
        meta = get_suggestion(
            "large_change",
            file_path="backend/views.py",
            context={"total_lines": 612, "additions": 400, "deletions": 212},
        )
        self.assertIn("612", meta["problem_hint"])
        self.assertIn("400", meta["problem_hint"])

    def test_unknown_query_falls_back_to_family_generic(self):
        meta = get_suggestion("n_plus_one.nonexistent_variant")
        generic = get_suggestion("n_plus_one.generic")
        self.assertEqual(meta["suggestion"], generic["suggestion"])

    def test_sequelize_issue_uses_playbook_via_analyze(self):
        patch = (
            "+for (const order of orders) {\n"
            "+  const user = await User.findByPk(order.userId);\n"
            "+}\n"
        )
        issues = analyze_file_changes([_fc("routes/orders.js", patch)])
        self.assertEqual(issues[0]["query"], "n_plus_one.sequelize_find_by_pk")
        self.assertIn("findAll", issues[0]["suggestion"])

    def test_build_ai_summary_mentions_playbook(self):
        issues = [
            {
                "severity": "CRITICAL",
                "title": "Possible N+1 Query",
                "query": "n_plus_one.django_objects_get",
                "file_path": "a.py",
                "description": "loop",
            }
        ]
        text = build_ai_summary(issues, "fix queries")
        self.assertIn("playbook", text.lower())
        self.assertIn("fix queries", text)


class RagServicesTests(SimpleTestCase):
    def test_recursive_chunk_small_text_single_chunk(self):
        from .rag_services import recursive_chunk_text

        text = "hello world"
        self.assertEqual(recursive_chunk_text(text, chunk_size=800), [text])

    def test_recursive_chunk_large_text_multiple(self):
        from .rag_services import recursive_chunk_text

        text = "line\n" * 400
        chunks = recursive_chunk_text(text, chunk_size=100, chunk_overlap=10)
        self.assertGreater(len(chunks), 1)
        self.assertTrue(all(len(c) <= 100 for c in chunks))

    def test_build_rag_prompt_includes_question(self):
        from .rag_services import build_rag_prompt

        prompt = build_rag_prompt("owner/repo", [], "Where is N+1?")
        self.assertIn("owner/repo", prompt)
        self.assertIn("Where is N+1?", prompt)
