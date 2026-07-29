# Auto-Unwatch when the user is neither Author nor Assignee

When Author is transferred away or Assignee is cleared/reassigned, remove that user's Watch only if they are not also the remaining Author or Assignee. Manual Watchers who never held those roles keep their Watch. This reverses the MVP rule that reassignment left the previous Assignee watching forever, so inbox volume tracks people who still have a stake (or an explicit Watch).

**Rejected:** always Unwatch on losing either role even if the other remains; Unwatch manual Watchers when anyone else's roles change; notify the removed Assignee/Author with a “you were removed” row (clear Assignee still creates no Notification).
