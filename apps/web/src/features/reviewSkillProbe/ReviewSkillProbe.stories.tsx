import type { Meta, StoryObj } from "@storybook/react-vite"

import { ReviewSkillProbe } from "./ReviewSkillProbe"

const meta = {
  title: "Review/SkillProbe",
  component: ReviewSkillProbe,
  tags: ["autodocs", "browser-test"],
} satisfies Meta<typeof ReviewSkillProbe>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
