export type NotificationCategory =
  | "upcoming_class"
  | "new_homework"
  | "homework_deadline"
  | "teacher_comment"
  | "weekend_mock"
  | "membership"
  | "sponsored_pass"
  | "weekly_report"
  | "announcement";

export type NotificationItem = {
  id: number;
  category: NotificationCategory;
  title: string;
  message: string;
  actionUrl: string | null;
  priority: "normal" | "important";
  status: "unread" | "read" | "archived";
  createdAt: string;
  readAt: string | null;
};

export type NotificationPreferences = {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  upcomingClasses: boolean;
  newHomework: boolean;
  homeworkDeadlines: boolean;
  teacherComments: boolean;
  weekendMock: boolean;
  membership: boolean;
  sponsoredPass: boolean;
  weeklyReport: boolean;
  announcements: boolean;
  quietStart: string;
  quietEnd: string;
  timezone: string;
};

export type NotificationDelivery = {
  id: number;
  notificationId: number;
  userEmail: string;
  title: string;
  channel: "email";
  status: "queued" | "sending" | "sent" | "delivered" | "opened" | "failed" | "skipped" | "configuration_required";
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  openedAt: string | null;
};

export type NotificationCenterSnapshot = {
  notifications: NotificationItem[];
  unreadCount: number;
  preferences: NotificationPreferences;
  deliveries: NotificationDelivery[];
  emailConfigured: boolean;
};

export type CommunicationSnapshot = {
  stats: { total: number; unread: number; queued: number; sent: number; opened: number; failed: number };
  deliveries: NotificationDelivery[];
  announcements: Array<{ id: number; title: string; message: string; audienceType: string; audienceValue: string | null; recipientCount: number; createdBy: string; sentAt: string }>;
  students: Array<{ email: string; label: string }>;
  cohorts: Array<{ id: number; name: string; memberCount: number }>;
  emailConfigured: boolean;
};

export const defaultNotificationPreferences: NotificationPreferences = {
  inAppEnabled: true,
  emailEnabled: true,
  upcomingClasses: true,
  newHomework: true,
  homeworkDeadlines: true,
  teacherComments: true,
  weekendMock: true,
  membership: true,
  sponsoredPass: true,
  weeklyReport: true,
  announcements: true,
  quietStart: "22:00",
  quietEnd: "08:00",
  timezone: "Asia/Almaty",
};
