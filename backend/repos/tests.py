from django.test import SimpleTestCase

from .analysis_services import (
    _is_python_source,
    _patch_has_orm_n_plus_one,
    analyze_file_changes,
)


class NPlusOneRuleTests(SimpleTestCase):
    def test_skips_markdown_with_for_and_dict_get_in_examples(self):
        patch = (
            "+for file in diff_files:\n"
            '+    additions = file.get("additions", 0)\n'
        )
        fc = type(
            "FC",
            (),
            {
                "file_path": "Diagrams and Concepts/celery.md",
                "patch": patch,
                "additions": 2,
                "deletions": 0,
            },
        )()
        self.assertFalse(_is_python_source(fc.file_path))
        self.assertEqual(analyze_file_changes([fc]), [])

    def test_detects_orm_get_inside_loop_in_python(self):
        patch = (
            "+for item in cart_items:\n"
            "+    product = Product.objects.get(id=item.id)\n"
        )
        self.assertTrue(_patch_has_orm_n_plus_one(patch))
        fc = type(
            "FC",
            (),
            {
                "file_path": "checkout/views.py",
                "patch": patch,
                "additions": 2,
                "deletions": 0,
            },
        )()
        issues = analyze_file_changes([fc])
        self.assertEqual(len(issues), 1)
        self.assertEqual(issues[0]["severity"], "CRITICAL")
        self.assertEqual(issues[0]["title"], "Possible N+1 Query")

    def test_ignores_dict_get_without_objects_get(self):
        patch = (
            "+for key in data:\n"
            '+    value = data.get(key, "")\n'
        )
        self.assertFalse(_patch_has_orm_n_plus_one(patch))
