export type RootStackParamList = {
  Tabs: undefined;
  UserDetail: { id: string; category?: string };
};

export type TabParamList = {
  Leaderboard: { category?: string } | undefined;
  Awards: undefined;
  Athletes: undefined;
};
