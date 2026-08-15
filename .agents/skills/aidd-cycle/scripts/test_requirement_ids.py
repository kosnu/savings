from __future__ import annotations

import unittest
import time

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

    def test_nested_blockquote_fence_does_not_close_outer_fence(self) -> None:
        document = """> ```markdown
>> ```
> FR-9: コード例内の機能要件
> ```

FR-1: 実際の機能要件
"""

        self.assertEqual(extract_requirement_mentions(document), ["FR-1"])

    def test_list_continuation_does_not_cross_into_blockquote(self) -> None:
        document = """- list item

>     FR-9: 引用内のコード

FR-1: 実際の機能要件
"""

        self.assertEqual(extract_requirement_mentions(document), ["FR-1"])

    def test_five_space_list_padding_preserves_indented_code(self) -> None:
        document = """-     FR-9: リスト内のコード

FR-1: 実際の機能要件
"""

        self.assertEqual(extract_requirement_mentions(document), ["FR-1"])

    def test_backslash_escaped_delimiters_remain_visible(self) -> None:
        document = """\\`FR-1: 可視のbacktick本文\\`
\\<!-- FR-2: 可視のcomment風本文 -->
"""

        self.assertEqual(extract_requirement_mentions(document), ["FR-1", "FR-2"])

    def test_link_metadata_is_not_visible_requirement_content(self) -> None:
        document = """FR-1: 実際の機能要件
[visible](https://example.com/FR-9 "AC-9")

[reference]: https://example.com/FR-8 "AC-8"
[FR-2: 可視のリンク本文](https://example.com/NFR-9)
[visible][FR-7]

[FR-7]: /target
> [quoted-reference]: /NFR-8 "AC-7"
[multiline-reference]: /target
  "FR-6 hidden title"
[split-reference]:
  /NFR-6
  'AC-6 hidden title'
[wrapped-reference]: /target "hidden
AC-5 continued title"
[quoted-title](target "title ) FR-5 hidden")
![AC-4 hidden alt](/image.png)
![AC-3 collapsed alt][]

[AC-3 collapsed alt]: /image.png
"""

        self.assertEqual(extract_requirement_mentions(document), ["FR-1", "FR-2"])

    def test_unclosed_inline_links_are_masked_in_linear_time(self) -> None:
        document = "[visible](" * 10_000
        started = time.perf_counter()

        extract_requirement_mentions(document)

        self.assertLess(time.perf_counter() - started, 1.0)

    def test_nested_brackets_are_processed_in_linear_time(self) -> None:
        document = "[" * 20_000 + "x" + "]" * 20_000
        started = time.perf_counter()

        extract_requirement_mentions(document)

        self.assertLess(time.perf_counter() - started, 1.0)

    def test_unclosed_image_openers_and_links_are_processed_in_linear_time(self) -> None:
        document = "![" * 4_000 + "[x](u)" * 4_000
        started = time.perf_counter()

        extract_requirement_mentions(document)

        self.assertLess(time.perf_counter() - started, 1.0)

    def test_invalid_link_syntax_remains_visible(self) -> None:
        long_label = "x" * 1000
        document = f"""FR-1 visible
[foo]: /url "title" FR-9 visible
[visible](/my FR-8 visible)
[unresolved][AC-8]
[   ]: /FR-7
[{long_label}]: /AC-7
[ref]: /url
> "FR-6 visible"
[visible](

FR-5 visible)
"""

        self.assertEqual(
            extract_requirement_mentions(document),
            ["FR-1", "FR-5", "FR-6", "FR-7", "FR-8", "FR-9", "AC-7", "AC-8"],
        )

    def test_reference_definition_cannot_interrupt_a_paragraph(self) -> None:
        document = "継続本文\n[ref]: /FR-99\n"

        self.assertEqual(extract_requirement_mentions(document), ["FR-99"])

    def test_reference_definition_cannot_interrupt_a_lazy_list_paragraph(self) -> None:
        document = "- paragraph\n[ref]: /FR-99\n"

        self.assertEqual(extract_requirement_mentions(document), ["FR-99"])

    def test_reference_definition_cannot_interrupt_a_lazy_quote_paragraph(self) -> None:
        document = "> paragraph\n[ref]: /FR-99\n"

        self.assertEqual(extract_requirement_mentions(document), ["FR-99"])

    def test_reference_title_cannot_continue_in_a_sibling_list_item(self) -> None:
        document = '- [ref]: /url\n- "FR-99 visible"\n'

        self.assertEqual(extract_requirement_mentions(document), ["FR-99"])

    def test_nested_link_leaves_outer_destination_visible(self) -> None:
        document = "[outer [inner](x)](/FR-99)\n"

        self.assertEqual(extract_requirement_mentions(document), ["FR-99"])

    def test_shortcut_reference_link_deactivates_ancestor_link(self) -> None:
        document = "[inner]: /x\n\n[outer [inner]](/FR-99)\n"

        self.assertEqual(extract_requirement_mentions(document), ["FR-99"])

    def test_link_title_requires_separating_whitespace(self) -> None:
        document = '[x](<dest>"FR-99")\n[ref]: <dest>"AC-99"\n'

        self.assertEqual(extract_requirement_mentions(document), ["FR-99", "AC-99"])

    def test_link_destination_rejects_more_than_32_parenthesis_levels(self) -> None:
        destination = "(" * 33 + "FR-99" + ")" * 33
        document = f"[x]({destination})\n[ref]: {destination}\n"

        self.assertEqual(extract_requirement_mentions(document), ["FR-99"])

    def test_inline_link_escape_scan_is_linear(self) -> None:
        document = "[visible](" + "\\" * 20_000 + ") FR-1 visible"
        started = time.perf_counter()

        extract_requirement_mentions(document)

        self.assertLess(time.perf_counter() - started, 1.0)

    def test_unclosed_reference_titles_are_processed_in_linear_time(self) -> None:
        document = "\n".join("[x]: /url (" for _ in range(4_000))
        started = time.perf_counter()

        extract_requirement_mentions(document)

        self.assertLess(time.perf_counter() - started, 1.0)

    def test_autolink_line_does_not_end_multiline_code_span(self) -> None:
        document = """`code
<https://example.com/FR-9>
FR-8: コード内の根拠`

FR-1: 実際の機能要件
"""

        self.assertEqual(extract_requirement_mentions(document), ["FR-1"])

    def test_deep_blockquote_container_is_processed_without_recursion(self) -> None:
        document = "> " * 2000 + "FR-1: 深い引用でも可視。\n"

        self.assertEqual(extract_requirement_mentions(document), ["FR-1"])

    def test_tab_indented_code_is_hidden(self) -> None:
        document = """ \tFR-9: タブで4列インデントされたコード
FR-1: 実際の機能要件
"""

        self.assertEqual(extract_requirement_mentions(document), ["FR-1"])

    def test_blockquote_tab_uses_original_line_tab_stop(self) -> None:
        document = "> \tFR-1: 引用内で可視。\n"

        self.assertEqual(extract_requirement_mentions(document), ["FR-1"])

    def test_ten_digit_ordered_marker_does_not_end_code_span(self) -> None:
        document = """`open
1234567890. ordinary text
FR-9: コード内の根拠
close`
FR-1: 実際の機能要件
"""

        self.assertEqual(extract_requirement_mentions(document), ["FR-1"])

    def test_backslash_does_not_escape_code_span_closer(self) -> None:
        document = """`open
FR-9: コード内の根拠
\\`
FR-1: 実際の機能要件
"""

        self.assertEqual(extract_requirement_mentions(document), ["FR-1"])

    def test_multiline_code_span_stays_within_blockquote_container(self) -> None:
        document = """> `open
> FR-9: 引用内code spanの根拠
> close`
FR-1: 実際の機能要件
"""

        self.assertEqual(extract_requirement_mentions(document), ["FR-1"])

    def test_multiline_code_span_stays_within_list_item(self) -> None:
        document = """- `open
  FR-9: list内code spanの根拠
  close`
FR-1: 実際の機能要件
"""

        self.assertEqual(extract_requirement_mentions(document), ["FR-1"])

    def test_ordered_marker_above_one_does_not_interrupt_paragraph(self) -> None:
        document = """`open
2. ordinary paragraph
FR-9: code span内の根拠
close`
FR-1: 実際の機能要件
"""

        self.assertEqual(extract_requirement_mentions(document), ["FR-1"])

    def test_interleaved_list_blockquote_indented_code_is_hidden(self) -> None:
        document = """- >     FR-9: container内のコード
FR-1: 実際の機能要件
"""

        self.assertEqual(extract_requirement_mentions(document), ["FR-1"])

    def test_interleaved_list_blockquote_fence_is_hidden(self) -> None:
        document = """- > ```text
  > FR-9: container内のコード
  > ```
FR-1: 実際の機能要件
"""

        self.assertEqual(extract_requirement_mentions(document), ["FR-1"])

    def test_blockquote_lazy_continuation_stays_in_code_span(self) -> None:
        document = """> `open
FR-9: lazy continuation内の根拠
> close`
FR-1: 実際の機能要件
"""

        self.assertEqual(extract_requirement_mentions(document), ["FR-1"])

    def test_list_lazy_continuation_stays_in_code_span(self) -> None:
        document = """- `open
FR-9: lazy continuation内の根拠
  close`
FR-1: 実際の機能要件
"""

        self.assertEqual(extract_requirement_mentions(document), ["FR-1"])

    def test_ordered_marker_above_one_does_not_interrupt_list_paragraph(self) -> None:
        document = """- `open
  2. ordinary paragraph
  FR-9: code span内の根拠
  close`
FR-1: 実際の機能要件
"""

        self.assertEqual(extract_requirement_mentions(document), ["FR-1"])

    def test_indented_line_does_not_interrupt_open_code_span(self) -> None:
        for indentation in ("    ", "\t"):
            with self.subTest(indentation=repr(indentation)):
                document = (
                    "`open\n"
                    f"{indentation}FR-9: code span内の根拠\n"
                    "close`\n"
                    "FR-1: 実際の機能要件\n"
                )

                self.assertEqual(extract_requirement_mentions(document), ["FR-1"])

    def test_empty_list_marker_does_not_interrupt_open_code_span(self) -> None:
        for marker in ("- ", "1. "):
            with self.subTest(marker=marker):
                document = (
                    "`open\n"
                    f"{marker}\n"
                    "FR-9: code span内の根拠\n"
                    "close`\n"
                    "FR-1: 実際の機能要件\n"
                )

                self.assertEqual(extract_requirement_mentions(document), ["FR-1"])

    def test_extractors_ignore_html_comment_structure(self) -> None:
        document = """# Requirements

<!--
## 偽の機能要件

### FR-2: コメント内の機能要件
-->

## 機能要件

### FR-1: 実際の機能要件

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

    def test_unclosed_html_comment_masks_the_remaining_document(self) -> None:
        document = """# Requirements

## 機能要件

### FR-1: 実際の機能要件

<!--
## 偽の受け入れ条件

- AC-1: コメント内の受け入れ条件
"""

        self.assertEqual(list(extract_requirement_items(document)), ["FR-1"])
        self.assertEqual(extract_requirement_mentions(document), ["FR-1"])
        self.assertEqual(
            [section.heading for section in extract_level_two_sections(document)],
            ["機能要件"],
        )


if __name__ == "__main__":
    unittest.main()
