export type DummyUserRole = "admin" | "member";

export type DummyUserStatus = "active" | "inactive";

export type DummyUserLocation = {
  shared: boolean;
  city?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  updatedAt?: string;
};

export type DummyUser = {
  id: string;
  email: string;
  name: string;
  role: DummyUserRole;
  status: DummyUserStatus;
  location?: DummyUserLocation;
  createdAt: string;
};

const DUMMY_USERS: DummyUser[] = [
  {
    id: "dummy-tanuj-reddy",
    email: "tanujreddy004@gmail.com",
    name: "Tanuj Reddy",
    role: "admin",
    status: "active",
    createdAt: "2026-09-01T09:00:00.000Z",
    location: {
      shared: true,
      city: "Hyderabad",
      region: "Telangana",
      country: "India",
      latitude: 17.385044,
      longitude: 78.486671,
      updatedAt: "2026-09-14T08:00:00.000Z",
    },
  },
  {
    id: "dummy-goverdhan-reddy",
    email: "goverdhan.reddy@nexus.test",
    name: "Goverdhan Reddy Garudaiah",
    role: "member",
    status: "active",
    createdAt: "2026-09-01T09:15:00.000Z",
    location: {
      shared: false,
    },
  },
  {
    id: "dummy-pavan-teja",
    email: "pavan.teja@nexus.test",
    name: "Pavan teja T",
    role: "member",
    status: "active",
    createdAt: "2026-09-01T09:30:00.000Z",
    location: {
      shared: false,
    },
  },
  {
    id: "dummy-praveen-kumar",
    email: "praveen.kumar@nexus.test",
    name: "Praveen kumar",
    role: "member",
    status: "active",
    createdAt: "2026-09-01T09:45:00.000Z",
    location: {
      shared: false,
    },
  },
];

export function getDummyUsers(): DummyUser[] {
  return DUMMY_USERS.map((user) => ({
    ...user,
    location: user.location
      ? {
          ...user.location,
        }
      : undefined,
  }));
}

export function getDummyUserById(
  userId: string | null | undefined
): DummyUser | null {
  if (!userId) {
    return null;
  }

  return (
    DUMMY_USERS.find((user) => user.id === userId) ?? null
  );
}

export function getDummyUserByEmail(
  email: string | null | undefined
): DummyUser | null {
  if (!email) {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();

  return (
    DUMMY_USERS.find(
      (user) => user.email.toLowerCase() === normalizedEmail
    ) ?? null
  );
}

export function getDummyUserByName(
  name: string | null | undefined
): DummyUser | null {
  if (!name) {
    return null;
  }

  const normalizedName = name.trim().toLowerCase();

  return (
    DUMMY_USERS.find(
      (user) => user.name.toLowerCase() === normalizedName
    ) ?? null
  );
}

export function isDummyAdmin(
  user: DummyUser | null | undefined
): boolean {
  return user?.role === "admin";
}

export function canViewUserData(
  viewer: DummyUser | null | undefined,
  target: DummyUser | null | undefined
): boolean {
  if (!viewer || !target) {
    return false;
  }

  if (viewer.id === target.id) {
    return true;
  }

  return viewer.role === "admin";
}

export function canViewLocationData(
  viewer: DummyUser | null | undefined,
  target: DummyUser | null | undefined
): boolean {
  if (!viewer || !target) {
    return false;
  }

  if (!target.location?.shared) {
    return false;
  }

  return viewer.id === target.id || viewer.role === "admin";
}

export function getVisibleDummyUsers(
  viewer: DummyUser | null | undefined
): DummyUser[] {
  if (!viewer) {
    return [];
  }

  if (viewer.role === "admin") {
    return getDummyUsers();
  }

  return getDummyUsers().filter((user) => user.id === viewer.id);
}

export function getVisibleDummyLocation(
  viewer: DummyUser | null | undefined,
  target: DummyUser | null | undefined
): DummyUserLocation | null {
  if (!canViewLocationData(viewer, target)) {
    return null;
  }

  return target?.location ?? null;
}