import type { Meta, StoryObj } from "@storybook/react-vite"

import { AccountActionCallback } from "./AccountActionCallback"

const meta = {
  title: "Features/Profile/AccountActionCallback",
  component: AccountActionCallback,
  tags: ["autodocs"],
} satisfies Meta<typeof AccountActionCallback>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = { args: { completion: Promise.resolve("retry") } }
export const Reactivated: Story = { args: { completion: Promise.resolve("reactivate") } }
export const Loading: Story = { args: { completion: new Promise(() => {}) } }
// 描画後に失敗させ、Story読込時の未処理rejectionを作らない。
export const Error: Story = {
  args: { completion: Promise.resolve("retry") },
  render: () => (
    <AccountActionCallback
      completion={
        new Promise((_, reject) =>
          setTimeout(() => reject(new globalThis.Error("Synthetic account action failure")), 0),
        )
      }
    />
  ),
}
