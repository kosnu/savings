export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          id: bigint
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: bigint
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: bigint
          name?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"]
