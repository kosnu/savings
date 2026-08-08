from __future__ import annotations

import unittest

from requirement_ids import (
    extract_level_two_sections,
    extract_requirement_items,
    extract_requirement_mentions,
)


class RequirementIdsTest(unittest.TestCase):
    def test_extractors_ignore_fenced_markdown_structure(self) -> None:
        document = """# Requirements

## 機能要件

### FR-1: 実際の機能要件

````markdown
## 偽の機能要件

### FR-2: コード例内の機能要件
````

~~~markdown
## 偽の受け入れ条件

- AC-2: コード例内の受け入れ条件
~~~

## 受け入れ条件

- AC-1: 実際の受け入れ条件
"""

        self.assertEqual(
            list(extract_requirement_items(document)),
            ["FR-1", "AC-1"],
        )
        self.assertEqual(
            extract_requirement_mentions(document),
            ["FR-1", "AC-1"],
        )
        self.assertEqual(
            [section.heading for section in extract_level_two_sections(document)],
            ["機能要件", "受け入れ条件"],
        )

    def test_unclosed_fence_masks_the_remaining_document(self) -> None:
        document = """# Requirements

````markdown
## 機能要件

### FR-1: コード例内の機能要件
"""

        self.assertEqual(extract_requirement_items(document), {})
        self.assertEqual(extract_requirement_mentions(document), [])
        self.assertEqual(extract_level_two_sections(document), [])


if __name__ == "__main__":
    unittest.main()
