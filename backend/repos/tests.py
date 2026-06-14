from django.test import SimpleTestCase

from .analysis_services import (
    _patch_has_n_plus_one,
    _should_analyze_file,
    analyze_file_changes,
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

    def test_large_change_still_skips_markdown(self):
        fc = _fc("README.md", "+line\n" * 600, additions=600, deletions=0)
        self.assertEqual(analyze_file_changes([fc]), [])
