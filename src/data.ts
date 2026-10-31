import { seedFamily, type FamilyData } from "./family/model";
import { seedStrategy, type StrategyState, type GoalExtension } from "./strategy/model";
import { seedOperations, type OperationsState, type Repeat, type Category, type Priority } from "./operations/model";
export type Member = { id: string; name: string; role: string; avatar: number; color: string };
export type Task = { id: string; title: string; person: string; due: string; done: boolean;
  description?: string; category?: Category; dueDate?: string; assigneeIds?: string[];
  householdId?: string; priority?: Priority; repeat?: Repeat; completedDates?: string[];
  archived?: boolean; };
export type Goal = { id: string; title: string; meta: string; progress: number; image: string; color: "green" | "blue"; } & GoalExtension;
export type PlanEvent = { id: string; time: string; title: string; note: string; attendees: string[]; color: string; done?: boolean;
  date?: string; endTime?: string; location?: string; householdId?: string; category?: Category;
  status?: "ACTIVE" | "CANCELLED"; };
export type Upcoming = { id: string; when: string; title: string; detail: string; icon: string; tint: string };
export type AppData = { members: Member[]; family: FamilyData; operations: OperationsState; strategy: StrategyState; tasks: Task[]; goals: Goal[]; events: PlanEvent[]; upcoming: Upcoming[]; notificationsSeen: boolean };
export const seed: AppData = {
  family: seedFamily,
  operations: seedOperations,
  strategy: seedStrategy,
  members: [
    { id: "alex", name: "Alex", role: "Owner", avatar: 12, color: "#cee6ff" },
    { id: "jamie", name: "Jamie", role: "Co-parent", avatar: 47, color: "#ffe0db" },
    { id: "sam", name: "Sam", role: "Teen · 16", avatar: 13, color: "#f2d5c5" },
    { id: "ella", name: "Ella", role: "Child · 10", avatar: 44, color: "#ffead0" },
    { id: "noah", name: "Noah", role: "Child · 7", avatar: 11, color: "#e1f4ce" }
  ],
  tasks: [
    { id: "t1", title: "Take out bins", person: "Noah", due: "Today", done: true },
    { id: "t2", title: "Grocery shopping", person: "Jamie", due: "Today", done: true },
    { id: "t3", title: "Help with dinner", person: "Ella", due: "Today", done: true },
    { id: "t4", title: "Clean bedrooms", person: "Sam, Ella", due: "Tomorrow", done: false }
  ],
  goals: [
    { id: "g1", title: "Europe Family Trip", meta: "Family adventure", progress: 75, objectiveId: "objective-trip", status: "ACTIVE", ownerIds: ["alex","jamie"], history: [], image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=170&h=170&fit=crop", color: "green" },
    { id: "g2", title: "Build Emergency Fund", meta: "Family security", progress: 40, objectiveId: "objective-reserve", status: "ACTIVE", ownerIds: ["alex","jamie"], history: [], image: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=170&h=170&fit=crop", color: "blue" },
    { id: "g3", title: "Healthier Habits", meta: "Family wellness", progress: 60, objectiveId: "objective-habits", status: "ACTIVE", ownerIds: ["alex","jamie"], history: [], image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=170&h=170&fit=crop", color: "green" }
  ],
  events: [
    { id: "e1", time: "7:00 AM", title: "Morning routine", note: "Kids", attendees: ["sam", "ella", "noah"], color: "#b6dc62", done: true },
    { id: "e2", time: "8:30 AM", title: "School drop-off", note: "Sam, Ella, Noah", attendees: ["ella", "noah"], color: "#cfe0e7" },
    { id: "e3", time: "12:00 PM", title: "Team lunch", note: "Alex", attendees: ["alex"], color: "#d7c6fa" },
    { id: "e4", time: "3:00 PM", title: "Pick up Ella", note: "School", attendees: ["ella"], color: "#ffd5bc" },
    { id: "e5", time: "5:00 PM", title: "Soccer training", note: "Sam", attendees: ["sam"], color: "#75d0fa" },
    { id: "e6", time: "7:00 PM", title: "Family meeting", note: "Weekly review", attendees: ["alex", "jamie", "sam"], color: "#ff97b8" }
  ],
  upcoming: [
    { id: "u1", when: "Tomorrow", title: "School science camp", detail: "Ella · Permission form required", icon: "school", tint: "purple" },
    { id: "u2", when: "In 2 days", title: "Dentist appointment", detail: "Noah · 3:00 PM", icon: "dental", tint: "blue" },
    { id: "u3", when: "Friday", title: "Date night", detail: "Alex & Jamie · 7:00 PM", icon: "heart", tint: "rose" },
    { id: "u4", when: "Saturday", title: "Soccer game", detail: "Sam · 10:00 AM", icon: "soccer", tint: "green" },
    { id: "u5", when: "Sunday", title: "Family bike ride", detail: "John Forrest National Park", icon: "tree", tint: "green" }
  ],
  notificationsSeen: false
};
export const navItems = [
  { label: "Dashboard", icon: "dashboard", phase: 1 },
  { label: "Family", icon: "family", phase: 2 },
  { label: "Plan", icon: "plan", phase: 3 },
  { label: "Goals", icon: "goals", phase: 4 },
  { label: "Decisions", icon: "decisions", phase: 5 },
  { label: "Calendar", icon: "calendar", phase: 3 },
  { label: "Responsibilities", icon: "tasks", phase: 3 },
  { label: "Routines", icon: "routines", phase: 3 },
  { label: "Memory", icon: "memory", phase: 6 },
  { label: "Legacy", icon: "legacy", phase: 6 },
  { label: "Insights", icon: "insights", phase: 7 },
  { label: "Search", icon: "search", phase: 8 }
];
export const navigationDescriptions: Record<string, string> = {
  Family: "Member profiles, relationships, household structure and role-aware spaces.",
  Plan: "Your family's shared planning workspace, capacity and coordination.",
  Goals: "Vision, missions, milestones and meaningful family progress.",
  Decisions: "Discuss options, compare scenarios and document shared decisions.",
  Calendar: "A unified view of appointments, shared time and upcoming plans.",
  Responsibilities: "Coordinate family tasks, assignments and household workload.",
  Routines: "Build calm and repeatable daily and weekly family rhythms.",
  Memory: "A private timeline of your family's favourite moments and milestones.",
  Legacy: "Keep stories, traditions, family wisdom and meaningful artifacts safe.",
  Insights: "Explainable family signals, opportunities and advisory recommendations.",
  Search: "Find authorised family information across your family workspace.",
  Notifications: "Important family updates and reminders in one place.",
  Messages: "Family communication and decision conversations.",
  Settings: "Family preferences, visibility, privacy and governance.",
  "Personal Mode": "A private view of your own tasks, goals and information."
};
