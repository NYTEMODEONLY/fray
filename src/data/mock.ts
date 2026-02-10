import { Message, Room, Space, User } from "../types";

export const me: User = {
  id: "u_me",
  name: "nyte",
  avatar: "N",
  status: "online",
  roles: ["Founder", "Admin"]
};

export const users: User[] = [
  me,
  {
    id: "u_ava",
    name: "ava",
    avatar: "A",
    status: "online",
    roles: ["Moderator"]
  },
  {
    id: "u_sol",
    name: "sol",
    avatar: "S",
    status: "idle",
    roles: ["Member"]
  },
  {
    id: "u_lynx",
    name: "lynx",
    avatar: "L",
    status: "dnd",
    roles: ["Member"]
  },
  {
    id: "u_rae",
    name: "rae",
    avatar: "R",
    status: "offline",
    roles: ["Artist"]
  }
];

export const spaces: Space[] = [
  { id: "s_fray", name: "Fray HQ", icon: "F" },
  { id: "s_synth", name: "Synth Club", icon: "S" }
];

export const rooms: Room[] = [
  {
    id: "r_welcome",
    spaceId: "s_fray",
    name: "welcome",
    type: "text",
    category: "start-here",
    topic: "Start here. Say hi and get set up.",
    unreadCount: 0,
    isWelcome: true
  },
  {
    id: "r_announcements",
    spaceId: "s_fray",
    name: "announcements",
    type: "text",
    category: "start-here",
    topic: "Release notes, updates, and milestones.",
    unreadCount: 2
  },
  {
    id: "r_general",
    spaceId: "s_fray",
    name: "general",
    type: "text",
    category: "community",
    topic: "Main lounge for Fray builders.",
    unreadCount: 5
  },
  {
    id: "r_build",
    spaceId: "s_fray",
    name: "build-log",
    type: "text",
    category: "community",
    topic: "Daily logs, commits, and progress.",
    unreadCount: 0
  },
  {
    id: "r_voice",
    spaceId: "s_fray",
    name: "hangout",
    type: "voice",
    category: "voice",
    topic: "Drop in voice channel",
    unreadCount: 0
  },
  {
    id: "r_video",
    spaceId: "s_fray",
    name: "war-room",
    type: "video",
    category: "voice",
    topic: "Video + screen share",
    unreadCount: 0
  },
  {
    id: "r_synth_general",
    spaceId: "s_synth",
    name: "general",
    type: "text",
    category: "studio",
    topic: "Synth club chatter.",
    unreadCount: 1
  },
  {
    id: "r_dm_ava",
    spaceId: "s_fray",
    name: "@ava",
    type: "dm",
    topic: "Direct message",
    unreadCount: 0
  },
  {
    id: "r_dm_sol",
    spaceId: "s_fray",
    name: "@sol",
    type: "dm",
    topic: "Direct message",
    unreadCount: 1
  }
];

const now = Date.now();

export const messages: Message[] = [
  {
    id: "m1",
    roomId: "r_welcome",
    authorId: "u_ava",
    body: "Welcome to **Fray**. Drop your role and what you are building.",
    timestamp: now - 1000 * 60 * 60 * 3,
    reactions: []
  },
  {
    id: "m2",
    roomId: "r_welcome",
    authorId: "u_me",
    body: "Hey everyone. We are sprinting on the MVP. Check #build-log for updates.",
    timestamp: now - 1000 * 60 * 60 * 2.6,
    reactions: [
      { emoji: "🔥", userIds: ["u_sol", "u_ava"] }
    ]
  },
  {
    id: "m3",
    roomId: "r_announcements",
    authorId: "u_me",
    body: "Roadmap: text chat, MatrixRTC voice, and screen share first. No ads. No fluff.",
    timestamp: now - 1000 * 60 * 60 * 5,
    reactions: [],
    pinned: true
  },
  {
    id: "m4",
    roomId: "r_general",
    authorId: "u_sol",
    body: "Anyone testing the dark theme? The new gradients look sick.",
    timestamp: now - 1000 * 60 * 20,
    reactions: []
  },
  {
    id: "m5",
    roomId: "r_general",
    authorId: "u_lynx",
    body: "@nyte the onboarding flow is clean. Maybe add a short tooltip for the welcome channel.",
    timestamp: now - 1000 * 60 * 12,
    reactions: [
      { emoji: "✅", userIds: ["u_me"] }
    ]
  },
  {
    id: "m6",
    roomId: "r_general",
    authorId: "u_me",
    body: "Noted. Also adding ||spoiler|| support and quick reactions.",
    timestamp: now - 1000 * 60 * 8,
    reactions: []
  },
  {
    id: "m7",
    roomId: "r_build",
    authorId: "u_me",
    body: "Build log: shipped layout, mentions, reactions, and message pinning.",
    timestamp: now - 1000 * 60 * 90,
    reactions: []
  },
  {
    id: "m8",
    roomId: "r_dm_ava",
    authorId: "u_ava",
    body: "Can we surface a smart unread feed like Discord but cleaner?",
    timestamp: now - 1000 * 60 * 45,
    reactions: []
  },
  {
    id: "m9",
    roomId: "r_dm_ava",
    authorId: "u_me",
    body: "Yes. I am building a focused inbox with mentions and pins.",
    timestamp: now - 1000 * 60 * 42,
    reactions: []
  },
  {
    id: "m10",
    roomId: "r_synth_general",
    authorId: "u_rae",
    body: "We should bridge to Matrix rooms for workshops.",
    timestamp: now - 1000 * 60 * 200,
    reactions: []
  }
];
