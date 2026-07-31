export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export type Database = {
  graphql_public: {
    CompositeTypes: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
  }
  public: {
    CompositeTypes: {
      [_ in never]: never
    }
    Enums: {
      project_invite_status: "accepted" | "expired" | "pending" | "revoked"
      project_member_role: "admin" | "contributor" | "manager" | "viewer"
      task_type: "bug" | "feature" | "task"
    }
    Functions: {
      accept_project_invite: {
        Args: { p_token: string }
        Returns: {
          created_at: string
          project_id: string
          role: Database["public"]["Enums"]["project_member_role"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          isOneToOne: true
          isSetofReturn: false
          to: "project_members"
        }
      }
      assert_task_not_archived: {
        Args: { task_uuid: string }
        Returns: undefined
      }
      can_create_tasks: { Args: { project_uuid: string }; Returns: boolean }
      can_delete_tasks: { Args: { project_uuid: string }; Returns: boolean }
      can_edit_tasks: { Args: { project_uuid: string }; Returns: boolean }
      can_manage_board: { Args: { project_uuid: string }; Returns: boolean }
      can_manage_members: { Args: { project_uuid: string }; Returns: boolean }
      can_manage_project_settings: {
        Args: { project_uuid: string }
        Returns: boolean
      }
      can_view_project: { Args: { project_uuid: string }; Returns: boolean }
      cancel_sprint: {
        Args: { p_sprint_id: string }
        Returns: {
          board_id: string
          canceled_at: null | string
          closed_at: null | string
          committed_task_ids: string[]
          completed_task_ids: string[]
          created_at: string
          created_by: null | string
          ends_on: null | string
          goal: null | string
          id: string
          name: string
          project_id: string
          started_at: null | string
          starts_on: null | string
          state: string
        }
        SetofOptions: {
          from: "*"
          isOneToOne: true
          isSetofReturn: false
          to: "sprints"
        }
      }
      claim_project_invite: {
        Args: { p_token: string }
        Returns: {
          accepted_by: null | string
          claimed_by: null | string
          created_at: string
          email: string
          expires_at: null | string
          id: string
          invited_by: string
          project_id: string
          role: Database["public"]["Enums"]["project_member_role"]
          status: Database["public"]["Enums"]["project_invite_status"]
          token: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          isOneToOne: true
          isSetofReturn: false
          to: "project_invites"
        }
      }
      cleanup_notifications_for_user: { Args: never; Returns: undefined }
      close_sprint: {
        Args: {
          p_carryover_sprint_id?: string
          p_completed_task_ids: string[]
          p_sprint_id: string
        }
        Returns: {
          board_id: string
          canceled_at: null | string
          closed_at: null | string
          committed_task_ids: string[]
          completed_task_ids: string[]
          created_at: string
          created_by: null | string
          ends_on: null | string
          goal: null | string
          id: string
          name: string
          project_id: string
          started_at: null | string
          starts_on: null | string
          state: string
        }
        SetofOptions: {
          from: "*"
          isOneToOne: true
          isSetofReturn: false
          to: "sprints"
        }
      }
      confirm_project_invite: {
        Args: { p_invite_id: string; p_user_id: string }
        Returns: {
          created_at: string
          project_id: string
          role: Database["public"]["Enums"]["project_member_role"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          isOneToOne: true
          isSetofReturn: false
          to: "project_members"
        }
      }
      create_board_with_columns: {
        Args: { p_base_branch: string; p_name: string; p_project_id: string }
        Returns: {
          allowed_head_patterns: string[]
          base_branch: string
          created_at: string
          id: string
          name: string
          position: number
          project_id: string
        }
        SetofOptions: {
          from: "*"
          isOneToOne: true
          isSetofReturn: false
          to: "boards"
        }
      }
      create_notifications_for_assignment_change: {
        Args: {
          p_metadata: Json
          p_project_id: string
          p_recipient_id: string
          p_task_id: string
        }
        Returns: undefined
      }
      create_notifications_for_author_change: {
        Args: {
          p_metadata: Json
          p_project_id: string
          p_recipient_id: string
          p_task_id: string
        }
        Returns: undefined
      }
      create_notifications_for_mentions: {
        Args: {
          p_actor_name?: string
          p_comment_id?: string
          p_mentionee_ids: string[]
          p_source: string
          p_task_id: string
        }
        Returns: undefined
      }
      create_notifications_for_status_change: {
        Args: { p_metadata: Json; p_project_id: string; p_task_id: string }
        Returns: undefined
      }
      create_notifications_for_watchers: {
        Args: {
          p_exclude_recipient_ids?: string[]
          p_kind: string
          p_metadata: Json
          p_project_id: string
          p_task_id: string
        }
        Returns: undefined
      }
      create_task_notifications: {
        Args: { p_events: Json; p_project_id: string; p_task_id: string }
        Returns: undefined
      }
      get_project_invite_by_token: {
        Args: { p_token: string }
        Returns: {
          email: string
          expires_at: string
          id: string
          project_id: string
          project_name: string
          role: Database["public"]["Enums"]["project_member_role"]
          status: Database["public"]["Enums"]["project_invite_status"]
        }[]
      }
      has_project_role: {
        Args: {
          allowed: Database["public"]["Enums"]["project_member_role"][]
          project_uuid: string
        }
        Returns: boolean
      }
      is_project_member: { Args: { project_uuid: string }; Returns: boolean }
      is_project_owner: { Args: { project_uuid: string }; Returns: boolean }
      is_project_participant: {
        Args: { p_project_id: string; p_user_id: string }
        Returns: boolean
      }
      list_notifications_for_recipient: {
        Args: {
          p_extra_patterns?: string[]
          p_limit?: number
          p_matched_kinds?: string[]
          p_offset?: number
          p_project_id?: string
          p_q?: string
        }
        Returns: {
          created_at: string
          id: string
          kind: string
          metadata: Json
          project_id: string
          read_at: null | string
          recipient_id: string
          task_id: string
          task_key: string
          task_title: string
        }[]
        SetofOptions: {
          from: "*"
          isOneToOne: false
          isSetofReturn: true
          to: "notifications"
        }
      }
      mark_notifications_read: {
        Args: { p_notification_ids: string[] }
        Returns: undefined
      }
      mark_notifications_read_in_scope: {
        Args: { p_project_id?: string }
        Returns: undefined
      }
      notification_always_on_kinds: { Args: never; Returns: string[] }
      notification_kind_search_text: {
        Args: { p_kind: string }
        Returns: string
      }
      notification_search_document: {
        Args: {
          p_kind: string
          p_metadata: Json
          p_project_name: string
          p_task_key: string
          p_task_title: string
        }
        Returns: string
      }
      notification_watcher_kinds: { Args: never; Returns: string[] }
      project_member_role_of: {
        Args: { project_uuid: string }
        Returns: Database["public"]["Enums"]["project_member_role"]
      }
      reorder_board_columns: {
        Args: { p_board_id: string; p_column_ids: string[] }
        Returns: undefined
      }
      replace_task_labels: {
        Args: { p_label_ids: string[]; p_task_id: string }
        Returns: undefined
      }
      start_sprint: {
        Args: { p_ends_on: string; p_sprint_id: string; p_starts_on: string }
        Returns: {
          board_id: string
          canceled_at: null | string
          closed_at: null | string
          committed_task_ids: string[]
          completed_task_ids: string[]
          created_at: string
          created_by: null | string
          ends_on: null | string
          goal: null | string
          id: string
          name: string
          project_id: string
          started_at: null | string
          starts_on: null | string
          state: string
        }
        SetofOptions: {
          from: "*"
          isOneToOne: true
          isSetofReturn: false
          to: "sprints"
        }
      }
      task_is_archived: { Args: { task_uuid: string }; Returns: boolean }
    }
    Tables: {
      activity_log: {
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          project_id: string
          task_id: string
          user_id?: null | string
        }
        Relationships: [
          {
            columns: ["project_id"]
            foreignKeyName: "activity_log_project_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "projects"
          },
          {
            columns: ["task_id"]
            foreignKeyName: "activity_log_task_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "tasks"
          },
          {
            columns: ["user_id"]
            foreignKeyName: "activity_log_user_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "profiles"
          },
        ]
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          project_id: string
          task_id: string
          user_id: null | string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          project_id?: string
          task_id?: string
          user_id?: null | string
        }
      }
      board_columns: {
        Insert: {
          board_id: string
          created_at?: string
          id: string
          name: string
          position?: number
          project_id: string
        }
        Relationships: [
          {
            columns: ["board_id"]
            foreignKeyName: "board_columns_board_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "boards"
          },
          {
            columns: ["project_id"]
            foreignKeyName: "board_columns_project_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "projects"
          },
        ]
        Row: {
          board_id: string
          created_at: string
          id: string
          name: string
          position: number
          project_id: string
        }
        Update: {
          board_id?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          project_id?: string
        }
      }
      boards: {
        Insert: {
          allowed_head_patterns?: string[]
          base_branch?: string
          created_at?: string
          id?: string
          name: string
          position?: number
          project_id: string
        }
        Relationships: [
          {
            columns: ["project_id"]
            foreignKeyName: "boards_project_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "projects"
          },
        ]
        Row: {
          allowed_head_patterns: string[]
          base_branch: string
          created_at: string
          id: string
          name: string
          position: number
          project_id: string
        }
        Update: {
          allowed_head_patterns?: string[]
          base_branch?: string
          created_at?: string
          id?: string
          name?: string
          position?: number
          project_id?: string
        }
      }
      labels: {
        Insert: {
          color: string
          created_at?: string
          custom_color?: null | string
          id?: string
          name: string
          project_id: string
        }
        Relationships: [
          {
            columns: ["project_id"]
            foreignKeyName: "labels_project_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "projects"
          },
        ]
        Row: {
          color: string
          created_at: string
          custom_color: null | string
          id: string
          name: string
          project_id: string
        }
        Update: {
          color?: string
          created_at?: string
          custom_color?: null | string
          id?: string
          name?: string
          project_id?: string
        }
      }
      notifications: {
        Insert: {
          created_at?: string
          id?: string
          kind: string
          metadata?: Json
          project_id: string
          read_at?: null | string
          recipient_id: string
          task_id: string
          task_key: string
          task_title: string
        }
        Relationships: [
          {
            columns: ["project_id"]
            foreignKeyName: "notifications_project_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "projects"
          },
          {
            columns: ["recipient_id"]
            foreignKeyName: "notifications_recipient_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "profiles"
          },
          {
            columns: ["task_id"]
            foreignKeyName: "notifications_task_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "tasks"
          },
        ]
        Row: {
          created_at: string
          id: string
          kind: string
          metadata: Json
          project_id: string
          read_at: null | string
          recipient_id: string
          task_id: string
          task_key: string
          task_title: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          project_id?: string
          read_at?: null | string
          recipient_id?: string
          task_id?: string
          task_key?: string
          task_title?: string
        }
      }
      profiles: {
        Insert: {
          avatar_url?: null | string
          created_at?: string
          first_name?: null | string
          id: string
          last_name?: null | string
          updated_at?: string
          username?: null | string
        }
        Relationships: []
        Row: {
          avatar_url: null | string
          created_at: string
          first_name: null | string
          id: string
          last_name: null | string
          updated_at: string
          username: null | string
        }
        Update: {
          avatar_url?: null | string
          created_at?: string
          first_name?: null | string
          id?: string
          last_name?: null | string
          updated_at?: string
          username?: null | string
        }
      }
      project_invites: {
        Insert: {
          accepted_by?: null | string
          claimed_by?: null | string
          created_at?: string
          email: string
          expires_at?: null | string
          id?: string
          invited_by: string
          project_id: string
          role: Database["public"]["Enums"]["project_member_role"]
          status?: Database["public"]["Enums"]["project_invite_status"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            columns: ["accepted_by"]
            foreignKeyName: "project_invites_accepted_by_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "profiles"
          },
          {
            columns: ["claimed_by"]
            foreignKeyName: "project_invites_claimed_by_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "profiles"
          },
          {
            columns: ["invited_by"]
            foreignKeyName: "project_invites_invited_by_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "profiles"
          },
          {
            columns: ["project_id"]
            foreignKeyName: "project_invites_project_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "projects"
          },
        ]
        Row: {
          accepted_by: null | string
          claimed_by: null | string
          created_at: string
          email: string
          expires_at: null | string
          id: string
          invited_by: string
          project_id: string
          role: Database["public"]["Enums"]["project_member_role"]
          status: Database["public"]["Enums"]["project_invite_status"]
          token: string
          updated_at: string
        }
        Update: {
          accepted_by?: null | string
          claimed_by?: null | string
          created_at?: string
          email?: string
          expires_at?: null | string
          id?: string
          invited_by?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_member_role"]
          status?: Database["public"]["Enums"]["project_invite_status"]
          token?: string
          updated_at?: string
        }
      }
      project_members: {
        Insert: {
          created_at?: string
          project_id: string
          role: Database["public"]["Enums"]["project_member_role"]
          updated_at?: string
          user_id: string
        }
        Relationships: [
          {
            columns: ["project_id"]
            foreignKeyName: "project_members_project_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "projects"
          },
          {
            columns: ["user_id"]
            foreignKeyName: "project_members_user_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "profiles"
          },
        ]
        Row: {
          created_at: string
          project_id: string
          role: Database["public"]["Enums"]["project_member_role"]
          updated_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          project_id?: string
          role?: Database["public"]["Enums"]["project_member_role"]
          updated_at?: string
          user_id?: string
        }
      }
      project_task_sequences: {
        Insert: {
          next_val?: number
          project_id: string
        }
        Relationships: [
          {
            columns: ["project_id"]
            foreignKeyName: "project_task_sequences_project_id_fkey"
            isOneToOne: true
            referencedColumns: ["id"]
            referencedRelation: "projects"
          },
        ]
        Row: {
          next_val: number
          project_id: string
        }
        Update: {
          next_val?: number
          project_id?: string
        }
      }
      projects: {
        Insert: {
          created_at?: string
          description?: null | string
          github_default_branch?: null | string
          github_full_name?: null | string
          github_html_url?: null | string
          github_repo_id?: null | number
          id?: string
          is_private?: boolean
          name: string
          owner_id: string
          slug: string
          updated_at?: string
        }
        Relationships: []
        Row: {
          created_at: string
          description: null | string
          github_default_branch: null | string
          github_full_name: null | string
          github_html_url: null | string
          github_repo_id: null | number
          id: string
          is_private: boolean
          name: string
          owner_id: string
          slug: string
          updated_at: string
        }
        Update: {
          created_at?: string
          description?: null | string
          github_default_branch?: null | string
          github_full_name?: null | string
          github_html_url?: null | string
          github_repo_id?: null | number
          id?: string
          is_private?: boolean
          name?: string
          owner_id?: string
          slug?: string
          updated_at?: string
        }
      }
      sprint_events: {
        Insert: {
          actor_id?: null | string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          project_id: string
          sprint_id: string
          task_id?: null | string
        }
        Relationships: [
          {
            columns: ["actor_id"]
            foreignKeyName: "sprint_events_actor_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "profiles"
          },
          {
            columns: ["project_id"]
            foreignKeyName: "sprint_events_project_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "projects"
          },
          {
            columns: ["sprint_id"]
            foreignKeyName: "sprint_events_sprint_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "sprints"
          },
          {
            columns: ["task_id"]
            foreignKeyName: "sprint_events_task_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "tasks"
          },
        ]
        Row: {
          actor_id: null | string
          created_at: string
          event_type: string
          id: string
          payload: Json
          project_id: string
          sprint_id: string
          task_id: null | string
        }
        Update: {
          actor_id?: null | string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          project_id?: string
          sprint_id?: string
          task_id?: null | string
        }
      }
      sprints: {
        Insert: {
          board_id: string
          canceled_at?: null | string
          closed_at?: null | string
          committed_task_ids?: string[]
          completed_task_ids?: string[]
          created_at?: string
          created_by?: null | string
          ends_on?: null | string
          goal?: null | string
          id?: string
          name: string
          project_id: string
          started_at?: null | string
          starts_on?: null | string
          state: string
        }
        Relationships: [
          {
            columns: ["board_id"]
            foreignKeyName: "sprints_board_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "boards"
          },
          {
            columns: ["created_by"]
            foreignKeyName: "sprints_created_by_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "profiles"
          },
          {
            columns: ["project_id"]
            foreignKeyName: "sprints_project_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "projects"
          },
        ]
        Row: {
          board_id: string
          canceled_at: null | string
          closed_at: null | string
          committed_task_ids: string[]
          completed_task_ids: string[]
          created_at: string
          created_by: null | string
          ends_on: null | string
          goal: null | string
          id: string
          name: string
          project_id: string
          started_at: null | string
          starts_on: null | string
          state: string
        }
        Update: {
          board_id?: string
          canceled_at?: null | string
          closed_at?: null | string
          committed_task_ids?: string[]
          completed_task_ids?: string[]
          created_at?: string
          created_by?: null | string
          ends_on?: null | string
          goal?: null | string
          id?: string
          name?: string
          project_id?: string
          started_at?: null | string
          starts_on?: null | string
          state?: string
        }
      }
      task_comments: {
        Insert: {
          author_id?: null | string
          body: string
          created_at?: string
          id?: string
          project_id: string
          task_id: string
          updated_at?: string
        }
        Relationships: [
          {
            columns: ["author_id"]
            foreignKeyName: "task_comments_author_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "profiles"
          },
          {
            columns: ["project_id"]
            foreignKeyName: "task_comments_project_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "projects"
          },
          {
            columns: ["task_id"]
            foreignKeyName: "task_comments_task_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "tasks"
          },
        ]
        Row: {
          author_id: null | string
          body: string
          created_at: string
          id: string
          project_id: string
          task_id: string
          updated_at: string
        }
        Update: {
          author_id?: null | string
          body?: string
          created_at?: string
          id?: string
          project_id?: string
          task_id?: string
          updated_at?: string
        }
      }
      task_labels: {
        Insert: {
          label_id: string
          task_id: string
        }
        Relationships: [
          {
            columns: ["label_id"]
            foreignKeyName: "task_labels_label_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "labels"
          },
          {
            columns: ["task_id"]
            foreignKeyName: "task_labels_task_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "tasks"
          },
        ]
        Row: {
          label_id: string
          task_id: string
        }
        Update: {
          label_id?: string
          task_id?: string
        }
      }
      task_watchers: {
        Insert: {
          created_at?: string
          project_id: string
          task_id: string
          user_id: string
        }
        Relationships: [
          {
            columns: ["project_id"]
            foreignKeyName: "task_watchers_project_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "projects"
          },
          {
            columns: ["task_id"]
            foreignKeyName: "task_watchers_task_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "tasks"
          },
          {
            columns: ["task_id", "project_id"]
            foreignKeyName: "task_watchers_task_project_fkey"
            isOneToOne: false
            referencedColumns: ["id", "project_id"]
            referencedRelation: "tasks"
          },
          {
            columns: ["user_id"]
            foreignKeyName: "task_watchers_user_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "profiles"
          },
        ]
        Row: {
          created_at: string
          project_id: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          project_id?: string
          task_id?: string
          user_id?: string
        }
      }
      tasks: {
        Insert: {
          archived_at?: null | string
          archived_by?: null | string
          assignee_id?: null | string
          author_id?: null | string
          board_id: string
          branch_name?: null | string
          created_at?: string
          deadline?: null | string
          description?: null | string
          id?: string
          position?: number
          pr_number?: null | number
          pr_state?: null | string
          pr_url?: null | string
          priority?: null | string
          project_id: string
          sprint_id?: null | string
          sprint_position?: null | number
          status: string
          task_key: string
          task_type?: Database["public"]["Enums"]["task_type"]
          title: string
        }
        Relationships: [
          {
            columns: ["archived_by"]
            foreignKeyName: "tasks_archived_by_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "profiles"
          },
          {
            columns: ["assignee_id"]
            foreignKeyName: "tasks_assignee_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "profiles"
          },
          {
            columns: ["author_id"]
            foreignKeyName: "tasks_author_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "profiles"
          },
          {
            columns: ["board_id"]
            foreignKeyName: "tasks_board_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "boards"
          },
          {
            columns: ["project_id"]
            foreignKeyName: "tasks_project_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "projects"
          },
          {
            columns: ["sprint_id"]
            foreignKeyName: "tasks_sprint_id_fkey"
            isOneToOne: false
            referencedColumns: ["id"]
            referencedRelation: "sprints"
          },
        ]
        Row: {
          archived_at: null | string
          archived_by: null | string
          assignee_id: null | string
          author_id: null | string
          board_id: string
          branch_name: null | string
          created_at: string
          deadline: null | string
          description: null | string
          id: string
          position: number
          pr_number: null | number
          pr_state: null | string
          pr_url: null | string
          priority: null | string
          project_id: string
          sprint_id: null | string
          sprint_position: null | number
          status: string
          task_key: string
          task_type: Database["public"]["Enums"]["task_type"]
          title: string
        }
        Update: {
          archived_at?: null | string
          archived_by?: null | string
          assignee_id?: null | string
          author_id?: null | string
          board_id?: string
          branch_name?: null | string
          created_at?: string
          deadline?: null | string
          description?: null | string
          id?: string
          position?: number
          pr_number?: null | number
          pr_state?: null | string
          pr_url?: null | string
          priority?: null | string
          project_id?: string
          sprint_id?: null | string
          sprint_position?: null | number
          status?: string
          task_key?: string
          task_type?: Database["public"]["Enums"]["task_type"]
          title?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
  }
}

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type Json =
  | boolean
  | Json[]
  | null
  | number
  | string
  | { [key: string]: Json | undefined }

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      project_invite_status: ["pending", "accepted", "expired", "revoked"],
      project_member_role: ["admin", "manager", "contributor", "viewer"],
      task_type: ["task", "bug", "feature"],
    },
  },
} as const

