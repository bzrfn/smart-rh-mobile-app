const HEADERLESS_ROUTES = new Set(['Home', 'AdminDashboard']);

export function screenSafeAreaEdges(authenticated: boolean, routeName: string) {
  return authenticated && !HEADERLESS_ROUTES.has(routeName)
    ? (['left', 'right', 'bottom'] as const)
    : (['top', 'left', 'right', 'bottom'] as const);
}

export function moduleHeaderOptions(backgroundColor: string) {
  return {
    headerTransparent: false,
    headerLargeTitle: false,
    headerShadowVisible: false,
    headerStyle: { backgroundColor },
  };
}
