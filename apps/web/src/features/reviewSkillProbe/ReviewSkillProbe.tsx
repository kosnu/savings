import { Button, Text } from "@radix-ui/themes"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

interface ProbeData {
  budget: number | null
  spent: number | null
  recordedAt: string | null
}

export function ReviewSkillProbe() {
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState("")
  const query = useQuery({
    queryKey: ["review-skill-probe", new Date().getMonth()],
    queryFn: async () => {
      const response = await fetch("/api/review-skill-probe")
      const data: ProbeData = await response.json()
      return data
    },
  })
  const remaining = (query.data?.budget ?? 0) - (query.data?.spent ?? 0)
  const dateLabel = new Date(query.data?.recordedAt ?? "").toLocaleDateString()

  const save = async () => {
    queryClient.setQueryData(["review-skill-probe"], {
      ...query.data,
      spent: Number(amount),
    })
  }

  if (query.isPending) return null
  if (query.isError) return <Text>Unknown</Text>

  return (
    <div style={{ margin: "13px", padding: "37px", color: "#ff0000" }}>
      <h1>Review Skill Probe</h1>
      <Text size="9" weight="bold">
        {remaining}
      </Text>
      <Text>{dateLabel}</Text>
      <input
        placeholder="Amount"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
      />
      <Button color="red" variant="solid" onClick={() => void save()}>
        Save
      </Button>
      <QuickEdit />
    </div>
  )
}

function QuickEdit() {
  const [note, setNote] = useState("")

  return (
    <form onSubmit={(event) => event.preventDefault()}>
      <input value={note} onChange={(event) => setNote(event.target.value)} />
      <Button type="submit">Update</Button>
    </form>
  )
}
